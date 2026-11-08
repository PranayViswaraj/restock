// Purchase records + the context Guardian needs (spend, prices, cash).
import { read, update, sha256 } from './store.js';

const DAY_MS = 24 * 60 * 60 * 1000;
export const PAID = ['auto-paid', 'approved-paid'];
export const COMMITTED = [...PAID, 'awaiting-approval'];

export function getPurchase(id) {
  return read('purchases').find((p) => p.id === id) || null;
}

export function addPurchase(purchase) {
  update('purchases', (list) => { list.push(purchase); });
  return purchase;
}

export function updatePurchase(id, changes) {
  let updated = null;
  update('purchases', (list) => {
    const p = list.find((x) => x.id === id);
    if (p) {
      Object.assign(p, changes, { updatedAt: new Date().toISOString() });
      updated = p;
    }
  });
  return updated;
}

/** Pure: committed spend (paid + awaiting approval) in the rolling last 7 days. */
export function weekToDateSpend(purchases, now = Date.now()) {
  const since = now - 7 * DAY_MS;
  return Math.round(
    purchases
      .filter((p) => COMMITTED.includes(p.status) && new Date(p.createdAt).getTime() >= since)
      .reduce((a, p) => a + p.total, 0) * 100,
  ) / 100;
}

/** Pure: 30-day average unit price for a SKU across established (non-new) suppliers. */
export function marketAvgUnitPrice(suppliers, sku, today = new Date().toISOString().slice(0, 10)) {
  const cutoff = new Date(new Date(`${today}T12:00:00Z`).getTime() - 30 * DAY_MS).toISOString().slice(0, 10);
  const points = suppliers
    .filter((s) => !s.isNew)
    .flatMap((s) => s.priceHistory || [])
    .filter((h) => h.sku === sku && h.date >= cutoff);
  if (!points.length) return null;
  return Math.round((points.reduce((a, h) => a + h.unitPrice, 0) / points.length) * 10000) / 10000;
}

export function receiptHash(p) {
  return sha256(JSON.stringify({ id: p.id, total: p.total, supplierId: p.supplierId, paypal: p.paypal?.id || null, createdAt: p.createdAt }));
}

/** Simulated delivery: once paid, units arrive in stock (keeps the forecast honest). */
export function receiveStock(purchase) {
  const units = (purchase.unitsPerPack || 1) * purchase.quantity;
  update('inventory', (list) => {
    const item = list.find((i) => i.sku === purchase.sku);
    if (item) item.stock = Math.round((item.stock + units) * 100) / 100;
  });
  return units;
}

/** Simulated PayPal balance: money out when a payment succeeds. */
export function debitCash(amount) {
  update('cash', (c) => { c.balance = Math.round((c.balance - amount) * 100) / 100; }, {});
}
