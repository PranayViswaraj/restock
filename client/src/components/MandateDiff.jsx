import React from 'react';
import { motion } from 'framer-motion';
import { usd } from '../lib/format.js';

const LABELS = {
  maxPerWeek: ['Weekly budget', usd],
  maxPerOrder: ['Max per order', usd],
  requireApprovalAbove: ['Auto-approve up to', usd],
  minBalanceBuffer: ['Cash buffer', usd],
  maxPriceDeviationPct: ['Max price above normal', (v) => `+${v}%`],
  newSupplierNeedsApproval: ['New suppliers need approval', (v) => (v ? 'yes' : 'no')],
};

/** Pure: rule-by-rule changes between two rule sets. */
export function diffRules(before = {}, after = {}) {
  const out = [];
  for (const [k, [label, fmt]] of Object.entries(LABELS)) {
    if (before[k] === undefined && after[k] !== undefined) out.push({ kind: 'added', label, to: fmt(after[k]) });
    else if (before[k] !== undefined && after[k] === undefined) out.push({ kind: 'removed', label, from: fmt(before[k]) });
    else if (before[k] !== after[k]) out.push({ kind: 'changed', label, from: fmt(before[k]), to: fmt(after[k]) });
  }
  const a = new Set(before.approvedCategories || []);
  const b = new Set(after.approvedCategories || []);
  for (const c of b) if (!a.has(c)) out.push({ kind: 'added', label: 'Approved category', to: c });
  for (const c of a) if (!b.has(c)) out.push({ kind: 'removed', label: 'Approved category', from: c });
  return out;
}

const STYLE = {
  added: ['+', 'bg-ok-soft text-ok'],
  removed: ['−', 'bg-bad-soft text-bad'],
  changed: ['~', 'bg-warn-soft text-warn'],
};

/** Animated list of what changed between two mandate versions. */
export default function MandateDiff({ before, after, title }) {
  const rows = diffRules(before, after);
  return (
    <div className="mt-2">
      {title && <p className="mb-1.5 text-xs font-semibold text-ink-2">{title}</p>}
      {rows.length === 0 ? <p className="text-xs text-ink-3">No rule changes (same rules, new signature).</p> : (
        <ul className="space-y-1">
          {rows.map((r, i) => {
            const [sign, cls] = STYLE[r.kind];
            return (
              <motion.li key={`${r.kind}-${r.label}-${i}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0, transition: { delay: i * 0.05 } }}
                className="flex items-center gap-2 text-xs">
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md font-bold ${cls}`} aria-label={r.kind}>{sign}</span>
                <span className="font-medium">{r.label}:</span>
                {r.from !== undefined && <span className={r.kind === 'removed' ? 'text-bad' : 'text-ink-3 line-through'}>{r.from}</span>}
                {r.kind === 'changed' && <span className="text-ink-3" aria-hidden="true">→</span>}
                {r.to !== undefined && <span className="font-semibold">{r.to}</span>}
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
