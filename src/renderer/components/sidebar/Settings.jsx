import React, { useState, useEffect } from 'react';
import { FiSun, FiMoon, FiLogOut } from 'react-icons/fi';
import './Settings.css';

function Settings({ onLogout }) {
  const [fontSize, setFontSize] = useState(() => {
    return parseInt(localStorage.getItem('editorFontSize')) || 14;
  });
  
  const [tabSize, setTabSize] = useState(() => {
    return parseInt(localStorage.getItem('editorTabSize')) || 2;
  });

  useEffect(() => {
    localStorage.setItem('editorFontSize', fontSize.toString());
    // Apply font size globally to Monaco editor
    document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`);
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('editorTabSize', tabSize.toString());
    document.documentElement.style.setProperty('--editor-tab-size', tabSize.toString());
  }, [tabSize]);

  const handleFontSizeChange = (e) => {
    const value = parseInt(e.target.value);
    if (value >= 10 && value <= 24) {
      setFontSize(value);
    }
  };

  const handleTabSizeChange = (e) => {
    const value = parseInt(e.target.value);
    if (value >= 2 && value <= 8) {
      setTabSize(value);
    }
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h2>Settings</h2>
      </div>
      <div className="settings-content">

        <div className="settings-section">
          <h3>Editor</h3>
          <div className="settings-item">
            <div className="settings-item-label">
              <span>Font Size</span>
              <p className="settings-item-description">
                Control the font size in the editor
              </p>
            </div>
            <div className="settings-item-control">
              <input
                type="number"
                min="10"
                max="24"
                value={fontSize}
                onChange={handleFontSizeChange}
                className="settings-input"
              />
              <span className="settings-unit">px</span>
            </div>
          </div>
          <div className="settings-item">
            <div className="settings-item-label">
              <span>Tab Size</span>
              <p className="settings-item-description">
                Number of spaces for indentation
              </p>
            </div>
            <div className="settings-item-control">
              <input
                type="number"
                min="2"
                max="8"
                value={tabSize}
                onChange={handleTabSizeChange}
                className="settings-input"
              />
              <span className="settings-unit">spaces</span>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>Account</h3>
          <div className="settings-item">
            <div className="settings-item-label">
              <span>Sign Out</span>
              <p className="settings-item-description">
                Sign out of your account
              </p>
            </div>
            <div className="settings-item-control">
              <button className="logout-button" onClick={onLogout}>
                <FiLogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>About</h3>
          <div className="settings-item">
            <div className="settings-item-label">
              <span>Version</span>
            </div>
            <div className="settings-item-control">
              <span className="settings-value">1.0.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
