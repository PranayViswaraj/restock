// Rule-based SCOUT: stands in for the LLM when USE_MOCK_LLM=true, when no key is set,
// if the LLM fails mid-run, and always in Demo mode. It speaks the same tool-call format
// as the real providers, so Guardian, Treasurer and PayPal run the exact same code path.
import { read } from '../services/store.js';
import { current as currentMandate } from '../services/mandate.js';
import { DEMO_PRIORITY } from './roles.js';

const usd = (n) => `$${Number(n).toFixed(2)}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const perUnit = (n) => (n < 1 ? `$${n.toFixed(2)}` : usd(n));

function toolHistory(messages) {
  const argsById = {};
  for (const m of messages) if (m.role === 'assistant') for (const tc of m.toolCalls || []) argsById[tc.id] = tc.args;
  return messages.filter((m) => m.role === 'tool').map((m) => {
    let result = {};
    try { result = JSON.parse(m.content); } catch { /* ignore */ }
    return { name: m.name, args: argsById[m.toolCallId] || {}, result };
  });
}

let n = 0;
const call = (name, args, text = '') => ({ text, toolCalls: [{ id: `plan-${++n}`, name, args }], raw: null });

export function buildReason(item, offer, qty, cmp) {
  const driver = [...(item.drivers || [])].sort((a, b) => b.trendPct - a.trendPct)[0];
  const trend = driver && driver.trendPct >= 15 ? `${cap(driver.menuItem)} up ${driver.trendPct}% over 3 days.` : `Steady use of ~${item.dailyUsage} ${item.unit}/day.`;
  const runsOut = `${cap(item.name.replace(/\s*\(.*\)/, ''))} run${/s$/.test(item.name) ? '' : 's'} out in ~${Math.max(1, Math.round(item.daysOfStockLeft))} days.`;
  const units = offer.unitsPerPack * qty;
  const local = cmp.offers.find((o) => o.supplierId === cmp.cheapestLocal);
  let why;
  if (offer.country !== 'US' && local && offer.savingPerUnitVsLocal > 0) {
    const saved = offer.savingPerUnitVsLocal * units;
    why = `${offer.supplier} is ${perUnit(offer.savingPerUnitVsLocal)}/${offer.unit.replace(/s$/, '')} cheaper than the local supplier; saves ${usd(saved)}.`;
  } else if (offer.isNew) {
    why = `${offer.supplier} (new) is the only supplier with it in stock at ${usd(offer.price)}.`;
  } else {
    why = `Buying ${qty} × ${units / qty} ${offer.unit} from ${offer.supplier} at ${usd(offer.price)} each.`;
  }
  return `${trend} ${runsOut} ${why}`;
}

/** Mimics llm.chat(): picks the next tool call from what has happened so far. */
export function planner({ messages }) {
  const history = toolHistory(messages);
  const find = (name, pred = () => true) => history.find((h) => h.name === name && pred(h));

  if (!find('get_sales_summary')) return call('get_sales_summary', { days: 30 }, 'Starting the restock check — reading recent sales first.');
  if (!find('forecast_stock')) return call('forecast_stock', { sku: 'all' }, 'Forecasting how long each supply will last.');

  const rules = currentMandate()?.rules || { maxPerOrder: 100 };
  const urgent = (find('forecast_stock').result.items || [])
    .filter((i) => i.urgency === 'urgent' && !i.pendingPurchaseId && i.recommendedUnits > 0)
    .sort((a, b) => DEMO_PRIORITY.indexOf(a.sku) - DEMO_PRIORITY.indexOf(b.sku))
    .slice(0, 5);

  for (const item of urgent) {
    const cmp = find('compare_suppliers', (h) => h.args.sku === item.sku);
    if (!cmp) return call('compare_suppliers', { sku: item.sku }, `${item.name} runs out in ~${item.daysOfStockLeft} days — comparing suppliers.`);
    if (find('propose_purchase', (h) => h.args.sku === item.sku)) continue;
    const best = (cmp.result.offers || []).find((o) => o.inStock);
    if (!best) continue;
    const packsNeeded = Math.max(1, Math.ceil(item.recommendedUnits / best.unitsPerPack));
    const qty = Math.max(1, Math.min(packsNeeded, Math.floor(rules.maxPerOrder / best.price)));
    return call('propose_purchase', { sku: item.sku, supplierId: best.supplierId, quantity: qty, reason: buildReason(item, best, qty, cmp.result) });
  }

  const proposals = history.filter((h) => h.name === 'propose_purchase');
  const count = (pred) => proposals.filter((p) => pred(p.result)).length;
  const paid = count((r) => r.status === 'auto-paid');
  const waiting = count((r) => r.status === 'awaiting-approval');
  const delayed = count((r) => r.status === 'delayed');
  const blocked = count((r) => r.blocked);
  const cash = read('cash', {});
  return {
    text: proposals.length
      ? `Done. ${paid} paid automatically via PayPal, ${waiting} waiting for your approval, ${delayed} delayed to protect your cash buffer, ${blocked} blocked by Guardian. Balance now ${usd(cash.balance)}.`
      : 'Done. Every supply has at least 3 days of stock, so I did not buy anything.',
    toolCalls: [],
    raw: null,
  };
}
