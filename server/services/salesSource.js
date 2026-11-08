// Where Scout's sales data comes from.
//
//   USE_PAYPAL_SALES=true  -> read the café's PayPal SANDBOX transactions with the
//                             Transaction Search API (GET /v1/reporting/transactions),
//                             map each cart item to a menu item, aggregate per day.
//   otherwise / on error   -> keep the seeded demo sales (server/data/sales.json).
//
// The current source is always reported to the UI ("Sales source: ...") so the
// data is never passed off as something it isn't.
//
// Notes on the PayPal API (documented behaviour, see README):
//   - The REST app needs the "Transaction search" feature enabled.
//   - New transactions can take up to ~3 hours to appear.
//   - Max 31 days per request.
import { read, write } from './store.js';
import { flag } from '../env.js';
import { isMock as paypalIsMock, searchTransactions } from './paypal.js';
import { buildSales } from '../scripts/seed.js';

let info = { source: 'seeded', label: 'Seeded demo data', count: null, syncedAt: null, note: null };

export function salesSourceInfo() {
  return info;
}

export function markSeeded(note = null) {
  // If PayPal data had replaced the seeded sales, put the seeded sales back so the
  // label and the data always match.
  if (info.source === 'paypal') write('sales', buildSales());
  info ={ source: 'seeded', label: 'Seeded demo data', count: read('sales', []).length, syncedAt: new Date().toISOString(), note };
}

// Menu items used by inventory.usagePerSale. First matching rule wins.
const MENU_RULES = [
  ['cold coffee', /\b(cold|iced|ice|frappe|cold ?brew)\b/i],
  ['tea', /\b(tea|chai|matcha)\b/i],
  ['sandwiches', /\b(sandwich|panini|toastie|wrap)\b/i],
  ['pastries', /\b(pastry|pastries|croissant|muffin|cookie|cake|scone)\b/i],
  ['hot coffee', /\b(coffee|latte|espresso|americano|cappuccino|mocha|flat white)\b/i],
];

/** Pure: map an item name/description to a menu item (or null). */
export function mapToMenuItem(text) {
  const s = String(text || '');
  for (const [item, re] of MENU_RULES) if (re.test(s)) return item;
  return null;
}

/**
 * Pure: PayPal transaction_details[] -> [{date, item, quantity, revenue, currency, source}].
 * Only completed incoming payments (positive amount, status S) count as sales.
 */
export function transactionsToSales(details) {
  const byKey = new Map();
  for (const d of details || []) {
    const t = d.transaction_info || {};
    const amount = Number(t.transaction_amount?.value);
    if (!(amount > 0) || (t.transaction_status && t.transaction_status !== 'S')) continue;
    const date = String(t.transaction_initiation_date || '').slice(0, 10);
    if (!date) continue;
    const items = d.cart_info?.item_details?.length
      ? d.cart_info.item_details
      : [{ item_name: t.transaction_subject || t.transaction_note, item_quantity: '1', item_amount: { value: amount } }];
    for (const it of items) {
      const item = mapToMenuItem(`${it.item_name || ''} ${it.item_description || ''}`);
      if (!item) continue;
      const qty = Math.max(1, Math.round(Number(it.item_quantity) || 1));
      const revenue = Number(it.total_item_amount?.value ?? (Number(it.item_amount?.value) || 0) * qty) || 0;
      const key = `${date}|${item}`;
      const row = byKey.get(key) || { date, item, quantity: 0, revenue: 0, currency: 'USD', source: 'paypal' };
      row.quantity += qty;
      row.revenue = Math.round((row.revenue + revenue) * 100) / 100;
      byKey.set(key, row);
    }
  }
  return [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date) || a.item.localeCompare(b.item));
}

/**
 * Refresh sales from PayPal when enabled. Never throws: on any problem the seeded
 * data stays in place and the reason is reported in the UI.
 */
export async function syncSales() {
  if (!flag('USE_PAYPAL_SALES')) { markSeeded(); return info; }
  if (paypalIsMock()) { markSeeded('USE_PAYPAL_SALES is on but PayPal keys are missing.'); return info; }
  try {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 864e5);
    const details = await searchTransactions({ start, end });
    const sales = transactionsToSales(details);
    if (!sales.length) {
      markSeeded(`PayPal returned ${details.length} transaction(s) but none matched a menu item yet (new ones can take ~3 hours to appear).`);
      return info;
    }
    write('sales', sales);
    info = { source: 'paypal', label: 'PayPal sandbox', count: sales.length, transactions: details.length, syncedAt: new Date().toISOString(), note: null };
    return info;
  } catch (err) {
    console.warn(`[sales] PayPal transaction search failed, keeping seeded sales: ${err.message}`);
    markSeeded(`PayPal transaction search failed: ${err.message.slice(0, 200)}`);
    return info;
  }
}
