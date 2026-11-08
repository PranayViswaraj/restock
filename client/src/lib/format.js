export const usd = (n, opts = {}) =>
  Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', ...opts });

/** Unit prices under $1 get 3 decimals ($0.044). */
export const usdUnit = (n) => (Number(n) < 1 ? `$${Number(n).toFixed(3)}` : usd(n));

export const shortDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const dateTime = (iso) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export const timeOf = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
export const shortHash = (h) => (h ? `${h.slice(0, 8)}…${h.slice(-4)}` : '—');

export function formatKpi(value, format) {
  switch (format) {
    case 'usd': return usd(value, { maximumFractionDigits: 0 });
    case 'pct': return `${Math.round(value)}%`;
    case 'hours': return `${Number(value).toFixed(1)}h`;
    default: return `${Math.round(value)}`;
  }
}

export const STATUS = {
  'auto-paid': { tone: 'ok', label: 'Auto-paid' },
  'approved-paid': { tone: 'info', label: 'Approved & paid' },
  'awaiting-approval': { tone: 'warn', label: 'Needs approval' },
  delayed: { tone: 'owner', label: 'Delayed · cash' },
  blocked: { tone: 'bad', label: 'Blocked' },
  rejected: { tone: 'muted', label: 'Rejected' },
  failed: { tone: 'bad', label: 'Failed' },
  'approved-auto': { tone: 'ok', label: 'Paying…' },
  proposed: { tone: 'muted', label: 'Proposed' },
};

export const RULE_LABELS = {
  mandate: 'Signed mandate',
  category: 'Approved category',
  maxPerOrder: 'Per-order limit',
  maxPerWeek: 'Weekly budget',
  priceDeviation: 'Price vs 30-day average',
  newSupplier: 'Supplier trust',
  cashBuffer: 'Cash buffer',
  seeded: 'Seeded history',
};
