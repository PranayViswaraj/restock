import React from 'react';
import { motion } from 'framer-motion';

// A hand-drawn "Pranay" signature path, drawn with pathLength.
const PATH =
  'M8 52 C14 30 20 14 26 16 C33 18 26 40 18 46 C30 36 44 30 46 38 C48 44 40 50 44 50 C50 50 54 38 58 36 ' +
  'C60 46 58 52 64 50 C70 48 70 36 76 36 C80 36 78 50 84 50 C90 50 92 36 98 36 C104 36 100 52 108 50 ' +
  'C114 48 114 36 120 38 C124 40 118 64 112 70 C106 76 102 66 112 58 C124 50 140 44 168 40';

export default function SignatureStroke({ play = true, signed = false, className = '' }) {
  return (
    <svg viewBox="0 0 176 80" className={className} role="img" aria-label="Signed by Pranay">
      <motion.path
        d={PATH}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: signed ? 1 : 0, opacity: signed ? 1 : 0 }}
        animate={play ? { pathLength: 1, opacity: 1 } : {}}
        transition={{ pathLength: { duration: 1.4, ease: 'easeInOut' }, opacity: { duration: 0.1 } }}
      />
    </svg>
  );
}
