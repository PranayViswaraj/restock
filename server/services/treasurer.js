// TREASURER (code + PayPal) and the proposal pipeline:
//
//   Scout proposes  ->  Guardian decides (pure code)  ->  Treasurer acts
//
// The LLM can never reach PayPal directly: the only path to money is
// handleProposal(), which always runs Guardian first.
import { read, write, newId } from './store.js';
import { audit } from './ledger.js';
import * as sse from './sse.js';
import { evaluate } from '../guardian/guardian.js';
import { offersForSku, findOffer } from './channel3.js';
import { createPayout, getPayoutStatus, isPayoutsNotEnabled } from './paypal.js';
import { current as currentMandate } from './mandate.js';
import { forecast } from './forecast.js';
import {
  addPurchase, updatePurchase, getPurchase, weekToDateSpend, marketAvgUnitPrice,
  receiptHash, receiveStock, debitCash,
} from './purchases.js';

const usd = (n) => `$${Number(n).toFixed(2)}`;
const today = () => new Date().toISOString().slice(0, 10);

// ------------------------------------------------------------------ kill switch
export function isPaused() {
  return !!read('state', {}).paused;
}

export function setPaused(paused) {
  const state = { paused: !!paused, pausedAt: paused ? new Date().toISOString() : null };
  write('state', state);
  audit('owner', paused ? 'agent.paused' : 'agent.resumed', { message: paused ? 'Owner pressed the kill switch. No payments will be made.' : 'Owner resumed the agent.' });
  sse.event('state', { paused: state.paused });
  return state;
}

// ------------------------------------------------------------------ Guardian input
/** Gather everything Guardian needs for a proposal (from disk). */
export function guardianInput({ sku, category, supplier, offer, quantity }) {
  const total = Math.round(offer.price * quantity * 100) / 100;
  return {
    proposal: { sku, category, supplierId: supplier.id, quantity, total, unitPrice: offer.unitPrice },
    mandate: currentMandate(),
    weekToDateSpend: weekToDateSpend(read('purchases')),
    marketAvgUnitPrice: marketAvgUnitPrice(read('suppliers'), sku, today()),
    supplier,
    cash: read('cash', {}),
    today: today(),
  };
}

// ------------------------------------------------------------------ the pipeline
/**
 * Run a Scout proposal through Guardian, then let Treasurer act on the verdict.
 * Never throws for business failures; returns { ok, purchase, verdict, message }.
 */
export async function handleProposal({ sku, offerId, quantity, reason, runId = null }) {
  const inv = read('inventory').find((i) => i.sku === sku);
  if (!inv) return { ok: false, error: `Unknown sku "${sku}".` };
  const offer = findOffer(offerId);
  if (!offer || offer.sku !== sku) return { ok: false, error: `Offer "${offerId}" is not a ${sku} offer. Use an offerId from compare_suppliers.` };
  if (!offer.inStock) return { ok: false, error: `${offer.title} is out of stock.` };
  const qty = Math.floor(Number(quantity));
  if (!Number.isFinite(qty) || qty < 1 || qty > 50) return { ok: false, error: 'quantity must be 1-50 packs.' };
  if (!reason || String(reason).trim().length < 15) return { ok: false, error: 'A plain-English reason is required.' };

  const pending = read('purchases').find((p) => p.sku === sku && ['awaiting-approval', 'delayed'].includes(p.status));
  if (pending) return { ok: false, error: `${inv.name} already has a ${pending.status} order (${pending.id}). Not buying twice.` };

  const supplier = read('suppliers').find((s) => s.id === offer.supplierId);
  const input = guardianInput({ sku, category: inv.category, supplier, offer, quantity: qty });
  const result = evaluate(input);
  const f = forecast(sku).items[0];

  // Savings: vs the 30-day market average, and vs the cheapest LOCAL in-stock offer.
  const units = offer.unitsPerPack * qty;
  const offers = await offersForSku(sku);
  const suppliers = read('suppliers');
  const localUnit = offers
    .filter((o) => o.inStock && suppliers.find((s) => s.id === o.supplierId)?.country === 'US')
    .reduce((min, o) => Math.min(min, o.unitPrice), Infinity);
  const international = supplier.country !== 'US';
  const savedVsLocal = international && Number.isFinite(localUnit) ? Math.max(0, round2((localUnit - offer.unitPrice) * units)) : 0;
  const savings = input.marketAvgUnitPrice ? Math.max(0, round2((input.marketAvgUnitPrice - offer.unitPrice) * units)) : 0;

  const purchase = {
    id: newId('PO'),
    createdAt: new Date().toISOString(),
    sku, productName: offer.title, offerId: offer.id,
    supplierId: supplier.id, supplierName: supplier.name, country: supplier.country, flag: supplier.flag, city: supplier.city,
    lat: supplier.lat, lon: supplier.lon, international,
    quantity: qty, unitsPerPack: offer.unitsPerPack, unit: offer.unit, unitPrice: offer.price, unitCost: offer.unitPrice,
    total: input.proposal.total, currency: 'USD',
    savedVsLocal, savings, marketAvgUnitPrice: input.marketAvgUnitPrice,
    status: 'proposed', verdict: result.verdict, verdictReason: result.reason, delayUntil: result.delayUntil,
    reason: String(reason).trim(),
    forecast: { dailyUsage: f?.dailyUsage ?? null, daysOfStockLeft: f?.daysOfStockLeft ?? null },
    alternatives: offers.map((o) => {
      const s = suppliers.find((x) => x.id === o.supplierId);
      return { offerId: o.id, supplier: s?.name, flag: s?.flag, country: s?.country, isNew: !!s?.isNew, unitPrice: o.unitPrice, price: o.price, inStock: o.inStock };
    }),
    guardianChecks: result.checks,
    catalogSource: offer.source || 'mock',
    paypal: null,
    runId,
  };

  audit('scout', 'purchase.proposed', { purchaseId: purchase.id, sku, supplier: supplier.name, total: purchase.total, reason: purchase.reason });
  audit('guardian', `verdict.${result.verdict}`, { purchaseId: purchase.id, reason: result.reason, failed: result.checks.filter((c) => !c.passed).map((c) => c.rule) });

  return treasurerAct(purchase, result);
}

/** Treasurer: act on a Guardian verdict. Saves the purchase and emits timeline + app events. */
async function treasurerAct(purchase, result) {
  const label = `${purchase.flag} ${purchase.supplierName}`;
  switch (result.verdict) {
    case 'BLOCK': {
      purchase.status = 'blocked';
      save(purchase);
      sse.step('guardian', 'blocked', `Blocked ${label}: ${result.reason.replace(/^Blocked by Guardian: /, '')}`, { purchaseId: purchase.id });
      sse.event('blocked', { purchase, headline: blockHeadline(purchase) });
      return { ok: false, blocked: true, verdict: 'BLOCK', purchaseId: purchase.id, message: result.reason };
    }
    case 'DELAY': {
      purchase.status = 'delayed';
      save(purchase);
      sse.step('guardian', 'verdict', `Cash check: ${result.checks.find((c) => c.rule === 'cashBuffer').detail}`, { purchaseId: purchase.id });
      sse.step('treasurer', 'delayed', `Delayed ${usd(purchase.total)} to ${label} until ${purchase.delayUntil} to protect the cash buffer.`, { purchaseId: purchase.id });
      audit('treasurer', 'payment.delayed', { purchaseId: purchase.id, until: purchase.delayUntil });
      return { ok: true, verdict: 'DELAY', status: 'delayed', purchaseId: purchase.id, message: result.reason };
    }
    case 'NEEDS_APPROVAL': {
      purchase.status = 'awaiting-approval';
      purchase.paypal = { method: 'order', id: null, status: 'AWAITING_OWNER' };
      save(purchase);
      sse.step('guardian', 'approval', `${usd(purchase.total)} to ${label} needs Pranay's approval: ${result.reason}`, { purchaseId: purchase.id });
      return { ok: true, verdict: 'NEEDS_APPROVAL', status: 'awaiting-approval', purchaseId: purchase.id, message: result.reason };
    }
    default: { // APPROVE_AUTO
      sse.step('guardian', 'verdict', `All 7 checks passed for ${usd(purchase.total)} to ${label}.`, { purchaseId: purchase.id });
      if (isPaused()) {
        purchase.status = 'awaiting-approval';
        purchase.paypal = { method: 'order', id: null, status: 'PAUSED_BY_OWNER' };
        save(purchase);
        sse.step('treasurer', 'approval', 'Agent is paused — auto-payment held for the owner.', { purchaseId: purchase.id });
        return { ok: true, verdict: 'APPROVE_AUTO', status: 'awaiting-approval', purchaseId: purchase.id, message: 'Paused: held for owner.' };
      }
      purchase.status = 'approved-auto';
      save(purchase);
      return payout(purchase);
    }
  }
}

function save(purchase) {
  if (getPurchase(purchase.id)) updatePurchase(purchase.id, purchase);
  else addPurchase(purchase);
  sse.event('purchase', { purchase });
}

// Which sandbox account receives each supplier's payouts. One env var per supplier
// group, so the cross-border payments really land in India-based sandbox accounts.
const RECEIVER_ENV = {
  'sup-coorg-hills': 'SUPPLIER_EMAIL_COORG',
  'sup-chennai-ecopack': 'SUPPLIER_EMAIL_CHENNAI',
};

/**
 * Pure: pick the payout email for a supplier.
 *   SUPPLIER_EMAIL_COORG / SUPPLIER_EMAIL_CHENNAI for the Indian suppliers,
 *   SUPPLIER_EMAIL_LOCAL for every US supplier,
 *   then the shared PAYPAL_SUPPLIER_EMAIL, then the seeded placeholder.
 * @returns {{ email: string, envVar: string }}
 */
export function payoutReceiver(supplier, env = process.env) {
  const specific = RECEIVER_ENV[supplier.id] || (supplier.country === 'US' ? 'SUPPLIER_EMAIL_LOCAL' : null);
  if (specific && env[specific]) return { email: env[specific], envVar: specific };
  if (env.PAYPAL_SUPPLIER_EMAIL) return { email: env.PAYPAL_SUPPLIER_EMAIL, envVar: 'PAYPAL_SUPPLIER_EMAIL' };
  return { email: supplier.paypalEmail, envVar: 'seeded placeholder' };
}

/** Show enough of an email to recognise the sandbox account, not the whole address. */
const maskEmail = (e) => String(e || '').replace(/^(.{2})[^@]*(@.*)$/, '$1•••$2');

/** Auto-pay with PayPal Payouts (cross-border when the supplier is abroad). */
async function payout(purchase) {
  const supplier = read('suppliers').find((s) => s.id === purchase.supplierId);
  const label = `${purchase.flag} ${purchase.supplierName}`;
  const receiver = payoutReceiver(supplier);
  sse.step('treasurer', 'tool', `Paying ${usd(purchase.total)} to ${label} via PayPal Payouts${purchase.international ? ' (cross-border)' : ''}…`);
  try {
    const result = await createPayout({
      receiverEmail: receiver.email,
      amount: purchase.total,
      currency: 'USD',
      note: `${purchase.quantity} × ${purchase.productName} for Pranay's Café. ${purchase.reason}`,
      referenceId: purchase.id,
    });
    finalizePaid(purchase.id, 'auto-paid', {
      method: 'payout', id: result.id, status: result.status, senderBatchId: result.senderBatchId,
      receiver: maskEmail(receiver.email), receiverSource: receiver.envVar, mock: !!result.mock,
    });
    if (!result.mock) refreshPayoutStatusLater(purchase.id, result.id);
    const msg = `Paid ${usd(purchase.total)} to ${label}${purchase.savedVsLocal ? ` — saved ${usd(purchase.savedVsLocal)} vs local` : ''}.`;
    sse.step('treasurer', 'paid', msg, { purchaseId: purchase.id, paypalId: result.id });
    return { ok: true, verdict: 'APPROVE_AUTO', status: 'auto-paid', purchaseId: purchase.id, paypalId: result.id, message: msg };
  } catch (err) {
    if (isPayoutsNotEnabled(err)) {
      const p = updatePurchase(purchase.id, { status: 'awaiting-approval', paypal: { method: 'order', id: null, status: 'PAYOUTS_NOT_ENABLED', error: err.message } });
      audit('treasurer', 'payout.unavailable', { purchaseId: purchase.id, error: err.message, fix: 'Enable Payouts for the sandbox app in the PayPal developer dashboard.' });
      sse.event('purchase', { purchase: p });
      sse.step('treasurer', 'approval', 'PayPal Payouts is not enabled on this sandbox account — sent to the owner for PayPal checkout instead.', { purchaseId: purchase.id });
      return { ok: true, status: 'awaiting-approval', purchaseId: purchase.id, message: 'Payouts not enabled; falling back to owner approval.' };
    }
    const p = updatePurchase(purchase.id, { status: 'failed', error: err.message, paypal: { method: 'payout', id: null, status: 'FAILED', error: err.message } });
    audit('treasurer', 'payment.failed', { purchaseId: purchase.id, error: err.message, httpStatus: err.status, paypalName: err.paypalName, debugId: err.debugId });
    sse.event('purchase', { purchase: p });
    sse.step('treasurer', 'error', `Payment failed: ${err.message}`, { purchaseId: purchase.id });
    return { ok: false, status: 'failed', purchaseId: purchase.id, error: `Payment failed: ${err.message}` };
  }
}

/** Shared by auto-pay and owner approval: mark paid, move cash and stock, hash a receipt. */
export function finalizePaid(purchaseId, status, paypal) {
  const p = getPurchase(purchaseId);
  const updated = updatePurchase(purchaseId, { status, paypal, paidAt: new Date().toISOString() });
  updated.receiptHash = receiptHash(updated);
  updatePurchase(purchaseId, { receiptHash: updated.receiptHash });
  debitCash(p.total);
  receiveStock(p);
  audit('treasurer', status === 'auto-paid' ? 'payment.payout' : 'payment.captured', {
    purchaseId, total: p.total, supplier: p.supplierName, country: p.country, paypalId: paypal.id, paypalStatus: paypal.status,
    paypal, // full PayPal response summary (method, IDs, statuses, mock flag) for the audit chain
    receiptHash: updated.receiptHash,
  });
  sse.event('purchase', { purchase: updated });
  sse.event('payment', {
    purchaseId, total: p.total, supplierName: p.supplierName, flag: p.flag, city: p.city, country: p.country,
    lat: p.lat, lon: p.lon, savedVsLocal: p.savedVsLocal, international: p.international,
  });
  return updated;
}

function refreshPayoutStatusLater(purchaseId, batchId, delayMs = 8000) {
  const timer = setTimeout(async () => {
    try {
      const s = await getPayoutStatus(batchId);
      const p = getPurchase(purchaseId);
      if (!p) return;
      const fields = Object.fromEntries(Object.entries({ status: s.status, itemStatus: s.itemStatus, itemId: s.itemId, transactionId: s.transactionId, fee: s.fee, itemError: s.errors }).filter(([, v]) => v !== undefined));
      const updated = updatePurchase(purchaseId, { paypal: { ...p.paypal, ...fields } });
      audit('treasurer', 'payout.status', { purchaseId, batchId, ...fields });
      sse.event('purchase', { purchase: updated });
    } catch (err) {
      console.warn(`[paypal] Could not refresh payout ${batchId}: ${err.message}`);
    }
  }, delayMs);
  timer.unref?.();
}

// ------------------------------------------------------------------ cash settlements (demo)
/**
 * Apply the next upcoming settlement to the balance, then retry delayed purchases.
 * WHY: lets the demo show the Treasurer paying a DELAYED order once cash lands.
 */
export async function applyNextSettlement() {
  const cash = read('cash', {});
  const next = (cash.upcomingSettlements || []).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!next) return { ok: false, message: 'No upcoming settlements.' };
  cash.upcomingSettlements = cash.upcomingSettlements.filter((s) => s !== next);
  cash.balance = round2(cash.balance + next.amount);
  write('cash', cash);
  audit('treasurer', 'cash.settled', { amount: next.amount, source: next.source, balance: cash.balance });
  sse.event('cash', { cash });

  const results = [];
  for (const p of read('purchases').filter((x) => x.status === 'delayed')) {
    results.push(await retryPurchase(p.id));
  }
  return { ok: true, settlement: next, balance: cash.balance, retried: results };
}

/** Re-run Guardian for a delayed purchase and act on the new verdict. */
export async function retryPurchase(id) {
  const p = getPurchase(id);
  if (!p || p.status !== 'delayed') return { ok: false, error: 'Only delayed purchases can be retried.' };
  const supplier = read('suppliers').find((s) => s.id === p.supplierId);
  const offer = findOffer(p.offerId);
  const inv = read('inventory').find((i) => i.sku === p.sku);
  const result = evaluate(guardianInput({ sku: p.sku, category: inv.category, supplier, offer, quantity: p.quantity }));
  audit('guardian', `verdict.${result.verdict}`, { purchaseId: id, retry: true, reason: result.reason });
  Object.assign(p, { verdict: result.verdict, verdictReason: result.reason, delayUntil: result.delayUntil, guardianChecks: result.checks });
  if (result.verdict === 'DELAY') { save(p); return { ok: true, status: 'delayed', purchaseId: id }; }
  return treasurerAct(p, result);
}

function blockHeadline(p) {
  const price = p.guardianChecks.find((c) => c.rule === 'priceDeviation' && !c.passed);
  if (price) return `Blocked by Guardian: price ${price.ratioPct}% of normal`;
  const failed = p.guardianChecks.find((c) => !c.passed);
  return `Blocked by Guardian: ${failed ? failed.rule : 'rule violation'}`;
}

const round2 = (n) => Math.round(n * 100) / 100;
