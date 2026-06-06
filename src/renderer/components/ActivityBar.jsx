import React from 'react';
import { 
  FiFile, 
  FiSettings,
  FiImage,
  FiGlobe,
  FiLayout
} from 'react-icons/fi';
import './ActivityBar.css';

function ActivityBar({ activeView, onViewChange, onShowPublishedApps, onStudioMode }) {
  const buttons = [
    { id: 'explorer', icon: FiFile, tooltip: 'Explorer', label: 'Explorer' },
  ];

  return (
    <div className="activity-bar">
      <div className="activity-buttons">
        {buttons.map((button) => (
          <button
            key={button.id}
            className={`activity-button ${activeView === button.id ? 'active' : ''}`}
            onClick={() => onViewChange(button.id)}
            title={button.tooltip}
          >
            <button.icon size={22} />
            <span className="activity-label">{button.label}</span>
          </button>
        ))}
      </div>
      <div className="activity-buttons-bottom">
        {onStudioMode && (
          <button
            className="activity-button"
            onClick={onStudioMode}
            title="Return to Studio Mode"
          >
            <FiLayout size={22} />
            <span className="activity-label">Studio<br/>Mode</span>
          </button>
        )}
        <button
          className="activity-button"
          onClick={() => onViewChange('settings')}
          title="Settings"
        >
          <FiSettings size={22} />
          <span className="activity-label">Settings</span>
        </button>
      </div>
    </div>
  );
}

export default ActivityBar;
