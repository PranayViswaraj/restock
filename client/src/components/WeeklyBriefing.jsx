import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { Skeleton } from './Skeleton.jsx';

/** 3–4 sentence weekly summary for Pranay, written by the LLM (template fallback). */
export default function WeeklyBriefing() {
  const { purchases, status } = useApp();
  const [briefing, setBriefing] = useState(null);
  const [failed, setFailed] = useState(false);
  const count = purchases?.length || 0;

  useEffect(() => {
    if (status?.running) return undefined; // wait for the run to finish
    let alive = true;
    const t = setTimeout(() => {
      api('/api/briefing').then((b) => alive && setBriefing(b)).catch(() => alive && setFailed(true));
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [count, status?.running]);

  return (
    <section className="card relative overflow-hidden" aria-labelledby="briefing-title">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-scout opacity-10 blur-2xl" aria-hidden="true" />
      <div className="flex items-center justify-between gap-2">
        <h2 id="briefing-title" className="card-title flex items-center gap-2"><Sparkles size={16} className="text-scout" aria-hidden="true" /> Weekly briefing</h2>
        {briefing && <span className="badge bg-surface-2 text-ink-2">{briefing.source === 'ai' ? 'Written by AI' : 'Template (AI off)'}</span>}
      </div>
      {briefing ? (
        <motion.p key={briefing.generatedAt} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-sm leading-relaxed text-ink">
          {briefing.text}
        </motion.p>
      ) : failed ? (
        <p className="mt-3 text-sm text-ink-2">Briefing unavailable right now.</p>
      ) : (
        <div className="mt-3 space-y-2"><Skeleton className="h-3.5 w-full" /><Skeleton className="h-3.5 w-11/12" /><Skeleton className="h-3.5 w-2/3" /></div>
      )}
    </section>
  );
}
