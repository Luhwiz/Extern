import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { FiX, FiMonitor, FiUploadCloud, FiChevronDown, FiMaximize2, FiMinimize2 } from 'react-icons/fi';
import SupabasePanel from './SupabasePanel';
import GitHubPanel from './GitHubPanel';
import IntegrationsPanel, { StripeLogo, OpenAILogo, FirebaseLogo, AnthropicLogo } from './IntegrationsPanel';
import { FiGrid } from 'react-icons/fi';
import ExplanationService from '../services/ExplanationService';
import './EditorArea.css';
import './EditorAreaExplanation.css';

const SupabaseIconBtn = () => (
  <svg width="16" height="16" viewBox="0 0 109 113" fill="none" style={{ flexShrink: 0 }}>
    <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#sb_g1)"/>
    <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#sb_g2)" fillOpacity="0.2"/>
    <path d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.04075L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z" fill="#3ECF8E"/>
    <defs>
      <linearGradient id="sb_g1" x1="53.9738" y1="54.974" x2="94.1635" y2="71.8295" gradientUnits="userSpaceOnUse">
        <stop stopColor="#249361"/><stop offset="1" stopColor="#3ECF8E"/>
      </linearGradient>
      <linearGradient id="sb_g2" x1="36.1558" y1="30.578" x2="54.4844" y2="65.0806" gradientUnits="userSpaceOnUse">
        <stop/><stop offset="1" stopOpacity="0"/>
      </linearGradient>
    </defs>
  </svg>
);

const GitHubIconBtn = () => (
  <svg width="16" height="16" viewBox="0 0 98 96" fill="currentColor" style={{ flexShrink: 0 }}>
    <path fillRule="evenodd" clipRule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"/>
  </svg>
);

function EditorArea({ openFiles, activeFile, onFileSelect, onFileClose, onContentChange, onOpenFolder, onStartBuilding, onBuildIdea, theme, onPreviewClick, onPublishClick, onCursorChange, pendingPlan, devServerUrl, showSupabase, onSupabaseToggle, showGitHub, onGitHubToggle, showIntegrations, onIntegrationsToggle, onSendToAI, workspaceFolder }) {
  const [showHowTo, setShowHowTo] = React.useState(false);
  const [previewUrl, setPreviewUrl] = useState('http://localhost:3000');
  const [fontSize, setFontSize] = useState(8.5);
  const [tabSize, setTabSize] = useState(2);
  const [viewMode, setViewMode] = useState('split'); // 'split', 'code', 'explanation'
  const [fileExplanations, setFileExplanations] = useState({}); // Cache explanations per file
  const [loadingExplanation, setLoadingExplanation] = useState(false);
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
    const savedFontSize = parseInt(localStorage.getItem('editorFontSize')) || 10;
    const savedTabSize = parseInt(localStorage.getItem('editorTabSize')) || 2;
    setFontSize(savedFontSize);
    setTabSize(savedTabSize);

    // Listen for storage changes to update in real-time
    const handleStorageChange = () => {
      setFontSize(parseInt(localStorage.getItem('editorFontSize')) || 10);
      setTabSize(parseInt(localStorage.getItem('editorTabSize')) || 2);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Parse explanation text into an array of bullet points
  const parseExplanationToBullets = (text) => {
    if (!text) return [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const hasBullets = lines.some(l => /^[-•*]|^\d+[.)\s]/.test(l));
    if (hasBullets) {
      const bullets = [];
      let current = '';
      for (const line of lines) {
        if (/^[-•*]|^\d+[.)\s]/.test(line)) {
          if (current) bullets.push(current.trim());
          current = line.replace(/^[-•*]\s*|^\d+[.)\s]+/, '').trim();
        } else if (current) {
          current += ' ' + line;
        } else {
          bullets.push(line);
        }
      }
      if (current) bullets.push(current.trim());
      return bullets.filter(b => b.length > 0);
    }
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    return sentences.map(s => s.trim()).filter(s => s.length > 10);
  };

  // Render bullet text, turning **word** into green-coloured spans, stripping HTML tags
  const renderBulletText = (text) => {
    const clean = text.replace(/<\/?[^>]+(>|$)/g, '');
    const parts = clean.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1
        ? <span key={i} className="expl-highlight">{part}</span>
        : part
    );
  };

  // Fetch explanation when file changes
  useEffect(() => {
    if (!currentFile) return;
    
    // Check if we already have explanation for this file
    if (fileExplanations[currentFile.id]) return;

    const fetchExplanation = async () => {
      setLoadingExplanation(true);
      const result = await ExplanationService.explainFile(
        currentFile.name,
        currentFile.content,
        currentFile.language
      );
      
      if (result.success) {
        setFileExplanations(prev => ({
          ...prev,
          [currentFile.id]: result.explanation
        }));
      }
      setLoadingExplanation(false);
    };

    fetchExplanation();
  }, [currentFile, fileExplanations]);

  const handleEditorChange = (value) => {
    if (currentFile) {
      onContentChange(currentFile.id, value);
    }
  };

  const handleEditorDidMount = (editor, monaco) => {
    // Define a custom light theme that matches the app's greyish aesthetic
    monaco.editor.defineTheme('premium-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': 'var(--vscode-bg)',
      }
    });

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
  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'premium-light';

  return (
    <div className="editor-area">
      <div className="editor-tabs">
        <div className="editor-toolbar">
          <button
            className={`toolbar-button toolbar-button--github${showGitHub ? ' active' : ''}`}
            onClick={onGitHubToggle}
            title="GitHub — save and back up your code"
          >
            <GitHubIconBtn />
            GitHub
            <FiChevronDown size={12} style={{ marginLeft: '2px', opacity: 0.6 }} />
          </button>
          <button
            className={`toolbar-button toolbar-button--supabase${showSupabase ? ' active' : ''}`}
            onClick={onSupabaseToggle}
            title="Open Supabase integration"
          >
            <SupabaseIconBtn />
            Supabase
            <FiChevronDown size={12} style={{ marginLeft: '2px', opacity: 0.6 }} />
          </button>
          <button
            className={`toolbar-button toolbar-button--integrations${showIntegrations ? ' active' : ''}`}
            onClick={onIntegrationsToggle}
            title="Integrations — add Stripe, OpenAI, and more"
          >
            <div className="integration-icons-stack">
              <div className="integration-icon-circle">
                <StripeLogo />
              </div>
              <div className="integration-icon-circle">
                <OpenAILogo />
              </div>
              <div className="integration-icon-circle">
                <FirebaseLogo />
              </div>
              <div className="integration-icon-circle">
                <AnthropicLogo />
              </div>
            </div>
            Integrations
            <FiChevronDown size={12} style={{ marginLeft: '2px', opacity: 0.6 }} />
          </button>
          <button
            className="toolbar-button toolbar-button--preview"
            onClick={handlePreviewClick}
            title="Open Live Preview"
          >
            <FiMonitor size={16} />
            Preview
          </button>
          <button
            className="toolbar-button toolbar-button--publish"
            onClick={onPublishClick}
            title="Deploy and get shareable link"
          >
            <FiUploadCloud size={16} />
            Publish
          </button>
        </div>
        <div className="editor-tabs-row">
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
                <FiX size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="editor-content" style={{ position: 'relative' }}>
        {showGitHub && (
          <GitHubPanel workspaceFolder={workspaceFolder} onClose={onGitHubToggle} />
        )}
        {showSupabase && (
          <SupabasePanel workspaceFolder={workspaceFolder} onClose={onSupabaseToggle} />
        )}
        {showIntegrations && (
          <IntegrationsPanel workspaceFolder={workspaceFolder} onClose={onIntegrationsToggle} onSendToAI={onSendToAI} />
        )}
        {!showGitHub && !showSupabase && !showIntegrations && openFiles.length > 0 ? (
          <div className="editor-pane" style={{ display: activeFile ? 'flex' : 'none' }}>
            {currentFile && (
              <div className="editor-split-view">
                {/* Code editor — left */}
                <div className={`editor-split-code ${viewMode === 'code' ? 'editor-split-code--fullwidth' : ''} ${viewMode === 'explanation' ? 'editor-split-code--hidden' : ''}`}>
                  <div className="editor-code-header">
                    <div className="editor-code-label">CODE</div>
                    <button 
                      className="expl-expand-btn expl-expand-btn--labeled" 
                      onClick={() => setViewMode(viewMode === 'code' ? 'split' : 'code')}
                    >
                      {viewMode === 'code' ? <FiMinimize2 size={12} /> : <FiMaximize2 size={12} />}
                      <span>{viewMode === 'code' ? 'Split View' : 'Expand'}</span>
                    </button>
                  </div>
                  <div className="editor-code-body">
                    <Editor
                      height="100%"
                      language={currentFile.language}
                      value={currentFile.content}
                      theme={monacoTheme}
                      onMount={handleEditorDidMount}
                      loading={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--vscode-fg)' }}>Loading editor...</div>}
                      options={{
                        fontSize: fontSize,
                        lineHeight: 12,
                        fontFamily: "Menlo, Monaco, 'Courier New', monospace",
                        fontLigatures: true,
                        minimap: { enabled: true },
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        stickyScroll: { enabled: false },
                        breadcrumbs: { enabled: false },
                        tabSize: tabSize,
                        insertSpaces: true,
                        wordWrap: 'on',
                        lineNumbers: 'on',
                        lineNumbersMinChars: 3,
                        glyphMargin: false,
                        folding: true,
                        renderWhitespace: 'selection',
                        cursorBlinking: 'smooth',
                        cursorSmoothCaretAnimation: true,
                        smoothScrolling: true,
                        quickSuggestions: false,
                        suggestOnTriggerCharacters: false,
                        acceptSuggestionOnCommitCharacter: false,
                        acceptSuggestionOnEnter: 'off',
                        tabCompletion: 'off',
                        wordBasedSuggestions: false,
                        parameterHints: { enabled: false },
                        hover: { enabled: false },
                        links: false,
                        colorDecorators: false,
                        lightbulb: { enabled: false },
                        scrollbar: { vertical: 'hidden', horizontal: 'hidden', handleMouseWheel: false },
                        overviewRulerLanes: 0,
                        hideCursorInOverviewRuler: true,
                        overviewRulerBorder: false,
                        readOnly: true,
                      }}
                    />
                  </div>
                </div>

                {/* Explanation panel — right */}
                <div className={`editor-split-explanation ${viewMode === 'explanation' ? 'editor-split-explanation--fullwidth' : ''} ${viewMode === 'code' ? 'editor-split-explanation--hidden' : ''}`}>
                  <div className="expl-panel-header">
                    <div className="expl-panel-label">EXPLANATION</div>
                    <button 
                      className="expl-expand-btn expl-expand-btn--labeled" 
                      onClick={() => setViewMode(viewMode === 'explanation' ? 'split' : 'explanation')}
                    >
                      {viewMode === 'explanation' ? <FiMinimize2 size={12} /> : <FiMaximize2 size={12} />}
                      <span>{viewMode === 'explanation' ? 'Split View' : 'Expand'}</span>
                    </button>
                  </div>
                  <div className="expl-panel-divider" />
                  <div className="expl-panel-body">
                    {loadingExplanation ? (
                      <div className="expl-panel-loading">
                        <div className="expl-spinner"></div>
                        <span>Generating explanation...</span>
                      </div>
                    ) : fileExplanations[currentFile.id] ? (
                      <ul className="expl-bullet-list">
                        {parseExplanationToBullets(fileExplanations[currentFile.id]).map((point, i) => (
                          <li key={i} className="expl-bullet-item">
                            <span className="expl-bullet-check">✓</span>
                            <span className="expl-bullet-text">{renderBulletText(point)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="expl-panel-empty">
                        Could not generate explanation for this file.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="editor-welcome-empty" />
        )}
      </div>
    </div>
  );
}

export default EditorArea;
