// Restock server: JSON API + live SSE stream + the built React app, in one Express
// process (one Render web service).
import './env.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cron from 'node-cron';
import { z } from 'zod';

import { flag } from './env.js';
import { read, allFilesExist } from './services/store.js';
import { audit, verifyStoredChain } from './services/ledger.js';
import * as sse from './services/sse.js';
import { salesSummary, forecast } from './services/forecast.js';
import * as paypal from './services/paypal.js';
import { isMock as channel3IsMock, MOCK_CATALOG } from './services/channel3.js';
import { providerInfo } from './services/llm.js';
import * as mandate from './services/mandate.js';
import { getPurchase, updatePurchase, weekToDateSpend } from './services/purchases.js';
import { isPaused, setPaused, guardianInput, finalizePaid, applyNextSettlement, retryPurchase } from './services/treasurer.js';
import { liveKpis } from './services/kpis.js';
import { evaluate } from './guardian/guardian.js';
import { simulate } from './simulation/simulate.js';
import { startAgentRun, askAgent, weeklyBriefing, isRunning } from './agent/agent.js';
import { findOffer } from './services/channel3.js';
import { seedAll } from './scripts/seed.js';
import { syncSales, salesSourceInfo, markSeeded } from './services/salesSource.js';
import { rateLimit } from './services/rateLimit.js';
import { securityHeaders } from './services/security.js';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, '..', 'client', 'dist');
const PORT = Number(process.env.PORT) || 3456;

if (!allFilesExist() || flag('SEED_ON_START')) {
  seedAll();
  console.log('✔ Demo data seeded.');
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Render runs behind one proxy: use the real client IP for rate limits
app.use(securityHeaders({ indexHtmlPath: path.join(CLIENT_DIST, 'index.html') }));
app.use(express.json({ limit: '100kb' }));

// Rate limits for the endpoints that spend free AI quota or PayPal sandbox calls.
const TEN_MIN = 10 * 60 * 1000;
const limitRun = rateLimit({ name: 'Running the agent', windowMs: TEN_MIN, max: 6, globalMax: 40 });
const limitDemo = rateLimit({ name: 'Demo mode', windowMs: TEN_MIN, max: 10, globalMax: 60 });
const limitAsk = rateLimit({ name: 'Ask Restock', windowMs: TEN_MIN, max: 20, globalMax: 150 });
const limitParse = rateLimit({ name: 'Mandate parsing', windowMs: TEN_MIN, max: 15, globalMax: 100 });
const limitBriefing = rateLimit({ name: 'The weekly briefing', windowMs: TEN_MIN, max: 30, globalMax: 300 });
// Demo runs move sandbox money and reset shared data: also cap them per minute for everyone.
const limitDemoBurst = rateLimit({ name: 'Demo mode', windowMs: 60 * 1000, max: 3, globalMax: 4 });

// ------------------------------------------------------------------ helpers
/** Consistent error: { error: { code, message, details? } } */
class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
function validate(schema, data) {
  const r = schema.safeParse(data ?? {});
  if (!r.success) throw new HttpError(400, 'VALIDATION', 'Invalid input', r.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  return r.data;
}
const services = () => {
  const llm = providerInfo();
  return {
    llm: { live: !llm.mock, provider: llm.provider, model: llm.model },
    paypal: { live: !paypal.isMock(), env: 'sandbox' },
    channel3: { live: !channel3IsMock() },
  };
};
const today = () => new Date().toISOString().slice(0, 10);

// ------------------------------------------------------------------ config & status
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/config', (req, res) => {
  res.json({
    // Public values only — the PayPal secret and LLM keys never leave the server.
    paypalClientId: paypal.isMock() ? null : process.env.PAYPAL_CLIENT_ID,
    currency: 'USD',
    business: { name: "Pranay's Café", owner: 'Pranay', city: 'Austin, TX', lat: 30.27, lon: -97.74, flag: '🇺🇸' },
    services: services(),
    publicUrl: process.env.PUBLIC_URL || null,
  });
});

app.get('/api/status', (req, res) => {
  const m = mandate.current();
  res.json({
    paused: isPaused(),
    running: isRunning(),
    mandate: m ? { version: m.version, status: m.status, hash: m.hash, signedAt: m.signedAt } : null,
    services: services(),
    salesSource: salesSourceInfo(),
    auditVerified: verifyStoredChain().ok,
  });
});

// ------------------------------------------------------------------ data
app.get('/api/sales', (req, res) => res.json({ sales: read('sales'), summary: salesSummary(30), source: salesSourceInfo() }));
app.post('/api/sales/sync', limitParse, h(async (req, res) => res.json(await syncSales())));

app.get('/api/inventory', (req, res) => {
  const f = Object.fromEntries(forecast('all').items.map((i) => [i.sku, i]));
  res.json(read('inventory').map((i) => ({ ...i, ...f[i.sku] })));
});

// Suppliers with a simple, explainable trust score (0-100).
app.get('/api/suppliers', (req, res) => {
  const purchases = read('purchases');
  res.json(read('suppliers').map((s) => {
    const prices = (s.priceHistory || []).map((p) => p.unitPrice);
    const groups = {};
    for (const p of s.priceHistory || []) (groups[p.sku] ||= []).push(p.unitPrice);
    const cvs = Object.values(groups).map((g) => { const m = g.reduce((a, b) => a + b, 0) / g.length; return Math.sqrt(g.reduce((a, b) => a + (b - m) ** 2, 0) / g.length) / m; });
    const stability = cvs.length ? Math.max(0, 1 - (cvs.reduce((a, b) => a + b, 0) / cvs.length) * 5) : 0;
    const history = Math.min(1, (s.ordersCompleted || 0) / 20);
    const trustScore = s.isNew ? 15 : Math.round((s.onTimeRate || 0) * 50 + stability * 30 + history * 20);
    const { paypalEmail, priceHistory, ...publicFields } = s; // never expose payout emails
    void paypalEmail;
    return {
      ...publicFields,
      trustScore,
      priceStability: Math.round(stability * 100),
      skus: [...new Set(priceHistory.map((p) => p.sku))],
      offers: MOCK_CATALOG.filter((o) => o.supplierId === s.id).length,
      restockOrders: purchases.filter((p) => p.supplierId === s.id && ['auto-paid', 'approved-paid'].includes(p.status)).length,
      priceTrend: prices.slice(-5),
    };
  }));
});

app.get('/api/cash', (req, res) => {
  const m = mandate.current();
  res.json({ ...read('cash', {}), minBalanceBuffer: m?.rules?.minBalanceBuffer ?? null, weekToDateSpend: weekToDateSpend(read('purchases')), maxPerWeek: m?.rules?.maxPerWeek ?? null });
});

app.get('/api/kpis', (req, res) => res.json(liveKpis()));

// ------------------------------------------------------------------ mandate
app.get('/api/mandate', (req, res) => res.json(mandate.current()));
app.get('/api/mandate/history', (req, res) => res.json([...mandate.history()].reverse()));

app.post('/api/mandate/parse', limitParse, h(async (req, res) => {
  const { text } = validate(z.object({ text: z.string().trim().min(10, 'Write at least one rule').max(2000) }), req.body);
  const parsed = await mandate.parseWithAI(text);
  const check = mandate.validateRules(parsed.rules);
  res.json({ ...parsed, valid: check.ok, rules: check.ok ? check.rules : parsed.rules, errors: check.errors });
}));

app.post('/api/mandate/sign', h(async (req, res) => {
  const body = validate(z.object({ sourceText: z.string().trim().min(10).max(2000), rules: z.any() }), req.body);
  const check = mandate.validateRules(body.rules);
  if (!check.ok) throw new HttpError(400, 'INVALID_RULES', 'These rules are not valid', check.errors);
  const signed = mandate.sign({ sourceText: body.sourceText, rules: check.rules, signedBy: 'Pranay' });
  audit('owner', 'mandate.signed', { version: signed.version, hash: signed.hash, rules: signed.rules });
  sse.event('mandate', { mandate: signed });
  res.json(signed);
}));

app.post('/api/mandate/revoke', (req, res) => {
  const revoked = mandate.revoke();
  if (!revoked) throw new HttpError(400, 'NO_ACTIVE_MANDATE', 'There is no active mandate to revoke.');
  audit('owner', 'mandate.revoked', { version: revoked.version, hash: revoked.hash });
  sse.event('mandate', { mandate: revoked });
  res.json(revoked);
});

// ------------------------------------------------------------------ agent
app.post('/api/agent/run', limitRun, (req, res) => {
  res.status(202).json(startAgentRun({ trigger: 'dashboard' }));
});

// Daily agent check, triggered by an external scheduler (GitHub Actions / Render cron).
// Disabled unless CRON_SECRET is set; the caller sends "Authorization: Bearer <CRON_SECRET>".
app.post('/api/cron/daily-run', (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new HttpError(503, 'CRON_DISABLED', 'Set CRON_SECRET to enable the scheduled daily run.');
  const given = Buffer.from(String(req.get('authorization') || '').replace(/^Bearer\s+/i, ''));
  const want = Buffer.from(secret);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) throw new HttpError(401, 'UNAUTHORIZED', 'Bad cron secret.');
  if (isRunning()) return res.json({ skipped: 'already running' });
  if (isPaused()) return res.json({ skipped: 'kill switch is on' });
  audit('system', 'cron.triggered', { source: req.get('user-agent')?.slice(0, 80) || 'unknown' });
  res.status(202).json(startAgentRun({ trigger: 'daily schedule' }));
});
app.post('/api/agent/pause', (req, res) => res.json(setPaused(true)));
app.post('/api/agent/resume', (req, res) => res.json(setPaused(false)));

app.get('/api/agent/stream', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  sse.addClient(res, { running: isRunning(), paused: isPaused() });
  const ping = setInterval(() => res.write(': ping\n\n'), 20000); // keeps Render's proxy from closing it
  req.on('close', () => clearInterval(ping));
});

app.post('/api/agent/ask', limitAsk, h(async (req, res) => {
  const { question } = validate(z.object({ question: z.string().trim().min(1).max(500) }), req.body);
  res.json(await askAgent(question));
}));

app.get('/api/briefing', limitBriefing, h(async (req, res) => res.json(await weeklyBriefing())));

// ------------------------------------------------------------------ purchases
app.get('/api/purchases', (req, res) => res.json(read('purchases')));

app.get('/api/purchases/:id', (req, res) => {
  const p = getPurchase(req.params.id);
  if (!p) throw new HttpError(404, 'NOT_FOUND', 'Purchase not found.');
  res.json(p);
});

app.post('/api/purchases/:id/reject', (req, res) => {
  const p = getPurchase(req.params.id);
  if (!p) throw new HttpError(404, 'NOT_FOUND', 'Purchase not found.');
  if (!['awaiting-approval', 'delayed'].includes(p.status)) throw new HttpError(400, 'BAD_STATUS', `Purchase is ${p.status}.`);
  const updated = updatePurchase(p.id, { status: 'rejected', rejectedAt: new Date().toISOString() });
  audit('owner', 'purchase.rejected', { purchaseId: p.id, total: p.total });
  sse.event('purchase', { purchase: updated });
  sse.event('toast', { kind: 'info', message: `Rejected ${p.productName}. No money moved.` });
  res.json(updated);
});

app.post('/api/purchases/:id/retry', h(async (req, res) => res.json(await retryPurchase(req.params.id))));
app.post('/api/cash/settle', h(async (req, res) => res.json(await applyNextSettlement())));

// ------------------------------------------------------------------ PayPal approval (Orders v2)
app.post('/api/paypal/orders', h(async (req, res) => {
  const { purchaseId } = validate(z.object({ purchaseId: z.string().min(3) }), req.body);
  const p = getPurchase(purchaseId);
  if (!p) throw new HttpError(404, 'NOT_FOUND', 'Purchase not found.');
  if (p.status !== 'awaiting-approval') throw new HttpError(400, 'BAD_STATUS', `Purchase is ${p.status}, not awaiting approval.`);

  // Guardian runs again at approval time: the owner can approve over-limit amounts,
  // but never something that is now blocked (e.g. mandate revoked, price spike).
  const inv = read('inventory').find((i) => i.sku === p.sku);
  const supplier = read('suppliers').find((s) => s.id === p.supplierId);
  const input = guardianInput({ sku: p.sku, category: inv.category, supplier, offer: findOffer(p.offerId), quantity: p.quantity });
  input.weekToDateSpend = Math.max(0, input.weekToDateSpend - p.total); // don't count this order twice
  const verdict = evaluate(input);
  if (verdict.verdict === 'BLOCK') throw new HttpError(400, 'GUARDIAN_BLOCK', verdict.reason);

  const order = await paypal.createOrder({ amount: p.total, description: `${p.quantity} × ${p.productName}`, referenceId: p.id });
  const updated = updatePurchase(p.id, { paypal: { method: 'order', id: order.id, status: order.status } });
  audit('treasurer', 'order.created', { purchaseId: p.id, orderId: order.id, orderStatus: order.status, total: p.total, mock: !!order.mock });
  sse.event('purchase', { purchase: updated });
  res.json({ id: order.id, status: order.status, mock: !!order.mock });
}));

app.post('/api/paypal/orders/:id/capture', h(async (req, res) => {
  const orderId = req.params.id;
  const p = read('purchases').find((x) => x.paypal?.id === orderId);
  if (!p) throw new HttpError(404, 'NOT_FOUND', 'No purchase is linked to this PayPal order.');
  if (p.status === 'approved-paid') return res.json({ purchase: p }); // idempotent
  try {
    const cap = await paypal.captureOrder(orderId);
    if (cap.status !== 'COMPLETED') {
      const failed = updatePurchase(p.id, { status: 'failed', error: `Capture status ${cap.status}`, paypal: { ...p.paypal, status: cap.status } });
      audit('treasurer', 'payment.failed', { purchaseId: p.id, orderId, status: cap.status });
      sse.event('purchase', { purchase: failed });
      throw new HttpError(502, 'CAPTURE_INCOMPLETE', `PayPal returned ${cap.status}.`);
    }
    audit('owner', 'purchase.approved', { purchaseId: p.id, orderId });
    const updated = finalizePaid(p.id, 'approved-paid', {
      method: 'order', id: orderId, status: cap.status, captureId: cap.captureId, captureStatus: cap.captureStatus,
      payerId: cap.payerId, sellerReceivable: cap.sellerReceivable, mock: !!cap.mock,
    });
    sse.event('toast', { kind: 'success', message: `Pranay approved ${p.productName}: $${p.total.toFixed(2)} paid via PayPal.` });
    res.json({ purchase: updated });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    // Instrument declined etc. -> keep it awaiting so the owner can try again.
    audit('treasurer', 'capture.error', { purchaseId: p.id, orderId, error: err.message, httpStatus: err.status, paypalName: err.paypalName, debugId: err.debugId });
    throw new HttpError(502, 'PAYPAL_ERROR', err.message);
  }
}));

// Refresh one payout's status from PayPal (GET /v1/payments/payouts/{id}) and update the purchase.
app.get('/api/paypal/payouts/:batchId', limitParse, h(async (req, res) => {
  const batchId = validate(z.object({ batchId: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_-]+$/) }), req.params).batchId;
  const p = read('purchases').find((x) => x.paypal?.method === 'payout' && x.paypal.id === batchId);
  if (!p) throw new HttpError(404, 'NOT_FOUND', 'No purchase is linked to this payout batch.');
  if (p.paypal.mock || p.seeded) return res.json({ purchase: p, refreshed: false, reason: p.seeded ? 'Seeded demo history is not in PayPal.' : 'Mock payout (no sandbox keys).' });
  try {
    const s = await paypal.getPayoutStatus(batchId);
    const fields = Object.fromEntries(Object.entries({ status: s.status, itemStatus: s.itemStatus, itemId: s.itemId, transactionId: s.transactionId, fee: s.fee, itemError: s.errors }).filter(([, v]) => v !== undefined));
    const updated = updatePurchase(p.id, { paypal: { ...p.paypal, ...fields, checkedAt: new Date().toISOString() } });
    audit('treasurer', 'payout.status', { purchaseId: p.id, batchId, ...fields, trigger: 'manual refresh' });
    sse.event('purchase', { purchase: updated });
    res.json({ purchase: updated, refreshed: true });
  } catch (err) {
    throw new HttpError(502, 'PAYPAL_ERROR', err.message);
  }
}));

// Optional webhook: disabled unless PAYPAL_WEBHOOK_ID is set. Signature verified by PayPal.
app.post('/api/paypal/webhook', h(async (req, res) => {
  if (!process.env.PAYPAL_WEBHOOK_ID || paypal.isMock()) throw new HttpError(503, 'WEBHOOKS_DISABLED', 'Set PAYPAL_WEBHOOK_ID to enable webhooks.');
  const ok = await paypal.verifyWebhookSignature(req.headers, req.body);
  if (!ok) throw new HttpError(401, 'BAD_SIGNATURE', 'Webhook signature verification failed.');
  const evt = req.body;
  audit('treasurer', 'webhook.received', { type: evt.event_type, id: evt.id, resource: evt.resource?.id });
  // Payout item / capture events update the matching purchase's PayPal status.
  const batchId = evt.resource?.batch_header?.payout_batch_id || evt.resource?.payout_batch_id;
  const orderId = evt.resource?.supplementary_data?.related_ids?.order_id;
  const p = read('purchases').find((x) => x.paypal?.id && [batchId, orderId].includes(x.paypal.id));
  if (p) {
    const updated = updatePurchase(p.id, { paypal: { ...p.paypal, webhookEvent: evt.event_type } });
    sse.event('purchase', { purchase: updated });
  }
  res.json({ received: true });
}));

// ------------------------------------------------------------------ audit, simulation, demo
app.get('/api/audit', (req, res) => res.json([...read('audit')].reverse()));
app.get('/api/audit/verify', (req, res) => res.json(verifyStoredChain()));

app.post('/api/simulate', (req, res) => {
  const assumptions = validate(z.object({
    manualHoursPerWeek: z.number().min(0).max(40).optional(),
    lostSalePerStockout: z.number().min(0).max(5000).optional(),
  }), req.body);
  const m = mandate.current();
  const offers = MOCK_CATALOG.filter((o) => o.sku).map((o) => ({ ...o, unitPrice: o.price / o.unitsPerPack }));
  // Simulate with the current rules even if the mandate was revoked (it's a what-if).
  const simMandate = m ? { ...m, status: 'active' } : mandate.buildSignedMandate({ version: 0, sourceText: 'default', rules: mandate.DEFAULT_RULES });
  res.json(simulate({ sales: read('sales'), inventory: read('inventory'), offers, suppliers: read('suppliers'), mandate: simMandate, assumptions }));
});

app.post('/api/demo/reset', (req, res) => {
  if (isRunning()) throw new HttpError(409, 'BUSY', 'Wait for the agent run to finish.');
  seedAll();
  markSeeded();
  sse.resetRun();
  sse.event('reset', {});
  res.json({ ok: true });
});

// Demo mode: fresh data + scripted, paced run. Works with zero keys.
// (The Scout is scripted; Guardian and PayPal are real when keys are set.)
app.post('/api/demo/run', limitDemoBurst, limitDemo, (req, res) => {
  if (isRunning()) throw new HttpError(409, 'BUSY', 'The agent is already running.');
  seedAll();
  markSeeded('Demo mode always uses the seeded story.');
  sse.event('reset', {});
  res.status(202).json(startAgentRun({ trigger: 'demo mode', scripted: true }));
});

// ------------------------------------------------------------------ frontend
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST, { maxAge: '1h', index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
} else {
  app.get('/', (req, res) => res.type('text').send('Restock API is running. Build the dashboard with `npm run build`, or run `npm run dev` and open http://localhost:5173'));
}

app.use('/api', (req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` } }));

// Central error handler: consistent JSON, never crashes the process.
app.use((err, req, res, _next) => {
  const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500) console.error('[server]', err);
  if (!res.headersSent) {
    res.status(status).json({ error: { code: err.code || (status === 400 ? 'BAD_REQUEST' : 'SERVER_ERROR'), message: err.message || 'Server error', details: err.details } });
  }
});

process.on('unhandledRejection', (err) => console.error('[server] Unhandled rejection:', err));

if (flag('ENABLE_DAILY_RUN')) {
  const schedule = process.env.DAILY_RUN_CRON || '0 7 * * *';
  cron.schedule(schedule, () => {
    try { startAgentRun({ trigger: 'daily schedule' }); } catch (err) { console.warn('[cron]', err.message); }
  }, { timezone: process.env.DAILY_RUN_TZ || 'America/Chicago' });
  console.log(`⏰ Daily agent run scheduled: "${schedule}"`);
}

// Express 5 passes listen errors (e.g. port already in use) to this callback.
app.listen(PORT, (err) => {
  if (err) {
    console.error(`\n✖ Could not start on port ${PORT}: ${err.code === 'EADDRINUSE' ? 'another app is already using it.' : err.message}`);
    console.error('  Set a different PORT in .env (e.g. PORT=3457) and try again.\n');
    process.exit(1);
  }
  const s = services();
  syncSales().then((info) => console.log(`   Sales source: ${info.label}${info.note ? ` (${info.note})` : ''}`));
  console.log(`\n☕ Restock running on http://localhost:${PORT}  (${today()})`);
  console.log(`   Scout AI: ${s.llm.live ? `${s.llm.provider} (${s.llm.model})` : 'MOCK (rule-based)'}`);
  console.log(`   PayPal: ${s.paypal.live ? 'sandbox' : 'MOCK'}   Channel3: ${s.channel3.live ? 'live' : 'MOCK'}\n`);
});
