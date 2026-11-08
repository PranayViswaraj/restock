import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { Logo } from './Header.jsx';

/** Shown while a sleeping free-tier server wakes up (instead of errors). */
export default function WakeScreen() {
  const { waking } = useApp();
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    if (!waking) { setSecs(0); return undefined; }
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [waking]);

  return (
    <AnimatePresence>
      {waking && (
        <motion.div
          className="fixed inset-0 z-[90] grid place-items-center bg-canvas/95 px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          role="status" aria-live="polite"
        >
          <div className="card max-w-sm text-center">
            <div className="mx-auto mb-4 w-fit animate-pulse"><Logo size={44} /></div>
            <h2 className="text-lg font-bold">Waking up the server…</h2>
            <p className="mt-1 text-sm text-ink-2">Restock runs on free hosting, which sleeps when idle. This takes about 30–60 seconds, once.</p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
              <motion.div className="h-full rounded-full bg-accent" initial={{ width: '4%' }} animate={{ width: `${Math.min(95, 4 + secs * 1.6)}%` }} transition={{ ease: 'linear', duration: 1 }} />
            </div>
            <p className="mt-2 text-xs tabular-nums text-ink-3">{secs}s</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
