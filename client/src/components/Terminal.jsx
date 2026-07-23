import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TermIcon, Play, AlertCircle, RefreshCw } from 'lucide-react';

export default function Terminal({
  terminalLogs,
  onTerminalInput,
  onRunCode,
  activeFile,
  isRunning,
  isBridgeConnected,
  sandboxMode
}) {
  const [inputVal, setInputVal] = useState('');
  const terminalEndRef = useRef(null);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onTerminalInput(inputVal + '\n');
      setInputVal('');
    }
  };

  return (
    <div className="terminal-panel">
      <div className="terminal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TermIcon size={14} />
          <span>Terminal Output {sandboxMode && "(Sandbox Mode)"}</span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {isBridgeConnected && !sandboxMode && (
            <span style={{ color: '#3EBE7A', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Bridge Connected
            </span>
          )}
          {sandboxMode && (
            <span style={{ color: '#EAA12A', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertCircle size={12} /> Piston Sandbox fallback
            </span>
          )}
          <button
            className="btn btn-primary"
            style={{ padding: '2px 8px', fontSize: '0.75rem', borderRadius: '4px' }}
            onClick={onRunCode}
            disabled={isRunning || !activeFile}
          >
            <Play size={12} /> {isRunning ? "Running..." : "Run Code"}
          </button>
        </div>
      </div>
      <div className="terminal-body">
        {terminalLogs.map((log, idx) => (
          <div key={idx} className="terminal-line">
            {log}
          </div>
        ))}
        {isBridgeConnected && !sandboxMode && (
          <div className="terminal-input-row">
            <span className="terminal-input-prompt">$</span>
            <input
              type="text"
              className="terminal-input"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type shell command..."
            />
          </div>
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
