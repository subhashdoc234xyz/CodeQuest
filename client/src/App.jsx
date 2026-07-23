import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import FileExplorer from './components/FileExplorer';
import Editor from './components/Editor';
import Terminal from './components/Terminal';
import Visualizer from './components/Visualizer';
import LightChat from './components/LightChat';
import Roadmap from './components/Roadmap';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import ForgotPassword from './components/auth/ForgotPassword';
import { 
  Code, 
  Map, 
  LogOut, 
  Laptop, 
  Wifi, 
  WifiOff, 
  Search,
  Sparkles,
  Award
} from 'lucide-react';

function CodeQuestApp() {
  const { currentUser, logout } = useAuth();
  
  // App Layout State
  const [activeTab, setActiveTab] = useState('ide'); // 'ide' or 'roadmap'
  const [rightPanelTab, setRightPanelTab] = useState('explain'); // 'explain' or 'chat'
  const [authView, setAuthView] = useState('login'); // 'login', 'register', 'forgot'

  // XP / Streak
  const [xp, setXp] = useState(100);
  const [streak, setStreak] = useState(3);

  // Command Palette
  const [showPalette, setShowPalette] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState('');

  // File explorer & Editor states
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');

  // Terminal & execution states
  const [terminalLogs, setTerminalLogs] = useState([
    'Welcome to CodeQuest IDE!',
    'Connect the Local Bridge or run in Piston Sandbox mode.'
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [executionOutput, setExecutionOutput] = useState('');

  // Bridge socket connection state
  const [socketConnected, setSocketConnected] = useState(false);
  const [pairingRequired, setPairingRequired] = useState(true);
  const [pairingCodeInput, setPairingCodeInput] = useState('');
  const [bridgeError, setBridgeError] = useState('');
  const [sandboxMode, setSandboxMode] = useState(false);
  const wsRef = useRef(null);

  // Keyboard shortcut listener (Ctrl+Shift+P for command palette)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setShowPalette(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Web socket handlers for Local Bridge
  const connectBridge = (code) => {
    setBridgeError('');
    const ws = new WebSocket('ws://localhost:7420');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        action: 'pair',
        payload: { code }
      }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      
      if (msg.message === 'Authenticated successfully') {
        setSocketConnected(true);
        setPairingRequired(false);
        setSandboxMode(false);
        setTerminalLogs(prev => [...prev, 'System: Successfully paired and connected to Local Bridge!']);
        ws.send(JSON.stringify({
          action: 'openFolder',
          payload: { path: './workspace' }
        }));
      } else if (msg.message === 'Invalid pairing code') {
        setBridgeError('Invalid pairing code. Check agent terminal output.');
        ws.close();
      }

      if (msg.workspace) {
        ws.send(JSON.stringify({ action: 'listDir', payload: {} }));
      }

      if (msg.action === 'listDir' || msg.entries) {
        setFiles(msg.entries || []);
      }

      if (msg.action === 'readFile' || msg.content !== undefined) {
        setEditorContent(msg.content);
        setOriginalContent(msg.content);
      }

      if (msg.type === 'shell_output') {
        setTerminalLogs(prev => [...prev, msg.data]);
      }

      if (msg.type === 'run_output') {
        setTerminalLogs(prev => [...prev, msg.data]);
        setExecutionOutput(prev => prev + msg.data);
      }

      if (msg.type === 'run_exit') {
        setIsRunning(false);
        setTerminalLogs(prev => [...prev, `Process finished with exit code ${msg.code}`]);
      }
    };

    ws.onerror = () => {
      setBridgeError('Could not connect to Local Bridge. Make sure it is running on localhost:7420.');
    };

    ws.onclose = () => {
      setSocketConnected(false);
    };
  };

  const handlePairingSubmit = (e) => {
    e.preventDefault();
    if (!pairingCodeInput.trim()) return;
    connectBridge(pairingCodeInput.trim().toUpperCase());
  };

  const handleRefreshDir = () => {
    if (wsRef.current && socketConnected) {
      wsRef.current.send(JSON.stringify({ action: 'listDir', payload: {} }));
    }
  };

  const handleFileSelect = (file) => {
    setActiveFile(file);
    if (wsRef.current && socketConnected) {
      wsRef.current.send(JSON.stringify({
        action: 'readFile',
        payload: { path: file.path }
      }));
    }
  };

  const handleCreateFile = (name) => {
    if (!socketConnected) return;
    let content = '';
    const ext = name.split('.').pop();
    if (ext === 'py') content = '# Python Starter Code\nprint("Hello World!")\n';
    else if (ext === 'js') content = '// Node.js Starter Code\nconsole.log("Hello World!");\n';
    else if (ext === 'cpp') content = '#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << "Hello World!" << endl;\n  return 0;\n}\n';

    wsRef.current.send(JSON.stringify({
      action: 'createFile',
      payload: { path: name, content }
    }));
    setTimeout(handleRefreshDir, 300);
  };

  const handleCreateFolder = (name) => {
    if (!socketConnected) return;
    wsRef.current.send(JSON.stringify({
      action: 'createFolder',
      payload: { path: name }
    }));
    setTimeout(handleRefreshDir, 300);
  };

  const handleDeleteFile = (filePath) => {
    if (!socketConnected) return;
    wsRef.current.send(JSON.stringify({
      action: 'deleteEntry',
      payload: { path: filePath }
    }));
    if (activeFile?.path === filePath) {
      setActiveFile(null);
      setEditorContent('');
    }
    setTimeout(handleRefreshDir, 300);
  };

  const handleSaveFile = () => {
    if (wsRef.current && socketConnected && activeFile) {
      wsRef.current.send(JSON.stringify({
        action: 'writeFile',
        payload: { path: activeFile.path, content: editorContent }
      }));
      setOriginalContent(editorContent);
      setTerminalLogs(prev => [...prev, `Saved file: ${activeFile.name}`]);
    }
  };

  const handleRunCode = async () => {
    if (!activeFile) return;
    setTerminalLogs(prev => [...prev, `\n> Running ${activeFile.name}...`]);
    setExecutionOutput('');
    setIsRunning(true);

    if (socketConnected && !sandboxMode) {
      wsRef.current.send(JSON.stringify({
        action: 'runCode',
        payload: { path: activeFile.path }
      }));
    } else {
      const ext = activeFile.name.split('.').pop();
      let language = 'javascript';
      if (ext === 'py') language = 'python';
      else if (ext === 'java') language = 'java';
      else if (ext === 'c') language = 'c';
      else if (ext === 'cpp') language = 'cpp';

      try {
        const response = await fetch('https://emkc.org/api/v2/piston/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language,
            version: '*',
            files: [{ content: editorContent }]
          })
        });
        const data = await response.json();
        setIsRunning(false);
        const out = data.run?.output || '(No execution output)';
        setTerminalLogs(prev => [...prev, out]);
        setExecutionOutput(out);
      } catch (err) {
        setIsRunning(false);
        setTerminalLogs(prev => [...prev, `Sandbox execution failed: ${err.message}`]);
      }
    }
  };

  const handleOpenPracticeFile = (phase) => {
    const filename = `${phase.title.toLowerCase().replace(/\s+/g, '-')}.js`;
    const starterTemplate = `/* Practice Phase: ${phase.title}\n${phase.description}\n*/\n\n${phase.practice_template || '// Start coding here'}\n`;
    
    if (socketConnected) {
      wsRef.current.send(JSON.stringify({
        action: 'createFile',
        payload: { path: filename, content: starterTemplate }
      }));
      setTimeout(() => {
        handleRefreshDir();
        setActiveTab('ide');
        setTerminalLogs(prev => [...prev, `Created practice file: ${filename}`]);
      }, 300);
    } else {
      setActiveFile({ name: filename, path: filename, isDirectory: false });
      setEditorContent(starterTemplate);
      setActiveTab('ide');
      setTerminalLogs(prev => [...prev, `Loaded sandbox practice file: ${filename}`]);
    }
  };

  // Command palette logic
  const commands = [
    { name: 'Switch to IDE Editor', action: () => { setActiveTab('ide'); setShowPalette(false); } },
    { name: 'Switch to Learning Roadmap', action: () => { setActiveTab('roadmap'); setShowPalette(false); } },
    { name: 'Run Active Program', action: () => { handleRunCode(); setShowPalette(false); } },
    { name: 'Save File', action: () => { handleSaveFile(); setShowPalette(false); } },
    { name: 'Create Practice scratchpad', action: () => { handleCreateFile('practice.js'); setShowPalette(false); } },
    { name: 'Enable Sandbox fallback mode', action: () => { setSandboxMode(true); setPairingRequired(false); setShowPalette(false); } }
  ];

  const filteredCommands = commands.filter(c => c.name.toLowerCase().includes(paletteSearch.toLowerCase()));

  // Render Login forms if user not logged in
  if (!currentUser) {
    if (authView === 'register') {
      return <RegisterForm onToggleForm={() => setAuthView('login')} />;
    }
    if (authView === 'forgot') {
      return <ForgotPassword onBackToLogin={() => setAuthView('login')} />;
    }
    return (
      <LoginForm 
        onToggleForm={() => setAuthView('register')} 
        onForgot={() => setAuthView('forgot')} 
      />
    );
  }

  // Render Pairing prompt
  if (pairingRequired && !sandboxMode) {
    return (
      <div className="modal-overlay" style={{ background: '#0B1D3A' }}>
        <div className="modal" style={{ maxWidth: '460px' }}>
          <h2 className="modal-title">Connect to Local Machine</h2>
          <p style={{ color: '#5B6472', fontSize: '0.875rem', marginBottom: '20px', lineHeight: '1.5' }}>
            CodeQuest runs programs and manages files locally on your machine. Start the **Local Bridge agent** (`node local-bridge/agent.js`) and paste the 6-character pairing code below:
          </p>

          <form onSubmit={handlePairingSubmit}>
            <input
              type="text"
              className="input-field"
              style={{ textTransform: 'uppercase', textAlign: 'center', fontSize: '1.25rem', letterSpacing: '0.2em', fontWeight: 700 }}
              maxLength={6}
              placeholder="CQ-CODE"
              value={pairingCodeInput}
              onChange={(e) => setPairingCodeInput(e.target.value)}
            />
            {bridgeError && (
              <div style={{ color: '#FF5A5F', fontSize: '0.8rem', marginBottom: '16px' }}>{bridgeError}</div>
            )}
            
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '12px' }}>
              Establish Connect Link
            </button>
          </form>

          <div style={{ position: 'relative', margin: '20px 0', textAlign: 'center' }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: '#E5E9F0', zIndex: 1 }}></div>
            <span style={{ position: 'relative', zIndex: 2, background: '#FFFFFF', padding: '0 12px', fontSize: '0.8rem', color: '#5B6472' }}>OR</span>
          </div>

          <button 
            className="btn btn-secondary" 
            style={{ width: '100%' }}
            onClick={() => setSandboxMode(true)}
          >
            <Laptop size={14} /> Continue with Sandbox (No Local Bridge)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="navbar">
        <div className="brand">
          <span>🚀 CodeQuest</span>
        </div>
        <div className="nav-links">
          <button 
            className={`btn ${activeTab === 'ide' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('ide')}
          >
            <Code size={16} /> Code Editor
          </button>
          <button 
            className={`btn ${activeTab === 'roadmap' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('roadmap')}
          >
            <Map size={16} /> Roadmap Tracker
          </button>

          <div style={{ height: '24px', width: '1px', background: '#DDE2EB' }}></div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#5B6472', fontWeight: 600 }}>
            <Award size={14} color="#EAA12A" />
            <span>{xp} XP</span>
          </div>

          {socketConnected ? (
            <span style={{ color: '#3EBE7A', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
              <Wifi size={14} /> Local Bridge Linked
            </span>
          ) : (
            <button 
              style={{ background: 'transparent', border: 'none', color: '#FF5A5F', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', cursor: 'pointer' }}
              onClick={() => { setPairingRequired(true); setSandboxMode(false); }}
            >
              <WifiOff size={14} /> Bridge Off
            </button>
          )}

          <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={logout} title="Sign Out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      {activeTab === 'ide' ? (
        <div className="ide-layout">
          <div className="sidebar-tabs">
            <div className={`tab-icon ${rightPanelTab === 'explain' ? 'active' : ''}`} onClick={() => setRightPanelTab('explain')} title="Explain & Visualize">
              <Code size={20} />
            </div>
            <div className={`tab-icon ${rightPanelTab === 'chat' ? 'active' : ''}`} onClick={() => setRightPanelTab('chat')} title="Light AI chat">
              <Sparkles size={20} />
            </div>
          </div>

          <FileExplorer
            files={files}
            activeFile={activeFile}
            onFileSelect={handleFileSelect}
            onCreateFile={handleCreateFile}
            onCreateFolder={handleCreateFolder}
            onDeleteFile={handleDeleteFile}
            onRefresh={handleRefreshDir}
          />

          <div className="central-workspace">
            <div className="editor-wrapper">
              <Editor
                file={activeFile}
                value={editorContent}
                onChange={setEditorContent}
                onSave={handleSaveFile}
              />
            </div>
            <Terminal
              terminalLogs={terminalLogs}
              onTerminalInput={(val) => {
                if (wsRef.current && socketConnected) {
                  wsRef.current.send(JSON.stringify({ action: 'shellInput', payload: { input: val } }));
                }
              }}
              onRunCode={handleRunCode}
              activeFile={activeFile}
              isRunning={isRunning}
              isBridgeConnected={socketConnected}
              sandboxMode={sandboxMode}
            />
          </div>

          <div className="right-panel">
            {rightPanelTab === 'explain' ? (
              <Visualizer
                code={editorContent}
                executionOutput={executionOutput}
                activeFile={activeFile}
              />
            ) : (
              <LightChat
                code={editorContent}
                activeFile={activeFile}
              />
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', background: '#F8F9FB', padding: '32px 0' }}>
          <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 24px' }}>
            <Roadmap
              onOpenPracticeFile={handleOpenPracticeFile}
              xp={xp}
              setXp={setXp}
              streak={streak}
              setStreak={setStreak}
            />
          </div>
        </div>
      )}

      {/* Command Palette Modal */}
      {showPalette && (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setShowPalette(false)}>
          <div className="modal" style={{ maxWidth: '500px', padding: '16px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #E5E9F0', paddingBottom: '8px', marginBottom: '8px' }}>
              <Search size={16} color="#5B6472" />
              <input
                type="text"
                placeholder="Search commands (Ctrl+Shift+P)..."
                value={paletteSearch}
                onChange={(e) => setPaletteSearch(e.target.value)}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.9rem' }}
                autoFocus
              />
            </div>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {filteredCommands.length === 0 ? (
                <div style={{ padding: '8px', fontSize: '0.85rem', color: '#5B6472' }}>No commands found</div>
              ) : (
                filteredCommands.map((cmd, idx) => (
                  <div
                    key={idx}
                    onClick={cmd.action}
                    style={{ padding: '8px 12px', fontSize: '0.85rem', cursor: 'pointer', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}
                    className="file-item"
                  >
                    <span>{cmd.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CodeQuestApp />
    </AuthProvider>
  );
}
