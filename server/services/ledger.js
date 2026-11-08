// Tamper-evident audit log (hash chain).
// Each entry stores the previous entry's hash, and its own hash covers
// prevHash + the entry's content. Editing ANY past entry changes its hash,
// which breaks every link after it — so verifyChain() detects tampering.
import { read, write, sha256 } from './store.js';

export const GENESIS_HASH = '0'.repeat(64);

/** Hash for one entry: SHA-256(prevHash + JSON of the entry's content). */
export function hashEntry({ seq, timestamp, role, action, data }, prevHash) {
  return sha256(prevHash + JSON.stringify({ seq, timestamp, role, action, data: data ?? null }));
}

/** Pure: build the next entry for a chain (used by append and by tests). */
export function buildEntry(chain, { role, action, data }, timestamp = new Date().toISOString()) {
  const prev = chain[chain.length - 1];
  const prevHash = prev ? prev.hash : GENESIS_HASH;
  const entry = { seq: prev ? prev.seq + 1 : 1, timestamp, role, action, data: data ?? null, prevHash };
  entry.hash = hashEntry(entry, prevHash);
  return entry;
}

/**
 * Pure: verify a chain. Returns { ok, checked, brokenAt, reason }.
 * brokenAt = seq of the first bad entry.
 */
export function verifyChain(chain) {
  let prevHash = GENESIS_HASH;
  for (let i = 0; i < chain.length; i++) {
    const e = chain[i];
    if (e.prevHash !== prevHash) {
      return { ok: false, checked: i, brokenAt: e.seq, reason: `Entry #${e.seq} does not link to the previous entry.` };
    }
    if (hashEntry(e, prevHash) !== e.hash) {
      return { ok: false, checked: i, brokenAt: e.seq, reason: `Entry #${e.seq} was modified after it was written.` };
    }
    prevHash = e.hash;
  }
  return { ok: true, checked: chain.length, brokenAt: null, reason: 'Chain intact.' };
}

/**
 * Append an entry to audit.json.
 * role: 'scout' | 'guardian' | 'treasurer' | 'owner' | 'system'
 */
export function audit(role, action, data) {
  const chain = read('audit');
  const entry = buildEntry(chain, { role, action, data });
  chain.push(entry);
  write('audit', chain);
  return entry;
}

export function verifyStoredChain() {
  return verifyChain(read('audit'));
}
