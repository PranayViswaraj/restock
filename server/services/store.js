// Tiny JSON-file "database".
// WHY synchronous: data is small and Node is single-threaded, so sync reads/writes
// can never interleave between requests (no race conditions, no locks needed).
// WHY temp file + rename: a crash mid-write never leaves a half-written JSON file.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.RESTOCK_DATA_DIR || path.resolve(__dirname, '..', 'data');

export const FILES = ['sales', 'inventory', 'suppliers', 'mandate', 'purchases', 'audit', 'cash', 'state'];

function filePath(name) {
  if (!FILES.includes(name)) throw new Error(`Unknown data file: ${name}`);
  return path.join(DATA_DIR, `${name}.json`);
}

/** Read a data file. Returns `fallback` if the file is missing or corrupt. */
export function read(name, fallback = []) {
  try {
    return JSON.parse(fs.readFileSync(filePath(name), 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(`[store] Could not read ${name}.json:`, err.message);
    return fallback;
  }
}

/** Write a data file atomically (temp file + rename). */
export function write(name, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const target = filePath(name);
  const json = JSON.stringify(data, null, 2);
  const tmp = `${target}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, json);
    fs.renameSync(tmp, target);
  } catch {
    // Synced folders (OneDrive/Dropbox) sometimes lock files briefly on Windows.
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    fs.writeFileSync(target, json);
  }
  return data;
}

/** Read, change, write back. `fn` may mutate the data or return a replacement. */
export function update(name, fn, fallback = []) {
  const data = read(name, fallback);
  const result = fn(data);
  return write(name, result === undefined ? data : result);
}

export function allFilesExist() {
  return FILES.every((n) => fs.existsSync(filePath(n)));
}

export function newId(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
