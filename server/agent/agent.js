// The agent loop: SCOUT (LLM) decides -> tools run -> results go back -> repeat.
// Money only moves via propose_purchase -> Guardian -> Treasurer.
//
// Safety:
//   - Max AGENT_MAX_TOOL_CALLS (default 12) tool calls per run.
//   - One run at a time; refuses to start while the kill switch is on, and stops mid-run if pressed.
//   - LLM failure (after one retry inside llm.js) -> friendly error -> rule-based Scout finishes the run.
import { read, newId } from '../services/store.js';
import { audit } from '../services/ledger.js';
import * as sse from '../services/sse.js';
import { chat, providerInfo, LLMError } from '../services/llm.js';
import { current as currentMandate } from '../services/mandate.js';
import { isPaused } from '../services/treasurer.js';
import { weekToDateSpend } from '../services/purchases.js';
import { forecast } from '../services/forecast.js';
import { flag } from '../env.js';
import { TOOL_DEFINITIONS, runTool, describeCall, describeResult, cashPosition } from './tools.js';
import { scoutSystemPrompt, askSystemPrompt, briefingSystemPrompt } from './prompt.js';
import { planner } from './planner.js';
import { syncSales, salesSourceInfo } from '../services/salesSource.js';

const MAX_TOOL_CALLS = Number(process.env.AGENT_MAX_TOOL_CALLS) || 12;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let running = false;

export function isRunning() {
  return running;
}

/**
 * Start a run in the background. Returns { runId } immediately.
 * scripted=true -> Demo mode: rule-based Scout with pauses between steps (works with no keys).
 */
export function startAgentRun({ trigger = 'dashboard', scripted = false, pace = 1 } = {}) {
  if (running) throw Object.assign(new Error('The agent is already running.'), { status: 409, code: 'BUSY' });
  if (isPaused()) throw Object.assign(new Error('The agent is paused. Resume it with the kill switch first.'), { status: 423, code: 'PAUSED' });
  running = true;
  sse.resetRun();
  const runId = newId('RUN');
  sse.event('run', { running: true, runId });
  runAgent({ runId, trigger, scripted, pace })
    .catch((err) => {
      console.error('[agent] Unexpected error:', err);
      audit('system', 'agent.crashed', { runId, error: err.message });
      sse.step('system', 'error', `Something went wrong: ${err.message}`);
    })
    .finally(() => {
      running = false;
      sse.step('system', 'done', 'Run finished.', { runId });
      sse.event('run', { running: false, runId });
    });
  return { runId };
}

async function runAgent({ runId, trigger, scripted, pace = 1 }) {
  const today = new Date().toISOString().slice(0, 10);
  const info = providerInfo();
  const useLLM = !scripted && !info.mock;
  // Story Mode asks for a slower pace so its captions land just before each event.
  const stepDelay = scripted ? Number(process.env.DEMO_STEP_DELAY_MS ?? 1100) * Math.min(2.5, Math.max(1, Number(pace) || 1)) : 0;
  const system = scoutSystemPrompt({ mandate: currentMandate(), today, maxToolCalls: MAX_TOOL_CALLS });
  const messages = [{ role: 'user', content: `Run the restock check for Pranay's Café now (trigger: ${trigger}).` }];
  const ctx = { runId };

  const who = scripted ? 'Demo mode · scripted Scout' : useLLM ? `${info.provider} · ${info.model}` : 'rule-based Scout';
  sse.step('scout', 'start', `Scout started (${who}).`, { runId, trigger });
  // Live runs pull sales from PayPal when USE_PAYPAL_SALES=true (falls back to seeded data).
  const sales = scripted ? salesSourceInfo() : await syncSales();
  sse.step('scout', 'result', `Sales source: ${sales.label}${sales.count ? ` (${sales.count} rows)` : ''}.${sales.note ? ` ${sales.note}` : ''}`, { salesSource: sales.source });
  audit('scout', 'run.started', { runId, trigger, engine: who, salesSource: sales.source });

  let toolCalls = 0;
  let fallback = !useLLM;
  let finalText = '';

  for (let turn = 0; turn < MAX_TOOL_CALLS + 4; turn++) {
    if (isPaused()) {
      sse.step('owner', 'blocked', 'Kill switch pressed — Scout stopped. No further payments.');
      audit('scout', 'run.stopped', { runId, reason: 'paused by owner' });
      return;
    }
    if (stepDelay) await sleep(stepDelay);

    let reply;
    try {
      reply = fallback ? planner({ messages }) : await chat({ system, messages, tools: TOOL_DEFINITIONS, mock: planner });
    } catch (err) {
      const friendly = err instanceof LLMError ? err.message : `AI error: ${err.message}`;
      audit('system', 'llm.error', { runId, error: err.raw || err.message });
      if (fallback || !flag('AGENT_FALLBACK_TO_RULES', true)) {
        sse.step('system', 'error', friendly);
        return;
      }
      // Calm notice, not an alarm: the run continues under the same Guardian rules.
      // The exact provider error is kept in the audit ledger.
      sse.step('system', 'notice', 'AI busy, using backup logic. Guardian applies exactly the same rules.', { fallback: true, detail: friendly });
      audit('scout', 'fallback.rules', { runId, reason: friendly });
      fallback = true;
      turn--;
      continue;
    }

    if (!reply.toolCalls?.length) { finalText = reply.text; break; }
    if (reply.text) sse.step('scout', 'thinking', reply.text);
    messages.push({ role: 'assistant', content: reply.text, toolCalls: reply.toolCalls, raw: reply.raw });

    for (const tc of reply.toolCalls) {
      let result;
      if (toolCalls >= MAX_TOOL_CALLS) {
        result = { error: `Tool budget of ${MAX_TOOL_CALLS} reached. Stop and summarise.` };
      } else {
        toolCalls++;
        sse.step('scout', 'tool', describeCall(tc.name, tc.args), { tool: tc.name, args: tc.args, n: toolCalls });
        if (stepDelay && tc.name === 'propose_purchase') await sleep(stepDelay / 2);
        result = await runTool(tc.name, tc.args, ctx);
        // Guardian/Treasurer emit their own steps for proposals; Scout reports the rest.
        if (tc.name !== 'propose_purchase' || result.error) {
          sse.step('scout', result.error ? 'error' : 'result', describeResult(tc.name, result), { tool: tc.name });
        }
      }
      messages.push({ role: 'tool', toolCallId: tc.id, name: tc.name, content: JSON.stringify(result) });
    }
  }

  const summary = finalText || planner({ messages }).text || 'Run complete.';
  sse.step('scout', 'summary', summary, { runId, toolCalls });
  audit('scout', 'run.finished', { runId, toolCalls, summary });
}

// ------------------------------------------------------------------ context for Ask + Briefing
function contextSnapshot() {
  const purchases = read('purchases').slice(-30).map((p) => ({
    id: p.id, sku: p.sku, date: p.createdAt.slice(0, 10), productName: p.productName, supplier: p.supplierName, country: p.country,
    quantity: p.quantity, total: p.total, savedVsLocal: p.savedVsLocal, savings: p.savings, status: p.status, verdict: p.verdict,
    guardian: p.verdictReason, reason: p.reason, seeded: !!p.seeded, paypalId: p.paypal?.id,
  }));
  return {
    mandate: currentMandate(),
    cash: cashPosition(),
    weekToDateSpend: weekToDateSpend(read('purchases')),
    purchases,
    recentAudit: read('audit').slice(-30).map(({ seq, timestamp, role, action, data }) => ({ seq, timestamp, role, action, data })),
    stock: forecast('all').items.map(({ name, stock, unit, daysOfStockLeft }) => ({ name, stock, unit, daysOfStockLeft })),
  };
}

export async function askAgent(question) {
  const q = String(question || '').trim().slice(0, 500);
  if (!q) return { answer: 'Ask me something like "Why did you buy cups?" or "What did you block this week?"' };
  const ctx = contextSnapshot();
  const today = new Date().toISOString().slice(0, 10);
  audit('owner', 'ask', { question: q });
  try {
    const reply = await chat({
      system: askSystemPrompt({ today }),
      messages: [{ role: 'user', content: `Context JSON:\n${JSON.stringify(ctx)}\n\nQuestion: ${q}` }],
      mock: () => ({ text: answerFromRecords(q, ctx), toolCalls: [], mock: true }),
    });
    return { answer: reply.text || "I couldn't find that in my records.", source: reply.mock ? 'records' : 'ai' };
  } catch (err) {
    return { answer: `${answerFromRecords(q, ctx)}\n\n(AI busy, answered from your records.)`, source: 'records', error: err.message };
  }
}

/** Keyword answers for mock mode / LLM outages. */
export function answerFromRecords(q, ctx) {
  const lower = q.toLowerCase();
  const live = ctx.purchases.filter((p) => !p.seeded);
  const list = (arr) => arr.map((p) => `${p.productName} ($${p.total.toFixed(2)})`).join(', ');
  if (/block/.test(lower)) {
    const b = ctx.purchases.filter((p) => p.status === 'blocked');
    return b.length ? `Guardian blocked ${b.length}: ${b.map((p) => `${p.productName} from ${p.supplier}. ${p.guardian}`).join(' ')}` : 'Guardian has not blocked anything recently.';
  }
  if (/delay/.test(lower)) {
    const d = ctx.purchases.filter((p) => p.status === 'delayed');
    return d.length ? `Delayed to protect your cash buffer: ${list(d)}. ${d[0].guardian}` : 'Nothing is delayed right now.';
  }
  if (/approv|pending|waiting/.test(lower)) {
    const w = ctx.purchases.filter((p) => p.status === 'awaiting-approval');
    return w.length ? `${w.length} order(s) need your approval: ${list(w)}.` : 'Nothing is waiting for your approval.';
  }
  if (/sav|cheaper|cross|india|international/.test(lower)) {
    const intl = ctx.purchases.filter((p) => p.savedVsLocal > 0 && ['auto-paid', 'approved-paid'].includes(p.status));
    const total = intl.reduce((t, p) => t + p.savedVsLocal, 0);
    return `Buying cross-border saved $${total.toFixed(2)} vs local suppliers across ${intl.length} order(s).`;
  }
  if (/spend|spent|budget|how much/.test(lower)) {
    return `Week-to-date spend is $${ctx.weekToDateSpend.toFixed(2)} of your $${ctx.mandate?.rules?.maxPerWeek} weekly limit. Balance: $${Number(ctx.cash.balance).toFixed(2)} (buffer $${ctx.cash.minBalanceBuffer}).`;
  }
  const words = lower.split(/[^a-z0-9]+/).filter((w) => w.length > 2).map((w) => w.replace(/s$/, ''));
  const score = (p) => words.reduce((s, w) => s + (p.sku?.includes(w) ? 2 : 0) + (p.productName.toLowerCase().includes(w) ? 1 : 0), 0);
  const match = [...ctx.purchases].reverse().map((p) => ({ p, s: score(p) })).filter((x) => x.s > 0).sort((x, y) => y.s - x.s)[0]?.p;
  if (match) return `On ${match.date} I proposed ${match.quantity} × ${match.productName} from ${match.supplier} for $${match.total.toFixed(2)} (${match.status}). Reason: "${match.reason}"${match.guardian ? ` Guardian: ${match.guardian}` : ''}`;
  return live.length ? `My latest decision: ${live[live.length - 1].productName} (${live[live.length - 1].status}). Ask about an item for details.` : "I haven't made purchases yet. Click Run agent.";
}

// ------------------------------------------------------------------ weekly briefing
let briefingCache = { key: null, value: null };

export async function weeklyBriefing() {
  const key = `${read('purchases').length}:${read('audit').length}`;
  if (briefingCache.key === key) return briefingCache.value;
  const ctx = contextSnapshot();
  const today = new Date().toISOString().slice(0, 10);
  let value;
  try {
    const reply = await chat({
      system: briefingSystemPrompt({ today }),
      messages: [{ role: 'user', content: JSON.stringify({ purchases: ctx.purchases, cash: ctx.cash, mandate: ctx.mandate?.rules }) }],
      mock: () => ({ text: templateBriefing(ctx), toolCalls: [], mock: true }),
    });
    value = { text: reply.text || templateBriefing(ctx), source: reply.mock ? 'template' : 'ai', generatedAt: new Date().toISOString() };
  } catch {
    value = { text: templateBriefing(ctx), source: 'template', generatedAt: new Date().toISOString() };
  }
  briefingCache = { key, value };
  return value;
}

export function templateBriefing(ctx) {
  const week = ctx.purchases.filter((p) => Date.now() - new Date(`${p.date}T12:00:00Z`).getTime() < 7.5 * 864e5);
  const paid = week.filter((p) => ['auto-paid', 'approved-paid'].includes(p.status));
  const spent = paid.reduce((t, p) => t + p.total, 0);
  const saved = paid.reduce((t, p) => t + (p.savedVsLocal || p.savings || 0), 0);
  const blocked = week.filter((p) => p.status === 'blocked');
  const delayed = week.filter((p) => p.status === 'delayed');
  const waiting = week.filter((p) => p.status === 'awaiting-approval');
  const parts = [
    `This week Restock paid for ${paid.length} supply order${paid.length === 1 ? '' : 's'} totalling $${spent.toFixed(2)}, saving $${saved.toFixed(2)} by choosing the best-value suppliers, including cross-border orders from India.`,
  ];
  if (blocked.length) parts.push(`Guardian blocked ${blocked.length} risky purchase${blocked.length > 1 ? 's' : ''}: ${blocked[0].productName} was priced far above normal.`);
  if (delayed.length) parts.push(`${delayed[0].productName} ($${delayed[0].total.toFixed(2)}) is waiting for incoming cash so your $${ctx.cash.minBalanceBuffer} buffer stays safe.`);
  parts.push(waiting.length ? `${waiting.length} order${waiting.length > 1 ? 's need' : ' needs'} your one-tap approval.` : 'Nothing needs your approval right now.');
  return parts.join(' ');
}
