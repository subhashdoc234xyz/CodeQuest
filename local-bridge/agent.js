const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

const PORT = 7420;
const wss = new WebSocketServer({ port: PORT });

// Generate random pairing code
const pairingCode = Math.random().toString(36).substring(2, 8).toUpperCase();

console.log('=============================================');
console.log('         CODEQUEST LOCAL BRIDGE AGENT        ');
console.log('=============================================');
console.log(` Server starting on: ws://localhost:${PORT}`);
console.log(` YOUR PAIRING CODE IS: \x1b[36m${pairingCode}\x1b[0m`);
console.log(' Enter this code in the web client to connect.');
console.log('=============================================');

let clientAuthenticated = false;
let currentWorkspace = null;
let activeShell = null;

wss.on('connection', (ws, req) => {
  console.log(`Connection attempt from: ${req.socket.remoteAddress}`);
  
  // Set origin header checking to ensure it only comes from local or our web application
  const origin = req.headers.origin;
  console.log(`Origin: ${origin}`);

  ws.on('message', async (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      return ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON message structure' }));
    }

    const { action, payload, id } = data;

    // Handle pairing
    if (action === 'pair') {
      if (payload?.code === pairingCode) {
        clientAuthenticated = true;
        console.log('Client successfully paired and authenticated.');
        return ws.send(JSON.stringify({ id, success: true, message: 'Authenticated successfully' }));
      } else {
        console.log(`Failed pairing attempt with code: ${payload?.code}`);
        return ws.send(JSON.stringify({ id, success: false, message: 'Invalid pairing code' }));
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
            // Create if it doesn't exist
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
              // Run via java directly if source file launching is supported
              cmd = 'java';
              args = [target];
              break;
            case '.c':
              // Compile first, then run
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
