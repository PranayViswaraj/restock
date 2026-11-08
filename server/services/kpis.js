// Live impact KPIs, computed from real app data. Values that rely on an assumption
// are flagged `estimated: true` so the UI can label them honestly.
import { read } from './store.js';
import { PAID } from './purchases.js';
import { current as currentMandate } from './mandate.js';

const LOST_SALE_PER_STOCKOUT = 60; // $; same default as the simulation
const round2 = (n) => Math.round(n * 100) / 100;

/** Pure: compute KPIs from data. */
export function computeKpis({ purchases, cash, mandate, now = Date.now() }) {
  const paid = purchases.filter((p) => PAID.includes(p.status));
  const decided = purchases.filter((p) => [...PAID, 'awaiting-approval', 'delayed'].includes(p.status));
  const week = paid.filter((p) => now - new Date(p.createdAt).getTime() < 7 * 864e5);
  const prevented = paid.filter((p) => (p.forecast?.daysOfStockLeft ?? 99) < 3).length;
  const buffer = mandate?.rules?.minBalanceBuffer ?? 0;
  const history = cash?.history || [];
  const bufferDays = history.filter((h) => h.balance >= buffer).length;

  return [
    { key: 'stockoutsPrevented', label: 'Stockouts prevented', value: prevented, format: 'int' },
    { key: 'lostSalesAvoided', label: 'Lost sales avoided', value: prevented * LOST_SALE_PER_STOCKOUT, format: 'usd', estimated: true, hint: `$${LOST_SALE_PER_STOCKOUT} per stockout day` },
    { key: 'moneySaved', label: 'Saved vs average price', value: round2(paid.reduce((t, p) => t + (p.savings || 0), 0)), format: 'usd' },
    { key: 'crossBorderSavings', label: 'Cross-border savings', value: round2(paid.reduce((t, p) => t + (p.savedVsLocal || 0), 0)), format: 'usd' },
    { key: 'hoursSaved', label: 'Owner hours saved / week', value: round2(week.reduce((t, p) => t + (p.status === 'auto-paid' ? 20 : 15), 0) / 60), format: 'hours', estimated: true, hint: '20 min per auto order, 15 per approval' },
    { key: 'autoPct', label: 'Handled automatically', value: decided.length ? Math.round((purchases.filter((p) => p.status === 'auto-paid').length / decided.length) * 100) : 0, format: 'pct' },
    { key: 'riskyBlocked', label: 'Risky purchases blocked', value: purchases.filter((p) => p.status === 'blocked').length, format: 'int' },
    { key: 'ruleViolations', label: 'Rule violations', value: paid.filter((p) => (p.guardianChecks || []).some((c) => !c.passed)).length, format: 'int', mustBeZero: true },
    { key: 'cashBufferDays', label: 'Days cash buffer kept', value: bufferDays + (cash?.balance >= buffer ? 1 : 0), outOf: history.length + 1, format: 'days' },
  ];
}

export function liveKpis() {
  return computeKpis({ purchases: read('purchases'), cash: read('cash', {}), mandate: currentMandate() });
}
