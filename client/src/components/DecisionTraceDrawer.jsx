import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CircleCheck, CircleX, Clock, Receipt } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { Link } from '../lib/router.jsx';
import { usd, usdUnit, RULE_LABELS } from '../lib/format.js';
import PayPalProof from './PayPalProof.jsx';
import { spring, stagger } from '../lib/motion.js';
import RoleAvatar from './RoleAvatar.jsx';
import StatusBadge from './StatusBadge.jsx';

function Section({ role, title, children }) {
  return (
    <section className="border-t border-line py-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <RoleAvatar role={role} size={26} /> {title}
      </h3>
      {children}
    </section>
  );
}

/** Slide-over explaining one decision end to end: Scout → Guardian → Treasurer → receipt. */
export default function DecisionTraceDrawer() {
  const { drawerId, openTrace, purchases } = useApp();
  const p = (purchases || []).find((x) => x.id === drawerId);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!drawerId) return undefined;
    const onKey = (e) => e.key === 'Escape' && openTrace(null);
    window.addEventListener('keydown', onKey);
    setTimeout(() => closeRef.current?.focus(), 50);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerId, openTrace]);

  return (
    <AnimatePresence>
      {p && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => openTrace(null)} aria-hidden="true" />
          <motion.aside
            role="dialog" aria-modal="true" aria-labelledby="trace-title"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-surface"
            style={{ boxShadow: 'var(--shadow-lg)' }}
            initial={{ x: '100%' }} animate={{ x: 0, transition: spring }} exit={{ x: '100%', transition: { duration: 0.22 } }}
          >
            <header className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink-3">Decision trace · {p.id}</p>
                <h2 id="trace-title" className="mt-0.5 truncate text-lg font-bold tracking-tight">{p.quantity} × {p.productName}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <StatusBadge status={p.status} /> <span className="font-semibold">{usd(p.total)}</span>
                  <span className="text-ink-2">{p.flag} {p.supplierName}</span>
                </div>
              </div>
              <button ref={closeRef} className="btn btn-sm h-9 w-9 px-0" onClick={() => openTrace(null)} aria-label="Close decision trace"><X size={16} /></button>
            </header>

            <div className="flex-1 overflow-y-auto px-6">
              <Section role="scout" title="Scout's reasoning (AI)">
                <blockquote className="rounded-xl bg-scout-soft/60 px-4 py-3 text-sm italic">“{p.reason}”</blockquote>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-surface-2 p-2"><dt className="text-ink-3">Daily usage</dt><dd className="mt-0.5 font-semibold">{p.forecast?.dailyUsage ?? '—'} {p.unit}</dd></div>
                  <div className="rounded-xl bg-surface-2 p-2"><dt className="text-ink-3">Days left</dt><dd className="mt-0.5 font-semibold">{p.forecast?.daysOfStockLeft ?? '—'}</dd></div>
                  <div className="rounded-xl bg-surface-2 p-2"><dt className="text-ink-3">Saved vs local</dt><dd className="mt-0.5 font-semibold text-ok">{usd(p.savedVsLocal || 0)}</dd></div>
                </dl>
                {p.alternatives?.length > 0 && (
                  <table className="mt-4 w-full text-xs">
                    <caption className="mb-1.5 text-left font-semibold text-ink-2">
                      Suppliers compared{' '}
                      <span className="font-normal text-ink-3">· source: {p.catalogSource === 'channel3' ? 'Channel3' : 'mock catalog (Channel3 not connected)'}</span>
                    </caption>
                    <thead className="text-ink-3"><tr><th className="py-1 text-left font-medium">Supplier</th><th className="text-right font-medium">Per unit</th><th className="text-right font-medium">Pack</th><th className="text-right font-medium">Status</th></tr></thead>
                    <tbody>
                      {p.alternatives.map((a) => (
                        <tr key={a.offerId} className={`border-t border-line ${a.offerId === p.offerId ? 'font-semibold' : ''}`}>
                          <td className="py-1.5">{a.flag} {a.supplier} {a.country !== 'US' && <span className="text-info">· intl</span>} {a.isNew && <span className="text-warn">· new</span>}</td>
                          <td className="text-right tabular-nums">{usdUnit(a.unitPrice)}</td>
                          <td className="text-right tabular-nums">{usd(a.price)}</td>
                          <td className="text-right">{a.offerId === p.offerId ? 'chosen' : a.inStock ? 'in stock' : 'out of stock'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Section>

              <Section role="guardian" title={`Guardian's checks (code) · verdict ${p.verdict || '—'}`}>
                <motion.ul variants={stagger(0.12, 0.15)} initial="hidden" animate="show" className="space-y-2">
                  {(p.guardianChecks || []).map((c) => (
                    <motion.li key={c.rule}
                      variants={{ hidden: { opacity: 0, x: 10 }, show: { opacity: 1, x: 0, transition: spring } }}
                      className={`flex items-start gap-2.5 rounded-xl px-3 py-2 text-xs ${c.passed ? (c.needsApproval ? 'bg-warn-soft' : 'bg-ok-soft/60') : 'bg-bad-soft'}`}>
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring, delay: 0.1 }}>
                        {c.passed ? (c.needsApproval ? <Clock size={16} className="text-warn" /> : <CircleCheck size={16} className="text-ok" />) : <CircleX size={16} className="text-bad" />}
                      </motion.span>
                      <span><b className="block text-ink">{RULE_LABELS[c.rule] || c.rule}</b><span className="text-ink-2">{c.detail}</span></span>
                    </motion.li>
                  ))}
                </motion.ul>
                {p.verdictReason && <p className="mt-3 text-xs text-ink-2">{p.verdictReason}</p>}
              </Section>

              <Section role="treasurer" title="Treasurer (code + PayPal)">
                {p.paypal?.id ? (
                  <PayPalProof p={p} />
                ) : (
                  <p className="text-xs text-ink-2">
                    {p.status === 'blocked' && 'No money moved. Guardian blocked this proposal.'}
                    {p.status === 'delayed' && `Holding payment until ${p.delayUntil} to keep the cash buffer safe.`}
                    {p.status === 'awaiting-approval' && 'Waiting for Pranay to approve in PayPal.'}
                    {p.status === 'rejected' && 'Pranay rejected this order. No money moved.'}
                    {p.status === 'failed' && `Payment failed: ${p.error}`}
                  </p>
                )}
                {p.receiptHash && (
                  <div className="mt-4 rounded-xl border border-line p-3">
                    <p className="text-[11px] font-medium text-ink-3">Receipt hash (SHA-256)</p>
                    <p className="mt-1 break-all font-mono text-[11px]">{p.receiptHash}</p>
                    <Link to={`/receipt/${p.id}`} className="link mt-2 inline-flex items-center gap-1 text-xs" onClick={() => openTrace(null)}><Receipt size={13} /> Printable receipt</Link>
                  </div>
                )}
              </Section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
