/**
 * PublishService - Handles publishing apps to ExternAI's Firebase hosting platform
 * Similar to Lovable's one-click deploy feature
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import FirebaseService from './FirebaseService';

class PublishService {
  constructor() {
    this._functionsInstance = null;
  }

  /**
   * Get Firebase Functions instance
   */
  get functions() {
    if (!this._functionsInstance) {
      const app = FirebaseService.getApp();
      this._functionsInstance = getFunctions(app, 'us-central1');
    }
    return this._functionsInstance;
  }

  /**
   * Publish a project to ExternAI hosting
   * @param {string} workspaceFolder - Path to the workspace
   * @param {string} projectName - Display name for the project
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<{success: boolean, url?: string, error?: string}>}
   */
  async publishProject(workspaceFolder, projectName, onProgress = () => {}) {
    try {
      onProgress({ status: 'preparing', message: 'Preparing project for publishing...' });

      // First, try to build if there's a build script
      await this.buildIfNeeded(workspaceFolder, onProgress);

      // Detect if there's a build folder
      const buildInfo = await this.detectBuildOutput(workspaceFolder);
      
      // Determine which folder to publish
      const publishFolder = buildInfo.buildPath || workspaceFolder;
      const buildOutput = buildInfo.buildFolder || '';

      onProgress({ status: 'scanning', message: 'Scanning files...' });

      // Read all files from the publish folder
      const files = await this.collectFiles(publishFolder, onProgress);

      if (Object.keys(files).length === 0) {
        // No build folder found, check if there's an index.html in the root
        const rootFiles = await this.collectFiles(workspaceFolder, onProgress);
        if (!rootFiles['index.html']) {
          return {
            success: false,
            error: 'No publishable content found. Please build your project first (npm run build) or create an index.html file.',
            needsBuild: true
          };
        }
        // Use root files
        Object.assign(files, rootFiles);
      }

      // Check file count and size
      const fileCount = Object.keys(files).length;
      if (fileCount > 200) {
        return {
          success: false,
          error: `Too many files (${fileCount}). Maximum is 200 files. Try building your project first to reduce the number of files.`
        };
      }

      onProgress({ status: 'uploading', message: 'Uploading to ExternAI servers...' });

      // Call Firebase Cloud Function
      const publishAppFn = httpsCallable(this.functions, 'publishApp');
      const result = await publishAppFn({
        projectName,
        files,
        buildOutput
      });

      const data = result.data;

      onProgress({ status: 'complete', message: 'Published successfully!' });

      // Persist locally so Published Apps panel always shows the app
      this._saveAppLocally({
        appId: data.appId,
        displayName: projectName,
        url: data.url,
        updatedAt: new Date().toISOString(),
        visits: 0,
      });

      return {
        success: true,
        url: data.url,
        appId: data.appId,
        isUpdate: data.isUpdate,
        message: data.message
      };

    } catch (error) {
      console.error('Publish error:', error);
      
      // Handle Firebase function errors
      let errorMessage = 'Failed to publish project';
      if (error.code === 'functions/unauthenticated') {
        errorMessage = 'Please sign in to publish your project';
      } else if (error.code === 'functions/invalid-argument') {
        errorMessage = error.message || 'Invalid project data';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Run npm run build if the project has a build script and no build output yet
   */
  async buildIfNeeded(workspaceFolder, onProgress) {
    try {
      // Always rebuild to ensure the latest changes are deployed
      // We intentionally do not skip if existingBuild.buildPath exists

      // Check if package.json has a build script
      const pkgResult = await window.electronAPI.fs.readFile(`${workspaceFolder}/package.json`);
      if (!pkgResult.success) return;

      const pkg = JSON.parse(pkgResult.content);
      if (!pkg.scripts?.build) return;

      onProgress({ status: 'preparing', message: 'Building project...' });

      // Install deps first if node_modules doesn't exist
      const nmResult = await window.electronAPI.fs.readDir(`${workspaceFolder}/node_modules`);
      if (!nmResult.success || !nmResult.items?.length) {
        onProgress({ status: 'preparing', message: 'Installing dependencies...' });
        await window.electronAPI.process.run('npm install', workspaceFolder);
      }

      // Run the build
      const buildResult = await window.electronAPI.process.run('npm run build', workspaceFolder);
      if (!buildResult.success) {
        console.warn('Build failed:', buildResult.stderr);
        // Don't block publishing — will fall back to raw files
      }
    } catch (e) {
      console.warn('Build step skipped:', e.message);
    }
  }

  /**
   * Detect build output folder
   */
  async detectBuildOutput(workspaceFolder) {
    const buildFolders = ['dist', 'build', 'out', '.next/out', 'public'];
    
    for (const folder of buildFolders) {
      const folderPath = `${workspaceFolder}/${folder}`;
      try {
        const result = await window.electronAPI.fs.readDir(folderPath);
        if (result.success && result.items?.length > 0) {
          // Check if it has an index.html
          const hasIndex = result.items.some(item => item.name === 'index.html');
          if (hasIndex) {
            return {
              buildPath: folderPath,
              buildFolder: folder
            };
          }
        }
      } catch (e) {
        // Folder doesn't exist, continue
      }
    }

    return { buildPath: null, buildFolder: null };
  }

  /**
   * Collect all files from a folder recursively
   */
  async collectFiles(folderPath, onProgress, basePath = '', files = {}) {
    try {
      const result = await window.electronAPI.fs.readDir(folderPath);
      
      if (!result.success) return files;

      // Skip common non-publishable folders
      const skipFolders = ['node_modules', '.git', '.next', '.cache', '__pycache__', '.venv', 'venv'];
      
      // Publishable file extensions
      const allowedExtensions = [
        '.html', '.css', '.js', '.mjs', '.jsx', '.ts', '.tsx',
        '.json', '.xml', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico',
        '.woff', '.woff2', '.ttf', '.eot', '.otf',
        '.mp4', '.webm', '.mp3', '.wav', '.ogg',
        '.pdf', '.txt', '.md', '.map'
      ];

      for (const item of result.items) {
        const itemPath = `${folderPath}/${item.name}`;
        const relativePath = basePath ? `${basePath}/${item.name}` : item.name;

        if (item.isDirectory) {
          if (!skipFolders.includes(item.name)) {
            await this.collectFiles(itemPath, onProgress, relativePath, files);
          }
        } else {
          // Check file extension
          const ext = '.' + item.name.split('.').pop()?.toLowerCase();
          if (allowedExtensions.includes(ext) || item.name === 'favicon.ico') {
            try {
              // Read file as binary for proper base64 encoding
              const fileResult = await window.electronAPI.fs.readFile(itemPath, 'binary');
              if (fileResult.success) {
                // Convert to base64
                let base64Content;
                if (fileResult.encoding === 'binary' && fileResult.buffer) {
                  // Binary file - already base64 from preload
                  base64Content = fileResult.buffer;
                } else {
                  // Text file - convert to base64
                  base64Content = btoa(unescape(encodeURIComponent(fileResult.content)));
                }
                files[relativePath] = base64Content;
                onProgress({ 
                  status: 'scanning', 
                  message: `Found: ${relativePath}` 
                });
              }
            } catch (e) {
              console.warn(`Could not read file: ${relativePath}`);
            }
          }
        }
      }

      return files;
    } catch (error) {
      console.error('Error collecting files:', error);
      return files;
    }
  }

  /**
   * Persist a single published app entry to localStorage
   */
  _saveAppLocally(app) {
    try {
      const stored = this._loadLocalApps();
      // Replace existing entry with same appId, or prepend
      const filtered = stored.filter(a => a.appId !== app.appId);
      filtered.unshift(app);
      localStorage.setItem('externai_published_apps', JSON.stringify(filtered));
    } catch (e) {
      console.warn('Could not save app locally:', e);
    }
  }

  /**
   * Load published apps from localStorage
   */
  _loadLocalApps() {
    try {
      const raw = localStorage.getItem('externai_published_apps');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Remove a published app entry from localStorage
   */
  _removeAppLocally(appId) {
    try {
      const stored = this._loadLocalApps();
      localStorage.setItem('externai_published_apps', JSON.stringify(stored.filter(a => a.appId !== appId)));
    } catch (e) {
      console.warn('Could not remove app locally:', e);
    }
  }

  /**
   * Get list of user's published apps
   * Loads from localStorage immediately; tries cloud to refresh/merge.
   */
  async getMyApps() {
    const localApps = this._loadLocalApps();

    try {
      const getMyAppsFn = httpsCallable(this.functions, 'getMyApps');
      const result = await getMyAppsFn();
      const cloudApps = result.data.apps || [];

      // Merge: cloud is authoritative; add any local-only entries the cloud doesn't know about yet
      const cloudIds = new Set(cloudApps.map(a => a.appId));
      const localOnly = localApps.filter(a => !cloudIds.has(a.appId));
      const merged = [...cloudApps, ...localOnly];

      // Keep localStorage in sync with merged list
      localStorage.setItem('externai_published_apps', JSON.stringify(merged));

      return { success: true, apps: merged };
    } catch (error) {
      console.warn('Could not reach cloud for published apps, using local cache:', error);

      // Fall back to whatever we have locally
      if (localApps.length > 0) {
        return { success: true, apps: localApps };
      }

      let errorMessage = 'Failed to load published apps';
      if (error.code === 'functions/unauthenticated') {
        errorMessage = 'Please sign in to view your published apps';
      }
      return { success: false, error: errorMessage, apps: [] };
    }
  }

  /**
   * Unpublish/delete an app
   */
  async unpublishApp(appId) {
    try {
      const unpublishAppFn = httpsCallable(this.functions, 'unpublishApp');
      await unpublishAppFn({ appId });
      this._removeAppLocally(appId);
      return { success: true };
    } catch (error) {
      console.error('Error unpublishing app:', error);
      
      let errorMessage = 'Failed to unpublish app';
      if (error.code === 'functions/permission-denied') {
        errorMessage = 'You do not have permission to delete this app';
      } else if (error.code === 'functions/not-found') {
        errorMessage = 'App not found';
      }
      
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }
}

export default new PublishService();
