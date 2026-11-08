import { describe, it, expect } from 'vitest';
import { payoutReceiver } from '../services/treasurer.js';
import { mapToMenuItem, transactionsToSales } from '../services/salesSource.js';
import { createLimiter } from '../services/rateLimit.js';

const coorg = { id: 'sup-coorg-hills', country: 'IN', paypalEmail: 'seed-coorg@example.com' };
const chennai = { id: 'sup-chennai-ecopack', country: 'IN', paypalEmail: 'seed-chennai@example.com' };
const local = { id: 'sup-hill-country', country: 'US', paypalEmail: 'seed-local@example.com' };

describe('payoutReceiver (one sandbox account per supplier group)', () => {
  const env = {
    SUPPLIER_EMAIL_LOCAL: 'local@test.com',
    SUPPLIER_EMAIL_COORG: 'coorg@test.com',
    SUPPLIER_EMAIL_CHENNAI: 'chennai@test.com',
    PAYPAL_SUPPLIER_EMAIL: 'shared@test.com',
  };
  it('routes each supplier to its own account', () => {
    expect(payoutReceiver(coorg, env)).toEqual({ email: 'coorg@test.com', envVar: 'SUPPLIER_EMAIL_COORG' });
    expect(payoutReceiver(chennai, env)).toEqual({ email: 'chennai@test.com', envVar: 'SUPPLIER_EMAIL_CHENNAI' });
    expect(payoutReceiver(local, env)).toEqual({ email: 'local@test.com', envVar: 'SUPPLIER_EMAIL_LOCAL' });
  });
  it('falls back to the shared email, then to the seeded placeholder', () => {
    expect(payoutReceiver(coorg, { PAYPAL_SUPPLIER_EMAIL: 'shared@test.com' }).email).toBe('shared@test.com');
    expect(payoutReceiver(local, {})).toEqual({ email: 'seed-local@example.com', envVar: 'seeded placeholder' });
  });
});

describe('PayPal transactions -> sales', () => {
  it('maps item names to menu items', () => {
    expect(mapToMenuItem('Iced latte (16oz)')).toBe('cold coffee');
    expect(mapToMenuItem('Cold brew')).toBe('cold coffee');
    expect(mapToMenuItem('Flat white')).toBe('hot coffee');
    expect(mapToMenuItem('Masala chai')).toBe('tea');
    expect(mapToMenuItem('Butter croissant')).toBe('pastries');
    expect(mapToMenuItem('Gift card')).toBeNull();
  });

  it('aggregates completed incoming payments per day and item, skipping refunds and unknown items', () => {
    const tx = (date, amount, items, status = 'S') => ({
      transaction_info: { transaction_initiation_date: `${date}T15:00:00+0000`, transaction_amount: { value: String(amount), currency_code: 'USD' }, transaction_status: status },
      cart_info: { item_details: items },
    });
    const sales = transactionsToSales([
      tx('2026-11-01', 14.25, [{ item_name: 'Iced latte', item_quantity: '3', item_amount: { value: '4.75' } }]),
      tx('2026-11-01', 4.75, [{ item_name: 'Iced mocha', item_quantity: '1', item_amount: { value: '4.75' } }]),
      tx('2026-11-01', 3.75, [{ item_name: 'Espresso', item_quantity: '1', item_amount: { value: '3.75' } }]),
      tx('2026-11-02', -4.75, [{ item_name: 'Iced latte', item_quantity: '1' }]), // refund
      tx('2026-11-02', 4.75, [{ item_name: 'Iced latte', item_quantity: '1' }], 'P'), // pending
      tx('2026-11-02', 25, [{ item_name: 'Gift card', item_quantity: '1' }]), // not a menu item
    ]);
    expect(sales).toEqual([
      { date: '2026-11-01', item: 'cold coffee', quantity: 4, revenue: 19, currency: 'USD', source: 'paypal' },
      { date: '2026-11-01', item: 'hot coffee', quantity: 1, revenue: 3.75, currency: 'USD', source: 'paypal' },
    ]);
  });

  it('uses the transaction subject when there is no cart', () => {
    const sales = transactionsToSales([{ transaction_info: { transaction_initiation_date: '2026-11-03T10:00:00Z', transaction_amount: { value: '2.75' }, transaction_status: 'S', transaction_subject: 'Chai' } }]);
    expect(sales).toEqual([{ date: '2026-11-03', item: 'tea', quantity: 1, revenue: 2.75, currency: 'USD', source: 'paypal' }]);
  });
});

describe('rate limiter', () => {
  it('limits per key and resets after the window', () => {
    let t = 0;
    const l = createLimiter({ windowMs: 1000, max: 2, now: () => t });
    expect(l.take('a').ok).toBe(true);
    expect(l.take('a').ok).toBe(true);
    expect(l.take('a')).toMatchObject({ ok: false, scope: 'you' });
    expect(l.take('b').ok).toBe(true); // other visitors unaffected
    t = 1000;
    expect(l.take('a').ok).toBe(true);
  });
  it('enforces a global cap across visitors', () => {
    const l = createLimiter({ windowMs: 1000, max: 5, globalMax: 2, now: () => 0 });
    expect(l.take('a').ok).toBe(true);
    expect(l.take('b').ok).toBe(true);
    expect(l.take('c')).toMatchObject({ ok: false, scope: 'everyone' });
  });
});

describe('CSP inline script hashes', async () => {
  const { inlineScriptHashes } = await import('../services/security.js');
  const crypto = await import('node:crypto');
  it('hashes only inline scripts, exactly as written', () => {
    const body = "\n  document.documentElement.dataset.theme = 'dark';\n";
    const html = `<head><script>${body}</script><script type="module" src="/a.js"></script><script></script></head>`;
    const expected = `'sha256-${crypto.createHash('sha256').update(body).digest('base64')}'`;
    expect(inlineScriptHashes(html)).toEqual([expected]);
  });
});
