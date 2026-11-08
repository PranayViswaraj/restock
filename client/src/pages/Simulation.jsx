import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Play, Pause, RotateCcw, PackageX, ShieldCheck, Truck, FlaskConical } from 'lucide-react';
import { post } from '../lib/api.js';
import { usd } from '../lib/format.js';
import { spring } from '../lib/motion.js';
import NumberTicker from '../components/NumberTicker.jsx';
import KpiStrip from '../components/KpiStrip.jsx';
import { SkeletonCard } from '../components/Skeleton.jsx';

const FRAME_MS = 650; // 30 days ≈ 20 seconds at 1×

function toKpis(k) {
  return [
    { key: 'stockoutsPrevented', label: 'Stockouts prevented', value: k.stockoutsPrevented, format: 'int' },
    { key: 'lostSalesAvoided', label: 'Lost sales avoided', value: k.lostSalesAvoided, format: 'usd', estimated: true },
    { key: 'moneySaved', label: 'Saved vs average price', value: k.moneySaved, format: 'usd' },
    { key: 'crossBorderSavings', label: 'Cross-border savings', value: k.crossBorderSavings, format: 'usd' },
    { key: 'hoursSaved', label: 'Owner hours saved / week', value: k.hoursSavedPerWeek, format: 'hours', estimated: true },
    { key: 'autoPct', label: 'Handled automatically', value: k.autoPct, format: 'pct' },
    { key: 'riskyBlocked', label: 'Risky purchases blocked', value: k.riskyBlocked, format: 'int' },
    { key: 'ruleViolations', label: 'Rule violations', value: k.ruleViolations, format: 'int', mustBeZero: true },
    { key: 'cashBufferDays', label: 'Days cash buffer kept', value: k.daysCashBuffer, outOf: 30, format: 'int' },
  ];
}

function SidePanel({ title, tone, frame, events, children }) {
  const stockouts = frame.stockouts;
  return (
    <div className={`card relative overflow-hidden ${tone === 'bad' ? 'ring-1 ring-bad/20' : 'ring-1 ring-ok/30'}`}>
      <div className="flex items-center justify-between">
        <h2 className="card-title">{title}</h2>
        <span className={`badge ${tone === 'bad' ? 'bg-bad-soft text-bad' : 'bg-ok-soft text-ok'}`}>{tone === 'bad' ? 'Manual' : 'Restock'}</span>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs text-ink-2"><span>Shelf health</span><span>{frame.health}%</span></div>
        <div className="mt-1 h-2.5 rounded-full bg-surface-2">
          <motion.div className={`h-full rounded-full ${frame.health === 100 ? 'bg-ok' : frame.health > 70 ? 'bg-warn' : 'bg-bad'}`} animate={{ width: `${frame.health}%` }} transition={spring} />
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-surface-2 p-2.5"><dt className="text-[11px] text-ink-3">Stockouts</dt><dd className={`text-xl font-bold ${stockouts ? 'text-bad' : 'text-ok'}`}><NumberTicker value={stockouts} duration={0.4} /></dd></div>
        <div className="rounded-xl bg-surface-2 p-2.5"><dt className="text-[11px] text-ink-3">Lost sales</dt><dd className="text-xl font-bold"><NumberTicker value={frame.lostSales} duration={0.4} format={(v) => usd(v, { maximumFractionDigits: 0 })} /></dd></div>
        <div className="rounded-xl bg-surface-2 p-2.5"><dt className="text-[11px] text-ink-3">Spend</dt><dd className="text-xl font-bold"><NumberTicker value={frame.spend} duration={0.4} format={(v) => usd(v, { maximumFractionDigits: 0 })} /></dd></div>
      </dl>
      {children}
      <div className="mt-4 flex min-h-8 flex-wrap gap-1.5" aria-live="polite">
        <AnimatePresence>
          {events.map((e, i) => (
            <motion.span key={`${frame.day}-${i}`} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className={`badge ${e.type === 'stockout' ? 'bg-bad-soft text-bad' : e.type === 'blocked' ? 'bg-guardian-soft text-guardian' : 'bg-info-soft text-info'}`}>
              {e.type === 'stockout' ? <PackageX size={12} /> : e.type === 'blocked' ? <ShieldCheck size={12} /> : <Truck size={12} />}
              {e.type === 'stockout' ? 'Stockout' : e.type === 'blocked' ? 'Trap blocked' : e.international ? 'Ordered (intl)' : 'Ordered'} · {e.sku}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function Simulation() {
  const [assumptions, setAssumptions] = useState({ manualHoursPerWeek: 3, lostSalePerStockout: 60 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timer = useRef(null);

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await post('/api/simulate', { manualHoursPerWeek: Number(assumptions.manualHoursPerWeek), lostSalePerStockout: Number(assumptions.lostSalePerStockout) });
      setResult(r);
      setIdx(0);
      setPlaying(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { run(); }, []); // run once on page load

  useEffect(() => {
    clearInterval(timer.current);
    if (!playing || !result) return undefined;
    timer.current = setInterval(() => {
      setIdx((i) => {
        if (i >= result.frames.length - 1) { setPlaying(false); return i; }
        return i + 1;
      });
    }, FRAME_MS / speed);
    return () => clearInterval(timer.current);
  }, [playing, speed, result]);

  const frame = result?.frames[idx];
  const done = result && idx >= result.frames.length - 1;
  const eventsFor = useMemo(() => (side) => (frame?.events || []).filter((e) => e.side === side).slice(0, 6), [frame]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><FlaskConical size={22} className="text-accent" aria-hidden="true" /> 30-day simulation</h1>
          <p className="text-sm text-ink-2">Same demand, two cafés. Deterministic code (no AI calls per day). <b>Simulated on seeded demo data.</b></p>
        </div>
        <div className="card flex flex-wrap items-end gap-3 p-3">
          <label className="text-xs text-ink-2">Manual reordering (h/week)
            <input type="number" min="0" max="40" className="input mt-1 w-28" value={assumptions.manualHoursPerWeek} onChange={(e) => setAssumptions({ ...assumptions, manualHoursPerWeek: e.target.value })} />
          </label>
          <label className="text-xs text-ink-2">Lost sale per stockout ($)
            <input type="number" min="0" max="5000" className="input mt-1 w-28" value={assumptions.lostSalePerStockout} onChange={(e) => setAssumptions({ ...assumptions, lostSalePerStockout: e.target.value })} />
          </label>
          <button className="btn btn-primary" onClick={run} disabled={loading}>{loading ? 'Simulating…' : 'Run simulation'}</button>
        </div>
      </div>

      {error && <p className="rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad" role="alert">{error}</p>}
      {!result ? <SkeletonCard lines={6} /> : (
        <>
          <div className="card flex flex-wrap items-center gap-4">
            <div className="min-w-[140px]">
              <div className="text-xs font-medium text-ink-3">Day</div>
              <div className="text-3xl font-bold tabular-nums tracking-tight">{frame.day}<span className="text-base text-ink-3"> / {result.days}</span></div>
            </div>
            <div className="h-2 min-w-[160px] flex-1 rounded-full bg-surface-2" role="progressbar" aria-valuenow={frame.day} aria-valuemin={1} aria-valuemax={result.days} aria-label="Simulation progress">
              <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${(frame.day / result.days) * 100}%` }} transition={{ duration: 0.2 }} />
            </div>
            <div className="flex items-center gap-2">
              <button className="btn" onClick={() => (done ? (setIdx(0), setPlaying(true)) : setPlaying((p) => !p))} aria-label={playing ? 'Pause' : 'Play'}>
                {playing ? <Pause size={15} /> : <Play size={15} />} {playing ? 'Pause' : done ? 'Replay' : 'Play'}
              </button>
              <button className="btn" onClick={() => { setIdx(0); setPlaying(false); }} aria-label="Restart"><RotateCcw size={15} /></button>
              <div className="flex rounded-xl border border-line p-0.5" role="group" aria-label="Speed">
                {[1, 2, 4].map((s) => (
                  <button key={s} onClick={() => setSpeed(s)} aria-pressed={speed === s} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${speed === s ? 'bg-accent text-accent-ink' : 'text-ink-2'}`}>{s}×</button>
                ))}
              </div>
              <button className="btn btn-sm" onClick={() => { setIdx(result.frames.length - 1); setPlaying(false); }}>Skip to end</button>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <SidePanel title="Without Restock" tone="bad" frame={frame.without} events={eventsFor('without')} />
            <SidePanel title="With Restock" tone="ok" frame={frame.with} events={eventsFor('with')}>
              <div className="mt-3 grid grid-cols-2 gap-3 text-center text-xs">
                <div className="rounded-xl bg-ok-soft p-2"><span className="text-ink-2">Saved</span> <b className="text-ok">{usd(frame.with.saved, { maximumFractionDigits: 0 })}</b></div>
                <div className="rounded-xl bg-guardian-soft p-2"><span className="text-ink-2">Traps blocked</span> <b className="text-guardian">{frame.with.blocked}</b></div>
              </div>
            </SidePanel>
          </div>

          <AnimatePresence>
            {done && (
              <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: spring }} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold tracking-tight">30-day impact</h2>
                  <span className="badge bg-warn-soft text-warn">Simulated on seeded demo data</span>
                </div>
                <KpiStrip kpis={toKpis(result.kpis)} label="Simulated" />
                <p className="text-xs text-ink-3">
                  Without Restock: {result.totals.without.orders} orders, {result.totals.without.stockouts} stockouts. With Restock: {result.totals.with.orders} orders
                  ({result.totals.with.approvals} needed one-tap approval), {result.totals.with.stockouts} stockouts. Lead times: local {result.assumptions.leadTimeLocalDays} days, international {result.assumptions.leadTimeInternationalDays} days.
                </p>
              </motion.section>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
