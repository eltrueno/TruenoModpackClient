const { spawn } = require('child_process');
const path = require('path');

const cliPath = path.join(__dirname, '..', 'node_modules', '@electron-forge', 'cli', 'dist', 'electron-forge.js');
const env = { ...process.env };

if (process.platform === 'linux') {
  env.ELECTRON_DISABLE_SANDBOX = '1';
}

const child = spawn(process.execPath, [cliPath, 'start', '--', '--mode', 'development'], {
  stdio: 'inherit',
  env
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
