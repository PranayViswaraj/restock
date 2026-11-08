import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleCheck, TriangleAlert, Info, X } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { spring } from '../lib/motion.js';

const STYLE = {
  success: { Icon: CircleCheck, cls: 'text-ok' },
  warn: { Icon: TriangleAlert, cls: 'text-warn' },
  error: { Icon: TriangleAlert, cls: 'text-bad' },
  info: { Icon: Info, cls: 'text-info' },
};

export default function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const s = STYLE[t.kind] || STYLE.info;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: spring }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
              className="glass pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line px-4 py-3 text-sm text-ink"
              style={{ boxShadow: 'var(--shadow-lg)' }}
              role="status"
            >
              <s.Icon size={18} className={`mt-0.5 shrink-0 ${s.cls}`} aria-hidden="true" />
              <span className="flex-1">{t.message}</span>
              <button className="text-ink-3 hover:text-ink" onClick={() => dismissToast(t.id)} aria-label="Dismiss notification">
                <X size={16} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
