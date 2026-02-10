import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { FiX, FiMonitor, FiCode, FiUploadCloud } from 'react-icons/fi';
import './EditorArea.css';

function EditorArea({ openFiles, activeFile, onFileSelect, onFileClose, onContentChange, onOpenFolder, theme, onPreviewClick, onPublishClick, onCursorChange, pendingPlan, devServerUrl }) {
  const [previewUrl, setPreviewUrl] = useState('http://localhost:3000');
  const [fontSize, setFontSize] = useState(12);
  const [tabSize, setTabSize] = useState(2);
  const currentFile = openFiles.find((f) => f.id === activeFile);

  // Sync previewUrl with devServerUrl when it changes
  useEffect(() => {
    if (devServerUrl) {
      setPreviewUrl(devServerUrl);
    }
  }, [devServerUrl]);

  // Debug logging for pendingPlan
  useEffect(() => {
    console.log('📺 [EditorArea] pendingPlan changed:', pendingPlan);
  }, [pendingPlan]);

  // Load editor settings from localStorage
  useEffect(() => {
    const savedFontSize = parseInt(localStorage.getItem('editorFontSize')) || 12;
    const savedTabSize = parseInt(localStorage.getItem('editorTabSize')) || 2;
    setFontSize(savedFontSize);
    setTabSize(savedTabSize);

    // Listen for storage changes to update in real-time
    const handleStorageChange = () => {
      setFontSize(parseInt(localStorage.getItem('editorFontSize')) || 12);
      setTabSize(parseInt(localStorage.getItem('editorTabSize')) || 2);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleEditorChange = (value) => {
    if (currentFile) {
      onContentChange(currentFile.id, value);
    }
  };

  const handleEditorDidMount = (editor, monaco) => {
    // Initial position update
    const position = editor.getPosition();
    if (position && onCursorChange) {
      onCursorChange({ line: position.lineNumber, column: position.column });
    }

    editor.onDidChangeCursorPosition((e) => {
      if (onCursorChange) {
        onCursorChange({ line: e.position.lineNumber, column: e.position.column });
      }
    });

    // Also update when focus changes as that might indicate a switch back to this editor
    editor.onDidFocusEditorText(() => {
      const position = editor.getPosition();
      if (position && onCursorChange) {
        onCursorChange({ line: position.lineNumber, column: position.column });
      }
    });
  };

  const handleCreateProject = async (projectType) => {
    // Open folder dialog
    const result = await window.electronAPI.dialog.openFolder();
    if (result && !result.canceled && result.filePaths && result.filePaths.length > 0) {
      const folderPath = result.filePaths[0];
      // Call onOpenFolder to set the workspace
      if (onOpenFolder) {
        onOpenFolder(folderPath);
      }
    }
  };

  const handlePreviewClick = () => {
    if (devServerUrl) {
      // If server is running, open in external browser
      window.electronAPI.shell.openExternal(devServerUrl);
    } else if (onPreviewClick) {
      // If server not running, trigger AI to start it
      onPreviewClick();
    }
  };

  // Determine Monaco theme based on app theme
  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'light';

  return (
    <div className="editor-area">
      <div className="editor-tabs">
        {openFiles.map((file) => (
          <div
            key={file.id}
            className={`editor-tab ${file.id === activeFile ? 'active' : ''}`}
            onClick={() => onFileSelect(file.id)}
          >
            <span className="tab-name">
              {file.isDirty && <span className="dirty-indicator">●</span>}
              {file.name}
            </span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onFileClose(file.id);
              }}
            >
              <FiX size={14} />
            </button>
          </div>
        ))}
        <div className="editor-toolbar">
          <button
            className="toolbar-button"
            onClick={handlePreviewClick}
            title="Open Live Preview"
          >
            <FiMonitor size={16} />
            Preview
          </button>
          <button
            className="toolbar-button"
            onClick={onPublishClick}
            title="Deploy and get shareable link"
          >
            <FiUploadCloud size={16} />
            Publish
          </button>
        </div>
      </div>
      <div className="editor-content">
        {openFiles.length > 0 ? (
          <div className="editor-pane" style={{ display: activeFile ? 'block' : 'none' }}>
            {currentFile && (
              <Editor
                height="100%"
                language={currentFile.language}
                value={currentFile.content}
                onChange={handleEditorChange}
                theme={monacoTheme}
                onMount={handleEditorDidMount}
                loading={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--vscode-fg)' }}>Loading editor...</div>}
                options={{
                  fontSize: fontSize,
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Source Code Pro', Menlo, Monaco, 'Courier New', monospace",
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: tabSize,
                  insertSpaces: true,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  renderWhitespace: 'selection',
                  scrollbar: {
                    vertical: 'auto',
                    horizontal: 'auto',
                  },
                }}
              />
            )}
          </div>
        ) : (
          <div className="editor-welcome">
            <h1>ExternAI</h1>
            <p className="welcome-subtitle">Your AI-Powered Software Development Environment</p>
            <div className="welcome-description" style={{ maxWidth: '600px', margin: '0 auto', opacity: 0.8 }}>
              <p>Ready to bring your ideas to life? Just tell the AI what you want to create—from simple websites to complex apps. We'll handle the coding, so you can focus on your vision.</p>
              <p style={{ marginTop: '20px', fontSize: '0.9em' }}>To get started, describe your project in the chat on the right!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EditorArea;
