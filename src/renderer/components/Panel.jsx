import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { FiX } from 'react-icons/fi';
import '@xterm/xterm/css/xterm.css';

const Panel = forwardRef(({ 
  terminals, 
  onNewTerminal, 
  onCloseTerminal,
  workspaceFolder,
  outputLogs = [],
  debugLogs = [],
  onClearOutput,
  onClearDebug,
  theme,
  onUpdateTerminalStatus,
  onTerminalOutput,
  onDevServerDetected,
  terminalRef,
  visible
}, ref) => {
  const [activeTab, setActiveTab] = useState('terminal');
  const [activeTerminal, setActiveTerminal] = useState(terminals.length > 0 ? terminals[0].id : null);
  const terminalRefsMap = useRef({});
  const terminalInstances = useRef({});
  const fitAddons = useRef({});
  const backendTerminalIds = useRef({}); // Store backend terminal IDs
  const terminalOutputBuffers = useRef({}); // Store output per terminal
  const urlDetectionBuffers = useRef({});
  const lastCommands = useRef({}); // Store last command per terminal
  const commandStartTime = useRef({}); // Track when command started
  const commandExplained = useRef({}); // Track if current command was already explained

  // Expose executeCommand method via ref for AI to use
  useImperativeHandle(ref, () => ({
    executeCommand: (command) => {
      // Get the first available terminal if no active terminal
      const terminalId = activeTerminal || Object.keys(backendTerminalIds.current)[0];
      
      if (!terminalId) {
        console.warn('[Panel] No terminal available for command execution');
        return;
      }
      
      const backendId = backendTerminalIds.current[terminalId];
      if (!backendId) {
        console.warn('[Panel] No backend terminal ID for terminal:', terminalId);
        return;
      }
      
      // Write command + newline to the terminal
      window.electronAPI.terminal.write(backendId, command + '\n');
      console.log('[Panel] Executed command:', command);
    },
    getTerminalOutput: () => {
      const terminalId = activeTerminal || Object.keys(terminalOutputBuffers.current)[0];
      if (!terminalId) return '';
      return terminalOutputBuffers.current[terminalId] || '';
    }
  }), [activeTerminal]);

  // Store queued commands that arrive before terminal is ready
  const queuedCommands = useRef([]);

  // Also expose via terminalRef prop if provided (initial setup)
  useEffect(() => {
    if (terminalRef && !terminalRef.current) {
      terminalRef.current = {
        executeCommand: (command) => {
          console.log('[Panel] Terminal not yet initialized, queueing command:', command);
          queuedCommands.current.push(command);
          
          // Retry after terminal might be ready
          setTimeout(() => {
            const availableTerminalIds = Object.keys(backendTerminalIds.current);
            if (availableTerminalIds.length > 0) {
              const backendId = backendTerminalIds.current[availableTerminalIds[availableTerminalIds.length - 1]];
              if (backendId && queuedCommands.current.includes(command)) {
                window.electronAPI.terminal.write(backendId, command + '\n');
                console.log('[Panel] Executed queued command:', command);
                queuedCommands.current = queuedCommands.current.filter(c => c !== command);
              }
            }
          }, 1000);
        },
        getTerminalOutput: () => ''
      };
    }
  }, [terminalRef]);

  const handleCloseTerminal = async (terminalId) => {
    // Close the terminal in the backend
    const backendId = backendTerminalIds.current[terminalId];
    if (backendId) {
      try {
        await window.electronAPI.terminal.kill(backendId);
      } catch (error) {
        console.error('Error killing terminal:', error);
      }
    }
    
    // Cleanup refs
    if (terminalInstances.current[terminalId]) {
      terminalInstances.current[terminalId].dispose();
      delete terminalInstances.current[terminalId];
    }
    delete terminalRefsMap.current[terminalId];
    delete fitAddons.current[terminalId];
    delete backendTerminalIds.current[terminalId];
    delete terminalOutputBuffers.current[terminalId];
    
    // Close in parent component
    if (onCloseTerminal) {
      onCloseTerminal(terminalId);
    }
  };

  useEffect(() => {
    if (terminals.length > 0 && !activeTerminal) {
      setActiveTerminal(terminals[0].id);
    }
  }, [terminals, activeTerminal]);

  useEffect(() => {
    const initTerminal = async (terminalId) => {
      const container = terminalRefsMap.current[terminalId];
      if (!container || terminalInstances.current[terminalId]) return;

      // Initialize output buffer
      terminalOutputBuffers.current[terminalId] = '';
      urlDetectionBuffers.current[terminalId] = '';

      const term = new XTerm({
        cursorBlink: true,
        fontSize: 12,
        fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace",
        theme: theme === 'light' ? {
          background: 'var(--vscode-bg)',
          foreground: 'var(--vscode-fg)',
          cursor: 'var(--vscode-fg)',
          selection: '#add6ff',
          black: 'var(--vscode-fg)',
          red: '#c5221f',
          green: '#1e8e3e',
          yellow: '#f57c00',
          blue: '#1967d2',
          magenta: '#a142f4',
          cyan: '#00acc1',
          white: '#5f6368',
          brightBlack: '#80868b',
          brightRed: '#ea4335',
          brightGreen: '#34a853',
          brightYellow: '#fbbc04',
          brightBlue: '#4285f4',
          brightMagenta: '#c678dd',
          brightCyan: '#00bcd4',
          brightWhite: 'var(--vscode-fg)',
        } : {
          background: 'var(--vscode-fg)',
          foreground: '#cccccc',
          cursor: '#ffffff',
          selection: '#264f78',
        },
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(container);
      fitAddon.fit();

      terminalInstances.current[terminalId] = term;
      fitAddons.current[terminalId] = fitAddon;

      // Create terminal backend
      const result = await window.electronAPI.terminal.create(workspaceFolder);
      
      if (!result.success) {
        // Show error message in terminal
        term.writeln('\x1b[1;31mTerminal Error:\x1b[0m ' + result.error);
        term.writeln('\x1b[33mPlease run:\x1b[0m npm rebuild node-pty');
        term.writeln('');
        term.writeln('The app will work without terminal, but you won\'t be able to run commands.');
        return;
      }
      
      if (result.success) {
        // Store the backend terminal ID
        backendTerminalIds.current[terminalId] = result.terminalId;
        
        // Update terminalRef with the now-available backend ID
        if (terminalRef) {
          terminalRef.current = {
            executeCommand: (command) => {
              // Find the first available backend terminal ID
              // This avoids stale closure issues with activeTerminal
              const availableTerminalIds = Object.keys(backendTerminalIds.current);
              if (availableTerminalIds.length === 0) {
                console.warn('[Panel] No backend terminal IDs available for command execution');
                return;
              }
              // Use the most recently created terminal (last in the object)
              const backendId = backendTerminalIds.current[availableTerminalIds[availableTerminalIds.length - 1]];
              if (!backendId) {
                console.warn('[Panel] No valid backend terminal ID for command execution');
                return;
              }
              window.electronAPI.terminal.write(backendId, command + '\n');
              console.log('[Panel] Executed command via terminalRef:', command);
            },
            getTerminalOutput: () => {
              // Get output from all terminals combined
              const allOutputs = Object.values(terminalOutputBuffers.current);
              return allOutputs.join('\n');
            }
          };
          
          // Execute any queued commands now that terminal is ready
          if (queuedCommands.current.length > 0) {
            console.log('[Panel] Executing queued commands:', queuedCommands.current);
            const commandsToRun = [...queuedCommands.current];
            queuedCommands.current = [];
            commandsToRun.forEach(cmd => {
              window.electronAPI.terminal.write(result.terminalId, cmd + '\n');
            });
          }
        }
        
        // Handle terminal input from user
        term.onData((data) => {
          // Track command input (detect Enter key to capture command)
          if (data === '\r' || data === '\n') {
            // Get the current line as the command
            const buffer = term.buffer.active;
            const cursorY = buffer.cursorY;
            const line = buffer.getLine(cursorY);
            if (line) {
              const commandText = line.translateToString(true).trim();
              // Remove prompt from command (e.g., "$ npm install" -> "npm install")
              const cleanCommand = commandText.replace(/^.*[$%>#]\s*/, '').trim();
              if (cleanCommand && !cleanCommand.match(/^[\s]*$/)) {
                lastCommands.current[terminalId] = cleanCommand;
                commandStartTime.current[terminalId] = Date.now();
                commandExplained.current[terminalId] = false; // Reset for new command
                console.log('[Panel] Command tracked:', cleanCommand);
              }
            }
          }
          window.electronAPI.terminal.write(result.terminalId, data);
        });

        // Handle terminal data from backend (node-pty)
        window.electronAPI.terminal.onData((id, data) => {
          if (id === result.terminalId) {
            term.write(data);
            
            // Store output in buffer (keep last ~50KB)
            terminalOutputBuffers.current[terminalId] = 
              (terminalOutputBuffers.current[terminalId] || '') + data;
            if (terminalOutputBuffers.current[terminalId].length > 50000) {
              terminalOutputBuffers.current[terminalId] = 
                terminalOutputBuffers.current[terminalId].slice(-40000);
            }
            
            // Notify parent of terminal output for AI auto-fix
            if (onTerminalOutput) {
              onTerminalOutput(terminalId, data, terminalOutputBuffers.current[terminalId]);
            }

            // Detect dev server URLs from terminal output (buffered for fragmentation)
            if (onDevServerDetected) {
              const urlPatterns = [
                /(?:Local|➜\s+Local|Network|➜\s+Network):\s+(https?:\/\/[^\s]+)/i,
                /(?:running on|listening on|server running at|Application started at):\s+(https?:\/\/[^\s]+)/i,
                /https?:\/\/localhost:\d+/i,
                /http:\/\/127\.0\.0\.1:\d+/i,
                /http:\/\/0\.0\.0\.0:\d+/i,
                /https?:\/\/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:\d+/i
              ];
              
              const cleanChunk = data.replace(/\x1b\[[0-9;]*m/g, '');
              let buffer = (urlDetectionBuffers.current[terminalId] || '') + cleanChunk;
              
              // Keep buffer at reasonable size
              if (buffer.length > 2000) buffer = buffer.slice(-2000);
              urlDetectionBuffers.current[terminalId] = buffer;

              for (const pattern of urlPatterns) {
                const match = buffer.match(pattern);
                if (match) {
                  const detectedUrl = (match[1] || match[0]).trim();
                  
                  // Only accept if it looks like a complete URL (ends in space, newline, or we have enough context)
                  // For localhost:\d+ we can be more confident
                  const isSpecificPattern = pattern.source.includes('\\d+');
                  const isTerminated = /[\s\r\n]/.test(buffer.slice(match.index + match[0].length, match.index + match[0].length + 1)) 
                                      || data.includes('\r') || data.includes('\n');

                  if (isSpecificPattern || isTerminated) {
                    console.log('🌐 Auto-detected dev server from terminal (buffered):', detectedUrl);
                    onDevServerDetected(detectedUrl);
                    urlDetectionBuffers.current[terminalId] = ''; // Reset buffer on match
                    break;
                  }
                }
              }
            }

            // Detect command completion status for terminal tab indicators
            if (onUpdateTerminalStatus) {
              // Check for common error patterns
              // Check for explicit and severe shell/command errors
              const hasError = /npm ERR!|ENOENT|EACCES|EADDRINUSE/.test(data)
                || (/command not found/.test(data) && !/command not found: #/.test(data)); // Ignore harmless comment artifacts
              const hasSuccess = /✓|success|Success|SUCCESS|Done|done|Compiled successfully|webpack compiled|Ready in|Server running|added \d+ packages|packages in \d|updated \d+ packages|audited \d+ packages|found \d+ vulnerabilities|successfully|installed|complete|finished/.test(data)
                || /[$%#]\s*$/.test(data.trimEnd()); // Shell prompt returned = command finished
              
              if (hasError) {
                onUpdateTerminalStatus(terminalId, 'error');
              }
            }
          }
        });

        // Handle terminal resize
        const resizeObserver = new ResizeObserver(() => {
          fitAddon.fit();
          window.electronAPI.terminal.resize(
            result.terminalId,
            term.cols,
            term.rows
          );
        });
        resizeObserver.observe(container);
      }
    };

    if (activeTerminal && terminalRefsMap.current[activeTerminal]) {
      initTerminal(activeTerminal);
    }

    // Also init any terminals that haven't been initialized yet
    terminals.forEach(t => {
      if (terminalRefsMap.current[t.id] && !terminalInstances.current[t.id]) {
        initTerminal(t.id);
      }
    });
    // Cleanup on unmount or activeTerminal change
  }, [activeTerminal, workspaceFolder, theme, onTerminalOutput, onUpdateTerminalStatus]);

  // Re-fit all terminals when panel becomes visible
  useEffect(() => {
    if (visible) {
      // Small delay to allow the container to get its actual dimensions
      const timer = setTimeout(() => {
        Object.keys(fitAddons.current).forEach(id => {
          try {
            fitAddons.current[id]?.fit();
            // Also update backend terminal size
            const term = terminalInstances.current[id];
            const backendId = backendTerminalIds.current[id];
            if (term && backendId) {
              window.electronAPI.terminal.resize(backendId, term.cols, term.rows);
            }
          } catch (e) {
            // ignore fit errors
          }
        });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  return (
    <div className="panel" style={{ height: '300px', backgroundColor: 'var(--vscode-bg)', borderTop: 'none', display: 'flex', flexDirection: 'column' }}>
      <div className="panel-tabs" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--vscode-bg)', borderBottom: 'none', padding: '0 10px', height: '35px' }}>
        <div className="panel-tab-list" style={{ display: 'flex', gap: '4px' }}>
          <button
            className={`panel-tab ${activeTab === 'terminal' ? 'active' : ''}`}
            onClick={() => setActiveTab('terminal')}
            style={{ padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', color: activeTab === 'terminal' ? 'var(--vscode-fg)' : '#6b7280', fontWeight: activeTab === 'terminal' ? '700' : '500' }}
          >
            Terminal
          </button>
        </div>
        {/* Terminal tabs and new button removed as requested */}
      </div>
      <div className="panel-content" style={{ flex: 1, overflow: 'hidden', backgroundColor: 'var(--vscode-bg)' }}>
        {activeTab === 'terminal' && terminals.length > 0 && (
          <>
            {/* Terminal output view */}
            <div className="terminals-container" style={{ width: '100%', height: '100%', position: 'relative' }}>
              {terminals.map((terminal) => (
                <div
                  key={terminal.id}
                  ref={(el) => (terminalRefsMap.current[terminal.id] = el)}
                  className={`terminal-instance ${activeTerminal === terminal.id ? 'active' : 'hidden'}`}
                  style={{ width: '100%', height: '100%', padding: '10px', backgroundColor: 'var(--vscode-bg)', display: activeTerminal === terminal.id ? 'block' : 'none' }}
                  data-terminal-id={backendTerminalIds.current[terminal.id] || ''}
                  data-id={terminal.id}
                />
              ))}
            </div>
          </>
        )}
        {activeTab === 'terminal' && terminals.length === 0 && (
          <div className="empty-panel">
            <p>No terminal opened</p>
            <button className="primary-button" onClick={onNewTerminal}>
              New Terminal
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

Panel.displayName = 'Panel';

export default Panel;
