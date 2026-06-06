import React, { useState } from 'react';
import './ReviewSidebar.css';

const ReviewSidebar = ({ 
  filesChanged = [], 
  backgroundTasks = [], 
  artifacts = [], 
  planContent = '',
  onClose,
  onFileClick
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedSections, setExpandedSections] = useState({
    subagents: true,
    files: true,
    artifacts: true,
    tasks: true
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const uniqueFiles = [...new Set(filesChanged)];
  const uniqueTasks = [...new Set(backgroundTasks)];

  return (
    <div className="review-sidebar">
      {/* Header Tabs */}
      <div className="review-header-tabs">
        <button 
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
          Overview
        </button>
        <button 
          className={`tab-btn ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          Files
        </button>
        <button className="close-btn" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
          </svg>
        </button>
      </div>

      {/* Title Area */}
      <div className="review-title-area">
        <h3>{activeTab === 'overview' ? 'Implementation Plan' : 'Files Created'}</h3>
      </div>

      <div className="review-content">
        {activeTab === 'overview' ? (
          <div className="plan-content">
            {planContent ? planContent.split('\n').map((line, i) => {
              if (!line.trim()) return <br key={i} />;
              // Render **bold** labels
              const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return <strong key={j}>{part.slice(2, -2)}</strong>;
                }
                return part;
              });
              return <p key={i} style={{ margin: '4px 0', lineHeight: '1.5' }}>{parts}</p>;
            }) : (
              <div className="plan-empty-state" style={{ textAlign: 'center', padding: '20px' }}>
                <span className="plan-empty" style={{ display: 'block', marginBottom: '12px' }}>No plan generated yet.</span>
                <button 
                  className="generate-plan-btn"
                  style={{ background: 'var(--vscode-button-background, #0e639c)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
                  onClick={() => {
                    // Send an event to AIAssistant to trigger plan generation
                    const event = new CustomEvent('trigger-plan-generation');
                    window.dispatchEvent(event);
                  }}
                >
                  Generate Plan Now
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Files Changed Section */}
            <div className="review-section">
              <div className="section-header" onClick={() => toggleSection('files')}>
                <span className="section-title">Files Created</span>
                <span className="count-badge">{uniqueFiles.length}</span>
                <svg className={`chevron ${expandedSections.files ? 'expanded' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
              {expandedSections.files && uniqueFiles.length > 0 && (
                <div className="section-body">
                  {uniqueFiles.map((file, idx) => {
                    const parts = file.split('/');
                    const name = parts.pop();
                    const path = parts.join('/');
                    return (
                      <div className="file-item" key={idx} onClick={() => onFileClick && onFileClick(file)}>
                        <svg className="file-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5cc9f5" strokeWidth="2">
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                        </svg>
                        <span className="file-name">{name}</span>
                        <span className="file-path">{path || '/'}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>


          </>
        )}
      </div>
    </div>
  );
};

export default ReviewSidebar;
