import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BadgeCheck } from 'lucide-react';

/** Brief "signed & sealed" ribbon that sweeps across the mandate card after signing. */
export default function SignRibbon({ show, version }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2" aria-hidden="true"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.4 } }}>
          <motion.div
            className="mx-auto flex w-[115%] -translate-x-[6%] -rotate-6 items-center justify-center gap-2 bg-accent py-2.5 text-sm font-bold uppercase tracking-[0.2em] text-white"
            style={{ boxShadow: 'var(--shadow-lg)', transformOrigin: 'left center' }}
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.45, type: 'spring', stiffness: 400, damping: 14 }}>
              <BadgeCheck size={18} />
            </motion.span>
            Signed &amp; sealed · v{version}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
