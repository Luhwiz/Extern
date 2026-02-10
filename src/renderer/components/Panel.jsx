import React, { useState, useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { FiX } from 'react-icons/fi';
import '@xterm/xterm/css/xterm.css';
import OutputPanel from './panels/OutputPanel';
import ProblemsPanel from './panels/ProblemsPanel';
import DebugConsole from './panels/DebugConsole';
import './Panel.css';

function Panel({
  terminals,
  onNewTerminal,
  onCloseTerminal,
  workspaceFolder,
  outputLogs = [],
  diagnostics = [],
  debugLogs = [],
  onClearOutput,
  onClearDiagnostics,
  onClearDebug,
  theme
}) {
  const [activeTab, setActiveTab] = useState('terminal');
  const [activeTerminal, setActiveTerminal] = useState(null);
  const terminalRefs = useRef({});
  const terminalInstances = useRef({});
  const fitAddons = useRef({});
  const backendTerminalIds = useRef({}); // Store backend terminal IDs

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
    delete terminalRefs.current[terminalId];
    delete fitAddons.current[terminalId];
    delete backendTerminalIds.current[terminalId];

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
      const container = terminalRefs.current[terminalId];
      if (!container || terminalInstances.current[terminalId]) return;

      const term = new XTerm({
        cursorBlink: true,
        fontSize: 10,
        fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace",
        theme: theme === 'light' ? {
          background: '#ffffff',
          foreground: '#3b3b3b',
          cursor: '#3b3b3b',
          selection: '#add6ff',
          black: '#000000',
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
          brightWhite: '#3b3b3b',
        } : {
          background: '#1e1e1e',
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

        // Handle terminal input
        term.onData((data) => {
          window.electronAPI.terminal.write(result.terminalId, data);
        });

        // Handle terminal data from backend
        window.electronAPI.terminal.onData((id, data) => {
          if (id === result.terminalId) {
            term.write(data);
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

    if (activeTerminal && terminalRefs.current[activeTerminal]) {
      initTerminal(activeTerminal);
    }
  }, [activeTerminal, workspaceFolder]);

  return (
    <div className="panel">
      <div className="panel-tabs">
        <div className="panel-tab-list">
          <button
            className={`panel-tab ${activeTab === 'terminal' ? 'active' : ''}`}
            onClick={() => setActiveTab('terminal')}
          >
            Terminal
          </button>
          <button
            className={`panel-tab ${activeTab === 'output' ? 'active' : ''}`}
            onClick={() => setActiveTab('output')}
          >
            Output
          </button>
          <button
            className={`panel-tab ${activeTab === 'problems' ? 'active' : ''}`}
            onClick={() => setActiveTab('problems')}
          >
            Problems
          </button>
          <button
            className={`panel-tab ${activeTab === 'debug' ? 'active' : ''}`}
            onClick={() => setActiveTab('debug')}
          >
            Debug Console
          </button>
        </div>
        {activeTab === 'terminal' && (
          <div className="terminal-tabs">
            {terminals.map((terminal) => (
              <button
                key={terminal.id}
                className={`terminal-tab ${activeTerminal === terminal.id ? 'active' : ''}`}
                onClick={() => setActiveTerminal(terminal.id)}
              >
                {terminal.status && (
                  <span className={`terminal-status-dot ${terminal.status}`} />
                )}
                <span className="terminal-tab-name">{terminal.name}</span>
                <span
                  className="terminal-close-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTerminal(terminal.id);
                  }}
                >
                  <FiX size={14} />
                </span>
              </button>
            ))}
            <button className="new-terminal-button" onClick={onNewTerminal}>
              +
            </button>
          </div>
        )}
      </div>
      <div className="panel-content">
        {activeTab === 'terminal' && terminals.length > 0 && (
          <div className="terminals-container">
            {terminals.map((terminal) => (
              <div
                key={terminal.id}
                ref={(el) => (terminalRefs.current[terminal.id] = el)}
                className={`terminal-instance ${activeTerminal === terminal.id ? 'active' : 'hidden'}`}
                data-terminal-id={backendTerminalIds.current[terminal.id] || ''}
                data-id={terminal.id}
              />
            ))}
          </div>
        )}
        {activeTab === 'terminal' && terminals.length === 0 && (
          <div className="empty-panel">
            <p>No terminal opened</p>
            <button className="primary-button" onClick={onNewTerminal}>
              New Terminal
            </button>
          </div>
        )}
        {activeTab === 'output' && (
          <OutputPanel outputLogs={outputLogs} />
        )}
        {activeTab === 'problems' && (
          <ProblemsPanel diagnostics={diagnostics} />
        )}
        {activeTab === 'debug' && (
          <DebugConsole debugLogs={debugLogs} />
        )}
      </div>
    </div>
  );
}

export default Panel;
