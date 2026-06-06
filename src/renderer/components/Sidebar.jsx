import React from 'react';
import { FiZap } from 'react-icons/fi';
import Explorer from './sidebar/Explorer';
import Search from './sidebar/Search';
import SourceControl from './sidebar/SourceControl';
import RunDebug from './sidebar/RunDebug';
import ImageSearch from './sidebar/ImageSearch';
import Settings from './sidebar/Settings';
import AnalyticsService from '../services/AnalyticsService';
import './Sidebar.css';

function Sidebar({ activeView, workspaceFolder, onOpenFile, onOpenFolder, explorerRefreshTrigger, onExplorerRefresh, onLogout, hasAiResponded }) {
  const renderView = () => {
    // Track sidebar view changes
    if (activeView) {
      AnalyticsService.trackFeatureUsage('Sidebar', 'view_displayed', activeView);
    }

    switch (activeView) {
      case 'explorer':
        return (
          <Explorer
            workspaceFolder={workspaceFolder}
            onOpenFile={onOpenFile}
            onOpenFolder={onOpenFolder}
            refreshTrigger={explorerRefreshTrigger}
            onRefresh={onExplorerRefresh}
            hasAiResponded={hasAiResponded}
          />
        );
      case 'search':
        return <Search workspaceFolder={workspaceFolder} onOpenFile={onOpenFile} />;
      case 'git':
        return <SourceControl workspaceFolder={workspaceFolder} />;
      case 'run':
        return <RunDebug workspaceFolder={workspaceFolder} />;
      case 'images':
        return <ImageSearch />;
      case 'extensions':
        return <div className="sidebar-content">Extensions</div>;
      case 'settings':
        return <Settings onLogout={onLogout} />;
      default:
        return null;
    }
  };

  return (
    <div className="sidebar">
      {renderView()}
    </div>
  );
}

export default Sidebar;
