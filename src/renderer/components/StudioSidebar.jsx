import React from 'react';
import './StudioSidebar.css';
import { FiMenu, FiPlus, FiBox, FiGrid, FiBookOpen, FiSearch, FiStar, FiKey, FiSettings, FiChevronRight, FiMessageSquare, FiFolder, FiUploadCloud, FiCode, FiLogOut, FiLayers, FiImage, FiGlobe, FiUser, FiLogIn } from 'react-icons/fi';

const StudioSidebar = ({ collapsed, onToggle, onOpenFolder, onPublish, onAdvancedMode, onIntegrations, onDocumentation, onSettings, onImages, onPublishedApps, onChatAssistant, onUpgrade, currentUser, onLogin, onLogout }) => {
  return (
    <div className={`studio-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="studio-sidebar-header">
        <button className="icon-btn menu-btn" onClick={onToggle}>
          <FiMenu size={18} strokeWidth={1.5} />
        </button>
        {!collapsed && <div className="studio-logo">Extern AI Studio</div>}
        {collapsed && <div className="studio-logo-small">E</div>}
      </div>

      <div className="studio-nav-section">
        <div className="nav-item active" onClick={onChatAssistant}>
          <FiMessageSquare size={16} strokeWidth={1.5} />
          {!collapsed && <span>Chat Assistant</span>}
        </div>
        
        <div className="nav-item" onClick={onOpenFolder}>
          <FiFolder size={16} strokeWidth={1.5} />
          {!collapsed && <span>Open Project</span>}
        </div>

        <div className="nav-item" onClick={onPublish}>
          <FiUploadCloud size={16} strokeWidth={1.5} />
          {!collapsed && <span>Deploy App</span>}
        </div>
        
        <div className="nav-item" onClick={onPublishedApps}>
          <FiGlobe size={16} strokeWidth={1.5} />
          {!collapsed && <span>Published Apps</span>}
        </div>
      </div>

      <div className="studio-sidebar-footer">
        {!collapsed && (
          <div className="upgrade-card" onClick={onUpgrade}>
            <div className="upgrade-title">Upgrade to unlock more</div>
            <div className="upgrade-desc">Access higher limits, Pro models, and more.</div>
          </div>
        )}
        <div className="nav-item" onClick={onSettings}>
          <FiSettings size={16} strokeWidth={1.5} />
          {!collapsed && <span>Settings</span>}
        </div>
        
        {currentUser ? (
          <div className="nav-item user-profile-btn" onClick={onLogout}>
            <FiLogOut size={16} strokeWidth={1.5} />
            {!collapsed && <span>Log Out ({currentUser.displayName || currentUser.email})</span>}
          </div>
        ) : (
          <div className="nav-item user-profile-btn" onClick={onLogin}>
            <FiLogIn size={16} strokeWidth={1.5} />
            {!collapsed && <span>Log In</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudioSidebar;
