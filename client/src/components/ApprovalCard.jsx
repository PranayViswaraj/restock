import React, { useCallback, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Smartphone, ShieldCheck, CircleCheck } from 'lucide-react';
import { useApp, celebrate } from '../lib/store.jsx';
import { post } from '../lib/api.js';
import { usd, shortDate } from '../lib/format.js';
import { spring } from '../lib/motion.js';
import PayPalButton from './PayPalButton.jsx';
import QrCode from './QrCode.jsx';
import EmptyState from './EmptyState.jsx';

export function approveUrl(config, id) {
  const base = config?.publicUrl || window.location.origin;
  return `${base.replace(/\/$/, '')}/approve/${id}`;
}

/** One purchase waiting for Pranay: reason, Guardian summary, PayPal button, QR for phone. */
export function ApprovalCard({ purchase }) {
  const { config, toast, openTrace } = useApp();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const passed = (purchase.guardianChecks || []).filter((c) => c.passed).length;
  const why = (purchase.guardianChecks || []).find((c) => c.needsApproval)?.detail || purchase.verdictReason;

  const onPaid = useCallback(() => { celebrate('small'); }, []);
  const onError = useCallback((m) => setError(m), []);

  const reject = async () => {
    setBusy(true);
    try {
      await post(`/api/purchases/${purchase.id}/reject`);
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };

  return (
    <motion.article
      layoutId={purchase.id}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={spring}
      className="rounded-2xl border border-warn/40 bg-warn-soft/40 p-4"
    >
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <button className="text-left text-sm font-semibold hover:underline" onClick={() => openTrace(purchase.id)}>
                {purchase.quantity} × {purchase.productName}
              </button>
              <div className="text-xs text-ink-2">{purchase.flag} {purchase.supplierName} · {shortDate(purchase.createdAt)}</div>
            </div>
            <div className="text-xl font-bold tabular-nums">{usd(purchase.total)}</div>
          </div>
          <p className="mt-2 text-[13px] text-ink-2">{purchase.reason}</p>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-guardian">
            <ShieldCheck size={14} className="mt-px shrink-0" aria-hidden="true" />
            <span>{passed}/7 checks passed. {why}</span>
          </p>
        </div>
        <div className="hidden shrink-0 flex-col items-center gap-1 sm:flex">
          <QrCode url={approveUrl(config, purchase.id)} size={92} label="Approve from your phone" />
          <span className="flex items-center gap-1 text-[10px] font-medium text-ink-3"><Smartphone size={11} aria-hidden="true" /> Approve on phone</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex-1"><PayPalButton purchase={purchase} onPaid={onPaid} onError={onError} /></div>
        <button className="btn btn-danger" onClick={reject} disabled={busy}>Reject</button>
      </div>
      {error && <p className="mt-2 rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad" role="alert">{error}</p>}
    </motion.article>
  );
}

/** Awaiting purchases, plus recently approved ones (shared layout animation between them). */
export default function Approvals() {
  const { purchases } = useApp();
  const awaiting = (purchases || []).filter((p) => p.status === 'awaiting-approval');
  const recent = (purchases || [])
    .filter((p) => p.status === 'approved-paid' && !p.seeded && Date.now() - new Date(p.paidAt || p.updatedAt || 0).getTime() < 30 * 60 * 1000)
    .slice(-3);

  return (
    <section className="card" aria-labelledby="approvals-title" data-tour="approvals">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 id="approvals-title" className="card-title">Needs your approval</h2>
          <p className="card-sub">Guardian paused these. One tap in PayPal, or scan to approve on your phone.</p>
        </div>
        {awaiting.length > 0 && <span className="badge bg-warn-soft text-warn">{awaiting.length} waiting</span>}
      </div>
      <LayoutGroup>
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {awaiting.map((p) => <ApprovalCard key={p.id} purchase={p} />)}
            {recent.map((p) => (
              <motion.div key={p.id} layoutId={p.id} layout transition={spring}
                className="flex items-center gap-3 rounded-2xl border border-ok/30 bg-ok-soft/50 px-4 py-3 text-sm">
                <CircleCheck size={18} className="text-ok" aria-hidden="true" />
                <span className="flex-1 truncate"><b>{p.productName}</b> approved & paid</span>
                <span className="font-semibold tabular-nums">{usd(p.total)}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </LayoutGroup>
      {awaiting.length === 0 && recent.length === 0 && (
        <EmptyState tone="ok" title="Nothing waiting" body="Orders over your auto-approve limit, or from new suppliers, land here." />
      )}
    </section>
  );
}
