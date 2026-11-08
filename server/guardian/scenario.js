// Scenario Lab: "what if" runs of the REAL Guardian (pure code, no LLM, no I/O).
// Shared by the browser (instant slider updates) and the server tests.
//
// The five pending purchases mirror the Demo mode story (same suppliers, prices
// and 30-day averages as the seed), evaluated in order exactly like the live
// pipeline: every auto-pay lowers the balance and every committed order counts
// toward the weekly budget.
import { evaluate } from './guardian.js';

export const LAB_ITEMS = [
  { id: 'milk', sku: 'milk-whole', name: 'Whole milk (12 L case)', category: 'beverage-supplies', supplier: { id: 'sup-hill-country', name: 'Hill Country Dairy', isNew: false }, flag: '🇺🇸', packPrice: 13.5, unitsPerPack: 12, marketAvgUnitPrice: 1.1219, baseQty: 2 },
  { id: 'cups', sku: 'cups-16oz', name: '16oz paper cups (500)', category: 'packaging', supplier: { id: 'sup-chennai-ecopack', name: 'Chennai EcoPack', isNew: false }, flag: '🇮🇳', packPrice: 22, unitsPerPack: 500, marketAvgUnitPrice: 0.0539, baseQty: 1 },
  { id: 'beans', sku: 'coffee-beans', name: 'Espresso beans (5 kg)', category: 'beverage-supplies', supplier: { id: 'sup-coorg-hills', name: 'Coorg Hills Coffee Co-op', isNew: false }, flag: '🇮🇳', packPrice: 42, unitsPerPack: 5, marketAvgUnitPrice: 9.7882, baseQty: 2 },
  { id: 'syrup', sku: 'caramel-syrup', name: 'Caramel syrup (6 bottles)', category: 'beverage-supplies', supplier: { id: 'sup-quicksupply', name: 'QuickSupply Deals', isNew: true }, flag: '🇺🇸', packPrice: 52.92, unitsPerPack: 6, marketAvgUnitPrice: 3.1533, baseQty: 1 },
  { id: 'lids', sku: 'lids-16oz', name: 'Flat lids (250)', category: 'packaging', supplier: { id: 'sup-chennai-ecopack', name: 'Chennai EcoPack', isNew: false }, flag: '🇮🇳', packPrice: 16, unitsPerPack: 250, marketAvgUnitPrice: 0.0694, baseQty: 2 },
];

export const DEFAULT_LAB = { demandSpikePct: 40, cashBalance: 620, priceMarkupPct: 0, weeklyBudget: 200 };
export const LAB_LIMITS = {
  demandSpikePct: [0, 150], cashBalance: [0, 3000], priceMarkupPct: [-30, 300], weeklyBudget: [50, 600],
};

const BASE_RULES = {
  maxPerOrder: 100, requireApprovalAbove: 30, minBalanceBuffer: 500, newSupplierNeedsApproval: true,
  maxPriceDeviationPct: 50, approvedCategories: ['packaging', 'beverage-supplies', 'food-supplies'],
};
const WEEK_TO_DATE = 34.9; // seeded spend this week
const round2 = (n) => Math.round(n * 100) / 100;
const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, Number.isFinite(Number(v)) ? Number(v) : lo));

function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Normalize slider values into a safe lab state. */
export function normalizeLab(lab = {}) {
  const out = {};
  for (const k of Object.keys(DEFAULT_LAB)) out[k] = clamp(lab[k] ?? DEFAULT_LAB[k], LAB_LIMITS[k]);
  return out;
}

function labContext(lab, today) {
  return {
    mandate: { version: 'lab', status: 'active', signedBy: 'Pranay', hash: 'scenario-lab', rules: { ...BASE_RULES, maxPerWeek: lab.weeklyBudget, maxPerOrder: Math.min(BASE_RULES.maxPerOrder, lab.weeklyBudget) } },
    settlements: [
      { date: addDays(today, 2), amount: 850, source: 'Card sales settlement' },
      { date: addDays(today, 5), amount: 1240, source: 'Catering invoice' },
    ],
  };
}

function proposalFor(item, { quantity, priceMarkupPct }) {
  const packPrice = round2(item.packPrice * (1 + priceMarkupPct / 100));
  return {
    packPrice,
    unitPrice: packPrice / item.unitsPerPack,
    total: round2(packPrice * quantity),
  };
}

/**
 * Evaluate all five pending purchases in order under the lab's what-if values.
 * @returns {{ results: object[], summary: object }}
 */
export function runScenario(labInput, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const lab = normalizeLab(labInput);
  const { mandate, settlements } = labContext(lab, today);
  let balance = lab.cashBalance;
  let week = WEEK_TO_DATE;
  const results = [];
  for (const item of LAB_ITEMS) {
    const quantity = Math.max(1, Math.round((item.baseQty * (100 + lab.demandSpikePct)) / 140));
    const p = proposalFor(item, { quantity, priceMarkupPct: lab.priceMarkupPct });
    const verdict = evaluate({
      proposal: { sku: item.sku, category: item.category, supplierId: item.supplier.id, quantity, total: p.total, unitPrice: p.unitPrice },
      mandate, weekToDateSpend: round2(week), marketAvgUnitPrice: item.marketAvgUnitPrice, supplier: item.supplier,
      cash: { balance: round2(balance), upcomingSettlements: settlements }, today,
    });
    if (verdict.verdict === 'APPROVE_AUTO') { balance -= p.total; week += p.total; }
    if (verdict.verdict === 'NEEDS_APPROVAL') week += p.total;
    results.push({ ...item, quantity, packPrice: p.packPrice, total: p.total, ...verdict, balanceAfter: round2(balance) });
  }
  const count = (v) => results.filter((r) => r.verdict === v).length;
  return {
    lab,
    results,
    summary: {
      autoPaid: count('APPROVE_AUTO'), needsApproval: count('NEEDS_APPROVAL'), delayed: count('DELAY'), blocked: count('BLOCK'),
      spent: round2(lab.cashBalance - balance), endBalance: round2(balance), weekSpend: round2(week),
      bufferKept: balance >= BASE_RULES.minBalanceBuffer || lab.cashBalance < BASE_RULES.minBalanceBuffer,
    },
  };
}

/**
 * "Try to trick the Guardian": one custom proposal under the lab's values.
 * The persuasive `reason` is accepted but never read by Guardian — that's the point.
 */
export function evaluateAttempt(labInput, { itemId, quantity = 1, priceMarkupPct = 0 }, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const lab = normalizeLab(labInput);
  const item = LAB_ITEMS.find((i) => i.id === itemId) || LAB_ITEMS[0];
  const qty = Math.max(1, Math.min(50, Math.floor(Number(quantity)) || 1));
  const markup = clamp(priceMarkupPct, [-30, 500]);
  const { mandate, settlements } = labContext(lab, today);
  const p = proposalFor(item, { quantity: qty, priceMarkupPct: markup });
  const verdict = evaluate({
    proposal: { sku: item.sku, category: item.category, supplierId: item.supplier.id, quantity: qty, total: p.total, unitPrice: p.unitPrice },
    mandate, weekToDateSpend: WEEK_TO_DATE, marketAvgUnitPrice: item.marketAvgUnitPrice, supplier: item.supplier,
    cash: { balance: lab.cashBalance, upcomingSettlements: settlements }, today,
  });
  return { item, quantity: qty, priceMarkupPct: markup, total: p.total, ...verdict };
}
