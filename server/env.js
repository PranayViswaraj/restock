// Loads environment variables from restock/.env (if it exists) using the
// built-in Node 20.12+ loader — no dotenv dependency needed.
// Import this file FIRST in any entry point (index.js, seed.js).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env');

if (fs.existsSync(envPath)) {
  // Values already set in the real environment (e.g. on Render) win.
  process.loadEnvFile(envPath);
}

/** Reads a boolean env flag. Accepts true/1/yes. */
export function flag(name, defaultValue = false) {
  const v = process.env[name];
  if (v === undefined || v === '') return defaultValue;
  return ['true', '1', 'yes', 'on'].includes(String(v).toLowerCase());
}
