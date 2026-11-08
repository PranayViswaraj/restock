import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ShieldX } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { usd } from '../lib/format.js';

/** The guardrail moment: full-width shield when Guardian blocks, then it settles into the timeline. */
export default function ShieldOverlay() {
  const { shield, clearShield } = useApp();

  useEffect(() => {
    if (!shield) return undefined;
    const t = setTimeout(clearShield, 3400);
    const onKey = (e) => e.key === 'Escape' && clearShield();
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [shield, clearShield]);

  return (
    <AnimatePresence>
      {shield && (
        <motion.div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-6 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.35 } }}
          onClick={clearShield} role="alertdialog" aria-live="assertive" aria-label={shield.headline}
        >
          <motion.div
            className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-guardian/40 bg-surface px-8 py-10 text-center"
            style={{ boxShadow: '0 0 0 1px var(--guardian), 0 30px 80px -10px rgb(0 0 0 / 0.6)' }}
            initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 20 } }}
            exit={{ scale: 0.6, y: -260, x: -300, opacity: 0, transition: { duration: 0.45, ease: 'easeIn' } }}
          >
            {/* expanding rings */}
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="absolute left-1/2 top-[68px] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-guardian"
                initial={{ scale: 0.6, opacity: 0.7 }} animate={{ scale: 3, opacity: 0 }} transition={{ duration: 1.6, delay: i * 0.35, repeat: 1 }} aria-hidden="true" />
            ))}
            <motion.div className="relative mx-auto grid h-24 w-24 place-items-center rounded-full bg-guardian-soft"
              initial={{ rotate: -20, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.1 }}>
              <ShieldX size={52} className="text-guardian" strokeWidth={2} aria-hidden="true" />
            </motion.div>
            <p className="relative mt-6 text-xs font-bold uppercase tracking-[0.2em] text-guardian">Guardian · deterministic code</p>
            <h2 className="relative mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{shield.headline}</h2>
            <p className="relative mt-3 text-sm text-ink-2">
              {shield.purchase?.flag} {shield.purchase?.supplierName} offered {shield.purchase?.productName} for {usd(shield.purchase?.total)}.
              The AI proposed it. The code said no. No money moved.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
