import React, { useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { usd } from '../lib/format.js';

// Equirectangular projection into a 360×180 box (lon/lat → x/y).
const project = (lat, lon) => [lon + 180, 90 - lat];
const AUSTIN = { lat: 30.27, lon: -97.74, label: 'Austin, US', flag: '🇺🇸' };

// A faint dot-matrix "world" so the arc has context without shipping a map.
const DOTS = (() => {
  const blobs = [
    [-125, -65, 25, 50], [-82, -35, -55, 10], [-10, 40, 36, 70], [-17, 50, -35, 35], [40, 145, 5, 70], [113, 154, -40, -12],
  ];
  const out = [];
  for (const [lo1, lo2, la1, la2] of blobs) {
    for (let lon = lo1; lon <= lo2; lon += 6) for (let lat = la1; lat <= la2; lat += 6) out.push(project(lat, lon));
  }
  return out;
})();

/** Curved arc + moving coin from Austin to the supplier's city on every payment. */
export default function PaymentArc() {
  const { arcs, nextArc } = useApp();
  const arc = arcs[0];

  useEffect(() => {
    if (!arc) return undefined;
    const t = setTimeout(nextArc, 3000);
    return () => clearTimeout(t);
  }, [arc, nextArc]);

  const geo = useMemo(() => {
    if (!arc) return null;
    const [x1, y1] = project(AUSTIN.lat, AUSTIN.lon);
    const [x2, y2] = project(arc.lat ?? AUSTIN.lat, arc.lon ?? AUSTIN.lon);
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const lift = Math.max(14, dist * 0.35);
    const cx = (x1 + x2) / 2;
    const cy = Math.min(y1, y2) - lift;
    return { x1, y1, x2, y2, d: `M${x1},${y1} Q${cx},${cy} ${x2},${y2}` };
  }, [arc]);

  return (
    <div className="pointer-events-none fixed left-1/2 top-20 z-[55] w-[min(420px,calc(100vw-32px))] -translate-x-1/2 no-print" aria-live="polite">
      <AnimatePresence mode="wait">
        {arc && geo && (
          <motion.div
            key={arc.key}
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 25 } }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.25 } }}
            className="overflow-hidden rounded-2xl border border-line bg-surface"
            style={{ boxShadow: 'var(--shadow-lg)' }}
          >
            <svg viewBox="0 12 360 118" className="block w-full bg-surface-2" role="img" aria-label={`Payment from Austin to ${arc.city}`}>
              <g>
                {DOTS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="0.9" fill="var(--ink-3)" opacity="0.35" />)}
                <motion.path d={geo.d} fill="none" stroke="var(--treasurer)" strokeWidth="1.6" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: 'easeInOut' }} />
                <circle cx={geo.x1} cy={geo.y1} r="3" fill="var(--accent)" />
                <circle cx={geo.x2} cy={geo.y2} r="3" fill="var(--treasurer)" />
                <motion.circle cx={geo.x2} cy={geo.y2} r="3" fill="none" stroke="var(--treasurer)" initial={{ r: 3, opacity: 0.9 }} animate={{ r: 12, opacity: 0 }} transition={{ delay: 1.2, duration: 0.8 }} />
                <motion.g
                  style={{ offsetPath: `path("${geo.d}")`, offsetRotate: '0deg' }}
                  initial={{ offsetDistance: '0%' }} animate={{ offsetDistance: '100%' }} transition={{ duration: 1.2, ease: 'easeInOut' }}
                >
                  <circle r="5" fill="#fbbf24" stroke="#b45309" strokeWidth="1" />
                  <text y="2" textAnchor="middle" fontSize="6" fontWeight="700" fill="#7c2d12">$</text>
                </motion.g>
              </g>
            </svg>
            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-sm">
              <span className="min-w-0 truncate"><span aria-hidden="true">{AUSTIN.flag}</span> Austin → <span aria-hidden="true">{arc.flag}</span> {arc.city}</span>
              <span className="shrink-0 font-bold tabular-nums">{usd(arc.total)}</span>
            </div>
            {arc.savedVsLocal > 0 && (
              <div className="bg-ok-soft px-4 py-1.5 text-center text-xs font-semibold text-ok">Saved {usd(arc.savedVsLocal)} vs local · paid cross-border via PayPal</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
