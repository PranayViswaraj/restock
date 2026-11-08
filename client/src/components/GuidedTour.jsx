import React, { useEffect, useLayoutEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { spring } from '../lib/motion.js';

const STEPS = [
  { target: 'kpis', title: 'Impact, live', body: 'Stockouts prevented, money saved, risky buys blocked, and rule violations (always 0). Computed from real app data.' },
  { target: 'run-agent', title: 'Run the agent team', body: 'Run agent uses the AI Scout. Demo mode plays the scripted story with no keys: local buy, cross-border buy, cash delay, blocked trap, approval.' },
  { target: 'kill-switch', title: 'The kill switch', body: 'One tap pauses everything. No runs, no payments, logged to the tamper-evident ledger.' },
  { target: 'approvals', title: 'Approve in one tap', body: 'Anything over your limits waits here. Pay with PayPal, or scan the QR code to approve from your phone.' },
  { target: 'purchases', title: 'Every decision, explained', body: 'Click any purchase to open its Decision Trace: Scout\'s reasoning, all 7 Guardian checks, and the PayPal receipt.' },
];
const KEY = 'restock-tour-done';

/** Lightweight 5-step tour for first-time visitors (judges). Skippable, remembered in localStorage. */
export default function GuidedTour({ forceOpen, onClose }) {
  const [step, setStep] = useState(-1);
  const [rect, setRect] = useState(null);

  useEffect(() => {
    let done = false;
    try { done = localStorage.getItem(KEY) === '1'; } catch { /* storage blocked */ }
    if (forceOpen || !done) {
      const t = setTimeout(() => setStep(0), forceOpen ? 100 : 1200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [forceOpen]);

  useLayoutEffect(() => {
    if (step < 0) return undefined;
    const el = document.querySelector(`[data-tour="${STEPS[step].target}"]`);
    if (!el) { setRect(null); return undefined; }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const update = () => setRect(el.getBoundingClientRect());
    const t = setTimeout(update, 350);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { clearTimeout(t); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [step]);

  const finish = () => {
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    setStep(-1);
    onClose?.();
  };

  if (step < 0) return null;
  const s = STEPS[step];
  const w = Math.min(320, window.innerWidth - 32);
  const below = rect ? rect.bottom + 12 + 170 < window.innerHeight : true;
  const top = rect ? (below ? rect.bottom + 12 : Math.max(16, rect.top - 182)) : window.innerHeight / 2 - 90;
  const left = rect ? Math.min(Math.max(16, rect.left + rect.width / 2 - w / 2), window.innerWidth - w - 16) : window.innerWidth / 2 - w / 2;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[66]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
        <div className="absolute inset-0 bg-black/35" onClick={finish} aria-hidden="true" />
        {rect && (
          <motion.div className="pointer-events-none absolute rounded-2xl ring-4 ring-accent"
            animate={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
            transition={spring} style={{ boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.25)' }} aria-hidden="true" />
        )}
        <motion.div key={step} className="absolute rounded-2xl border border-line bg-surface p-4" style={{ top, left, width: w, boxShadow: 'var(--shadow-lg)' }}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: spring }}>
          <p className="text-[11px] font-semibold text-accent">Step {step + 1} of {STEPS.length}</p>
          <h2 id="tour-title" className="mt-1 text-sm font-bold">{s.title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-2">{s.body}</p>
          <div className="mt-3 flex items-center justify-between">
            <button className="text-xs font-medium text-ink-3 hover:text-ink" onClick={finish}>Skip tour</button>
            <div className="flex gap-2">
              {step > 0 && <button className="btn btn-sm" onClick={() => setStep(step - 1)}>Back</button>}
              <button className="btn btn-primary btn-sm" onClick={() => (step === STEPS.length - 1 ? finish() : setStep(step + 1))} autoFocus>
                {step === STEPS.length - 1 ? 'Done' : 'Next'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
