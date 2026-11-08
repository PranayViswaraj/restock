import React, { useEffect, useState } from 'react';
import { Printer, ArrowLeft } from 'lucide-react';
import { api } from '../lib/api.js';
import { Link } from '../lib/router.jsx';
import { usd, usdUnit, dateTime, RULE_LABELS } from '../lib/format.js';
import { Logo } from '../components/Header.jsx';
import { SkeletonCard } from '../components/Skeleton.jsx';
import PayPalProof from '../components/PayPalProof.jsx';

/** Printable receipt for one purchase (Ctrl+P / Save as PDF). */
export default function Receipt({ id }) {
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api(`/api/purchases/${encodeURIComponent(id)}`).then(setP).catch((e) => setError(e.message)); }, [id]);

  if (error) return <p className="rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">{error}</p>;
  if (!p) return <SkeletonCard lines={8} />;

  const rows = [
    ['Receipt for', p.id],
    ['Date', dateTime(p.paidAt || p.createdAt)],
    ['Supplier', `${p.flag} ${p.supplierName} (${p.city})`],
    ['Item', p.productName],
    ['Quantity', `${p.quantity} × ${p.unitsPerPack} ${p.unit}`],
    ['Unit price', `${usd(p.unitPrice)} per pack (${usdUnit(p.unitCost || p.unitPrice / p.unitsPerPack)} per unit)`],
    ['Saved vs local', usd(p.savedVsLocal || 0)],
    ['Guardian verdict', p.verdict || '—'],
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link to="/ledger" className="btn btn-sm"><ArrowLeft size={14} /> Ledger</Link>
        <button className="btn btn-primary btn-sm" onClick={() => window.print()}><Printer size={14} /> Print / Save PDF</button>
      </div>
      <article className="card p-8">
        <header className="flex items-start justify-between gap-4 border-b border-line pb-5">
          <div className="flex items-center gap-3"><Logo size={36} /><div><div className="text-lg font-bold">Pranay's Café</div><div className="text-xs text-ink-2">Austin, Texas · purchased by Restock</div></div></div>
          <div className="text-right"><div className="text-xs text-ink-3">Total (USD)</div><div className="text-3xl font-bold">{usd(p.total)}</div></div>
        </header>
        <dl className="mt-5 grid grid-cols-[150px_1fr] gap-y-2 text-sm">
          {rows.map(([k, v]) => <React.Fragment key={k}><dt className="text-ink-3">{k}</dt><dd className="break-words">{v}</dd></React.Fragment>)}
        </dl>
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold">PayPal payment</h2>
          {p.paypal?.id ? <PayPalProof p={p} compact /> : <p className="text-sm text-ink-2">No PayPal payment for this purchase ({p.status}).</p>}
        </section>
        <section className="mt-6">
          <h2 className="text-sm font-semibold">Agent's reason</h2>
          <p className="mt-1 text-sm italic text-ink-2">“{p.reason}”</p>
        </section>
        <section className="mt-5">
          <h2 className="text-sm font-semibold">Guardian checks</h2>
          <ul className="mt-1 space-y-0.5 text-xs text-ink-2">
            {(p.guardianChecks || []).map((c) => <li key={c.rule}>{c.passed ? '✓' : '✗'} {RULE_LABELS[c.rule] || c.rule}: {c.detail}</li>)}
          </ul>
        </section>
        <footer className="mt-6 border-t border-dashed border-line pt-4">
          <div className="text-xs text-ink-3">Receipt hash (SHA-256)</div>
          <div className="break-all font-mono text-xs">{p.receiptHash || 'not paid'}</div>
          <p className="mt-3 text-[11px] text-ink-3">{p.seeded ? 'Seeded demo history. ' : ''}PayPal sandbox transaction. No real money moved.</p>
        </footer>
      </article>
    </div>
  );
}
