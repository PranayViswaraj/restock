// The Money Mandate: the owner's spending rules, written in plain English,
// turned into validated JSON, signed (SHA-256) and versioned.
// Guardian refuses everything unless an active, signed mandate exists.
import { z } from 'zod';
import { read, write, sha256 } from './store.js';
import { chat } from './llm.js';

export const CATEGORIES = ['packaging', 'beverage-supplies', 'food-supplies', 'cleaning-supplies'];

// zod schema: WHY — LLM output and form input are untrusted; never let a bad
// number (negative limit, buffer of "lots") reach the Guardian.
export const RulesSchema = z
  .object({
    maxPerOrder: z.number({ error: 'Max per order must be a number' }).positive('Max per order must be above $0').max(100000),
    maxPerWeek: z.number({ error: 'Weekly limit must be a number' }).positive('Weekly limit must be above $0').max(1000000),
    requireApprovalAbove: z.number({ error: 'Auto-approve limit must be a number' }).min(0, 'Auto-approve limit cannot be negative'),
    minBalanceBuffer: z.number({ error: 'Cash buffer must be a number' }).min(0, 'Cash buffer cannot be negative'),
    newSupplierNeedsApproval: z.boolean(),
    maxPriceDeviationPct: z.number({ error: 'Price deviation must be a number' }).min(0).max(1000),
    approvedCategories: z.array(z.enum(CATEGORIES)).min(1, 'Approve at least one category'),
  })
  .refine((r) => r.requireApprovalAbove <= r.maxPerOrder, { message: 'Auto-approve limit cannot be higher than the per-order limit', path: ['requireApprovalAbove'] })
  .refine((r) => r.maxPerOrder <= r.maxPerWeek, { message: 'Per-order limit cannot be higher than the weekly limit', path: ['maxPerOrder'] });

export const DEFAULT_RULES = {
  maxPerOrder: 100,
  maxPerWeek: 200,
  requireApprovalAbove: 30,
  minBalanceBuffer: 500,
  newSupplierNeedsApproval: true,
  maxPriceDeviationPct: 50,
  approvedCategories: ['packaging', 'beverage-supplies', 'food-supplies'],
};

export const DEFAULT_TEXT =
  'Spend up to $200 a week on supplies. No single order over $100. Auto-approve anything under $30. ' +
  'Never buy from a new supplier without asking me. Keep at least $500 in my PayPal balance. ' +
  'Never pay more than 50% above normal prices. Only packaging, beverage and food supplies.';

/** Turn zod issues into a friendly list. */
export function validateRules(rules) {
  const result = RulesSchema.safeParse(rules);
  if (result.success) return { ok: true, rules: result.data, errors: [] };
  return { ok: false, rules: null, errors: result.error.issues.map((i) => ({ field: i.path.join('.') || 'rules', message: i.message })) };
}

// ---------------------------------------------------------------- parsing
const money = '\\$?\\s?([\\d,]+(?:\\.\\d+)?)';
const num = (s) => Number(String(s).replace(/,/g, ''));

/**
 * Deterministic plain-English parser (mock fallback for the LLM).
 * Starts from defaults and overrides whatever it recognises. Returns { rules, understood[] }.
 */
export function parseMandateText(text) {
  const t = ` ${String(text).toLowerCase()} `;
  const rules = { ...DEFAULT_RULES };
  const understood = [];
  const grab = (re) => { const m = t.match(re); return m ? num(m[1]) : null; };

  const week = grab(new RegExp(`${money}\\s*(?:a|per|each|\\/)\\s*week`)) ?? grab(new RegExp(`week[^.$\\d]*${money}`));
  if (week !== null) { rules.maxPerWeek = week; understood.push(`Weekly limit $${week}`); }

  const order = grab(new RegExp(`(?:single|per|each|one)\\s+order[^.$\\d]*${money}`)) ?? grab(new RegExp(`${money}\\s*(?:per|an|each|a)\\s+order`));
  if (order !== null) { rules.maxPerOrder = order; understood.push(`Max $${order} per order`); }

  const auto = grab(new RegExp(`auto[- ]?(?:approve|pay)[^.$\\d]*${money}`));
  if (auto !== null) { rules.requireApprovalAbove = auto; understood.push(`Auto-approve up to $${auto}`); }

  const buffer = grab(new RegExp(`(?:keep|leave|maintain|minimum|at least)[^.$\\d]*${money}[^.]*(?:balance|account|buffer|cash)`));
  if (buffer !== null) { rules.minBalanceBuffer = buffer; understood.push(`Keep $${buffer} cash buffer`); }

  const pct = grab(/(\d+(?:\.\d+)?)\s*%\s*(?:above|over|more than)/);
  if (pct !== null) { rules.maxPriceDeviationPct = pct; understood.push(`Max ${pct}% above normal price`); }

  if (/new supplier/.test(t)) {
    const allow = /(?:can|may|okay to|ok to) (?:buy|use)[^.]*new supplier/.test(t);
    rules.newSupplierNeedsApproval = !allow;
    understood.push(allow ? 'New suppliers allowed' : 'New suppliers need my approval');
  }

  const cats = [];
  if (/packag|cups?|lids?/.test(t)) cats.push('packaging');
  if (/beverage|drink|coffee|milk/.test(t)) cats.push('beverage-supplies');
  if (/food/.test(t)) cats.push('food-supplies');
  if (/clean/.test(t)) cats.push('cleaning-supplies');
  if (cats.length) { rules.approvedCategories = cats; understood.push(`Categories: ${cats.join(', ')}`); }

  // If the auto-approve limit came out above the per-order cap, clamp it (sensible default).
  if (rules.requireApprovalAbove > rules.maxPerOrder) rules.requireApprovalAbove = rules.maxPerOrder;
  return { rules, understood };
}

/** LLM parse (falls back to the deterministic parser). Always zod-validated. */
export async function parseWithAI(text) {
  const fallback = () => ({ ...parseMandateText(text), source: 'rules-parser' });
  try {
    const reply = await chat({
      system:
        'Convert a café owner\'s plain-English spending rules into JSON. Reply with ONLY a JSON object with keys: ' +
        'maxPerOrder (number USD), maxPerWeek (number USD), requireApprovalAbove (number USD), minBalanceBuffer (number USD), ' +
        'newSupplierNeedsApproval (boolean), maxPriceDeviationPct (number), approvedCategories (array of: ' +
        CATEGORIES.join(', ') + '), understood (array of short strings describing each rule you found). ' +
        `Use these defaults for anything not mentioned: ${JSON.stringify(DEFAULT_RULES)}.`,
      messages: [{ role: 'user', content: String(text).slice(0, 2000) }],
      mock: () => {
        const p = parseMandateText(text);
        return { text: JSON.stringify({ ...p.rules, understood: p.understood }), toolCalls: [], mock: true };
      },
    });
    const json = JSON.parse(reply.text.replace(/^```(?:json)?|```$/gm, '').trim());
    const { understood = [], ...rules } = json;
    return { rules, understood, source: reply.mock ? 'rules-parser' : 'ai' };
  } catch (err) {
    console.warn('[mandate] AI parse failed, using rules parser:', err.message);
    return fallback();
  }
}

// ---------------------------------------------------------------- storage & signing
export function mandateHash({ version, signedAt, signedBy, sourceText, rules }) {
  return sha256(JSON.stringify({ version, signedAt, signedBy, sourceText, rules }));
}

/** Build a signed mandate version (pure). */
export function buildSignedMandate({ version, sourceText, rules, signedBy = 'Pranay', signedAt = new Date().toISOString() }) {
  const m = { version, signedAt, signedBy, sourceText, rules, status: 'active' };
  m.hash = mandateHash(m);
  return m;
}

export function history() {
  return read('mandate', []);
}

/** The latest version (active or revoked). */
export function current() {
  const list = history();
  return list[list.length - 1] || null;
}

export function sign({ sourceText, rules, signedBy = 'Pranay' }) {
  const list = history();
  for (const m of list) if (m.status === 'active') m.status = 'superseded';
  const next = buildSignedMandate({ version: (list[list.length - 1]?.version || 0) + 1, sourceText, rules, signedBy });
  list.push(next);
  write('mandate', list);
  return next;
}

export function revoke() {
  const list = history();
  const cur = list[list.length - 1];
  if (!cur || cur.status !== 'active') return null;
  cur.status = 'revoked';
  cur.revokedAt = new Date().toISOString();
  write('mandate', list);
  return cur;
}
