import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { timeOf } from '../lib/format.js';

const Json = ({ value }) => (
  <pre className="max-h-64 overflow-auto rounded-xl bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-ink-2">{JSON.stringify(value, null, 2)}</pre>
);

/** "Technical view" of a decision: raw audit entries, rule values and PayPal data. */
export default function TechnicalTrace({ p }) {
  const [entries, setEntries] = useState(null);
  useEffect(() => {
    let live = true;
    api('/api/audit').then((all) => live && setEntries(all.filter((e) => e.data?.purchaseId === p.id).reverse())).catch(() => live && setEntries([]));
    return () => { live = false; };
  }, [p.id, p.status]);

  return (
    <div className="space-y-5 py-5 text-xs">
      <section>
        <h3 className="mb-2 font-semibold">Hash-chained audit entries for {p.id}</h3>
        {!entries ? <p className="text-ink-3">Loading…</p> : entries.length === 0 ? <p className="text-ink-3">No audit entries (seeded history).</p> : (
          <ol className="space-y-1.5">
            {entries.map((e) => (
              <li key={e.seq} className="rounded-lg border border-line px-2.5 py-1.5">
                <div className="flex flex-wrap items-center gap-x-2 font-mono">
                  <span className="text-ink-3">#{e.seq}</span><span className="font-semibold">{e.role}</span><span>{e.action}</span>
                  <span className="text-ink-3">{timeOf(e.timestamp)}</span><span className="ml-auto text-ink-3" title={e.hash}>{e.hash.slice(0, 10)}…</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section>
        <h3 className="mb-2 font-semibold">Guardian input and checks</h3>
        <Json value={{
          proposal: { sku: p.sku, supplierId: p.supplierId, quantity: p.quantity, total: p.total, unitCost: p.unitCost },
          marketAvgUnitPrice: p.marketAvgUnitPrice, verdict: p.verdict, delayUntil: p.delayUntil ?? null, checks: p.guardianChecks,
        }} />
      </section>
      <section>
        <h3 className="mb-2 font-semibold">Scout's forecast and offer</h3>
        <Json value={{ forecast: p.forecast, offerId: p.offerId, catalogSource: p.catalogSource || 'mock', savedVsLocal: p.savedVsLocal, savingsVsAverage: p.savings, runId: p.runId }} />
      </section>
      <section>
        <h3 className="mb-2 font-semibold">PayPal</h3>
        {p.paypal ? <Json value={p.paypal} /> : <p className="text-ink-3">No PayPal call: {p.status}.</p>}
      </section>
    </div>
  );
}
