// SCOUT's tools: JSON-schema definitions (sent to the LLM) + the code that runs them.
// None of these can move money. propose_purchase hands off to Guardian -> Treasurer.
import { read } from '../services/store.js';
import { audit } from '../services/ledger.js';
import { salesSummary, forecast } from '../services/forecast.js';
import { searchProducts, offersForSku } from '../services/channel3.js';
import { handleProposal } from '../services/treasurer.js';
import { current as currentMandate } from '../services/mandate.js';
import { weekToDateSpend } from '../services/purchases.js';

const usd = (n) => `$${Number(n).toFixed(2)}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const TOOL_DEFINITIONS = [
  {
    name: 'get_sales_summary',
    description: 'Daily sales per menu item for the last N days, with averages and trend % (last 3 days vs earlier).',
    parameters: { type: 'object', properties: { days: { type: 'integer', description: 'Days (1-30). Default 30.' } } },
  },
  {
    name: 'get_inventory',
    description: 'Current stock, unit, reorder point and category for every supply.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'forecast_stock',
    description: 'Daily usage (weighted moving average, computed in code) and days of stock left. Use sku="all" for every item in one call. Includes recommendedUnits (to cover ~7 days) and pendingPurchaseId.',
    parameters: { type: 'object', properties: { sku: { type: 'string', description: 'Inventory SKU or "all".' } }, required: ['sku'] },
  },
  {
    name: 'search_products',
    description: 'Search supplier catalogs (Channel3) by text, optionally filtered by category.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' }, category: { type: 'string', description: 'packaging | beverage-supplies | food-supplies' } },
      required: ['query'],
    },
  },
  {
    name: 'compare_suppliers',
    description: 'All supplier offers for one SKU, cheapest unit price first, with country, flag, inStock, isNew and savings vs the cheapest local (US) offer.',
    parameters: { type: 'object', properties: { sku: { type: 'string' } }, required: ['sku'] },
  },
  {
    name: 'get_cash_position',
    description: 'PayPal balance, required cash buffer, upcoming settlements and week-to-date spend.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'propose_purchase',
    description: 'Propose buying `quantity` PACKS of an SKU from a supplier. Guardian checks it against the mandate, then Treasurer pays (PayPal), queues it for approval, delays it, or it is blocked.',
    parameters: {
      type: 'object',
      properties: {
        sku: { type: 'string' },
        supplierId: { type: 'string', description: 'supplierId from compare_suppliers.' },
        quantity: { type: 'integer', description: 'Number of packs.' },
        reason: { type: 'string', description: 'Under 45 words for Pranay: trend, days left, what and why this supplier, savings.' },
      },
      required: ['sku', 'supplierId', 'quantity', 'reason'],
    },
  },
  {
    name: 'log_decision',
    description: 'Write a note to the audit log (e.g. why an item was skipped).',
    parameters: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
  },
];

export async function compareSuppliers(sku) {
  const suppliers = read('suppliers');
  const offers = await offersForSku(sku);
  if (!offers.length) return { sku, offers: [], error: `No offers for "${sku}".` };
  const withSupplier = offers.map((o) => {
    const s = suppliers.find((x) => x.id === o.supplierId) || {};
    return {
      offerId: o.id, supplierId: o.supplierId, supplier: s.name, country: s.country, flag: s.flag, city: s.city,
      isNew: !!s.isNew, onTimeRate: s.onTimeRate, inStock: o.inStock, title: o.title,
      price: o.price, unitsPerPack: o.unitsPerPack, unit: o.unit, unitPrice: o.unitPrice,
    };
  }).sort((a, b) => a.unitPrice - b.unitPrice);
  const localBest = withSupplier.filter((o) => o.inStock && o.country === 'US' && !o.isNew)[0];
  for (const o of withSupplier) {
    o.savingPerUnitVsLocal = localBest && o.country !== 'US' ? Math.round((localBest.unitPrice - o.unitPrice) * 10000) / 10000 : 0;
  }
  const best = withSupplier.find((o) => o.inStock);
  return { sku, offers: withSupplier, cheapestInStock: best ? best.supplierId : null, cheapestLocal: localBest ? localBest.supplierId : null };
}

export function cashPosition() {
  const cash = read('cash', {});
  const m = currentMandate();
  return {
    balance: cash.balance, currency: 'USD', minBalanceBuffer: m?.rules?.minBalanceBuffer ?? null,
    headroom: Math.round((cash.balance - (m?.rules?.minBalanceBuffer ?? 0)) * 100) / 100,
    upcomingSettlements: cash.upcomingSettlements || [],
    weekToDateSpend: weekToDateSpend(read('purchases')), maxPerWeek: m?.rules?.maxPerWeek ?? null,
  };
}

const IMPLEMENTATIONS = {
  get_sales_summary({ days = 30 } = {}) {
    const s = salesSummary(Math.min(30, Math.max(1, Number(days) || 30)));
    return { ...s, items: s.items.map(({ daily, ...rest }) => ({ ...rest, last5Days: daily.slice(-5) })) };
  },
  get_inventory() {
    return { items: read('inventory').map(({ sku, name, unit, stock, reorderPoint, category }) => ({ sku, name, unit, stock, reorderPoint, category })) };
  },
  forecast_stock({ sku = 'all' } = {}) {
    const r = forecast(sku);
    if (!r.items.length) return { error: `Unknown sku "${sku}".` };
    return { ...r, items: r.items.map(({ usageTrend: _usageTrend, ...rest }) => rest) };
  },
  async search_products({ query, category } = {}) {
    if (!query) return { error: 'query is required' };
    const results = await searchProducts(String(query), { category });
    return { query, count: results.length, products: results.map(({ id, supplierId, sku, title, price, unitsPerPack, unit, unitPrice, inStock }) => ({ id, supplierId, sku, title, price, unitsPerPack, unit, unitPrice, inStock })) };
  },
  compare_suppliers({ sku } = {}) {
    return compareSuppliers(sku);
  },
  get_cash_position() {
    return cashPosition();
  },
  async propose_purchase({ sku, supplierId, quantity, reason } = {}, ctx = {}) {
    const offer = (await offersForSku(sku)).find((o) => o.supplierId === supplierId);
    if (!offer) return { ok: false, error: `Supplier "${supplierId}" has no offer for "${sku}". Use compare_suppliers.` };
    return handleProposal({ sku, offerId: offer.id, quantity, reason, runId: ctx.runId });
  },
  log_decision({ message } = {}, ctx = {}) {
    if (!message) return { error: 'message is required' };
    audit('scout', 'decision.note', { message: String(message).slice(0, 1000), runId: ctx.runId });
    return { ok: true };
  },
};

/** Run a tool. Never throws — errors come back as { error } so the agent can react. */
export async function runTool(name, args, ctx) {
  const fn = IMPLEMENTATIONS[name];
  if (!fn) return { error: `Unknown tool "${name}".` };
  try {
    return await fn(args || {}, ctx);
  } catch (err) {
    console.error(`[tool:${name}]`, err);
    return { error: `Tool ${name} failed: ${err.message}` };
  }
}

// ------------------------------------------------------------------ timeline text
export function describeCall(name, args = {}) {
  switch (name) {
    case 'get_sales_summary': return `Reading the last ${args.days || 30} days of sales…`;
    case 'get_inventory': return 'Checking stock levels…';
    case 'forecast_stock': return args.sku && args.sku !== 'all' ? `Forecasting ${args.sku}…` : 'Forecasting days of stock left for every supply…';
    case 'search_products': return `Searching Channel3 for "${args.query}"…`;
    case 'compare_suppliers': return `Comparing local and international suppliers for ${args.sku}…`;
    case 'get_cash_position': return 'Checking the cash position…';
    case 'propose_purchase': return `Proposing ${args.quantity} pack(s) of ${args.sku} → Guardian`;
    case 'log_decision': return 'Writing a note to the audit log…';
    default: return `Running ${name}…`;
  }
}

export function describeResult(name, r) {
  if (r?.error) return r.error;
  switch (name) {
    case 'get_sales_summary': {
      const moving = r.items.filter((i) => i.trend !== 'steady');
      return moving.length ? moving.map((i) => `${cap(i.item)} ${i.trendPct > 0 ? 'up' : 'down'} ${Math.abs(i.trendPct)}% over 3 days`).join('; ') + '.' : 'Sales are steady.';
    }
    case 'get_inventory': return `${r.items.length} supplies tracked.`;
    case 'forecast_stock': {
      const urgent = r.items.filter((i) => i.urgency === 'urgent');
      return urgent.length ? `Running low: ${urgent.map((i) => `${i.name} (~${i.daysOfStockLeft}d)`).join(', ')}.` : 'Nothing runs out in the next 3 days.';
    }
    case 'search_products': return `Found ${r.count} products.`;
    case 'compare_suppliers': {
      const best = r.offers.find((o) => o.inStock);
      if (!best) return 'No supplier has this in stock.';
      const out = r.offers.filter((o) => !o.inStock).map((o) => `${o.supplier} out of stock`);
      const save = best.savingPerUnitVsLocal > 0 ? `, $${best.savingPerUnitVsLocal.toFixed(best.unitPrice < 1 ? 3 : 2)}/${best.unit.replace(/s$/, '')} cheaper than local` : '';
      return `${r.offers.length} offers. Best in stock: ${best.flag} ${best.supplier} at ${usd(best.price)}${save}${best.isNew ? ' (NEW supplier)' : ''}.${out.length ? ` ${out.join(', ')}.` : ''}`;
    }
    case 'get_cash_position': return `Balance ${usd(r.balance)}, buffer ${usd(r.minBalanceBuffer)}, headroom ${usd(r.headroom)}.`;
    case 'propose_purchase': return r.message || (r.ok ? 'Done.' : 'Not purchased.');
    case 'log_decision': return 'Logged.';
    default: return 'Done.';
  }
}
