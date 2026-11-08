import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Power } from 'lucide-react';
import { post } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { spring } from '../lib/motion.js';

/** The owner's kill switch: pausing stops agent runs and auto-payments immediately. */
export default function KillSwitch({ compact = false }) {
  const { status, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const paused = !!status?.paused;

  const toggle = async () => {
    setBusy(true);
    try {
      await post(paused ? '/api/agent/resume' : '/api/agent/pause');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={!paused}
      aria-label={paused ? 'Agent paused. Resume agent' : 'Agent active. Pause agent'}
      onClick={toggle}
      disabled={busy || !status}
      data-tour="kill-switch"
      className={`inline-flex items-center gap-2 rounded-full border px-2 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        paused ? 'border-bad/40 bg-bad-soft text-bad' : 'border-line bg-surface text-ink'
      }`}
    >
      <span className={`relative h-5 w-9 rounded-full transition-colors ${paused ? 'bg-bad' : 'bg-ok'}`}>
        <motion.span
          className="absolute top-0.5 grid h-4 w-4 place-items-center rounded-full bg-white shadow"
          animate={{ x: paused ? 2 : 18 }}
          transition={spring}
        >
          <Power size={9} className={paused ? 'text-bad' : 'text-ok'} strokeWidth={3} aria-hidden="true" />
        </motion.span>
      </span>
      {!compact && <span>{paused ? 'Agent paused' : 'Agent active'}</span>}
    </button>
  );
}
