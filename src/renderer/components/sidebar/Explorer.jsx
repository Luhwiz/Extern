import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FiFolderPlus, FiFilePlus, FiRefreshCw, FiFolder, FiFile, FiChevronRight, FiChevronDown,
  FiCode, FiImage, FiFileText, FiSettings, FiAlertCircle
} from 'react-icons/fi';
import {
  SiJavascript, SiTypescript, SiReact, SiHtml5, SiCss3, SiJson,
  SiPython, SiMarkdown, SiGit, SiNodedotjs
} from 'react-icons/si';
import './Explorer.css';

// File icon mapping based on extension
const getFileIcon = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase();
  const iconProps = { size: 16 };

  // Special files
  if (fileName === 'package.json' || fileName === 'package-lock.json') {
    return <SiNodedotjs {...iconProps} style={{ color: '#68a063' }} />;
  }
  if (fileName === '.gitignore' || fileName === '.gitattributes') {
    return <SiGit {...iconProps} style={{ color: '#f05032' }} />;
  }
  if (fileName === 'README.md') {
    return <SiMarkdown {...iconProps} style={{ color: '#083fa1' }} />;
  }

  // Extension-based icons
  const iconMap = {
    // JavaScript/TypeScript
    'js': <SiJavascript {...iconProps} style={{ color: '#f7df1e' }} />,
    'jsx': <SiReact {...iconProps} style={{ color: '#61dafb' }} />,
    'ts': <SiTypescript {...iconProps} style={{ color: '#3178c6' }} />,
    'tsx': <SiReact {...iconProps} style={{ color: '#3178c6' }} />,
    'mjs': <SiJavascript {...iconProps} style={{ color: '#f7df1e' }} />,
    'cjs': <SiJavascript {...iconProps} style={{ color: '#f7df1e' }} />,

    // Web
    'html': <SiHtml5 {...iconProps} style={{ color: '#e34c26' }} />,
    'css': <SiCss3 {...iconProps} style={{ color: '#264de4' }} />,
    'scss': <SiCss3 {...iconProps} style={{ color: '#c69' }} />,
    'sass': <SiCss3 {...iconProps} style={{ color: '#c69' }} />,
    'less': <SiCss3 {...iconProps} style={{ color: '#1d365d' }} />,

    // Data
    'json': <SiJson {...iconProps} style={{ color: '#f7df1e' }} />,
    'xml': <FiCode {...iconProps} style={{ color: '#ff6600' }} />,
    'yaml': <FiFileText {...iconProps} style={{ color: '#cb171e' }} />,
    'yml': <FiFileText {...iconProps} style={{ color: '#cb171e' }} />,
    'toml': <FiFileText {...iconProps} style={{ color: '#9c4221' }} />,

    // Python
    'py': <SiPython {...iconProps} style={{ color: '#3776ab' }} />,
    'pyc': <SiPython {...iconProps} style={{ color: '#646464' }} />,

    // Markdown & Docs
    'md': <SiMarkdown {...iconProps} style={{ color: '#083fa1' }} />,
    'mdx': <SiMarkdown {...iconProps} style={{ color: '#f9ac00' }} />,
    'txt': <FiFileText {...iconProps} />,

    // Config
    'env': <FiSettings {...iconProps} style={{ color: '#faf047' }} />,
    'config': <FiSettings {...iconProps} />,
    'conf': <FiSettings {...iconProps} />,

    // Images
    'png': <FiImage {...iconProps} style={{ color: '#a074c4' }} />,
    'jpg': <FiImage {...iconProps} style={{ color: '#a074c4' }} />,
    'jpeg': <FiImage {...iconProps} style={{ color: '#a074c4' }} />,
    'gif': <FiImage {...iconProps} style={{ color: '#a074c4' }} />,
    'svg': <FiImage {...iconProps} style={{ color: '#ffb13b' }} />,
    'ico': <FiImage {...iconProps} style={{ color: '#a074c4' }} />,
    'webp': <FiImage {...iconProps} style={{ color: '#a074c4' }} />,
  };

  return iconMap[ext] || <FiFile {...iconProps} />;
};

function Explorer({ workspaceFolder, onOpenFile, onOpenFolder, refreshTrigger, onRefresh, hasAiResponded }) {
  const [folderTree, setFolderTree] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingIn, setCreatingIn] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (workspaceFolder) {
      loadFolder(workspaceFolder);
    }
  }, [workspaceFolder]);

  // Refresh when trigger changes (manual refresh fallback)
  useEffect(() => {
    if (workspaceFolder && refreshTrigger > 0) {
      console.log('[INFO] Explorer refresh triggered:', refreshTrigger);
      loadFolder(workspaceFolder);
    }
  }, [refreshTrigger, workspaceFolder]);

  // Debug: Log when folderTree changes
  useEffect(() => {
    if (folderTree) {
      console.log('� FolderTree updated:', {
        path: folderTree.path,
        itemCount: folderTree.items?.length || 0,
        items: folderTree.items?.map(i => i.name) || []
      });
    }
  }, [folderTree]);

  useEffect(() => {
    // Click outside handler to cancel folder creation
    const handleClickOutside = (e) => {
      if (creatingFolder && inputRef.current && !inputRef.current.contains(e.target)) {
        handleCancelCreateFolder();
      }
    };

    if (creatingFolder) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [creatingFolder]);

  // Unified refresh handler
  const handleRefresh = useCallback(() => {
    if (!workspaceFolder) return;
    console.log('[INFO] Explorer refreshing...');
    loadFolder(workspaceFolder);

    // Also trigger AI sync if available
    if (onRefresh) {
      console.log('� Triggering AI file sync...');
      onRefresh();
    }
  }, [workspaceFolder, onRefresh]);

  // Effect to reload when workspaceFolder changes
  useEffect(() => {
    handleRefresh();
  }, [workspaceFolder, handleRefresh]);

  // Effect to reload when refresh trigger prop changes
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log('[INFO] Trigger prop changed:', refreshTrigger);
      handleRefresh();
    }
  }, [refreshTrigger, handleRefresh]);

  // Auto-refresh Explorer when files are added/removed via file watcher
  useEffect(() => {
    if (!workspaceFolder) return;

    // Debounce refresh for file watcher events
    let refreshTimeout;
    const debouncedRefresh = () => {
      clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        console.log('[INFO] Auto-refreshing explorer (watcher event)');
        handleRefresh();
      }, 500);
    };

    // Set up file watcher listeners
    const handleFileChange = (path) => {
      console.log('[INFO] File system change:', path);
      debouncedRefresh();
    };

    // Register listeners
    // Clean up old listeners first if any (though this effect runs on mount/unmount usually)
    const cleanup = () => {
      clearTimeout(refreshTimeout);
    };

    // We need to bind these to the current instance of debouncedRefresh
    const onFileAdded = (p) => handleFileChange(p);
    const onDirAdded = (p) => handleFileChange(p);
    const onFileRemoved = (p) => handleFileChange(p);
    const onDirRemoved = (p) => handleFileChange(p);

    if (window.electronAPI?.watch) {
      window.electronAPI.watch.onFileAdded(onFileAdded);
      window.electronAPI.watch.onDirAdded(onDirAdded);
      window.electronAPI.watch.onFileRemoved(onFileRemoved);
      window.electronAPI.watch.onDirRemoved(onDirRemoved);
    }

    return () => {
      cleanup();
      // Ideally we would remove listeners here, but the API might not support it cleanly
      // or we rely on the bridge to handle it. 
      // Since we use closures, new listeners are registered on re-render if dependencies change.
    };
  }, [workspaceFolder, handleRefresh]);

  const loadFolder = async (path) => {
    console.log('[INFO] Loading folder:', path);
    const result = await window.electronAPI.fs.readDir(path);
    if (result.success) {
      console.log('[OK] Folder loaded, items:', result.items.length);
      console.log('[INFO] Items:', result.items.map(i => i.name));
      
      // Auto-expand recommended folders (src, public, components)
      const loadedTree = { path, items: [...result.items] };
      const allPaths = new Set([path]);
      
      const shouldAutoExpand = (folderName, depth) => {
        if (depth === 0) return true; // Always expand root
        if (depth === 1) {
          // Expand important first-level folders
          return ['src', 'public', 'components', 'pages', 'app', 'lib', 'utils'].includes(folderName);
        }
        if (depth === 2) {
          // Expand second-level only for specific paths
          return ['components', 'pages', 'routes', 'views'].includes(folderName);
        }
        return false; // Don't auto-expand deeper levels
      };
      
      const loadSubdirs = async (items, parentPath, depth) => {
        for (const item of items) {
          if (item.isDirectory && shouldAutoExpand(item.name, depth)) {
            allPaths.add(item.path);
            const subResult = await window.electronAPI.fs.readDir(item.path);
            if (subResult.success) {
              item.children = subResult.items;
              await loadSubdirs(item.children, item.path, depth + 1);
            }
          }
        }
      };
      
      await loadSubdirs(loadedTree.items, path, 1);
      
      setFolderTree(loadedTree);
      setExpandedFolders(allPaths);
    } else {
      console.error('[ERROR] Failed to load folder:', result.error);
    }
  };

  const handleOpenFolder = async () => {
    const result = await window.electronAPI.dialog.openFolder();
    if (!result.canceled) {
      onOpenFolder(result.filePaths[0]);
    }
  };

  const handleItemClick = async (item) => {
    if (item.isDirectory) {
      const newExpanded = new Set(expandedFolders);
      if (expandedFolders.has(item.path)) {
        newExpanded.delete(item.path);
      } else {
        newExpanded.add(item.path);
        // Load children for this directory if not already loaded
        if (!item.children) {
          const result = await window.electronAPI.fs.readDir(item.path);
          if (result.success) {
            item.children = result.items;
            // Force re-render by updating folderTree
            setFolderTree({ ...folderTree });
          }
        }
      }
      setExpandedFolders(newExpanded);
    } else {
      onOpenFile(item.path);
    }
  };

  const handleNewFolder = () => {
    console.log('New folder button clicked, workspace:', workspaceFolder);
    setCreatingFolder(true);
    setCreatingIn(workspaceFolder);
    setNewFolderName('');
  };

  const handleNewFile = async () => {
    const fileName = prompt('Enter file name:');
    if (fileName && workspaceFolder) {
      const filePath = `${workspaceFolder}/${fileName}`;
      const result = await window.electronAPI.fs.createFile(filePath);
      if (result.success) {
        loadFolder(workspaceFolder);
        onOpenFile(filePath);
      }
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (newFolderName && creatingIn) {
      const folderPath = `${creatingIn}/${newFolderName}`;
      const result = await window.electronAPI.fs.createDir(folderPath);
      if (result.success) {
        setCreatingFolder(false);
        setNewFolderName('');
        setCreatingIn(null);
        loadFolder(workspaceFolder);
        // Expand the parent folder
        setExpandedFolders(new Set([...expandedFolders, creatingIn]));
      } else {
        alert(`Failed to create folder: ${result.error}`);
      }
    }
  };

  const handleCancelCreateFolder = (e) => {
    // Only cancel if explicitly requested (Escape key) or clicking outside
    // Don't cancel on blur if we're submitting
    if (e && e.type === 'blur' && e.relatedTarget?.closest('form')) {
      return; // Don't cancel if clicking within the form
    }
    setCreatingFolder(false);
    setNewFolderName('');
    setCreatingIn(null);
  };

  const handleContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();

    if (item.isDirectory) {
      setCreatingFolder(true);
      setCreatingIn(item.path);
      setNewFolderName('');
    }
  };

  const renderTreeItem = (item, depth = 0) => {
    const isExpanded = expandedFolders.has(item.path);

    return (
      <div key={item.path}>
        <div
          className={`tree-item ${item.isDirectory ? 'tree-item-folder' : 'tree-item-file'}`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => handleItemClick(item)}
          onContextMenu={(e) => handleContextMenu(e, item)}
        >
          {item.isDirectory && (
            <span className="tree-chevron">
              {isExpanded ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
            </span>
          )}
          <span className="tree-icon">
            {item.isDirectory ? (
              <FiFolder size={16} style={{ color: isExpanded ? '#dcb67a' : '#c09553' }} />
            ) : (
              getFileIcon(item.name)
            )}
          </span>
          <span className="tree-label" title={item.name}>{item.name}</span>
        </div>
        {creatingFolder && creatingIn === item.path && (
          <form
            onSubmit={handleCreateFolder}
            className="new-folder-input-container"
            style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
          >
            <span className="tree-icon">
              <FiFolder size={16} />
            </span>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  handleCancelCreateFolder();
                }
              }}
              placeholder="Folder name"
              className="new-folder-input"
              autoFocus
            />
          </form>
        )}
        {isExpanded && item.children && item.children.length > 0 && item.children.map((child) => renderTreeItem(child, depth + 1))}
      </div>
    );
  };

  if (!workspaceFolder) {
    return (
      <div className="explorer-empty">
        <p>No folder open</p>
        <button onClick={handleOpenFolder} className="explorer-open-btn">
          Open Folder
        </button>
      </div>
    );
  }

  return (
    <div className="explorer">
      {/* Explorer header removed as requested in card layout */}

      {hasAiResponded && (
        <div className="explorer-refresh-tip">
          <FiAlertCircle size={12} className="tip-icon" />
          <span>Click refresh if AI files are missing</span>
        </div>
      )}

      <div className="explorer-content">
        {workspaceFolder && (
          <div className="workspace-folder-header">
            <div className="workspace-folder-title">
              <FiChevronDown size={14} />
              <span>{workspaceFolder.split(/[/\\]/).pop().toUpperCase()}</span>
            </div>
          </div>
        )}
        {folderTree ? (
          <div className="folder-tree">
            {/* Render root level files directly */}
            {folderTree.items && folderTree.items.map((item) => renderTreeItem(item, 0))}
            {(!folderTree.items || folderTree.items.length === 0) && (
              <div style={{ padding: '20px', color: '#888', fontSize: '12px', textAlign: 'center' }}>
                No files in this folder
              </div>
            )}
          </div>
        ) : (
          <div className="loading">Loading...</div>
        )}
      </div>

      {creatingFolder && (
        <div className="new-folder-modal-overlay">
          <div className="new-folder-modal" ref={inputRef}>
            <h3>Create New Folder</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') setCreatingFolder(false);
              }}
            />
            <div className="modal-actions">
              <button onClick={() => setCreatingFolder(false)}>Cancel</button>
              <button onClick={handleCreateFolder} disabled={!newFolderName}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Explorer;
