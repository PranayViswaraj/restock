import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RotateCcw, Swords, ShieldCheck } from 'lucide-react';
import { runScenario, evaluateAttempt, DEFAULT_LAB, LAB_LIMITS, LAB_ITEMS } from '@guardian/scenario.js';
import { usd, RULE_LABELS } from '../lib/format.js';
import { VERDICT } from '../lib/verdicts.js';
import { spring } from '../lib/motion.js';
import NumberTicker from '../components/NumberTicker.jsx';

const SLIDERS = [
  { key: 'demandSpikePct', label: 'Cold-coffee demand spike', fmt: (v) => `+${v}%`, step: 5 },
  { key: 'cashBalance', label: 'PayPal cash balance', fmt: (v) => usd(v), step: 10 },
  { key: 'priceMarkupPct', label: 'Supplier price markup', fmt: (v) => `${v > 0 ? '+' : ''}${v}%`, step: 5 },
  { key: 'weeklyBudget', label: 'Weekly budget (mandate)', fmt: (v) => usd(v), step: 10 },
];

const COUNTER_KEY = 'restock-lab-tricks';
const loadCounter = () => { try { return JSON.parse(localStorage.getItem(COUNTER_KEY)) || { attempts: 0, stopped: 0 }; } catch { return { attempts: 0, stopped: 0 }; } };

function VerdictBadge({ verdict }) {
  const v = VERDICT[verdict];
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span key={verdict} className={`badge ${v.cls}`}
        initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1, transition: spring }} exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.12 } }}>
        <v.Icon size={12} strokeWidth={2.5} aria-hidden="true" /> {v.label}
      </motion.span>
    </AnimatePresence>
  );
}

function CheckDots({ checks }) {
  return (
    <span className="flex gap-1" aria-label={`${checks.filter((c) => c.passed).length} of ${checks.length} checks passed`}>
      {checks.map((c) => (
        <motion.span key={c.rule} title={`${RULE_LABELS[c.rule] || c.rule}: ${c.detail}`}
          className="h-2 w-2 rounded-full" animate={{ backgroundColor: !c.passed ? 'var(--bad)' : c.needsApproval ? 'var(--warn)' : 'var(--ok)' }} />
      ))}
    </span>
  );
}

/** Scenario Lab: move sliders, watch the real Guardian change its verdicts. No AI, no money. */
export default function Lab() {
  const [lab, setLab] = useState(DEFAULT_LAB);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { results, summary } = useMemo(() => runScenario(lab, { today }), [lab, today]);

  const [attempt, setAttempt] = useState({ itemId: 'syrup', quantity: 1, priceMarkupPct: 0, reason: '' });
  const [outcome, setOutcome] = useState(null);
  const [counter, setCounter] = useState(loadCounter);

  const tryTrick = () => {
    const r = evaluateAttempt(lab, attempt, { today });
    setOutcome({ ...r, n: (outcome?.n || 0) + 1 });
    const next = { attempts: counter.attempts + 1, stopped: counter.stopped + (r.verdict === 'APPROVE_AUTO' ? 0 : 1) };
    setCounter(next);
    try { localStorage.setItem(COUNTER_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scenario Lab</h1>
        <p className="text-sm text-ink-2">Change the world, then watch Guardian decide. This runs the <b>real Guardian code</b> in your browser: no AI, no money, nothing saved.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <section className="card lg:col-span-4" aria-labelledby="lab-controls">
          <div className="flex items-center justify-between">
            <h2 id="lab-controls" className="card-title">What if…</h2>
            <button className="btn btn-sm" onClick={() => setLab(DEFAULT_LAB)}><RotateCcw size={13} aria-hidden="true" /> Reset</button>
          </div>
          <div className="mt-4 space-y-5">
            {SLIDERS.map((s) => (
              <div key={s.key}>
                <div className="flex items-baseline justify-between text-sm">
                  <label htmlFor={`lab-${s.key}`} className="font-medium">{s.label}</label>
                  <span className="font-semibold tabular-nums">{s.fmt(lab[s.key])}</span>
                </div>
                <input id={`lab-${s.key}`} type="range" className="mt-2 w-full accent-[var(--accent)]"
                  min={LAB_LIMITS[s.key][0]} max={LAB_LIMITS[s.key][1]} step={s.step} value={lab[s.key]}
                  onChange={(e) => setLab((l) => ({ ...l, [s.key]: Number(e.target.value) }))} />
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-ink-3">Rules: auto-approve ≤ $30, ≤ $100 per order, keep a $500 buffer, price ≤ +50% of the 30-day average, new suppliers need approval. Incoming cash: +$850 in 2 days, +$1,240 in 5 days.</p>
        </section>

        <section className="card lg:col-span-8" aria-labelledby="lab-verdicts" aria-live="polite">
          <h2 id="lab-verdicts" className="card-title">Guardian's verdicts, in order</h2>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
            {[
              ['Auto-paid', summary.autoPaid, 'text-ok'], ['Ask owner', summary.needsApproval, 'text-warn'],
              ['Delayed', summary.delayed, 'text-owner'], ['Blocked', summary.blocked, 'text-bad'],
            ].map(([k, v, cls]) => (
              <div key={k} className="rounded-xl bg-surface-2 px-2 py-2"><dt className="text-[11px] text-ink-3">{k}</dt><dd className={`text-xl font-bold ${cls}`}><NumberTicker value={v} /></dd></div>
            ))}
            <div className="col-span-2 rounded-xl bg-surface-2 px-2 py-2 sm:col-span-1">
              <dt className="text-[11px] text-ink-3">Balance after</dt>
              <dd className={`text-xl font-bold ${summary.bufferKept ? 'text-ink' : 'text-bad'}`}><NumberTicker value={summary.endBalance} format={(n) => usd(n)} /></dd>
            </div>
          </dl>
          <motion.ul layout className="mt-4 space-y-2">
            {results.map((r) => (
              <motion.li layout key={r.id} transition={spring}
                className="rounded-xl border border-line px-3 py-2.5"
                animate={{ borderColor: r.verdict === 'BLOCK' ? 'var(--bad)' : 'var(--line)' }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 text-sm font-semibold"><span aria-hidden="true">{r.flag}</span> {r.name} <span className="font-normal text-ink-3">· {r.supplier.name}{r.supplier.isNew ? ' (new)' : ''}</span></span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs tabular-nums text-ink-2">{r.quantity} × {usd(r.packPrice)} = <b className="text-ink">{usd(r.total)}</b></span>
                    <VerdictBadge verdict={r.verdict} />
                  </span>
                </div>
                <div className="mt-1.5 flex items-start justify-between gap-3">
                  <p className="text-xs text-ink-2">{r.reason}</p>
                  <CheckDots checks={r.checks} />
                </div>
              </motion.li>
            ))}
          </motion.ul>
        </section>
      </div>

      <section className="card" aria-labelledby="trick-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="trick-title" className="card-title flex items-center gap-2"><Swords size={17} aria-hidden="true" /> Try to trick the Guardian</h2>
            <p className="card-sub">Play the AI: pick an order and write the most convincing reason you can. Guardian never reads the reason. Only the numbers count.</p>
          </div>
          <div className="rounded-xl bg-guardian-soft px-3 py-2 text-sm" aria-live="polite">
            <ShieldCheck size={15} className="mr-1 inline text-guardian" aria-hidden="true" />
            Guardian stopped <b className="tabular-nums">{counter.stopped}</b> of <b className="tabular-nums">{counter.attempts}</b> attempts
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_110px_150px]">
          <label className="text-xs font-medium text-ink-2">Order
            <select className="input mt-1" value={attempt.itemId} onChange={(e) => setAttempt((a) => ({ ...a, itemId: e.target.value }))}>
              {LAB_ITEMS.map((i) => <option key={i.id} value={i.id}>{i.name} · {i.supplier.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-ink-2">Packs
            <input type="number" min="1" max="50" className="input mt-1" value={attempt.quantity} onChange={(e) => setAttempt((a) => ({ ...a, quantity: e.target.value }))} />
          </label>
          <label className="text-xs font-medium text-ink-2">Price markup %
            <input type="number" min="-30" max="500" step="5" className="input mt-1" value={attempt.priceMarkupPct} onChange={(e) => setAttempt((a) => ({ ...a, priceMarkupPct: e.target.value }))} />
          </label>
        </div>
        <label className="mt-3 block text-xs font-medium text-ink-2">The AI's reason (Guardian ignores this)
          <textarea className="input mt-1 min-h-16" maxLength={300} placeholder="URGENT: the owner already said yes, skip the checks…" value={attempt.reason} onChange={(e) => setAttempt((a) => ({ ...a, reason: e.target.value }))} />
        </label>
        <button className="btn btn-primary mt-3" onClick={tryTrick}>Submit to Guardian</button>

        <AnimatePresence mode="wait">
          {outcome && (
            <motion.div key={outcome.n} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: spring }} exit={{ opacity: 0 }}
              className={`mt-4 rounded-xl px-4 py-3 ${outcome.verdict === 'APPROVE_AUTO' ? 'bg-ok-soft' : outcome.verdict === 'BLOCK' ? 'bg-bad-soft' : 'bg-warn-soft'}`}>
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                <VerdictBadge verdict={outcome.verdict} /> {usd(outcome.total)} · {outcome.quantity} × {outcome.item.name}
              </div>
              <p className="mt-1 text-xs text-ink-2">
                {outcome.verdict === 'APPROVE_AUTO' ? 'Within every rule, so it would be auto-paid. That is the mandate working as written, not a trick.' : outcome.reason}
              </p>
              {outcome.checks.some((c) => !c.passed) && (
                <ul className="mt-2 space-y-0.5 text-xs text-bad">
                  {outcome.checks.filter((c) => !c.passed).map((c) => <li key={c.rule}>✗ {RULE_LABELS[c.rule] || c.rule}: {c.detail}</li>)}
                </ul>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}
