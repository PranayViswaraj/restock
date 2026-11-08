import React, { useMemo, useState } from 'react';
import { AgCharts } from 'ag-charts-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-charts-community';
import { useApp } from '../lib/store.jsx';
import { usd } from '../lib/format.js';

ModuleRegistry.registerModules([AllCommunityModule]);

const PAID = ['auto-paid', 'approved-paid'];
// Categorical slots in fixed order (validated for colour-blind separation in both themes).
const COLORS = {
  light: { spend: '#2a78d6', rolling: '#eb6834', saved: '#1baf7a', limit: '#52514e', text: '#475569', grid: '#e4e6ee' },
  dark: { spend: '#3987e5', rolling: '#d95926', saved: '#199e70', limit: '#c3c2b7', text: '#a9b1c6', grid: '#262b3e' },
};

/** Daily spend + savings (bars), rolling 7-day spend vs weekly limit (lines). One $ axis. */
export default function SpendChart({ theme }) {
  const { purchases, mandate } = useApp();
  const [table, setTable] = useState(false);
  const limit = mandate?.rules?.maxPerWeek || 0;

  const data = useMemo(() => {
    const spend = {};
    const saved = {};
    for (const p of purchases || []) {
      if (!PAID.includes(p.status)) continue;
      const d = p.createdAt.slice(0, 10);
      spend[d] = (spend[d] || 0) + p.total;
      saved[d] = (saved[d] || 0) + (p.savedVsLocal || 0);
    }
    const days = Array.from({ length: 21 }, (_, i) => new Date(Date.now() - (20 - i) * 864e5).toISOString().slice(0, 10));
    return days.map((d, i) => ({
      date: new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      spend: +(spend[d] || 0).toFixed(2),
      saved: +(saved[d] || 0).toFixed(2),
      rolling: +days.slice(Math.max(0, i - 6), i + 1).reduce((t, x) => t + (spend[x] || 0), 0).toFixed(2),
      limit,
    }));
  }, [purchases, limit]);

  const c = theme === 'dark' ? COLORS.dark : COLORS.light;
  const options = useMemo(() => ({
    data,
    theme: theme === 'dark' ? 'ag-default-dark' : 'ag-default',
    background: { visible: false },
    padding: { top: 8, right: 8, bottom: 0, left: 0 },
    series: [
      { type: 'bar', xKey: 'date', yKey: 'spend', yName: 'Daily spend', fill: c.spend, cornerRadius: 4 },
      { type: 'bar', xKey: 'date', yKey: 'saved', yName: 'Saved vs local', fill: c.saved, cornerRadius: 4 },
      { type: 'line', xKey: 'date', yKey: 'rolling', yName: 'Rolling 7-day spend', stroke: c.rolling, strokeWidth: 2, marker: { enabled: true, size: 7, fill: c.rolling, stroke: theme === 'dark' ? '#121521' : '#ffffff', strokeWidth: 2 } },
      { type: 'line', xKey: 'date', yKey: 'limit', yName: 'Weekly limit', stroke: c.limit, strokeWidth: 2, lineDash: [6, 4], marker: { enabled: false } },
    ],
    axes: {
      x: { type: 'category', position: 'bottom', label: { color: c.text, fontSize: 11 } },
      y: { type: 'number', position: 'left', label: { color: c.text, formatter: ({ value }) => `$${value}` }, gridLine: { style: [{ stroke: c.grid, lineDash: [2, 4] }] } },
    },
    legend: { position: 'bottom', item: { label: { color: c.text } } },
  }), [data, theme, c]);

  return (
    <section className="card" aria-labelledby="spend-title">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 id="spend-title" className="card-title">Spend vs weekly limit</h2>
          <p className="card-sub">Paid purchases, last 21 days (USD · PayPal sandbox).</p>
        </div>
        <button className="btn btn-sm" onClick={() => setTable((t) => !t)} aria-pressed={table}>{table ? 'Chart' : 'Table'}</button>
      </div>
      {table ? (
        <div className="max-h-[300px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="text-ink-2"><tr><th className="py-1 text-left">Date</th><th className="text-right">Spend</th><th className="text-right">Saved</th><th className="text-right">Rolling 7d</th><th className="text-right">Limit</th></tr></thead>
            <tbody>{data.map((d) => <tr key={d.date} className="border-t border-line"><td className="py-1">{d.date}</td><td className="text-right">{usd(d.spend)}</td><td className="text-right">{usd(d.saved)}</td><td className="text-right">{usd(d.rolling)}</td><td className="text-right">{usd(d.limit)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="h-[300px]"><AgCharts options={options} style={{ height: '100%' }} /></div>
      )}
    </section>
  );
}
