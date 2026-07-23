import React from 'react';
import MonacoEditor from '@monaco-editor/react';

export default function Editor({ file, value, onChange, onSave }) {
  const getLanguage = (filename) => {
    if (!filename) return 'javascript';
    const ext = filename.split('.').pop();
    switch (ext) {
      case 'js': return 'javascript';
      case 'py': return 'python';
      case 'java': return 'java';
      case 'cpp': return 'cpp';
      case 'c': return 'c';
      case 'html': return 'html';
      case 'css': return 'css';
      case 'json': return 'json';
      case 'md': return 'markdown';
      default: return 'plaintext';
    }
  };

  const handleEditorChange = (val) => {
    onChange(val || '');
  };

  // Bind Ctrl+S to save code
  const handleEditorDidMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave();
    });
  };

  if (!file) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#8C99AD',
        fontSize: '0.9rem',
        background: '#0B1D3A'
      }}>
        Open or create a file to start coding.
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="tab-bar">
        <div className="tab active">
          <span>{file.name}</span>
        </div>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <MonacoEditor
          height="100%"
          language={getLanguage(file.name)}
          theme="vs-dark"
          value={value}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', monospace",
            lineNumbers: 'on',
            automaticLayout: true,
            tabSize: 2,
            scrollbar: {
              vertical: 'visible',
              horizontal: 'visible',
            }
          }}
        />
      </div>
    </div>
  );
}
