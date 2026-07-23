import React, { useState } from 'react';
import { Folder, File, Plus, Trash2, FolderPlus, RefreshCw } from 'lucide-react';

export default function FileExplorer({ files, onFileSelect, activeFile, onCreateFile, onCreateFolder, onDeleteFile, onRefresh }) {
  const [newEntryName, setNewEntryName] = useState('');
  const [showInput, setShowInput] = useState(null); // 'file' or 'folder' or null

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newEntryName.trim()) return;

    if (showInput === 'file') {
      onCreateFile(newEntryName.trim());
    } else if (showInput === 'folder') {
      onCreateFolder(newEntryName.trim());
    }

    setNewEntryName('');
    setShowInput(null);
  };

  return (
    <div className="left-panel">
      <div className="panel-header">
        <span>Workspace Files</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="tab-icon" style={{ width: '24px', height: '24px' }} onClick={() => setShowInput(showInput === 'file' ? null : 'file')} title="New File">
            <Plus size={14} />
          </button>
          <button className="tab-icon" style={{ width: '24px', height: '24px' }} onClick={() => setShowInput(showInput === 'folder' ? null : 'folder')} title="New Folder">
            <FolderPlus size={14} />
          </button>
          <button className="tab-icon" style={{ width: '24px', height: '24px' }} onClick={onRefresh} title="Refresh Workspace">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {showInput && (
        <form onSubmit={handleSubmit} style={{ padding: '8px 12px' }}>
          <input
            className="input-field"
            style={{ margin: 0, padding: '4px 8px', fontSize: '0.8rem' }}
            type="text"
            placeholder={showInput === 'file' ? "Filename (e.g. index.js)" : "Folder name"}
            value={newEntryName}
            onChange={(e) => setNewEntryName(e.target.value)}
            autoFocus
            onBlur={() => setTimeout(() => setShowInput(null), 200)}
          />
        </form>
      )}

      <div className="file-list">
        {files.length === 0 ? (
          <div style={{ padding: '16px', color: '#5B6472', fontSize: '0.85rem' }}>
            No files. Click "+" to create one.
          </div>
        ) : (
          files.map((file) => (
            <div
              key={file.path}
              className={`file-item ${activeFile?.path === file.path ? 'active' : ''}`}
              onClick={() => !file.isDirectory && onFileSelect(file)}
            >
              {file.isDirectory ? <Folder size={16} color="#3E6BD6" /> : <File size={16} color="#8C99AD" />}
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
              </span>
              <button
                style={{ background: 'transparent', border: 'none', color: '#5B6472', cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFile(file.path);
                }}
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
