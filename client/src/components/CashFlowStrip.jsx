import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Wallet, CalendarClock, ArrowDownToLine } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { post } from '../lib/api.js';
import { usd, shortDate } from '../lib/format.js';
import { Skeleton } from './Skeleton.jsx';
import { spring } from '../lib/motion.js';

/** Balance vs the protected buffer, weekly budget, and upcoming settlements. */
export default function CashFlowStrip() {
  const { cash, toast } = useApp();
  const [busy, setBusy] = useState(false);
  if (!cash) return <div className="card"><Skeleton className="h-16 w-full" /></div>;

  const buffer = cash.minBalanceBuffer || 0;
  const scale = Math.max(cash.balance, buffer) * 1.35 || 1;
  const balancePct = Math.min(100, (cash.balance / scale) * 100);
  const bufferPct = Math.min(100, (buffer / scale) * 100);
  const weekPct = cash.maxPerWeek ? Math.min(100, (cash.weekToDateSpend / cash.maxPerWeek) * 100) : 0;
  const settlements = [...(cash.upcomingSettlements || [])].sort((a, b) => a.date.localeCompare(b.date));

  const settle = async () => {
    setBusy(true);
    try {
      const r = await post('/api/cash/settle');
      toast(r.ok ? `Settlement landed: ${usd(r.settlement.amount)}. Treasurer re-checked delayed orders.` : r.message, 'info');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card grid gap-5 lg:grid-cols-[1.4fr_1fr_1.4fr]" aria-label="Cash flow">
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-ink-2"><Wallet size={14} aria-hidden="true" /> PayPal balance <span className="text-ink-3">(simulated)</span></div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight">{usd(cash.balance)}</span>
          <span className={`text-xs font-semibold ${cash.balance - buffer >= 0 ? 'text-ok' : 'text-bad'}`}>{usd(cash.balance - buffer)} above buffer</span>
        </div>
        <div className="relative mt-3 h-2.5 rounded-full bg-surface-2" role="img" aria-label={`Balance ${usd(cash.balance)}, buffer ${usd(buffer)}`}>
          <motion.div className="h-full rounded-full bg-treasurer" initial={{ width: 0 }} animate={{ width: `${balancePct}%` }} transition={spring} />
          <div className="absolute -top-1 h-[18px] w-0.5 rounded bg-bad" style={{ left: `${bufferPct}%` }} aria-hidden="true" />
          <div className="absolute top-4 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-bad" style={{ left: `${bufferPct}%` }}>buffer {usd(buffer, { maximumFractionDigits: 0 })}</div>
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-ink-2">Week-to-date spend</div>
        <div className="mt-1 text-2xl font-bold tracking-tight">{usd(cash.weekToDateSpend)} <span className="text-sm font-medium text-ink-3">of {usd(cash.maxPerWeek, { maximumFractionDigits: 0 })}</span></div>
        <div className="mt-3 h-2.5 rounded-full bg-surface-2">
          <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${weekPct}%` }} transition={spring} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-ink-2"><CalendarClock size={14} aria-hidden="true" /> Upcoming settlements</div>
          <button className="btn btn-sm" onClick={settle} disabled={busy || !settlements.length} title="Demo: land the next settlement now and let Treasurer retry delayed orders">
            <ArrowDownToLine size={13} aria-hidden="true" /> Land next (demo)
          </button>
        </div>
        <ul className="mt-2 space-y-1.5">
          {settlements.length === 0 && <li className="text-xs text-ink-3">No upcoming settlements.</li>}
          {settlements.map((s) => (
            <li key={s.date + s.source} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-1.5 text-xs">
              <span className="truncate text-ink-2">{shortDate(`${s.date}T12:00:00Z`)} · {s.source}</span>
              <span className="font-semibold text-ok">+{usd(s.amount, { maximumFractionDigits: 0 })}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
