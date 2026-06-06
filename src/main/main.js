const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
// Safe auto-updater initialization
let autoUpdater;
try {
  // Only use auto-updater if packaged
  if (app.isPackaged) {
    autoUpdater = require('electron-updater').autoUpdater;
  } else {
    // Dummy object for dev mode to prevent crashes
    autoUpdater = {
      on: () => { },
      checkForUpdates: () => { },
      downloadUpdate: () => { },
      quitAndInstall: () => { },
      autoDownload: false,
      autoInstallOnAppQuit: false
    };
  }
} catch (err) {
  console.error('Failed to initialize auto-updater:', err);
  autoUpdater = { on: () => { }, checkForUpdates: () => { } };
}

const path = require('path');
const fs = require('fs').promises;
const chokidar = require('chokidar');
const Store = require('electron-store');

// Secure storage for auth tokens
const store = new Store({
  encryptionKey: 'externai-secure-key-change-in-production',
  name: 'auth'
});

// Load node-pty for terminal support
let pty;
try {
  pty = require('node-pty');
  console.log('✅ Terminal support enabled');
} catch (error) {
  console.error('❌ node-pty load error:', error.message);
  console.warn('Terminal features will be disabled.');
  console.warn('Run: npx @electron/rebuild');
  pty = null;
}

let mainWindow;
let terminals = new Map();
let terminalBuffers = new Map(); // Store terminal output for AI access
let fileWatchers = new Map();
let outputChannels = new Map(); // Store output from different sources

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, '../../assets/icon.png'),
    ...(process.platform === 'darwin' ? {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 10, y: 10 },
    } : {
      titleBarStyle: 'default',
    }),
  });

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const isDev = process.env.NODE_ENV === 'development';

    // GA4 domains needed:
    //  - script:  googletagmanager.com (loader) + google-analytics.com + ssl.google-analytics.com + analytics.google.com
    //  - connect: all of the above + region1.google-analytics.com + stats.g.doubleclick.net (event collection)
    const gaScriptSrc = 'https://www.googletagmanager.com https://www.google-analytics.com https://ssl.google-analytics.com https://analytics.google.com';
    const gaConnectSrc = 'https://www.google-analytics.com https://ssl.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://stats.g.doubleclick.net https://*.analytics.google.com https://*.googletagmanager.com';
    const firebaseSrc = 'https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.firebaseio.com https://firestore.googleapis.com https://firebasestorage.googleapis.com https://*.cloudfunctions.net https://*.a.run.app https://firebase.googleapis.com https://firebaseinstallations.googleapis.com';

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': isDev ? [
          // Development — relaxed for Vite HMR + eval (Monaco needs unsafe-eval)
          `default-src 'self'; ` +
          `script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* https://cdn.jsdelivr.net ${gaScriptSrc}; ` +
          `style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; ` +
          `style-src-elem 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; ` +
          `img-src 'self' data: https:; ` +
          `font-src 'self' data: https://cdn.jsdelivr.net https://fonts.gstatic.com; ` +
          `connect-src 'self' http://localhost:* ws://localhost:* https://cdn.jsdelivr.net ${gaConnectSrc} ${firebaseSrc} https://*.up.railway.app; ` +
          `worker-src 'self' blob: https://cdn.jsdelivr.net;`
        ] : [
          // Production — strict, no eval
          `default-src 'self'; ` +
          `script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net ${gaScriptSrc}; ` +
          `style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; ` +
          `style-src-elem 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; ` +
          `img-src 'self' data: https:; ` +
          `font-src 'self' data: https://cdn.jsdelivr.net https://fonts.gstatic.com; ` +
          `connect-src 'self' https://cdn.jsdelivr.net ${gaConnectSrc} ${firebaseSrc} https://*.up.railway.app; ` +
          `worker-src 'self' blob: https://cdn.jsdelivr.net;`
        ]
      }
    });
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    // Try different ports in order of preference
    const ports = [3000, 3001, 3002, 5173];
    let loaded = false;

    for (const port of ports) {
      try {
        await mainWindow.loadURL(`http://localhost:${port}`);
        console.log(`✅ Loaded from http://localhost:${port}`);
        loaded = true;
        break;
      } catch (err) {
        console.log(`⚠️ Port ${port} not available, trying next...`);
      }
    }

    if (!loaded) {
      console.error('❌ Could not connect to dev server on any port');
    }

    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../build/index.html'));
  }

  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New File',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('menu-new-file'),
        },
        {
          label: 'Open File',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
            });
            if (!result.canceled) {
              mainWindow.webContents.send('menu-open-file', result.filePaths[0]);
            }
          },
        },
        {
          label: 'Open Folder',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory', 'createDirectory'],
            });
            if (!result.canceled) {
              mainWindow.webContents.send('menu-open-folder', result.filePaths[0]);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu-save'),
        },
        {
          label: 'Save As',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow.webContents.send('menu-save-as'),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Terminal',
          accelerator: 'CmdOrCtrl+`',
          click: () => mainWindow.webContents.send('menu-toggle-terminal'),
        },
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => mainWindow.webContents.send('menu-toggle-sidebar'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Terminal',
      submenu: [
        {
          label: 'New Terminal',
          accelerator: 'CmdOrCtrl+Shift+`',
          click: () => mainWindow.webContents.send('menu-new-terminal'),
        },
        {
          label: 'Split Terminal',
          accelerator: 'CmdOrCtrl+\\',
          click: () => mainWindow.webContents.send('menu-split-terminal'),
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => mainWindow.webContents.send('menu-docs'),
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => mainWindow.webContents.send('menu-about'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Node.js Detection
ipcMain.handle('system:checkNodeJs', async () => {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  // First check if user has already dismissed this modal permanently
  const hasBeenDismissed = store.get('nodejs_modal_dismissed', false);
  if (hasBeenDismissed) {
    return { installed: true }; // Treat as installed if dismissed
  }

  try {
    if (process.platform !== 'win32') {
      const shell = process.env.SHELL || '/bin/zsh';
      // Use interactive login shell to find Node/NPM even with managers like NVM
      await execAsync(`${shell} -ilc "node --version && npm --version"`, { timeout: 10000 });
    } else {
      await execAsync('node --version');
      await execAsync('npm --version');
    }
    return { installed: true };
  } catch (error) {
    console.log('[System] Node.js detection failed:', error.message);
    return { installed: false };
  }
});

ipcMain.handle('system:dismissNodeJsModal', async () => {
  store.set('nodejs_modal_dismissed', true);
  return { success: true };
});

ipcMain.handle('system:downloadNodeJs', async () => {
  const nodeJsUrl = process.platform === 'darwin'
    ? 'https://nodejs.org/dist/v20.11.0/node-v20.11.0.pkg'
    : process.platform === 'win32'
      ? 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi'
      : 'https://nodejs.org/en/download/';

  await shell.openExternal(nodeJsUrl);

  // Close the app after opening download
  setTimeout(() => {
    app.quit();
  }, 1000);

  return { success: true };
});

// File System Operations
ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:writeFile', async (event, filePath, content) => {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:readDir', async (event, dirPath) => {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    const result = await Promise.all(
      items.map(async (item) => {
        const fullPath = path.join(dirPath, item.name);
        const stats = await fs.stat(fullPath);
        return {
          name: item.name,
          path: fullPath,
          isDirectory: item.isDirectory(),
          size: stats.size,
          modified: stats.mtime,
        };
      })
    );
    return { success: true, items: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:createFile', async (event, filePath) => {
  try {
    await fs.writeFile(filePath, '', 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:createDir', async (event, dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:delete', async (event, itemPath) => {
  try {
    const stats = await fs.stat(itemPath);
    if (stats.isDirectory()) {
      await fs.rm(itemPath, { recursive: true });
    } else {
      await fs.unlink(itemPath);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:rename', async (event, oldPath, newPath) => {
  try {
    await fs.rename(oldPath, newPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
  });
  return result;
});

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  });
  return result;
});

ipcMain.handle('dialog:saveFile', async (event, defaultPath) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath,
  });
  return result;
});

// Helper to get robust environment with full PATH for terminals and commands
let cachedShellPath = null;

async function getTerminalEnv(cwd) {
  const isWindows = process.platform === 'win32';
  const pathSeparator = isWindows ? ';' : ':';
  const additionalPaths = isWindows ? [
    'C:\\Program Files\\nodejs',
    'C:\\Program Files (x86)\\nodejs',
    `${process.env.APPDATA}\\npm`,
    `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python311`,
    `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python310`,
    'C:\\Windows\\System32',
    'C:\\Windows',
  ] : [
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
    `${process.env.HOME}/.nvm/versions/node/v*/bin`, // Common NVM pattern
    '/usr/local/share/npm/bin'
  ];

  let terminalEnv = { ...process.env };
  let currentPath = process.env.PATH || '';

  if (!isWindows) {
    if (cachedShellPath) {
      currentPath = cachedShellPath;
    } else {
      try {
        const shell = process.env.SHELL || '/bin/zsh';
        // Get path from interactive login shell (one-time cache)
        const result = require('child_process').execSync(`${shell} -ilc "echo __PATH_START__; echo $PATH; echo __PATH_END__"`, { encoding: 'utf8', timeout: 5000 });
        if (result) {
          const match = result.match(/__PATH_START__\s+([\s\S]*?)\s+__PATH_END__/);
          if (match && match[1]) {
            cachedShellPath = match[1].trim();
            currentPath = cachedShellPath;
          } else if (result.trim()) {
            cachedShellPath = result.trim().split('\n').pop();
            currentPath = cachedShellPath;
          }
        }
      } catch (e) {
        console.warn('[Terminal] Failed to source shell PATH:', e.message);
      }
    }
  }

  // Construct full path with additional fallbacks
  const pathParts = currentPath.split(pathSeparator);
  const missingPaths = additionalPaths.filter(p => !pathParts.includes(p));
  let fullPath = [...pathParts, ...missingPaths].filter(Boolean).join(pathSeparator);

  // Add bundled Node.js path
  const isDev = !app.isPackaged;
  let bundledNodePath = '';
  
  if (isDev) {
    const platformArch = `${process.platform}-${process.arch}`;
    bundledNodePath = isWindows
      ? path.join(app.getAppPath(), 'bundled-node', platformArch)
      : path.join(app.getAppPath(), 'bundled-node', platformArch, 'bin');
  } else {
    bundledNodePath = isWindows
      ? path.join(process.resourcesPath, 'node')
      : path.join(process.resourcesPath, 'node', 'bin');
  }
  
  if (require('fs').existsSync(bundledNodePath)) {
    // Prepend so bundled Node takes absolute priority
    fullPath = `${bundledNodePath}${pathSeparator}${fullPath}`;
  } else if (isDev) {
    console.warn(`[Terminal] Bundled Node not found at ${bundledNodePath}. Run 'npm run download-node --current' to download it.`);
  }

  // Add project local node_modules/.bin
  if (cwd) {
    const localBin = path.join(cwd, 'node_modules', '.bin');
    if (!fullPath.includes(localBin)) {
      fullPath = `${localBin}${pathSeparator}${fullPath}`;
    }
  }

  terminalEnv.PATH = fullPath;
  return terminalEnv;
}

// Terminal Operations
ipcMain.handle('terminal:create', async (event, cwd) => {
  if (!pty) {
    return {
      success: false,
      error: 'Terminal not available. Run: npm rebuild node-pty'
    };
  }

  try {
    const shell = process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh');
    const terminalEnv = await getTerminalEnv(cwd);

    console.log('[Terminal] Spawning:', shell, 'with PATH visibility');

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
      cwd: cwd || process.env.HOME || process.cwd(),
      env: terminalEnv,
    });

    const terminalId = Date.now().toString();
    terminals.set(terminalId, ptyProcess);
    terminalBuffers.set(terminalId, []); // Initialize output buffer

    ptyProcess.onData((data) => {
      // Store output in buffer (keep last 1000 lines)
      const buffer = terminalBuffers.get(terminalId) || [];
      buffer.push(data);
      if (buffer.length > 1000) {
        buffer.shift(); // Remove oldest line
      }
      terminalBuffers.set(terminalId, buffer);

      mainWindow.webContents.send('terminal:data', terminalId, data);
    });

    ptyProcess.onExit(() => {
      terminals.delete(terminalId);
      terminalBuffers.delete(terminalId);
      mainWindow.webContents.send('terminal:exit', terminalId);
    });

    return { success: true, terminalId };
  } catch (error) {
    console.error('[Terminal] Error creating terminal:', error);
    return {
      success: false,
      error: error.message || 'Failed to create terminal'
    };
  }
});

ipcMain.handle('terminal:write', (event, terminalId, data) => {
  const terminal = terminals.get(terminalId);
  if (terminal) {
    terminal.write(data);
    return { success: true };
  }
  return { success: false, error: 'Terminal not found' };
});

ipcMain.handle('terminal:resize', (event, terminalId, cols, rows) => {
  const terminal = terminals.get(terminalId);
  if (terminal) {
    terminal.resize(cols, rows);
    return { success: true };
  }
  return { success: false, error: 'Terminal not found' };
});

ipcMain.handle('terminal:kill', (event, terminalId) => {
  const terminal = terminals.get(terminalId);
  if (terminal) {
    terminal.kill();
    terminals.delete(terminalId);
    terminalBuffers.delete(terminalId); // Clean up buffer
    return { success: true };
  }
  return { success: false, error: 'Terminal not found' };
});

ipcMain.handle('terminal:getOutput', (event, terminalId) => {
  const buffer = terminalBuffers.get(terminalId);
  if (buffer) {
    // Join all output and return last 500 lines
    const fullOutput = buffer.join('');
    const lines = fullOutput.split('\n');
    const recentLines = lines.slice(-500).join('\n');
    return { success: true, output: recentLines };
  }
  return { success: false, error: 'Terminal not found' };
});

// File Watcher
ipcMain.handle('watch:start', (event, dirPath) => {
  if (fileWatchers.has(dirPath)) {
    return { success: true, message: 'Already watching' };
  }

  const watcher = chokidar.watch(dirPath, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
  });

  watcher
    .on('add', (path) => mainWindow.webContents.send('file:added', path))
    .on('change', (path) => mainWindow.webContents.send('file:changed', path))
    .on('unlink', (path) => mainWindow.webContents.send('file:removed', path))
    .on('addDir', (path) => mainWindow.webContents.send('dir:added', path))
    .on('unlinkDir', (path) => mainWindow.webContents.send('dir:removed', path));

  fileWatchers.set(dirPath, watcher);
  return { success: true };
});

ipcMain.handle('watch:stop', (event, dirPath) => {
  const watcher = fileWatchers.get(dirPath);
  if (watcher) {
    watcher.close();
    fileWatchers.delete(dirPath);
    return { success: true };
  }
  return { success: false, error: 'Watcher not found' };
});

// Output channel handlers
ipcMain.handle('output:log', (event, { channel, message, type = 'info' }) => {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, message, type, channel };

  if (!outputChannels.has(channel)) {
    outputChannels.set(channel, []);
  }

  outputChannels.get(channel).push(logEntry);

  // Send to renderer
  mainWindow.webContents.send('output:message', logEntry);

  return { success: true };
});

ipcMain.handle('output:clear', (event, channel) => {
  if (channel) {
    outputChannels.delete(channel);
  } else {
    outputChannels.clear();
  }
  return { success: true };
});

ipcMain.handle('output:get', (event, channel) => {
  if (channel) {
    return { logs: outputChannels.get(channel) || [] };
  }
  return { logs: [] };
});

// Run command with output capture
ipcMain.handle('process:run', async (event, { command, cwd }) => {
  const { spawn } = require('child_process');
  const processId = Date.now().toString();

  return new Promise((resolve) => {
    try {
      const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
      const args = process.platform === 'win32' ? ['/c', command] : ['-c', command];

      const proc = spawn(shell, args, {
        cwd: cwd || process.cwd(),
        env: process.env,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        const message = data.toString();
        stdout += message;
        mainWindow.webContents.send('output:message', {
          timestamp: new Date().toISOString(),
          message: message,
          type: 'info',
          channel: 'Tasks',
          processId,
        });
      });

      proc.stderr.on('data', (data) => {
        const message = data.toString();
        stderr += message;
        mainWindow.webContents.send('output:message', {
          timestamp: new Date().toISOString(),
          message: message,
          type: 'error',
          channel: 'Tasks',
          processId,
        });
      });

      proc.on('close', (code) => {
        mainWindow.webContents.send('output:message', {
          timestamp: new Date().toISOString(),
          message: `Process exited with code ${code}\n`,
          type: code === 0 ? 'info' : 'error',
          channel: 'Tasks',
          processId,
        });

        resolve({
          success: code === 0,
          code,
          stdout,
          stderr,
          processId
        });
      });

      proc.on('error', (error) => {
        mainWindow.webContents.send('output:message', {
          timestamp: new Date().toISOString(),
          message: `Error: ${error.message}\n`,
          type: 'error',
          channel: 'Tasks',
          processId,
        });

        resolve({
          success: false,
          error: error.message,
          processId
        });
      });
    } catch (error) {
      resolve({ success: false, error: error.message });
    }
  });
});

// Diagnostics/Problems handlers
ipcMain.handle('diagnostics:analyze', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const diagnostics = [];
    const lines = content.split('\n');
    const ext = path.extname(filePath);

    // Basic syntax checking for common issues
    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // JavaScript/TypeScript checks
      if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
        // Check for console.log (warning)
        if (line.includes('console.log')) {
          diagnostics.push({
            file: filePath,
            line: lineNum,
            column: line.indexOf('console.log') + 1,
            severity: 'warning',
            message: 'Unexpected console statement',
            source: 'eslint',
          });
        }

        // Check for debugger statements
        if (line.includes('debugger')) {
          diagnostics.push({
            file: filePath,
            line: lineNum,
            column: line.indexOf('debugger') + 1,
            severity: 'warning',
            message: 'Debugger statement should be removed',
            source: 'eslint',
          });
        }

        // Check for TODO comments
        if (line.includes('// TODO') || line.includes('// FIXME')) {
          diagnostics.push({
            file: filePath,
            line: lineNum,
            column: 1,
            severity: 'info',
            message: line.trim(),
            source: 'todo',
          });
        }

        // Check for var usage
        if (line.match(/\bvar\s+/)) {
          diagnostics.push({
            file: filePath,
            line: lineNum,
            column: line.indexOf('var') + 1,
            severity: 'warning',
            message: 'Unexpected var, use let or const instead',
            source: 'eslint',
          });
        }
      }

      // Python checks
      if (ext === '.py') {
        // Check for print statements
        if (line.match(/\bprint\s*\(/)) {
          diagnostics.push({
            file: filePath,
            line: lineNum,
            column: line.indexOf('print') + 1,
            severity: 'info',
            message: 'Print statement found',
            source: 'pylint',
          });
        }
      }

      // CSS checks
      if (['.css', '.scss', '.less'].includes(ext)) {
        // Check for !important
        if (line.includes('!important')) {
          diagnostics.push({
            file: filePath,
            line: lineNum,
            column: line.indexOf('!important') + 1,
            severity: 'warning',
            message: 'Avoid using !important',
            source: 'stylelint',
          });
        }
      }
    });

    return { diagnostics };
  } catch (error) {
    return { diagnostics: [], error: error.message };
  }
});

ipcMain.handle('diagnostics:clear', (event, filePath) => {
  // Clear diagnostics for specific file
  mainWindow.webContents.send('diagnostics:cleared', filePath);
  return { success: true };
});

// Debug console handlers
ipcMain.handle('debug:evaluate', async (event, expression) => {
  try {
    // Safely evaluate expression using VM
    const vm = require('vm');
    const context = vm.createContext({
      console: console,
      process: process,
      require: require,
      __dirname: __dirname,
      __filename: __filename,
    });

    const result = vm.runInContext(expression, context, {
      timeout: 1000,
      displayErrors: true,
    });

    return {
      success: true,
      result: JSON.stringify(result, null, 2),
      type: typeof result,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      type: 'error',
    };
  }
});

ipcMain.handle('debug:log', (event, { message, level = 'log' }) => {
  const timestamp = new Date().toISOString();
  mainWindow.webContents.send('debug:message', {
    timestamp,
    message,
    level,
  });
  return { success: true };
});

// ==================== Workspace Context ====================
// Recursively scan directory and get file tree with contents
async function scanWorkspace(dirPath, maxDepth = 5, currentDepth = 0) {
  if (currentDepth >= maxDepth) return null;

  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    const result = {
      path: dirPath,
      name: path.basename(dirPath),
      type: 'directory',
      children: []
    };

    // Ignore common directories
    const ignorePatterns = [
      'node_modules', '.git', 'dist', 'build', '.vscode',
      '.idea', 'coverage', '.next', 'out', '.cache'
    ];

    for (const item of items) {
      const itemName = item.name;

      // Skip hidden files and ignored directories
      if (itemName.startsWith('.') || ignorePatterns.includes(itemName)) {
        continue;
      }

      const itemPath = path.join(dirPath, itemName);

      if (item.isDirectory()) {
        const subDir = await scanWorkspace(itemPath, maxDepth, currentDepth + 1);
        if (subDir) {
          result.children.push(subDir);
        }
      } else if (item.isFile()) {
        // Only include common code files
        const ext = path.extname(itemName).toLowerCase();
        const codeExtensions = [
          '.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css',
          '.scss', '.py', '.java', '.cpp', '.c', '.h', '.md',
          '.txt', '.xml', '.yml', '.yaml', '.env'
        ];

        if (codeExtensions.includes(ext)) {
          try {
            const stats = await fs.stat(itemPath);
            // Skip large files (> 100KB)
            if (stats.size < 100000) {
              const content = await fs.readFile(itemPath, 'utf-8');
              result.children.push({
                path: itemPath,
                name: itemName,
                type: 'file',
                extension: ext,
                size: stats.size,
                content: content,
                lines: content.split('\n').length
              });
            } else {
              result.children.push({
                path: itemPath,
                name: itemName,
                type: 'file',
                extension: ext,
                size: stats.size,
                content: '[File too large to analyze]',
                lines: 0
              });
            }
          } catch (error) {
            console.error(`Error reading file ${itemPath}:`, error);
          }
        }
      }
    }

    return result;
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
    return null;
  }
}

// Get workspace structure and file contents for AI context
ipcMain.handle('workspace:scan', async (event, dirPath) => {
  try {
    const workspaceTree = await scanWorkspace(dirPath);

    // Generate a summary
    const files = [];
    const collectFiles = (node) => {
      if (node.type === 'file') {
        files.push({
          path: node.path,
          name: node.name,
          extension: node.extension,
          lines: node.lines,
          content: node.content
        });
      }
      if (node.children) {
        node.children.forEach(collectFiles);
      }
    };
    collectFiles(workspaceTree);

    return {
      success: true,
      tree: workspaceTree,
      files: files,
      summary: {
        totalFiles: files.length,
        fileTypes: [...new Set(files.map(f => f.extension))],
        totalLines: files.reduce((sum, f) => sum + f.lines, 0)
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// List all files in workspace (lightweight version)
ipcMain.handle('workspace:listFiles', async (event, dirPath) => {
  try {
    const files = [];

    async function scanDir(dir, depth = 0) {
      if (depth > 3) return;

      const items = await fs.readdir(dir, { withFileTypes: true });
      const ignorePatterns = ['node_modules', '.git', 'dist', 'build'];

      for (const item of items) {
        if (item.name.startsWith('.') || ignorePatterns.includes(item.name)) continue;

        const itemPath = path.join(dir, item.name);

        if (item.isDirectory()) {
          await scanDir(itemPath, depth + 1);
        } else {
          const ext = path.extname(item.name);
          if (['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.py'].includes(ext)) {
            files.push({
              path: itemPath,
              name: item.name,
              relativePath: path.relative(dirPath, itemPath)
            });
          }
        }
      }
    }

    await scanDir(dirPath);

    return { success: true, files };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Execute terminal command and return output
ipcMain.handle('terminal:execute', async (event, { command, cwd }) => {
  try {
    const { exec } = require('child_process');
    const terminalEnv = await getTerminalEnv(cwd);

    // 25 minute timeout for all commands
    const timeout = 25 * 60 * 1000;

    console.log(`[Terminal] Executing command with full environment: ${command}`);

    return new Promise((resolve) => {
      exec(command, {
        cwd,
        timeout,
        env: terminalEnv,
        maxBuffer: 10 * 1024 * 1024
      }, (error, stdout, stderr) => {
        if (error) {
          console.error(`[Terminal] Command failed: ${error.message}`);
          resolve({
            success: false,
            error: error.message,
            stderr: stderr,
            stdout: stdout
          });
        } else {
          console.log(`[Terminal] Command succeeded`);
          resolve({
            success: true,
            stdout: stdout,
            stderr: stderr
          });
        }
      });
    });
  } catch (err) {
    console.error('[Terminal] Execute error:', err);
    return { success: false, error: err.message };
  }
});

// Open external URL in default browser
ipcMain.handle('shell:openExternal', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Failed to open external URL:', error);
    return { success: false, error: error.message };
  }
});

// Search in files
ipcMain.handle('search:inFiles', async (event, { folder, query, caseSensitive, useRegex }) => {
  try {
    if (!folder || !query) {
      return { success: false, error: 'Missing folder or query parameter' };
    }

    const results = [];
    const flags = caseSensitive ? 'g' : 'gi';
    const searchPattern = useRegex ? new RegExp(query, flags) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);

    const searchInDirectory = async (dir) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Skip node_modules, .git, and other common directories
          if (entry.isDirectory()) {
            if (!['node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage'].includes(entry.name)) {
              await searchInDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            // Only search in text files
            const ext = path.extname(entry.name).toLowerCase();
            const textExtensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.scss', '.sass', '.md', '.txt', '.xml', '.yml', '.yaml', '.py', '.java', '.c', '.cpp', '.h', '.go', '.rs', '.php', '.rb', '.vue', '.svelte'];

            if (textExtensions.includes(ext) || !ext) {
              try {
                const content = await fs.readFile(fullPath, 'utf8');
                const lines = content.split('\n');
                const matches = [];

                lines.forEach((line, index) => {
                  if (searchPattern.test(line)) {
                    // Highlight the match
                    const highlightedLine = line.replace(searchPattern, '<mark>$&</mark>');
                    matches.push({
                      line: index + 1,
                      preview: highlightedLine,
                      text: line
                    });
                  }
                });

                if (matches.length > 0) {
                  results.push({
                    filePath: fullPath,
                    fileName: path.relative(folder, fullPath),
                    matches: matches
                  });
                }
              } catch (readError) {
                // Skip files that can't be read (binary files, permission issues, etc.)
                console.log(`Skipping file ${fullPath}: ${readError.message}`);
              }
            }
          }
        }
      } catch (err) {
        console.error(`Error searching in ${dir}:`, err);
      }
    };

    await searchInDirectory(folder);

    return { success: true, results };
  } catch (error) {
    console.error('Search error:', error);
    return { success: false, error: error.message };
  }
});

// Proxy image search to avoid CSP issues
ipcMain.handle('images:search', async (event, query) => {
  try {
    const https = require('https');

    return new Promise((resolve) => {
      // Use Unsplash API with your access key
      const options = {
        hostname: 'api.unsplash.com',
        path: `/search/photos?query=${encodeURIComponent(query)}&per_page=30`,
        method: 'GET',
        headers: {
          'Authorization': 'Client-ID k-U5DmqeQpMigAg2dkGBmQDLDaHVVWxz1tnmeUkftTs',
          'Accept-Version': 'v1'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            console.log('[Image Search] Response status:', res.statusCode);

            const result = JSON.parse(data);

            if (result.results && result.results.length > 0) {
              const images = result.results.map(photo => ({
                id: photo.id.toString(),
                url: photo.urls.small,
                fullUrl: photo.urls.regular,
                thumb: photo.urls.thumb,
                alt: photo.alt_description || query,
                author: photo.user.name,
                authorUrl: photo.user.links.html
              }));
              console.log(`[Image Search] Found ${images.length} images`);
              resolve({ success: true, images });
            } else {
              console.warn('[Image Search] No results found for query:', query);
              resolve({ success: false, error: 'No images found for this search term' });
            }
          } catch (err) {
            console.error('[Image Search] Parse error:', err);
            resolve({ success: false, error: err.message });
          }
        });
      });

      req.on('error', (err) => {
        console.error('[Image Search] Request error:', err);
        resolve({ success: false, error: err.message });
      });

      req.end();
    });
  } catch (error) {
    console.error('[Image Search] Failed to search images:', error);
    return { success: false, error: error.message };
  }
});

// Auto-updater configuration
if (app.isPackaged && autoUpdater && autoUpdater.on) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('🔍 Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('✅ Update available:', info.version);
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) is available!`,
      buttons: ['Download Now', 'Later'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
        mainWindow.webContents.send('update-downloading');
      }
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('✅ App is up to date');
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`📥 Download progress: ${Math.round(progress.percent)}%`);
    mainWindow.webContents.send('update-progress', progress);
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('✅ Update downloaded');
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded. Restart now to install?',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (error) => {
    console.error('❌ Auto-updater error:', error);
  });
}

// ==================== Authentication IPC Handlers ====================

// Set auth tokens
ipcMain.handle('auth:setTokens', async (event, tokens) => {
  try {
    store.set('tokens', tokens);
    return { success: true };
  } catch (error) {
    console.error('Error storing tokens:', error);
    return { success: false, error: error.message };
  }
});

// Get auth tokens
ipcMain.handle('auth:getTokens', async () => {
  try {
    const tokens = store.get('tokens');
    return { success: true, tokens };
  } catch (error) {
    console.error('Error retrieving tokens:', error);
    return { success: false, error: error.message };
  }
});

// Clear auth tokens
ipcMain.handle('auth:clearTokens', async () => {
  try {
    store.delete('tokens');
    return { success: true };
  } catch (error) {
    console.error('Error clearing tokens:', error);
    return { success: false, error: error.message };
  }
});

// Set user info
ipcMain.handle('auth:setUser', async (event, user) => {
  try {
    store.set('user', user);
    return { success: true };
  } catch (error) {
    console.error('Error storing user:', error);
    return { success: false, error: error.message };
  }
});

// Get user info
ipcMain.handle('auth:getUser', async () => {
  try {
    const user = store.get('user');
    return { success: true, user };
  } catch (error) {
    console.error('Error retrieving user:', error);
    return { success: false, error: error.message };
  }
});

// Clear user info
ipcMain.handle('auth:clearUser', async () => {
  try {
    store.delete('user');
    return { success: true };
  } catch (error) {
    console.error('Error clearing user:', error);
    return { success: false, error: error.message };
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OpenAI - File Explanation Service (via Firebase Cloud Function)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ipcMain.handle('openai:explain', async (event, { filePath, content, language }) => {
  try {
    // Get Firebase Cloud Function URL from environment
    const FIREBASE_FUNCTION_URL = process.env.VITE_FIREBASE_FUNCTION_URL || process.env.FIREBASE_FUNCTION_URL;
    
    if (!FIREBASE_FUNCTION_URL) {
      console.error('[OpenAI Explanation] Firebase Function URL not configured');
      return { success: false, error: 'Service not configured' };
    }

    // Get user ID from store if available
    const userId = store.get('user')?.uid || null;

    // Call Firebase Cloud Function
    const response = await fetch(`${FIREBASE_FUNCTION_URL}/api/openai/explain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filePath,
        content,
        language,
        userId
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[OpenAI Explanation] Cloud function error:', response.status, errorData);
      return { success: false, error: errorData.error || 'Failed to generate explanation' };
    }

    const data = await response.json();
    
    if (data.success && data.explanation) {
      return { success: true, explanation: data.explanation };
    } else {
      return { success: false, error: data.error || 'No explanation generated' };
    }
  } catch (error) {
    console.error('[OpenAI Explanation] Error:', error);
    return { success: false, error: error.message || 'Failed to connect to explanation service' };
  }
});

// Check for updates on app start (only in production)
app.whenReady().then(() => {
  require('./ClaudeProxy');
  createWindow();

  if (!app.isPackaged) {
    console.log('📦 Development mode - skipping auto-update check');
  } else {
    // Check for updates after 3 seconds
    setTimeout(() => {
      autoUpdater.checkForUpdates();
    }, 3000);

    // Check for updates every 4 hours
    setInterval(() => {
      autoUpdater.checkForUpdates();
    }, 4 * 60 * 60 * 1000);
  }
});

app.on('window-all-closed', () => {
  // Clean up terminals and watchers
  terminals.forEach((terminal) => terminal.kill());
  fileWatchers.forEach((watcher) => watcher.close());
  outputChannels.clear();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
