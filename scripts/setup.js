// One-step local setup (works the same on Windows, macOS and Linux):
//   - creates .env from .env.example if it doesn't exist (no keys = demo mode)
//   - seeds fresh demo data
// Run after `npm run install-all`:   npm run setup
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = path.join(root, '.env');

if (!fs.existsSync(env)) {
  fs.copyFileSync(path.join(root, '.env.example'), env);
  console.log('✔ Created .env from .env.example (no keys yet: everything runs in demo/mock mode).');
} else {
  console.log('✔ .env already exists (left unchanged).');
}

const r = spawnSync(process.execPath, [path.join(root, 'server', 'scripts', 'seed.js')], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);
console.log('\nNext:  npm run dev   then open http://localhost:5173');
