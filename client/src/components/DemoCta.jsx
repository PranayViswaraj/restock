import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Clapperboard, Loader } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { post } from '../lib/api.js';

/**
 * First thing a visitor (or judge) on a fresh server sees: one obvious button that
 * plays the whole story. Hidden once the agent has run.
 */
export default function DemoCta() {
  const { purchases, steps, status, toast } = useApp();
  const [starting, setStarting] = useState(false);
  const fresh = purchases && purchases.every((p) => p.seeded) && steps.length === 0 && !status?.running;
  if (!fresh) return null;

  const run = async () => {
    setStarting(true);
    try { await post('/api/demo/run'); } catch (err) { toast(err.message, 'error'); } finally { setStarting(false); }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="card flex flex-wrap items-center justify-between gap-4 border-accent/30 bg-accent-soft/40"
      aria-labelledby="demo-cta-title"
    >
      <div className="min-w-0 max-w-2xl">
        <h2 id="demo-cta-title" className="text-lg font-bold tracking-tight">New here? Watch the agent team work in 60 seconds.</h2>
        <p className="mt-1 text-sm text-ink-2">
          One click: a local buy, a cross-border buy to India, a payment delayed to protect cash, a price trap blocked by Guardian,
          and an order waiting for your approval. Seeded demo data, PayPal sandbox.
        </p>
      </div>
      <motion.button whileTap={{ scale: 0.97 }} className="btn btn-primary h-11 px-5 text-base" onClick={run} disabled={starting || status?.paused}>
        {starting ? <Loader size={17} className="animate-spin" aria-hidden="true" /> : <Clapperboard size={17} aria-hidden="true" />}
        Run Demo
      </motion.button>
    </motion.section>
  );
}
