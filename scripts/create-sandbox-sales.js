// Create a few real SANDBOX café sales, so Scout can read sales from PayPal
// (USE_PAYPAL_SALES=true). Run manually; nothing here runs on the server.
//
//   Step 1  npm run sandbox-sales            -> creates 3 checkout orders with menu
//                                               items and prints an approval link for each
//   Step 2  open each link, log in with a sandbox PERSONAL (buyer) account, approve
//   Step 3  npm run sandbox-sales -- capture -> captures the approved orders
//
// The café is your app's own sandbox business account (the default payee).
// PayPal's Transaction Search can take up to ~3 hours to show new transactions.
import '../server/env.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAccessToken, isMock } from '../server/services/paypal.js';

const BASE = 'https://api-m.sandbox.paypal.com';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE = path.resolve(__dirname, '..', 'server', 'data', 'sandbox-sales.json'); // git-ignored

const MENU = [
  { name: 'Iced latte (16oz)', price: 4.75 },
  { name: 'Cold brew (16oz)', price: 4.75 },
  { name: 'Iced mocha (16oz)', price: 4.75 },
  { name: 'Hot latte', price: 3.75 },
  { name: 'Masala chai', price: 2.75 },
  { name: 'Butter croissant', price: 3.5 },
];
const BASKETS = [
  [[0, 3], [3, 1]],
  [[1, 2], [4, 1], [5, 2]],
  [[2, 4], [0, 2]],
];

async function call(method, url, body) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}: ${data.message || data.name || 'error'} ${data.details?.[0]?.description || ''}`);
  return data;
}

async function create() {
  const created = [];
  for (const [i, basket] of BASKETS.entries()) {
    const items = basket.map(([m, qty]) => ({
      name: MENU[m].name,
      quantity: String(qty),
      unit_amount: { currency_code: 'USD', value: MENU[m].price.toFixed(2) },
      category: 'PHYSICAL_GOODS',
    }));
    const total = basket.reduce((t, [m, qty]) => t + MENU[m].price * qty, 0).toFixed(2);
    const order = await call('POST', '/v2/checkout/orders', {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: `cafe-sale-${Date.now()}-${i}`,
        description: "Pranay's Café counter sale (sandbox)",
        amount: { currency_code: 'USD', value: total, breakdown: { item_total: { currency_code: 'USD', value: total } } },
        items,
      }],
    });
    const link = order.links?.find((l) => ['approve', 'payer-action'].includes(l.rel))?.href;
    created.push({ id: order.id, total, link });
    console.log(`\nOrder ${order.id}  $${total}  (${items.map((it) => `${it.quantity}× ${it.name}`).join(', ')})\n  Approve: ${link}`);
  }
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(created, null, 2));
  console.log('\nNext: open each link, log in with a sandbox PERSONAL account, approve.');
  console.log('Then run:  npm run sandbox-sales -- capture\n');
}

async function capture() {
  if (!fs.existsSync(STATE)) throw new Error('No orders yet. Run `npm run sandbox-sales` first.');
  const orders = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  for (const o of orders) {
    try {
      const r = await call('POST', `/v2/checkout/orders/${o.id}/capture`);
      console.log(`✔ ${o.id} $${o.total}: ${r.status}`);
    } catch (err) {
      console.log(`✖ ${o.id}: ${err.message}  (approved yet? already captured?)`);
    }
  }
  console.log('\nSet USE_PAYPAL_SALES=true and restart. Transactions can take up to ~3 hours to appear.\n');
}

if (isMock()) {
  console.error('Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET (sandbox) in .env first, and USE_MOCK_PAYPAL=false.');
  process.exit(1);
}
(process.argv.includes('capture') ? capture() : create()).catch((err) => {
  console.error(`\n✖ ${err.message}\n`);
  process.exit(1);
});
