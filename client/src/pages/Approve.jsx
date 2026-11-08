import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleCheck, CircleX, Clock, ShieldCheck, BellRing } from 'lucide-react';
import CheckDraw from '../components/CheckDraw.jsx';
import { useFeatures } from '../lib/features.js';
import { askNotificationPermission, notificationsSupported, notificationsGranted, haptic } from '../lib/pwa.js';
import { api, post } from '../lib/api.js';
import { useSSE } from '../lib/sse.js';
import { celebrate } from '../lib/store.jsx';
import { usd, RULE_LABELS } from '../lib/format.js';
import { spring } from '../lib/motion.js';
import { Logo } from '../components/Header.jsx';
import PayPalButton from '../components/PayPalButton.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { SkeletonCard } from '../components/Skeleton.jsx';

/** Mobile-first approval page opened from the QR code. Updates live via SSE. */
export default function Approve({ id }) {
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const flags = useFeatures();
  const [alerts, setAlerts] = useState(() => notificationsGranted());

  useEffect(() => {
    api(`/api/purchases/${encodeURIComponent(id)}`).then(setP).catch((err) => setError(err.message));
  }, [id]);

  useSSE((msg) => {
    if (msg.kind === 'app' && msg.event.type === 'purchase' && msg.event.purchase.id === id) setP(msg.event.purchase);
  });

  const onPaid = useCallback((purchase) => { setP(purchase); celebrate('big'); haptic(); }, []);
  const enableAlerts = async () => setAlerts((await askNotificationPermission()) === 'granted');
  const onError = useCallback((m) => setError(m), []);

  const reject = async () => {
    setBusy(true);
    try { setP(await post(`/api/purchases/${id}/reject`)); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const done = p && ['approved-paid', 'rejected'].includes(p.status);

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-5">
      <header className="flex items-center gap-2.5">
        <Logo size={28} />
        <div className="leading-tight"><div className="text-sm font-bold">Restock</div><div className="text-[11px] text-ink-2">Approval for Pranay</div></div>
      </header>

      {!p && !error && <SkeletonCard lines={6} className="mt-6" />}
      {!p && error && <p className="mt-6 rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad" role="alert">{error}</p>}

      {p && (
        <motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: spring }} className="mt-6 space-y-4">
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div key="done" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1, transition: spring }} className="card py-10 text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.1 }}>
                  {p.status === 'approved-paid'
                    ? (flags.microInteractions ? <CheckDraw size={68} /> : <CircleCheck size={64} className="mx-auto text-ok" />)
                    : <CircleX size={64} className="mx-auto text-ink-3" />}
                </motion.div>
                <h1 className="mt-4 text-xl font-bold">{p.status === 'approved-paid' ? `Paid ${usd(p.total)}` : 'Rejected'}</h1>
                <p className="mt-1 text-sm text-ink-2">{p.status === 'approved-paid' ? `PayPal ${p.paypal?.id}. The dashboard updated live.` : 'No money moved.'}</p>
              </motion.div>
            ) : (
              <motion.div key="pending" className="card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-ink-3">{p.flag} {p.supplierName}</p>
                    <h1 className="mt-0.5 text-lg font-bold leading-snug">{p.quantity} × {p.productName}</h1>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-4 text-4xl font-bold tracking-tight">{usd(p.total)}</div>
                {p.savedVsLocal > 0 && <p className="mt-1 text-sm font-semibold text-ok">Saves {usd(p.savedVsLocal)} vs local</p>}
                <p className="mt-4 rounded-xl bg-scout-soft/60 px-3 py-2.5 text-sm italic">“{p.reason}”</p>
              </motion.div>
            )}
          </AnimatePresence>

          <section className="card">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16} className="text-guardian" /> Guardian's checks</h2>
            <ul className="mt-3 space-y-1.5">
              {(p.guardianChecks || []).map((c) => (
                <li key={c.rule} className="flex items-start gap-2 text-xs">
                  {c.passed ? (c.needsApproval ? <Clock size={15} className="shrink-0 text-warn" /> : <CircleCheck size={15} className="shrink-0 text-ok" />) : <CircleX size={15} className="shrink-0 text-bad" />}
                  <span><b>{RULE_LABELS[c.rule] || c.rule}.</b> <span className="text-ink-2">{c.detail}</span></span>
                </li>
              ))}
            </ul>
          </section>

          {p.status === 'awaiting-approval' && (
            <div className="sticky bottom-4 space-y-2 rounded-2xl border border-line bg-surface p-3" style={{ boxShadow: 'var(--shadow-lg)' }}>
              <PayPalButton purchase={p} onPaid={onPaid} onError={onError} />
              <button className="btn btn-danger w-full" onClick={reject} disabled={busy}>Reject</button>
            </div>
          )}
          {error && p && <p className="rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad" role="alert">{error}</p>}
          {flags.pwa && notificationsSupported() && (
            alerts
              ? <p className="flex items-center justify-center gap-1.5 text-xs text-ok"><BellRing size={14} aria-hidden="true" /> Alerts on: keep this page open and Restock will notify you of new approvals.</p>
              : <button className="btn w-full" onClick={enableAlerts}><BellRing size={15} aria-hidden="true" /> Alert me about new approvals</button>
          )}
          <p className="text-center text-[11px] text-ink-3">PayPal sandbox · no real money moves.</p>
        </motion.main>
      )}
    </div>
  );
}
