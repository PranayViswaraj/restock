import React from 'react';
import { motion } from 'framer-motion';

/** Success check that draws itself in (circle, then tick). */
export default function CheckDraw({ size = 64, color = 'var(--ok)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" className="mx-auto" role="img" aria-label="Success">
      <motion.circle cx="26" cy="26" r="23" fill="none" stroke={color} strokeWidth="3"
        initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.5, ease: 'easeOut' }} />
      <motion.path d="M15 27l7 7 15-16" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: 0.45, ease: 'easeOut' }} />
    </svg>
  );
}
