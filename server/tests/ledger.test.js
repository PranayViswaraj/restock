import { describe, it, expect } from 'vitest';
import { buildEntry, verifyChain, hashEntry, GENESIS_HASH } from '../services/ledger.js';

function makeChain(n = 4) {
  const chain = [];
  for (let i = 0; i < n; i++) {
    chain.push(buildEntry(chain, { role: i % 2 ? 'guardian' : 'treasurer', action: `step.${i}`, data: { amount: i * 10 } }, `2030-01-01T00:00:0${i}.000Z`));
  }
  return chain;
}

describe('audit hash chain', () => {
  it('links each entry to the previous hash, starting from genesis', () => {
    const chain = makeChain();
    expect(chain[0].prevHash).toBe(GENESIS_HASH);
    expect(chain[0].seq).toBe(1);
    for (let i = 1; i < chain.length; i++) expect(chain[i].prevHash).toBe(chain[i - 1].hash);
  });

  it('hash = SHA-256(prevHash + entry) and is deterministic', () => {
    const [e] = makeChain(1);
    expect(e.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashEntry(e, GENESIS_HASH)).toBe(e.hash);
  });

  it('verifies an untouched chain', () => {
    expect(verifyChain(makeChain())).toMatchObject({ ok: true, checked: 4, brokenAt: null });
  });

  it('verifies an empty chain', () => {
    expect(verifyChain([]).ok).toBe(true);
  });

  it('detects edited data', () => {
    const chain = makeChain();
    chain[1].data.amount = 9999;
    expect(verifyChain(chain)).toMatchObject({ ok: false, brokenAt: 2 });
  });

  it('detects a deleted entry', () => {
    const chain = makeChain();
    chain.splice(2, 1);
    expect(verifyChain(chain)).toMatchObject({ ok: false, brokenAt: 4 });
  });

  it('detects a re-hashed forgery that does not relink the rest of the chain', () => {
    const chain = makeChain();
    chain[1].data.amount = 5;
    chain[1].hash = hashEntry(chain[1], chain[1].prevHash); // attacker recomputes one hash
    expect(verifyChain(chain)).toMatchObject({ ok: false, brokenAt: 3 });
  });
});
