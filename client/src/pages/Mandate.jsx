import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Wand2, Signature, Ban, History, CircleCheck, TriangleAlert } from 'lucide-react';
import { api, post } from '../lib/api.js';
import { useApp, celebrate } from '../lib/store.jsx';
import { dateTime, shortHash } from '../lib/format.js';
import { spring, fadeUp, stagger } from '../lib/motion.js';
import MandateCard from '../components/MandateCard.jsx';
import { SkeletonCard } from '../components/Skeleton.jsx';
import MandateDiff from '../components/MandateDiff.jsx';
import SignRibbon from '../components/SignRibbon.jsx';
import { useFeature } from '../lib/features.js';

const CATEGORIES = ['packaging', 'beverage-supplies', 'food-supplies', 'cleaning-supplies'];
const FIELDS = [
  ['maxPerWeek', 'Weekly budget ($)'],
  ['maxPerOrder', 'Max per order ($)'],
  ['requireApprovalAbove', 'Auto-approve up to ($)'],
  ['minBalanceBuffer', 'Keep cash buffer ($)'],
  ['maxPriceDeviationPct', 'Max % above normal price'],
];

/** Quick client-side mirror of the server's zod rules, for instant feedback. */
function localErrors(r) {
  const e = {};
  for (const [k] of FIELDS) if (!Number.isFinite(Number(r[k])) || Number(r[k]) < 0) e[k] = 'Must be a number ≥ 0';
  if (Number(r.maxPerOrder) <= 0) e.maxPerOrder = 'Must be above $0';
  if (Number(r.requireApprovalAbove) > Number(r.maxPerOrder)) e.requireApprovalAbove = 'Cannot exceed the per-order limit';
  if (Number(r.maxPerOrder) > Number(r.maxPerWeek)) e.maxPerOrder = 'Cannot exceed the weekly budget';
  if (!r.approvedCategories?.length) e.approvedCategories = 'Approve at least one category';
  return e;
}

export default function Mandate() {
  const { mandate, toast, refresh } = useApp();
  const [text, setText] = useState('');
  const [draft, setDraft] = useState(null); // { rules, understood, source }
  const [serverErrors, setServerErrors] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [signing, setSigning] = useState(false);
  const [history, setHistory] = useState(null);
  const upgrades = useFeature('mandateUpgrades');
  const [view, setView] = useState('card'); // card | english | json
  const [ribbon, setRibbon] = useState(null);
  const [openDiff, setOpenDiff] = useState(null);

  const loadHistory = () => api('/api/mandate/history').then(setHistory).catch(() => setHistory([]));
  useEffect(() => { loadHistory(); }, [mandate?.version, mandate?.status]);
  useEffect(() => { if (mandate && !text) setText(mandate.sourceText); }, [mandate]);

  const parse = async () => {
    setParsing(true);
    setServerErrors([]);
    try {
      const r = await post('/api/mandate/parse', { text });
      setDraft({ rules: r.rules, understood: r.understood || [], source: r.source });
      setServerErrors(r.errors || []);
    } catch (err) {
      setServerErrors(err.details || [{ field: 'text', message: err.message }]);
    } finally {
      setParsing(false);
    }
  };

  const setRule = (k, v) => setDraft((d) => ({ ...d, rules: { ...d.rules, [k]: v } }));
  const toggleCat = (c) => setDraft((d) => {
    const list = d.rules.approvedCategories.includes(c) ? d.rules.approvedCategories.filter((x) => x !== c) : [...d.rules.approvedCategories, c];
    return { ...d, rules: { ...d.rules, approvedCategories: list } };
  });

  const errors = draft ? localErrors(draft.rules) : {};
  const valid = draft && Object.keys(errors).length === 0;

  const sign = async () => {
    setSigning(true);
    const rules = { ...draft.rules };
    for (const [k] of FIELDS) rules[k] = Number(rules[k]);
    await new Promise((r) => setTimeout(r, 1500)); // let the signature stroke finish
    try {
      const signed = await post('/api/mandate/sign', { sourceText: text, rules });
      if (upgrades) { setRibbon(signed.version); setTimeout(() => setRibbon(null), 2600); }
      celebrate('small');
      toast('Mandate signed. Guardian now enforces the new rules.', 'success');
      setDraft(null);
      refresh(['mandate', 'status', 'cash']);
      loadHistory();
    } catch (err) {
      setServerErrors(err.details || [{ field: 'rules', message: err.message }]);
      toast(err.message, 'error');
    } finally {
      setSigning(false);
    }
  };

  const revoke = async () => {
    if (!window.confirm('Revoke the active mandate? Guardian will block every purchase until you sign a new one.')) return;
    try {
      await post('/api/mandate/revoke');
      toast('Mandate revoked. All purchases are blocked.', 'warn');
      refresh(['mandate', 'status']);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Money mandate</h1>
        <p className="text-sm text-ink-2">Write your spending rules in plain English. AI turns them into rules; Guardian enforces them in code.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.section variants={stagger(0.08)} initial="hidden" animate="show" className="space-y-5">
          <motion.div variants={fadeUp} className="card">
            <label htmlFor="mandate-text" className="card-title">Your rules, in your words</label>
            <textarea id="mandate-text" className="input mt-3 min-h-36 resize-y leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000}
              placeholder="Spend up to $200 a week on supplies. Auto-approve anything under $30…" />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-ink-3">{text.length}/2000</span>
              <button className="btn btn-primary" onClick={parse} disabled={parsing || text.trim().length < 10}>
                <Wand2 size={15} aria-hidden="true" /> {parsing ? 'Reading…' : 'Turn into rules'}
              </button>
            </div>
          </motion.div>

          <AnimatePresence>
            {draft && (
              <motion.div key="review" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: spring }} exit={{ opacity: 0 }} className="card">
                <div className="flex items-center justify-between">
                  <h2 className="card-title">Review the rules</h2>
                  <span className="badge bg-surface-2 text-ink-2">{draft.source === 'ai' ? 'Parsed by AI' : 'Parsed by rules engine'}</span>
                </div>
                {draft.understood.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {draft.understood.map((u) => <li key={u} className="badge bg-ok-soft text-ok"><CircleCheck size={12} aria-hidden="true" /> {u}</li>)}
                  </ul>
                )}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {FIELDS.map(([k, label]) => (
                    <div key={k}>
                      <label htmlFor={`f-${k}`} className="text-xs font-medium text-ink-2">{label}</label>
                      <input id={`f-${k}`} type="number" min="0" className={`input mt-1 ${errors[k] ? 'border-bad' : ''}`} value={draft.rules[k]}
                        onChange={(e) => setRule(k, e.target.value)} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `e-${k}` : undefined} />
                      {errors[k] && <p id={`e-${k}`} className="mt-1 text-xs text-bad">{errors[k]}</p>}
                    </div>
                  ))}
                  <label className="flex items-center gap-2 self-end text-sm">
                    <input type="checkbox" checked={draft.rules.newSupplierNeedsApproval} onChange={(e) => setRule('newSupplierNeedsApproval', e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                    New suppliers need my approval
                  </label>
                </div>
                <fieldset className="mt-4">
                  <legend className="text-xs font-medium text-ink-2">Approved categories</legend>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => (
                      <label key={c} className={`badge cursor-pointer px-3 py-1 ring-1 ${draft.rules.approvedCategories.includes(c) ? 'bg-accent-soft text-accent ring-accent/40' : 'bg-surface text-ink-2 ring-line'}`}>
                        <input type="checkbox" className="sr-only" checked={draft.rules.approvedCategories.includes(c)} onChange={() => toggleCat(c)} /> {c}
                      </label>
                    ))}
                  </div>
                  {errors.approvedCategories && <p className="mt-1 text-xs text-bad">{errors.approvedCategories}</p>}
                </fieldset>
                {serverErrors.length > 0 && (
                  <ul className="mt-4 space-y-1 rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad" role="alert">
                    {serverErrors.map((e, i) => <li key={i} className="flex gap-1.5"><TriangleAlert size={13} className="mt-px shrink-0" aria-hidden="true" /> {e.message}</li>)}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        <section className="space-y-5">
          {draft ? (
            <>
              <MandateCard rules={{ ...draft.rules, ...Object.fromEntries(FIELDS.map(([k]) => [k, Number(draft.rules[k])])) }} preview signing={signing} />
              {upgrades && mandate && (
                <div className="card">
                  <MandateDiff title={`What changes vs v${mandate.version}`} before={mandate.rules} after={{ ...draft.rules, ...Object.fromEntries(FIELDS.map(([k]) => [k, Number(draft.rules[k])])) }} />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-primary btn-lg" onClick={sign} disabled={!valid || signing}>
                  <Signature size={18} aria-hidden="true" /> {signing ? 'Signing…' : 'Sign as Pranay'}
                </button>
                <button className="btn btn-lg" onClick={() => setDraft(null)} disabled={signing}>Cancel</button>
              </div>
            </>
          ) : mandate ? (
            <>
              {upgrades && (
                <div className="flex gap-1 rounded-xl bg-surface-2 p-1 text-xs font-semibold" role="tablist" aria-label="Mandate view">
                  {[['card', 'Card'], ['english', 'Plain English'], ['json', 'Rules JSON']].map(([k, label]) => (
                    <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}
                      className={`relative flex-1 rounded-lg px-3 py-1.5 ${view === k ? 'text-ink' : 'text-ink-3'}`}>
                      {view === k && <motion.span layoutId="mandate-view" className="absolute inset-0 rounded-lg bg-surface" style={{ boxShadow: 'var(--shadow-sm)' }} transition={spring} />}
                      <span className="relative">{label}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="relative overflow-hidden rounded-2xl">
                <AnimatePresence mode="wait" initial={false}>
                  {(!upgrades || view === 'card') && <motion.div key="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><MandateCard mandate={mandate} /></motion.div>}
                  {upgrades && view === 'english' && (
                    <motion.blockquote key="en" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card text-[15px] leading-relaxed">
                      “{mandate.sourceText}”
                      <footer className="mt-3 text-xs text-ink-3">Pranay, signed v{mandate.version} · {dateTime(mandate.signedAt)}</footer>
                    </motion.blockquote>
                  )}
                  {upgrades && view === 'json' && (
                    <motion.pre key="json" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card max-h-96 overflow-auto font-mono text-[12px] leading-relaxed">
                      {JSON.stringify({ version: mandate.version, status: mandate.status, hash: mandate.hash, rules: mandate.rules }, null, 2)}
                    </motion.pre>
                  )}
                </AnimatePresence>
                <SignRibbon show={!!ribbon} version={ribbon} />
              </div>
              {mandate.status === 'active' && (
                <button className="btn btn-danger" onClick={revoke}><Ban size={15} aria-hidden="true" /> Revoke mandate</button>
              )}
            </>
          ) : (
            <SkeletonCard lines={5} />
          )}

          <div className="card">
            <h2 className="card-title flex items-center gap-2"><History size={16} aria-hidden="true" /> Version history</h2>
            {!history ? <SkeletonCard lines={2} className="mt-3 border-0 p-0 shadow-none" /> : (
              <ol className="mt-3 space-y-2">
                {history.map((m) => (
                  <li key={m.version} className="rounded-xl bg-surface-2 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-3">
                    <span><b>v{m.version}</b> · {dateTime(m.signedAt)} · {m.signedBy}
                      {upgrades && history.some((h) => h.version === m.version - 1) && (
                        <button className="link ml-2" onClick={() => setOpenDiff(openDiff === m.version ? null : m.version)} aria-expanded={openDiff === m.version}>
                          {openDiff === m.version ? 'Hide changes' : 'What changed'}
                        </button>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-ink-3" title={m.hash}>{shortHash(m.hash)}</span>
                      <span className={`badge ${m.status === 'active' ? 'bg-ok-soft text-ok' : m.status === 'revoked' ? 'bg-bad-soft text-bad' : 'bg-surface text-ink-2'}`}>{m.status}</span>
                    </span>
                    </div>
                    {upgrades && openDiff === m.version && (
                      <MandateDiff before={history.find((h) => h.version === m.version - 1)?.rules} after={m.rules} />
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
