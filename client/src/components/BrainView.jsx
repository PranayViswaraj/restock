import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Radar, ShieldCheck, Landmark, Wallet } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { VERDICT } from '../lib/verdicts.js';

// Live node graph of the agent team. Lights up from the SSE timeline:
//   Scout ──propose──▶ Guardian ──verdict──▶ Treasurer ──pay──▶ PayPal
const W = 640;
const NODES = [
  { id: 'scout', label: 'Scout', kind: 'AI', x: 80, color: 'var(--scout)', Icon: Radar },
  { id: 'guardian', label: 'Guardian', kind: 'Code', x: 240, color: 'var(--guardian)', Icon: ShieldCheck },
  { id: 'treasurer', label: 'Treasurer', kind: 'Code', x: 400, color: 'var(--treasurer)', Icon: Landmark },
  { id: 'paypal', label: 'PayPal', kind: 'Sandbox', x: 560, color: 'var(--info)', Icon: Wallet },
];
const Y = 62;
const R = 26;

/** Pure: what the latest timeline step means for the graph. */
function interpret(step) {
  if (!step) return { active: null, edge: null, verdict: null };
  const m = step.message || '';
  if (step.role === 'scout') return { active: 'scout', edge: /^Proposing/.test(m) ? 'scout-guardian' : null };
  if (step.role === 'guardian') {
    const verdict = step.type === 'blocked' ? 'BLOCK' : step.type === 'approval' ? 'NEEDS_APPROVAL' : /^Cash check/.test(m) ? 'DELAY' : /checks passed/.test(m) ? 'APPROVE_AUTO' : null;
    return { active: 'guardian', edge: verdict === 'APPROVE_AUTO' || verdict === 'DELAY' ? 'guardian-treasurer' : null, verdict };
  }
  if (step.role === 'treasurer') {
    if (step.type === 'paid') return { active: 'paypal', edge: 'treasurer-paypal' };
    return { active: 'treasurer', edge: null, verdict: step.type === 'delayed' ? 'DELAY' : null };
  }
  return { active: null, edge: null };
}

export default function BrainView() {
  const { steps, status } = useApp();
  const running = !!status?.running;
  const visible = steps.filter((s) => s.type !== 'done');
  const last = visible[visible.length - 1];

  const { active, edge } = running ? interpret(last) : { active: null, edge: null };
  // Most recent Guardian verdict (badge stays until the next one).
  const verdictStep = useMemo(() => [...visible].reverse().find((s) => interpret(s).verdict), [visible]);
  const verdict = verdictStep ? interpret(verdictStep).verdict : null;
  const counts = useMemo(() => ({
    scout: visible.filter((s) => s.role === 'scout' && s.type === 'tool').length,
    guardian: visible.filter((s) => s.role === 'guardian').length,
    treasurer: visible.filter((s) => s.role === 'treasurer' && ['paid', 'delayed'].includes(s.type)).length,
    paypal: visible.filter((s) => s.role === 'treasurer' && s.type === 'paid').length,
  }), [visible]);
  const sub = { scout: 'tool calls', guardian: 'checks run', treasurer: 'actions', paypal: 'payments' };

  return (
    <section className="card overflow-hidden" aria-labelledby="brain-title">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="brain-title" className="card-title">Agent brain</h2>
          <p className="card-sub">Lights up live: only Scout is AI; Guardian and Treasurer are code.</p>
        </div>
        <span className={`badge ${running ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink-3'}`}>{running ? 'Live run' : 'Idle'}</span>
      </div>
      <svg viewBox={`0 0 ${W} 132`} className="mt-2 w-full" role="img" aria-label={`Agent graph. Active: ${active || 'none'}. Last Guardian verdict: ${verdict ? VERDICT[verdict].label : 'none'}.`}>
        {NODES.slice(0, -1).map((n, i) => {
          const to = NODES[i + 1];
          const id = `${n.id}-${to.id}`;
          const hot = edge === id;
          return (
            <g key={id}>
              <line x1={n.x + R} y1={Y} x2={to.x - R} y2={Y} stroke="var(--line)" strokeWidth="2" strokeDasharray="4 5" />
              {hot && (
                <motion.circle key={`${id}-${last?.id}`} r="5" cy={Y} fill={to.color} cx={n.x + R}
                  initial={{ opacity: 0, x: 0 }} animate={{ opacity: [0, 1, 1, 0], x: to.x - n.x - 2 * R }}
                  transition={{ duration: 0.9, ease: 'easeInOut' }} />
              )}
            </g>
          );
        })}
        {NODES.map((n) => {
          const on = active === n.id;
          return (
            <g key={n.id} transform={`translate(${n.x} ${Y})`}>
              <motion.circle r={R + 10} fill={n.color} initial={false}
                animate={{ opacity: on ? [0.12, 0.28, 0.12] : 0, scale: on ? [1, 1.12, 1] : 0.9 }}
                transition={on ? { duration: 1.4, repeat: Infinity } : { duration: 0.3 }} />
              <motion.circle r={R} fill="var(--surface)" stroke={n.color} initial={false} animate={{ strokeWidth: on ? 3 : 1.5 }} />
              <foreignObject x={-11} y={-11} width="22" height="22">
                <n.Icon size={22} color={n.color} aria-hidden="true" />
              </foreignObject>
              <text y={R + 18} textAnchor="middle" className="fill-[var(--ink)] text-[12px] font-semibold">{n.label} <tspan className="fill-[var(--ink-3)] font-normal">· {n.kind}</tspan></text>
              <text y={R + 33} textAnchor="middle" className="fill-[var(--ink-3)] text-[10px]">{counts[n.id]} {sub[n.id]}</text>
            </g>
          );
        })}
        <AnimatePresence>
          {verdict && (
            <motion.g key={verdictStep.id} initial={{ opacity: 0, scale: 0.5, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 18 }} style={{ transformOrigin: '240px 18px' }}>
              <rect x={240 - 52} y={4} width="104" height="22" rx="11" fill={VERDICT[verdict].color} />
              <text x={240} y={19} textAnchor="middle" fill="var(--surface)" className="text-[11px] font-bold">{VERDICT[verdict].short}</text>
            </motion.g>
          )}
        </AnimatePresence>
      </svg>
    </section>
  );
}
