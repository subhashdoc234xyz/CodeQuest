import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useLocalBridge } from './lib/useLocalBridge';
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
  Award,
  Loader2
} from 'lucide-react';

function CodeQuestApp() {
  const { currentUser, logout } = useAuth();
  
  // Connect to Local Bridge automatically
  const { status: bridgeStatus, error: bridgeErrorMsg, socket, connectWithCode } = useLocalBridge();
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');

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
    'Auto-detecting Local Bridge or running in Piston Sandbox mode...'
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [executionOutput, setExecutionOutput] = useState('');

  // Listen to WebSocket messages
  useEffect(() => {
    if (!socket) return;

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      
      if (msg.workspace) {
        socket.send(JSON.stringify({ action: 'listDir', payload: {} }));
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

    setTerminalLogs(prev => [...prev, 'System: Successfully paired and connected to Local Bridge!']);
    
    // Open workspace
    socket.send(JSON.stringify({
      action: 'openFolder',
      payload: { path: './workspace' }
    }));
  }, [socket]);

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

  const handleRefreshDir = () => {
    if (socket && bridgeStatus === 'connected') {
      socket.send(JSON.stringify({ action: 'listDir', payload: {} }));
    }
  };

  const handleFileSelect = (file) => {
    setActiveFile(file);
    if (socket && bridgeStatus === 'connected') {
      socket.send(JSON.stringify({
        action: 'readFile',
        payload: { path: file.path }
      }));
    }
  };

  const handleCreateFile = (name) => {
    if (!socket || bridgeStatus !== 'connected') return;
    let content = '';
    const ext = name.split('.').pop();
    if (ext === 'py') content = '# Python Starter Code\nprint("Hello World!")\n';
    else if (ext === 'js') content = '// Node.js Starter Code\nconsole.log("Hello World!");\n';
    else if (ext === 'cpp') content = '#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << "Hello World!" << endl;\n  return 0;\n}\n';

    socket.send(JSON.stringify({
      action: 'createFile',
      payload: { path: name, content }
    }));
    setTimeout(handleRefreshDir, 300);
  };

  const handleCreateFolder = (name) => {
    if (!socket || bridgeStatus !== 'connected') return;
    socket.send(JSON.stringify({
      action: 'createFolder',
      payload: { path: name }
    }));
    setTimeout(handleRefreshDir, 300);
  };

  const handleDeleteFile = (filePath) => {
    if (!socket || bridgeStatus !== 'connected') return;
    socket.send(JSON.stringify({
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
    if (socket && bridgeStatus === 'connected' && activeFile) {
      socket.send(JSON.stringify({
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

    if (socket && bridgeStatus === 'connected') {
      socket.send(JSON.stringify({
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
    
    if (socket && bridgeStatus === 'connected') {
      socket.send(JSON.stringify({
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

  // Command palette choices
  const commands = [
    { name: 'Switch to IDE Editor', action: () => { setActiveTab('ide'); setShowPalette(false); } },
    { name: 'Switch to Learning Roadmap', action: () => { setActiveTab('roadmap'); setShowPalette(false); } },
    { name: 'Run Active Program', action: () => { handleRunCode(); setShowPalette(false); } },
    { name: 'Save File', action: () => { handleSaveFile(); setShowPalette(false); } },
    { name: 'Create Practice scratchpad', action: () => { handleCreateFile('practice.js'); setShowPalette(false); } }
  ];

  const filteredCommands = commands.filter(c => c.name.toLowerCase().includes(paletteSearch.toLowerCase()));

  // Render Auth screens if logged out
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

  // Auto-Detecting / Connection Failed Screen
  if (bridgeStatus === 'detecting' || bridgeStatus === 'failed') {
    return (
      <div className="modal-overlay" style={{ background: '#0B1D3A', flexDirection: 'column' }}>
        <div className="modal" style={{ maxWidth: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          {bridgeStatus === 'detecting' ? (
            <Loader2 className="animate-spin" size={32} color="#3E6BD6" style={{ marginBottom: '16px' }} />
          ) : (
            <div style={{ color: '#FF5A5F', marginBottom: '16px', fontSize: '2rem' }}>⚠️</div>
          )}
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0B1D3A', textAlign: 'center' }}>
            {bridgeStatus === 'detecting' ? 'Looking for CodeQuest Local Bridge...' : 'Connection Failed'}
          </h3>
          <p style={{ color: '#5B6472', fontSize: '0.8rem', marginTop: '8px', textAlign: 'center' }}>
            {bridgeStatus === 'detecting'
              ? "If the agent isn't running, we will fall back to sandbox mode automatically."
              : bridgeErrorMsg || "Could not connect to Local Bridge."}
          </p>

          <div style={{ marginTop: '16px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {!showManualInput ? (
              <button
                onClick={() => setShowManualInput(true)}
                style={{ background: 'none', border: 'none', color: '#3E6BD6', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Enter code manually
              </button>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualCode.trim()) {
                    connectWithCode(manualCode.trim());
                  }
                }}
                style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}
              >
                <input
                  type="text"
                  placeholder="Enter 6-digit pairing code"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #DDE2EB', fontSize: '0.9rem', textAlign: 'center' }}
                  maxLength={6}
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                    Connect
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowManualInput(false)}
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {bridgeStatus === 'sandbox' && (
        <div style={{
          background: '#FFF9E6',
          borderBottom: '1px solid #FFE5A3',
          padding: '8px 16px',
          fontSize: '0.85rem',
          color: '#8A6D1C',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          zIndex: 10
        }}>
          <span>Running in sandbox mode — start the Local Bridge for full local file/terminal access.</span>
        </div>
      )}
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

          {bridgeStatus === 'connected' ? (
            <span style={{ color: '#3EBE7A', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
              <Wifi size={14} /> Local Bridge Linked
            </span>
          ) : (
            <span style={{ color: '#FF5A5F', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
              <WifiOff size={14} /> Sandbox Mode
            </span>
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
                if (socket && bridgeStatus === 'connected') {
                  socket.send(JSON.stringify({ action: 'shellInput', payload: { input: val } }));
                }
              }}
              onRunCode={handleRunCode}
              activeFile={activeFile}
              isRunning={isRunning}
              isBridgeConnected={bridgeStatus === 'connected'}
              sandboxMode={bridgeStatus !== 'connected'}
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
