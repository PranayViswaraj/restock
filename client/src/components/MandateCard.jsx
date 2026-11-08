import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Hash } from 'lucide-react';
import SignatureStroke from './SignatureStroke.jsx';
import { usd, dateTime, shortHash } from '../lib/format.js';
import { spring } from '../lib/motion.js';

export function ruleRows(r) {
  return [
    ['Weekly budget', usd(r.maxPerWeek, { maximumFractionDigits: 0 })],
    ['Max per order', usd(r.maxPerOrder, { maximumFractionDigits: 0 })],
    ['Auto-approve up to', usd(r.requireApprovalAbove, { maximumFractionDigits: 0 })],
    ['Keep cash buffer', usd(r.minBalanceBuffer, { maximumFractionDigits: 0 })],
    ['Max above normal price', `+${r.maxPriceDeviationPct}%`],
    ['New suppliers', r.newSupplierNeedsApproval ? 'Ask me first' : 'Allowed'],
  ];
}

/** The signed Money Mandate, styled like a card you could put in a wallet. */
export default function MandateCard({ mandate, rules, preview = false, signing = false }) {
  const r = rules || mandate?.rules;
  if (!r) return null;
  const status = preview ? 'draft' : mandate?.status;
  const statusCls = { active: 'bg-ok-soft text-ok', revoked: 'bg-bad-soft text-bad', superseded: 'bg-surface-2 text-ink-2', draft: 'bg-warn-soft text-warn' }[status];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, rotateX: 12, y: 16 }}
      animate={{ opacity: 1, rotateX: 0, y: 0 }}
      transition={spring}
      className="relative overflow-hidden rounded-3xl border border-line p-6"
      style={{ background: 'linear-gradient(135deg, var(--surface) 0%, var(--accent-soft) 100%)', boxShadow: 'var(--shadow-lg)' }}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent opacity-10 blur-2xl" aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-accent"><ShieldCheck size={14} aria-hidden="true" /> Money mandate</div>
          <div className="mt-1 text-lg font-bold tracking-tight">Pranay's Café · {preview ? 'new version' : `v${mandate.version}`}</div>
        </div>
        <span className={`badge ${statusCls}`}>{status}</span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        {ruleRows(r).map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] text-ink-3">{k}</dt>
            <dd className="text-sm font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {r.approvedCategories.map((c) => <span key={c} className="badge bg-surface text-ink-2 ring-1 ring-line">{c}</span>)}
      </div>

      <div className="mt-5 flex items-end justify-between gap-4 border-t border-dashed border-line pt-4">
        <div className="min-w-0">
          <div className="h-12 w-36">{(signing || (!preview && mandate?.signedBy)) && <SignatureStroke signed={!signing} className="h-12 w-36" />}</div>
          <div className="mt-1 text-[11px] text-ink-3">{preview ? (signing ? 'Signing…' : 'Not signed yet') : `Signed by ${mandate.signedBy} · ${dateTime(mandate.signedAt)}`}</div>
        </div>
        {!preview && mandate?.hash && (
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 text-[11px] text-ink-3"><Hash size={11} aria-hidden="true" /> SHA-256</div>
            <div className="font-mono text-xs" title={mandate.hash}>{shortHash(mandate.hash)}</div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
