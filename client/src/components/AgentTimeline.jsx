import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Play, Clapperboard, CircleCheck, Ban, Clock, TriangleAlert, Coins, Loader, Info } from 'lucide-react';
import RoleAvatar, { ROLE_META } from './RoleAvatar.jsx';
import EmptyState from './EmptyState.jsx';
import { useApp } from '../lib/store.jsx';
import { post } from '../lib/api.js';
import { timeOf } from '../lib/format.js';
import { spring } from '../lib/motion.js';

// Small status glyph per step type (always paired with text).
const TYPE = {
  paid: { Icon: Coins, cls: 'text-ok' },
  verdict: { Icon: CircleCheck, cls: 'text-guardian' },
  result: { Icon: CircleCheck, cls: 'text-ink-3' },
  blocked: { Icon: Ban, cls: 'text-bad' },
  delayed: { Icon: Clock, cls: 'text-owner' },
  approval: { Icon: Clock, cls: 'text-warn' },
  error: { Icon: TriangleAlert, cls: 'text-bad' },
  notice: { Icon: Info, cls: 'text-info' }, // calm: e.g. "AI busy, using backup logic"
};

/** Run buttons + live, role-colored timeline of what the agent team is doing. */
export default function AgentTimeline() {
  const { steps, status, toast } = useApp();
  const [starting, setStarting] = useState(false);
  const listRef = useRef(null);
  const running = !!status?.running;
  const paused = !!status?.paused;
  const visible = steps.filter((s) => s.type !== 'done');

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [steps.length]);

  const start = async (path) => {
    setStarting(true);
    try {
      await post(path);
    } catch (err) {
      toast(err.message, err.code === 'PAUSED' ? 'warn' : 'error');
    } finally {
      setStarting(false);
    }
  };

  return (
    <section className="card flex h-full flex-col" aria-labelledby="timeline-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="timeline-title" className="card-title">Agent timeline</h2>
          <p className="card-sub">Scout proposes → Guardian checks → Treasurer pays via PayPal.</p>
        </div>
        <div className="flex items-center gap-2" data-tour="run-agent">
          <button className="btn" onClick={() => start('/api/demo/run')} disabled={running || starting || paused} title="Reset the demo and run the scripted story (no keys needed)">
            <Clapperboard size={15} aria-hidden="true" /> Demo mode
          </button>
          <motion.button whileTap={{ scale: 0.97 }} className="btn btn-primary" onClick={() => start('/api/agent/run')} disabled={running || starting || paused}>
            {running ? <Loader size={15} className="animate-spin" aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
            {running ? 'Agent working…' : 'Run agent'}
          </motion.button>
        </div>
      </div>

      {paused && (
        <div className="mt-3 rounded-xl bg-bad-soft px-3 py-2 text-xs font-medium text-bad" role="status">
          Kill switch is on. The agent can't run and no payments will be made until you resume it.
        </div>
      )}

      <div className="mt-4 flex gap-1.5 text-[11px]" aria-hidden="true">
        {['scout', 'guardian', 'treasurer'].map((r) => (
          <span key={r} className={`badge ${ROLE_META[r].cls}`}>{ROLE_META[r].name} · {ROLE_META[r].kind}</span>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="The agent team is standing by"
          body="Press Run agent (uses your AI key, or the rule-based Scout), or Demo mode for the scripted story: local buy, cross-border buy, cash delay, blocked trap and an approval."
        />
      ) : (
        <ol ref={listRef} className="relative mt-4 max-h-[460px] flex-1 overflow-y-auto pr-1" aria-live="polite" aria-label="Agent steps">
          <AnimatePresence initial={false}>
            {visible.map((s, i) => {
              const t = TYPE[s.type];
              const last = i === visible.length - 1;
              return (
                <motion.li
                  key={s.id}
                  layout
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0, transition: spring }}
                  className="relative flex gap-3 pb-4"
                >
                  {!last && (
                    <motion.span
                      className="absolute left-[15px] top-9 bottom-0 w-px origin-top bg-line"
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      aria-hidden="true"
                    />
                  )}
                  <RoleAvatar role={s.role} />
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-center gap-2 text-[11px] text-ink-3">
                      <span className="font-semibold text-ink-2">{ROLE_META[s.role]?.name || s.role}</span>
                      <span>{timeOf(s.ts)}</span>
                    </div>
                    <p
                      className={`mt-0.5 flex items-start gap-1.5 text-sm ${s.type === 'thinking' ? 'italic text-ink-2' : s.type === 'summary' ? 'font-semibold' : s.type === 'notice' ? 'w-fit rounded-lg bg-info-soft px-2 py-1 text-[13px] text-ink-2' : 'text-ink'}`}
                      title={s.data?.detail || undefined}
                    >
                      {t && <t.Icon size={15} className={`mt-0.5 shrink-0 ${t.cls}`} aria-hidden="true" />}
                      <span className="min-w-0 break-words">{s.message}</span>
                    </p>
                  </div>
                </motion.li>
              );
            })}
            {running && (
              <motion.li key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 pb-2">
                <span className="h-8 w-8 rounded-xl skeleton" aria-hidden="true" />
                <span className="thinking-shimmer text-sm font-medium">Thinking…</span>
              </motion.li>
            )}
          </AnimatePresence>
        </ol>
      )}
    </section>
  );
}
