import React from 'react';
import { FiX, FiSun, FiMoon } from 'react-icons/fi';
import './SettingsModal.css';

const SettingsModal = ({ onClose, theme, setTheme }) => {
  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal-content">
        <div className="settings-modal-header">
          <h2>Settings</h2>
          <button className="settings-close-btn" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>
        
        <div className="settings-modal-body">
          <div className="settings-section">
            <h3>Appearance</h3>
            <div className="settings-row">
              <div className="settings-info">
                <h4>Theme</h4>
                <p>Choose between light and dark mode</p>
              </div>
              <div className="theme-toggle-group">
                <button 
                  className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => setTheme('light')}
                >
                  <FiSun size={16} />
                  <span>Light</span>
                </button>
                <button 
                  className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => setTheme('dark')}
                >
                  <FiMoon size={16} />
                  <span>Dark</span>
                </button>
              </div>
            </div>
          </div>
          
          <div className="settings-section">
            <h3>Editor</h3>
            <div className="settings-row">
              <div className="settings-info">
                <h4>Font Size</h4>
                <p>Adjust the code editor text size</p>
              </div>
              <input 
                type="number" 
                className="settings-input"
                defaultValue={localStorage.getItem('editorFontSize') || 10}
                onChange={(e) => {
                  localStorage.setItem('editorFontSize', e.target.value);
                  window.dispatchEvent(new Event('storage'));
                }}
                min="8" max="24"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
