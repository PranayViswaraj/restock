import React from 'react';
import { motion } from 'framer-motion';
import { PackageCheck, TrendingUp, PiggyBank, Globe, Clock, Zap, ShieldCheck, Scale, Wallet } from 'lucide-react';
import NumberTicker from './NumberTicker.jsx';
import { Skeleton } from './Skeleton.jsx';
import { formatKpi } from '../lib/format.js';
import { fadeUp, stagger } from '../lib/motion.js';

const ICONS = {
  stockoutsPrevented: PackageCheck,
  lostSalesAvoided: TrendingUp,
  moneySaved: PiggyBank,
  crossBorderSavings: Globe,
  hoursSaved: Clock,
  autoPct: Zap,
  riskyBlocked: ShieldCheck,
  ruleViolations: Scale,
  cashBufferDays: Wallet,
};

/** Impact strip: 9 KPIs from live data. Estimated values are labeled. */
export default function KpiStrip({ kpis, label = 'Live from your data' }) {
  if (!kpis) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-9">
        {Array.from({ length: 9 }, (_, i) => <div key={i} className="card p-4"><Skeleton className="h-3 w-2/3" /><Skeleton className="mt-3 h-7 w-1/2" /></div>)}
      </div>
    );
  }
  return (
    <section aria-label={`Impact KPIs (${label})`} data-tour="kpis">
      <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-9">
        {kpis.map((k) => {
          const Icon = ICONS[k.key] || Zap;
          const good = k.mustBeZero ? k.value === 0 : true;
          return (
            <motion.div key={k.key} variants={fadeUp} className="card hover-lift p-4" title={k.hint || undefined}>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink-2">
                <Icon size={13} className={k.mustBeZero ? (good ? 'text-ok' : 'text-bad') : 'text-accent'} aria-hidden="true" />
                <span className="truncate">{k.label}</span>
              </div>
              <div className={`mt-1.5 text-2xl font-bold tracking-tight ${k.mustBeZero && good ? 'text-ok' : ''}`}>
                <NumberTicker value={k.value} format={(v) => formatKpi(v, k.format)} />
                {k.outOf ? <span className="text-sm font-medium text-ink-3">/{k.outOf}</span> : null}
              </div>
              {(k.estimated || k.mustBeZero) && (
                <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-ink-3">
                  {k.estimated ? 'estimate' : 'must stay 0'}
                </div>
              )}
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
