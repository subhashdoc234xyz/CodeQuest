const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

const PORT = 7420;

// Approved origins allowlist
const APPROVED_ORIGINS = new Set([
  'http://localhost:3000',
  'https://codequest.onrender.com' // Deployed Render URL fallback
]);

// Read Render URL from .env if present
const envPaths = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', 'server', '.env'),
  path.join(__dirname, '..', 'client', '.env')
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split(/\r?\n/);
      for (const line of lines) {
        const match = line.match(/^\s*(?:VITE_)?RENDER_URL\s*=\s*(.+)$/);
        if (match) {
          const val = match[1].trim().replace(/['"]/g, '');
          if (val) {
            APPROVED_ORIGINS.add(val);
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }
}

// Generate random 6-character pairing code
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const currentPairingCode = generateCode();

let clientAuthenticated = false;
let currentWorkspace = null;
let activeShell = null;

function corsHeaders(res, origin) {
  if (origin && APPROVED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Default fallback for dev environments
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Plain HTTP Server instance
const httpServer = http.createServer((req, res) => {
  const origin = req.headers.origin;
  corsHeaders(res, origin);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.url === '/pairing-code' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    return res.end(JSON.stringify({ code: currentPairingCode }));
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  const origin = req.headers.origin;
  console.log(`Connection attempt from origin: ${origin}`);

  ws.on('message', async (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      return ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON message structure' }));
    }

    // Support both client formats (action vs type, payload vs code)
    const action = data.action || data.type;
    const payload = data.payload || data;
    const code = data.code || payload?.code;
    const id = data.id;

    // Handle pairing
    if (action === 'pair') {
      if (code === currentPairingCode) {
        clientAuthenticated = true;
        console.log('Client successfully paired and authenticated.');
        return ws.send(JSON.stringify({ id, type: 'paired', success: true, message: 'Authenticated successfully' }));
      } else {
        console.log(`Failed pairing attempt. Received: ${code} | Expected: ${currentPairingCode}`);
        return ws.send(JSON.stringify({ id, type: 'paired', success: false, message: 'Invalid pairing code' }));
      }
    }

    // Require auth
    if (!clientAuthenticated) {
      return ws.send(JSON.stringify({ id, success: false, message: 'Not authenticated. Send pairing code first.' }));
    }

    // File System operations scoping check
    const resolvePath = (relPath) => {
      if (!currentWorkspace) {
        throw new Error('No workspace folder open. Open a folder first.');
      }
      const absolute = path.resolve(currentWorkspace, relPath || '');
      if (!absolute.startsWith(currentWorkspace)) {
        throw new Error('Access denied: Path is outside the current workspace.');
      }
      return absolute;
    };

    try {
      switch (action) {
        case 'openFolder': {
          const folderPath = path.resolve(payload.path);
          if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
          }
          currentWorkspace = folderPath;
          console.log(`Workspace folder set to: ${currentWorkspace}`);
          ws.send(JSON.stringify({ id, success: true, workspace: currentWorkspace }));
          break;
        }

        case 'listDir': {
          const target = resolvePath(payload.path);
          const entries = fs.readdirSync(target, { withFileTypes: true });
          const list = entries.map(entry => ({
            name: entry.name,
            isDirectory: entry.isDirectory(),
            path: path.relative(currentWorkspace, path.join(target, entry.name)).replace(/\\/g, '/')
          }));
          ws.send(JSON.stringify({ id, success: true, entries: list }));
          break;
        }

        case 'readFile': {
          const target = resolvePath(payload.path);
          const content = fs.readFileSync(target, 'utf-8');
          ws.send(JSON.stringify({ id, success: true, content }));
          break;
        }

        case 'writeFile': {
          const target = resolvePath(payload.path);
          fs.writeFileSync(target, payload.content || '', 'utf-8');
          ws.send(JSON.stringify({ id, success: true }));
          break;
        }

        case 'createFile': {
          const target = resolvePath(payload.path);
          fs.writeFileSync(target, payload.content || '', 'utf-8');
          ws.send(JSON.stringify({ id, success: true }));
          break;
        }

        case 'createFolder': {
          const target = resolvePath(payload.path);
          fs.mkdirSync(target, { recursive: true });
          ws.send(JSON.stringify({ id, success: true }));
          break;
        }

        case 'deleteEntry': {
          const target = resolvePath(payload.path);
          if (fs.statSync(target).isDirectory()) {
            fs.rmSync(target, { recursive: true, force: true });
          } else {
            fs.unlinkSync(target);
          }
          ws.send(JSON.stringify({ id, success: true }));
          break;
        }

        case 'renameEntry': {
          const oldTarget = resolvePath(payload.oldPath);
          const newTarget = resolvePath(payload.newPath);
          fs.renameSync(oldTarget, newTarget);
          ws.send(JSON.stringify({ id, success: true }));
          break;
        }

        case 'spawnShell': {
          if (activeShell) {
            activeShell.kill();
          }

          const shellCmd = process.platform === 'win32' ? 'powershell.exe' : 'bash';
          console.log(`Spawning terminal shell: ${shellCmd} in workspace ${currentWorkspace}`);
          
          activeShell = spawn(shellCmd, [], {
            cwd: currentWorkspace || process.cwd(),
            env: process.env
          });

          activeShell.stdout.on('data', (data) => {
            ws.send(JSON.stringify({ type: 'shell_output', data: data.toString('utf-8') }));
          });

          activeShell.stderr.on('data', (data) => {
            ws.send(JSON.stringify({ type: 'shell_output', data: data.toString('utf-8') }));
          });

          activeShell.on('close', (code) => {
            ws.send(JSON.stringify({ type: 'shell_exit', code }));
            activeShell = null;
          });

          ws.send(JSON.stringify({ id, success: true, message: 'Shell spawned successfully' }));
          break;
        }

        case 'shellInput': {
          if (activeShell) {
            activeShell.stdin.write(payload.input);
          } else {
            ws.send(JSON.stringify({ type: 'error', message: 'No active shell session' }));
          }
          break;
        }

        case 'runCode': {
          const target = resolvePath(payload.path);
          const ext = path.extname(target);
          let cmd = '';
          let args = [];

          switch (ext) {
            case '.py':
              cmd = 'python';
              args = ['-u', target];
              break;
            case '.js':
              cmd = 'node';
              args = [target];
              break;
            case '.java':
              cmd = 'java';
              args = [target];
              break;
            case '.c':
              const outputBinary = target.replace(/\.c$/, process.platform === 'win32' ? '.exe' : '');
              ws.send(JSON.stringify({ type: 'run_output', data: 'Compiling with gcc...\n' }));
              
              exec(`gcc "${target}" -o "${outputBinary}"`, (err, stdout, stderr) => {
                if (err) {
                  ws.send(JSON.stringify({ type: 'run_output', data: `Compilation Error:\n${stderr}\n` }));
                  ws.send(JSON.stringify({ id, success: false }));
                  return;
                }
                
                ws.send(JSON.stringify({ type: 'run_output', data: 'Compilation successful. Running...\n' }));
                const runner = spawn(outputBinary, [], { cwd: currentWorkspace });
                setupRunner(runner, ws, id);
              });
              return;
            
            case '.cpp':
              const cppOutputBinary = target.replace(/\.cpp$/, process.platform === 'win32' ? '.exe' : '');
              ws.send(JSON.stringify({ type: 'run_output', data: 'Compiling with g++...\n' }));
              
              exec(`g++ "${target}" -o "${cppOutputBinary}"`, (err, stdout, stderr) => {
                if (err) {
                  ws.send(JSON.stringify({ type: 'run_output', data: `Compilation Error:\n${stderr}\n` }));
                  ws.send(JSON.stringify({ id, success: false }));
                  return;
                }
                
                ws.send(JSON.stringify({ type: 'run_output', data: 'Compilation successful. Running...\n' }));
                const runner = spawn(cppOutputBinary, [], { cwd: currentWorkspace });
                setupRunner(runner, ws, id);
              });
              return;

            default:
              ws.send(JSON.stringify({ type: 'run_output', data: `Unsupported execution format: ${ext}\n` }));
              ws.send(JSON.stringify({ id, success: false }));
              return;
          }

          if (cmd) {
            const runner = spawn(cmd, args, { cwd: currentWorkspace });
            setupRunner(runner, ws, id);
          }
          break;
        }

        // Git support
        case 'gitStatus': {
          exec('git status -s', { cwd: currentWorkspace }, (err, stdout, stderr) => {
            ws.send(JSON.stringify({ id, success: !err, data: stdout || stderr }));
          });
          break;
        }

        case 'gitDiff': {
          exec('git diff', { cwd: currentWorkspace }, (err, stdout, stderr) => {
            ws.send(JSON.stringify({ id, success: !err, data: stdout || stderr }));
          });
          break;
        }

        case 'gitCommit': {
          exec(`git add . && git commit -m "${payload.message || 'codequest commit'}"`, { cwd: currentWorkspace }, (err, stdout, stderr) => {
            ws.send(JSON.stringify({ id, success: !err, data: stdout || stderr }));
          });
          break;
        }

        default:
          ws.send(JSON.stringify({ type: 'error', message: `Unknown action: ${action}` }));
      }
    } catch (e) {
      console.error(`Error processing action ${action}:`, e.message);
      ws.send(JSON.stringify({ id, success: false, message: e.message }));
    }
  });

  ws.on('close', () => {
    console.log('Client WebSocket connection closed.');
    if (activeShell) {
      activeShell.kill();
      activeShell = null;
    }
    clientAuthenticated = false;
  });
});

function setupRunner(runner, ws, id) {
  runner.stdout.on('data', (data) => {
    ws.send(JSON.stringify({ type: 'run_output', data: data.toString('utf-8') }));
  });

  runner.stderr.on('data', (data) => {
    ws.send(JSON.stringify({ type: 'run_output', data: data.toString('utf-8') }));
  });

  runner.on('close', (code) => {
    ws.send(JSON.stringify({ type: 'run_exit', code }));
    ws.send(JSON.stringify({ id, success: true }));
  });
}

// Start shared HTTP Server
httpServer.listen(PORT, () => {
  console.log('=============================================');
  console.log('         CODEQUEST LOCAL BRIDGE AGENT        ');
  console.log('=============================================');
  console.log(` Server running on: http://localhost:${PORT}`);
  console.log(` YOUR PAIRING CODE IS: \x1b[36m${currentPairingCode}\x1b[0m`);
  console.log(' Client app will automatically fetch & pair.');
  console.log('=============================================');
});
