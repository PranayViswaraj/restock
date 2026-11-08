// Seeds realistic demo data for "Pranay's Café" (Austin, Texas). All values USD.
//
// The numbers are tuned so one agent run tells the whole story, in this order:
//   1. Milk      -> Hill Country Dairy (local)      $27.00  AUTO-PAID
//   2. Cups      -> Chennai EcoPack (India)         $22.00  AUTO-PAID cross-border, saves $10 vs local
//   3. Beans     -> Coorg Hills Coffee Co-op (India) $84.00 DELAYED: would break the $500 cash buffer
//   4. Syrup     -> QuickSupply Deals (new)         $52.92  BLOCKED: 280% of normal price
//   5. Lids      -> Chennai EcoPack (India)         $32.00  NEEDS APPROVAL (over $30)
// A seeded random generator makes every reset identical. Dates are relative to today.
//
// Run:  npm run seed
import '../env.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { write, newId, sha256 } from '../services/store.js';
import { buildEntry } from '../services/ledger.js';
import { buildSignedMandate, DEFAULT_RULES, DEFAULT_TEXT } from '../services/mandate.js';
import { MOCK_CATALOG } from '../services/channel3.js';

const DAYS = 30;
const MENU = {
  'cold coffee': { base: 55, price: 4.75 },
  'hot coffee': { base: 50, price: 3.75 },
  tea: { base: 30, price: 2.75 },
  sandwiches: { base: 25, price: 7.5 },
  pastries: { base: 35, price: 3.5 },
};

// mulberry32: tiny deterministic PRNG
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function isoDate(daysAgo) {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}
const isoTime = (daysAgo, hour = 15) => `${isoDate(daysAgo)}T${String(hour).padStart(2, '0')}:20:00.000Z`;

export function buildSales() {
  const rand = rng(42);
  const sales = [];
  for (let daysAgo = DAYS; daysAgo >= 1; daysAgo--) {
    const date = isoDate(daysAgo);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const weekend = weekday === 0 || weekday === 6 ? 1.08 : 1;
    for (const [item, { base, price }] of Object.entries(MENU)) {
      const noise = 0.95 + rand() * 0.1;
      const spike = item === 'cold coffee' && daysAgo <= 3 ? 1.43 : 1; // Austin heat wave: ~+40%
      const quantity = Math.round(base * noise * weekend * spike);
      sales.push({ date, item, quantity, revenue: +(quantity * price).toFixed(2), currency: 'USD' });
    }
  }
  return sales;
}

export function buildInventory() {
  return [
    { sku: 'milk-whole', name: 'Whole milk', category: 'beverage-supplies', unit: 'litres', stock: 10, reorderPoint: 12,
      usagePerSale: { 'cold coffee': 0.04, 'hot coffee': 0.03, tea: 0.01 }, searchQuery: 'whole milk' },
    { sku: 'cups-16oz', name: '16oz paper cups', category: 'packaging', unit: 'cups', stock: 120, reorderPoint: 150,
      usagePerSale: { 'cold coffee': 1 }, searchQuery: '16oz paper cups' },
    { sku: 'coffee-beans', name: 'Espresso coffee beans', category: 'beverage-supplies', unit: 'kg', stock: 3, reorderPoint: 4,
      usagePerSale: { 'hot coffee': 0.018, 'cold coffee': 0.018 }, searchQuery: 'espresso coffee beans' },
    { sku: 'caramel-syrup', name: 'Caramel syrup (750ml)', category: 'beverage-supplies', unit: 'bottles', stock: 3, reorderPoint: 4,
      usagePerSale: { 'cold coffee': 0.02 }, searchQuery: 'caramel syrup' },
    { sku: 'lids-16oz', name: 'Flat lids for 16oz cups', category: 'packaging', unit: 'lids', stock: 150, reorderPoint: 150,
      usagePerSale: { 'cold coffee': 1 }, searchQuery: '16oz cup lids' },
    { sku: 'straws-paper', name: 'Paper straws', category: 'packaging', unit: 'straws', stock: 900, reorderPoint: 200,
      usagePerSale: { 'cold coffee': 1 }, searchQuery: 'paper straws' },
  ];
}

const SUPPLIERS = [
  { id: 'sup-hill-country', name: 'Hill Country Dairy', country: 'US', countryName: 'United States', flag: '🇺🇸', city: 'Austin, TX', lat: 30.27, lon: -97.74, categories: ['beverage-supplies'], isNew: false, onTimeRate: 0.97, ordersCompleted: 41 },
  { id: 'sup-lone-star', name: 'Lone Star Packaging', country: 'US', countryName: 'United States', flag: '🇺🇸', city: 'Dallas, TX', lat: 32.78, lon: -96.8, categories: ['packaging'], isNew: false, onTimeRate: 0.95, ordersCompleted: 28 },
  { id: 'sup-austin-bean', name: 'Austin Bean Roasters', country: 'US', countryName: 'United States', flag: '🇺🇸', city: 'Austin, TX', lat: 30.3, lon: -97.7, categories: ['beverage-supplies'], isNew: false, onTimeRate: 0.98, ordersCompleted: 19 },
  { id: 'sup-texas-syrup', name: 'Texas Syrup Supply', country: 'US', countryName: 'United States', flag: '🇺🇸', city: 'Houston, TX', lat: 29.76, lon: -95.37, categories: ['beverage-supplies'], isNew: false, onTimeRate: 0.92, ordersCompleted: 12 },
  { id: 'sup-coorg-hills', name: 'Coorg Hills Coffee Co-op', country: 'IN', countryName: 'India', flag: '🇮🇳', city: 'Madikeri, Karnataka', lat: 12.42, lon: 75.74, categories: ['beverage-supplies'], isNew: false, onTimeRate: 0.93, ordersCompleted: 9 },
  { id: 'sup-chennai-ecopack', name: 'Chennai EcoPack', country: 'IN', countryName: 'India', flag: '🇮🇳', city: 'Chennai, Tamil Nadu', lat: 13.08, lon: 80.27, categories: ['packaging'], isNew: false, onTimeRate: 0.94, ordersCompleted: 14 },
  { id: 'sup-quicksupply', name: 'QuickSupply Deals', country: 'US', countryName: 'United States', flag: '🇺🇸', city: 'Unknown (online only)', lat: 39.0, lon: -77.5, categories: ['beverage-supplies', 'packaging'], isNew: true, onTimeRate: null, ordersCompleted: 0 },
];

export function buildSuppliers() {
  const rand = rng(7);
  const sandboxEmail = process.env.PAYPAL_SUPPLIER_EMAIL || null;
  return SUPPLIERS.map((s) => {
    const priceHistory = [];
    if (!s.isNew) {
      for (const offer of MOCK_CATALOG.filter((o) => o.supplierId === s.id && o.sku)) {
        for (const daysAgo of [28, 21, 14, 7, 1]) {
          const wobble = 0.97 + rand() * 0.06; // ±3% normal price movement
          priceHistory.push({ date: isoDate(daysAgo), sku: offer.sku, unitPrice: +((offer.price / offer.unitsPerPack) * wobble).toFixed(4) });
        }
      }
    }
    return { ...s, priceHistory, paypalEmail: sandboxEmail || `${s.id}@sandbox.example.com` };
  });
}

export function buildCash() {
  const rand = rng(99);
  const history = [];
  for (let daysAgo = DAYS; daysAgo >= 1; daysAgo--) {
    history.push({ date: isoDate(daysAgo), balance: Math.round(560 + rand() * 420) });
  }
  return {
    balance: 620,
    currency: 'USD',
    note: 'Simulated PayPal balance (sandbox demo).',
    upcomingSettlements: [
      { date: isoDate(-2), amount: 850, source: 'Card sales settlement' },
      { date: isoDate(-5), amount: 1240, source: 'Catering invoice #1042' },
    ],
    history,
  };
}

function buildPurchaseHistory(suppliers) {
  const byId = Object.fromEntries(suppliers.map((s) => [s.id, s]));
  const offer = (id) => MOCK_CATALOG.find((o) => o.id === id);
  const rows = [
    { daysAgo: 26, off: 'off-bean-coorg', qty: 1, status: 'approved-paid', localUnit: 56 / 5, reason: 'Beans at 2 days of stock. Coorg Hills Co-op is $2.80/kg cheaper than the local roaster; owner approved the $42 order.' },
    { daysAgo: 22, off: 'off-cup-cep', qty: 1, status: 'auto-paid', localUnit: 32 / 500, reason: 'Cups below reorder point. Chennai EcoPack is $0.02/cup cheaper than local; saved $10.' },
    { daysAgo: 19, off: 'off-milk-hcd', qty: 2, status: 'auto-paid', reason: 'Milk at ~2 days of stock. Bought 2 cases from Hill Country Dairy (local, only supplier).' },
    { daysAgo: 15, off: 'off-lid-cep', qty: 1, status: 'auto-paid', localUnit: 19 / 250, reason: 'Lids below reorder point. Chennai EcoPack is cheapest; saved $3 vs local.' },
    { daysAgo: 12, off: 'off-milk-hcd', qty: 2, status: 'auto-paid', reason: 'Milk at ~2 days of stock. Bought 2 cases locally.' },
    { daysAgo: 9, off: 'off-syr-tss', qty: 1, status: 'auto-paid', reason: 'Caramel syrup at 3 days of stock as iced lattes pick up. Bought one case from Texas Syrup Supply.' },
    { daysAgo: 4, off: 'off-milk-hcd', qty: 2, status: 'auto-paid', reason: 'Cold coffee demand rising; milk down to ~2 days. Bought 2 cases locally.' },
    { daysAgo: 2, off: 'off-str-cep', qty: 1, status: 'auto-paid', localUnit: 9.8 / 1000, reason: 'Straws below reorder point. Chennai EcoPack is cheapest; saved $1.90.' },
  ];
  return rows.map((r) => {
    const o = offer(r.off);
    const s = byId[o.supplierId];
    const total = +(o.price * r.qty).toFixed(2);
    const units = o.unitsPerPack * r.qty;
    const savedVsLocal = r.localUnit ? Math.max(0, +((r.localUnit - o.price / o.unitsPerPack) * units).toFixed(2)) : 0;
    const p = {
      id: newId('PO'),
      createdAt: isoTime(r.daysAgo),
      sku: o.sku, productName: o.title, offerId: o.id,
      supplierId: s.id, supplierName: s.name, country: s.country, flag: s.flag, city: s.city, international: s.country !== 'US',
      quantity: r.qty, unitsPerPack: o.unitsPerPack, unit: o.unit, unitPrice: o.price, total, currency: 'USD',
      savedVsLocal, savings: savedVsLocal,
      status: r.status, verdict: r.status === 'approved-paid' ? 'NEEDS_APPROVAL' : 'APPROVE_AUTO',
      reason: r.reason,
      forecast: { dailyUsage: null, daysOfStockLeft: 2 },
      guardianChecks: [{ rule: 'seeded', passed: true, detail: 'Seeded demo history — recorded as passing all checks.' }],
      paypal: { method: r.status === 'approved-paid' ? 'order' : 'payout', id: `SEED-${r.daysAgo}D`, status: 'COMPLETED (seeded history)' },
      seeded: true,
    };
    p.receiptHash = sha256(JSON.stringify({ id: p.id, total, supplierId: s.id, paypal: p.paypal.id, createdAt: p.createdAt }));
    return p;
  });
}

function buildAudit(mandate) {
  const chain = [];
  chain.push(buildEntry(chain, { role: 'system', action: 'demo.seeded', data: { message: "Demo data seeded for Pranay's Café (30 days of sales, 7 suppliers)." } }));
  chain.push(buildEntry(chain, { role: 'owner', action: 'mandate.signed', data: { version: mandate.version, hash: mandate.hash, signedBy: mandate.signedBy } }));
  return chain;
}

/** Writes every data file. Used by `npm run seed`, POST /api/demo/reset and first start. */
export function seedAll() {
  const suppliers = buildSuppliers();
  const mandate = buildSignedMandate({ version: 1, sourceText: DEFAULT_TEXT, rules: DEFAULT_RULES, signedAt: isoTime(7, 9) });
  write('sales', buildSales());
  write('inventory', buildInventory());
  write('suppliers', suppliers);
  write('mandate', [mandate]);
  write('cash', buildCash());
  write('purchases', buildPurchaseHistory(suppliers));
  write('audit', buildAudit(mandate));
  write('state', { paused: false, pausedAt: null });
  return { ok: true };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  seedAll();
  console.log('✔ Seeded demo data into server/data/');
}
