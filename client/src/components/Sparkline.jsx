import React from 'react';

/** Tiny inline SVG sparkline (used as an AG Grid cell renderer). */
export default function Sparkline({ values = [], width = 96, height = 26, color = 'var(--accent)' }) {
  if (values.length < 2) return <span className="text-ink-3">—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - 3 - ((v - min) / span) * (height - 6)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  const trendUp = values[values.length - 1] > values[0] * 1.15;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Usage trend ${trendUp ? 'rising' : 'steady'}`}>
      <path d={`${d} L${width},${height} L0,${height} Z`} fill={color} opacity="0.1" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="2.75" fill={color} stroke="var(--surface)" strokeWidth="1.5" />
    </svg>
  );
}
