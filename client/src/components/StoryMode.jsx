import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pause, Play, SkipForward, RotateCcw, X, FlaskConical } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { post } from '../lib/api.js';
import { navigate } from '../lib/router.jsx';
import { isOn } from '../lib/features.js';
import { useStory, startStory, stopStory } from '../lib/story.js';

// Story Mode: a cinematic, captioned walk through one real Demo run.
// Each chapter waits for the actual event (purchase paid, blocked, delayed...)
// with a minimum on-screen time and a safety timeout, so it never stalls.
const live = (ctx, sku) => (ctx.purchases || []).find((p) => !p.seeded && p.sku === sku && p.createdAt >= ctx.since);

const CHAPTERS = [
  {
    caption: "This is Pranay's Café in Austin. Restock is its purchasing team: one AI and two guards made of code.",
    target: 'kpis', min: 4500, max: 6000,
  },
  {
    caption: 'Scout, the AI, reads 30 days of sales. A heat wave pushed cold coffee up 40%, so cups and milk will run out in about two days.',
    target: () => (isOn('brainView') ? 'brain' : 'timeline'), min: 6500, max: 14000,
    enter: async (ctx) => { await post('/api/demo/run', { pace: 1.6 }); ctx.markStart(); },
    done: (ctx) => (ctx.steps || []).some((s) => /^Proposing/.test(s.message || '')),
  },
  {
    caption: 'Milk from a local Austin dairy. Guardian runs all 7 checks, every one passes, and Treasurer pays $27 through PayPal Payouts.',
    target: 'timeline', min: 4000, max: 25000,
    done: (ctx) => live(ctx, 'milk-whole')?.status === 'auto-paid',
  },
  {
    caption: 'Cups: Chennai EcoPack in India is cheaper than the local supplier. Paid cross-border through PayPal, saving $10.',
    target: () => (isOn('paymentRoutes') ? 'routes' : 'timeline'), min: 5500, max: 25000,
    done: (ctx) => live(ctx, 'cups-16oz')?.status === 'auto-paid',
  },
  {
    caption: "Coffee beans would drop the balance below Pranay's $500 buffer, so Treasurer delays them until card sales settle.",
    target: 'cash', min: 5000, max: 25000,
    done: (ctx) => live(ctx, 'coffee-beans')?.status === 'delayed',
  },
  {
    caption: 'A brand-new supplier offers caramel syrup at 280% of the normal price. The AI proposes it, and Guardian blocks it. No money moves.',
    target: null, min: 5500, max: 25000, // no spotlight: let the shield take the screen
    done: (ctx) => live(ctx, 'caramel-syrup')?.status === 'blocked',
  },
  {
    caption: 'Lids cost $32, above the $30 auto-approve limit, so they wait for Pranay. One tap in PayPal, or scan the QR code on his phone.',
    target: 'approvals', min: 5500, max: 25000,
    done: (ctx) => live(ctx, 'lids-16oz')?.status === 'awaiting-approval' && !ctx.running,
  },
  {
    caption: 'Pranay approves. PayPal captures the payment and the receipt is hash-stamped.',
    target: 'approvals', min: 4500, max: 9000,
    enter: async (ctx) => {
      const lids = live(ctx, 'lids-16oz');
      // Mock PayPal: approve automatically. Live sandbox: needs a real buyer login, so the owner does it.
      if (lids && !ctx.paypalLive) {
        const order = await post('/api/paypal/orders', { purchaseId: lids.id });
        await post(`/api/paypal/orders/${order.id}/capture`);
      }
    },
  },
  {
    caption: 'Every decision is explained. Click any purchase to see the AI’s reason, all 7 Guardian checks and the PayPal IDs.',
    target: null, min: 6000, max: 6000,
    enter: (ctx) => { const s = live(ctx, 'caramel-syrup'); if (s) ctx.openTrace(s.id); },
    leave: (ctx) => ctx.openTrace(null),
  },
  {
    caption: 'Over 30 simulated days: stockouts prevented, money saved, traps blocked and 0 rule violations. Simulated on seeded demo data.',
    target: null, min: 7000, max: 7000,
    enter: () => navigate('/simulate'),
  },
  {
    caption: 'The AI decides. The code guards the money. PayPal moves it.',
    target: null, min: 2000, max: 600000, final: true,
  },
];

function useTargetRect(selector) {
  const [rect, setRect] = useState(null);
  useLayoutEffect(() => {
    if (!selector) { setRect(null); return undefined; }
    const measure = () => {
      const el = document.querySelector(`[data-story="${selector}"]`);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect((old) => (old && Math.abs(old.top - r.top) < 1 && Math.abs(old.height - r.height) < 1 && Math.abs(old.width - r.width) < 1 ? old : { top: r.top, left: r.left, width: r.width, height: r.height }));
    };
    measure();
    const t = setInterval(measure, 200);
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => { clearInterval(t); window.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); };
  }, [selector]);
  return rect;
}

export default function StoryMode() {
  const { active, runKey } = useStory();
  const { purchases, steps, status, config, openTrace, toast } = useApp();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [waitingForRun, setWaitingForRun] = useState(false);

  const ctx = useRef({});
  ctx.current = {
    ...ctx.current, purchases, steps, running: !!status?.running, openTrace,
    paypalLive: !!config?.services?.paypal?.live,
    markStart: () => { ctx.current.since = new Date(Date.now() - 2000).toISOString(); },
  };
  const timing = useRef({ start: 0, pausedAt: 0, pausedTotal: 0 });

  const chapter = active ? CHAPTERS[i] : null;
  const targetName = chapter ? (typeof chapter.target === 'function' ? chapter.target() : chapter.target) : null;
  const rect = useTargetRect(targetName);

  // Start / restart.
  useEffect(() => {
    if (!active) return;
    ctx.current.since = new Date().toISOString();
    setI(0); setPaused(false);
    try { localStorage.setItem('restock-tour-done', '1'); } catch { /* ignore */ }
    navigate('/app');
  }, [active, runKey]);

  // Enter a chapter: run its action once, reset its clock, scroll its target into view.
  useEffect(() => {
    if (!chapter) return undefined;
    timing.current = { start: Date.now(), pausedAt: 0, pausedTotal: 0 };
    let cancelled = false;
    (async () => {
      if (chapter.enter) {
        try {
          if (i === 1 && ctx.current.running) { setWaitingForRun(true); while (ctx.current.running && !cancelled) await new Promise((r) => setTimeout(r, 400)); setWaitingForRun(false); }
          if (!cancelled) await chapter.enter(ctx.current);
        } catch (err) { toast(err.message, 'warn'); }
      }
    })();
    const t = setTimeout(() => {
      const el = targetName && document.querySelector(`[data-story="${targetName}"]`);
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }, 120);
    return () => { cancelled = true; clearTimeout(t); chapter.leave?.(ctx.current); };
  }, [chapter, i, targetName, toast]);

  const next = useCallback(() => setI((x) => Math.min(CHAPTERS.length - 1, x + 1)), []);

  // Advance when the chapter's event happened (after its minimum time), or on timeout.
  useEffect(() => {
    if (!chapter || paused || chapter.final) return undefined;
    const t = setInterval(() => {
      const elapsed = Date.now() - timing.current.start - timing.current.pausedTotal;
      const ok = !chapter.done || chapter.done(ctx.current);
      if ((elapsed >= chapter.min && ok) || elapsed >= chapter.max) next();
    }, 250);
    return () => clearInterval(t);
  }, [chapter, paused, next]);

  const togglePause = () => setPaused((p) => {
    const now = Date.now();
    if (!p) timing.current.pausedAt = now;
    else timing.current.pausedTotal += now - timing.current.pausedAt;
    return !p;
  });

  // Keyboard: Esc closes, Space pauses, → next.
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') stopStory();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === ' ' && e.target === document.body) { e.preventDefault(); togglePause(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, next]);

  if (!active) return null;
  const pad = 10;

  return (
    <>
      {rect && (
        <div className="story-spotlight" aria-hidden="true"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      )}
      <motion.div
        role="region" aria-label="Story Mode" aria-live="polite"
        className="fixed inset-x-0 bottom-0 z-[75] px-3 pb-3 sm:px-6 sm:pb-5"
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      >
        <div className="glass mx-auto max-w-3xl rounded-2xl border border-line px-4 py-3 sm:px-5" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {CHAPTERS.map((_, n) => (
              <span key={n} className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                <motion.span className="block h-full origin-left bg-accent" initial={false} animate={{ scaleX: n < i ? 1 : n === i ? 0.5 : 0 }} transition={{ duration: 0.4 }} />
              </span>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.p key={i} className="mt-2.5 min-h-[3rem] text-[15px] font-medium leading-snug sm:text-base"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
              {waitingForRun ? 'Finishing the previous run first…' : chapter.caption}
            </motion.p>
          </AnimatePresence>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs tabular-nums text-ink-3">Story Mode · {i + 1}/{CHAPTERS.length}</span>
            <div className="ml-auto flex items-center gap-1.5">
              {chapter.final ? (
                <>
                  <button className="btn btn-sm" onClick={() => { stopStory(); navigate('/lab'); }}><FlaskConical size={14} aria-hidden="true" /> Try the Scenario Lab</button>
                  <button className="btn btn-sm" onClick={startStory}><RotateCcw size={14} aria-hidden="true" /> Restart</button>
                </>
              ) : (
                <>
                  <button className="btn btn-sm h-8 w-8 px-0" onClick={togglePause} aria-label={paused ? 'Resume story' : 'Pause story'}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>
                  <button className="btn btn-sm h-8 w-8 px-0" onClick={next} aria-label="Next chapter"><SkipForward size={14} /></button>
                  <button className="btn btn-sm h-8 w-8 px-0" onClick={startStory} aria-label="Restart story"><RotateCcw size={14} /></button>
                </>
              )}
              <button className="btn btn-sm h-8 w-8 px-0" onClick={stopStory} aria-label="Close story"><X size={14} /></button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
