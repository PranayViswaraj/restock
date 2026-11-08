// Runs the API server (with auto-restart) and the Vite dev server together.
// Plain Node instead of a "concurrently" dependency. Works in PowerShell, cmd and bash.
import { spawn } from 'node:child_process';

const procs = [
  { name: 'server', color: '\x1b[36m', args: ['run', 'dev', '--prefix', 'server'] },
  { name: 'client', color: '\x1b[35m', args: ['run', 'dev', '--prefix', 'client'] },
].map(({ name, color, args }) => {
  const child = spawn('npm', args, { shell: true, env: process.env });
  const tag = `${color}[${name}]\x1b[0m `;
  const pipe = (stream, out) => stream.on('data', (buf) => {
    for (const line of buf.toString().split(/\r?\n/)) if (line.trim()) out.write(tag + line + '\n');
  });
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    console.log(`${tag}exited with code ${code}`);
    shutdown();
  });
  return child;
});

console.log('\n  Dashboard: http://localhost:5173   (API uses PORT from .env, default 3456)\n');

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  for (const p of procs) {
    if (p.exitCode === null) {
      // On Windows, kill the whole process tree (npm -> node).
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(p.pid), '/T', '/F'], { shell: true });
      else p.kill('SIGTERM');
    }
  }
  setTimeout(() => process.exit(0), 500);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
