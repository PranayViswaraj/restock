import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Globe2 } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { usd } from '../lib/format.js';

// Stylized dot-grid world, generated procedurally from a few rough ellipses
// (no map artwork is shipped). Cropped to the band between Texas and India.
const W = 800;
const H = 300;
const LON = [-130, 150];
const LAT = [-8, 62];
const project = (lat, lon) => [((lon - LON[0]) / (LON[1] - LON[0])) * W, ((LAT[1] - lat) / (LAT[1] - LAT[0])) * H];

const LAND = [
  [-100, 45, 30, 14], [-112, 56, 24, 8], [-86, 36, 14, 9], [-101, 24, 9, 7], [-90, 15, 6, 4], [-70, 3, 9, 8],
  [12, 50, 17, 8], [25, 58, 14, 5], [20, 12, 21, 16], [22, 27, 17, 6], [46, 23, 9, 7], [70, 38, 16, 8],
  [92, 50, 40, 11], [103, 32, 17, 9], [114, 40, 12, 9], [78, 21, 7, 9], [78, 12, 4, 5], [104, 14, 6, 6], [110, 2, 9, 4], [138, 37, 4, 6],
];
const isLand = (lat, lon) => LAND.some(([cx, cy, rx, ry]) => ((lon - cx) / rx) ** 2 + ((lat - cy) / ry) ** 2 <= 1);

const DOT_PATHS = (() => {
  let land = '';
  let sea = '';
  for (let lat = LAT[1]; lat >= LAT[0]; lat -= 2.5) {
    for (let lon = LON[0]; lon <= LON[1]; lon += 2.5) {
      const [x, y] = project(lat, lon);
      const seg = `M${x.toFixed(1)} ${y.toFixed(1)}h0`;
      if (isLand(lat, lon)) land += seg; else sea += seg;
    }
  }
  return { land, sea };
})();

const HOME = { lat: 30.27, lon: -97.74, name: 'Austin', flag: '🇺🇸' };
const PAID = ['auto-paid', 'approved-paid'];
const HOME_XY = project(HOME.lat, HOME.lon);

function arcPath(a, b) {
  const [x1, y1] = a;
  const [x2, y2] = b;
  const lift = Math.min(150, Math.hypot(x2 - x1, y2 - y1) * 0.38);
  const cx = (x1 + x2) / 2;
  const cy = Math.min(y1, y2) - lift;
  return { d: `M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`, ctrl: [cx, cy] };
}
function sample(a, c, b, n = 16) {
  const xs = []; const ys = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    xs.push((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0]);
    ys.push((1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]);
  }
  return { xs, ys };
}

/** Where the money went: pins, arcs and a coin flying on every new payment. */
export default function PaymentRoutes() {
  const { purchases } = useApp();
  const home = HOME_XY;

  const routes = useMemo(() => {
    const by = new Map();
    for (const p of purchases || []) {
      if (!PAID.includes(p.status) || p.lat == null) continue;
      const r = by.get(p.supplierId) || { id: p.supplierId, name: p.supplierName, flag: p.flag, city: p.city, intl: !!p.international, lat: p.lat, lon: p.lon, total: 0, saved: 0, n: 0 };
      r.total += p.total; r.saved += p.savedVsLocal || 0; r.n += 1;
      by.set(p.supplierId, r);
    }
    return [...by.values()].map((r) => {
      const to = project(r.lat, r.lon);
      return { ...r, to, ...arcPath(home, to) };
    });
  }, [purchases, home]);

  const intl = routes.filter((r) => r.intl);
  const intlTotal = intl.reduce((t, r) => t + r.total, 0);
  const intlSaved = intl.reduce((t, r) => t + r.saved, 0);

  // Coin flights for payments that landed in the last few seconds.
  const seen = useRef(null);
  const [flights, setFlights] = useState([]);
  useEffect(() => {
    if (!purchases) return;
    const paid = purchases.filter((p) => PAID.includes(p.status) && p.paidAt && p.lat != null);
    if (!seen.current) { seen.current = new Set(paid.map((p) => p.id)); return; } // don't replay history
    const fresh = paid.filter((p) => !seen.current.has(p.id));
    if (!fresh.length) return;
    fresh.forEach((p) => seen.current.add(p.id));
    setFlights((f) => [...f, ...fresh.map((p) => ({ key: p.id, p }))]);
  }, [purchases]);
  useEffect(() => {
    if (!flights.length) return undefined;
    const t = setTimeout(() => setFlights((f) => f.slice(1)), 2600);
    return () => clearTimeout(t);
  }, [flights]);
  const flight = flights[0];
  const flightGeo = useMemo(() => {
    if (!flight) return null;
    const to = project(flight.p.lat, flight.p.lon);
    const { ctrl } = arcPath(home, to);
    return { to, ...sample(home, ctrl, to) };
  }, [flight, home]);

  return (
    <section className="card" aria-labelledby="routes-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="routes-title" className="card-title flex items-center gap-2"><Globe2 size={16} aria-hidden="true" /> Payment routes</h2>
          <p className="card-sub">Every supplier paid through PayPal, from Austin. Arcs to India are cross-border.</p>
        </div>
        <div className="text-right text-xs text-ink-2">
          <div><b className="text-ink">{usd(intlTotal)}</b> paid cross-border</div>
          <div className="text-ok">saved {usd(intlSaved)} vs local</div>
        </div>
      </div>
      {routes.length === 0 && <p className="mt-3 text-center text-xs text-ink-3">No payments with a route yet. Run the demo to watch money fly from Austin to India.</p>}
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto mt-3 max-h-80 w-full" role="img"
        aria-label={`Map of payments: ${routes.map((r) => `${r.name} ${usd(r.total)}`).join(', ') || 'none yet'}.`}>
        <path d={DOT_PATHS.sea} stroke="var(--line)" strokeWidth="2.2" strokeLinecap="round" opacity="0.45" />
        <path d={DOT_PATHS.land} stroke="var(--ink-3)" strokeWidth="3.4" strokeLinecap="round" opacity="0.35" />
        {routes.map((r) => (
          <motion.path key={r.id} d={r.d} fill="none" stroke={r.intl ? 'var(--accent)' : 'var(--treasurer)'} strokeWidth="2" strokeLinecap="round"
            strokeDasharray={r.intl ? undefined : '3 4'} initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.75 }} transition={{ duration: 1.1, ease: 'easeInOut' }} />
        ))}
        {routes.map((r) => {
          const left = r.id === 'sup-coorg-hills';
          return (
            <g key={`pin-${r.id}`} transform={`translate(${r.to[0]} ${r.to[1]})`}>
              <circle r="5" fill="var(--surface)" stroke={r.intl ? 'var(--accent)' : 'var(--treasurer)'} strokeWidth="2.5" />
              {r.intl && (
                <text x={left ? -10 : 10} y={left ? 18 : -8} textAnchor={left ? 'end' : 'start'} className="text-[12px]">
                  <tspan className="fill-[var(--ink)] font-semibold">{r.flag} {r.name}</tspan>
                  <tspan x={left ? -10 : 10} dy="14" className="fill-[var(--ink-2)]">{usd(r.total)}{r.saved ? ` · saved ${usd(r.saved)}` : ''}</tspan>
                </text>
              )}
            </g>
          );
        })}
        <g transform={`translate(${home[0]} ${home[1]})`}>
          <circle r="7" fill="var(--accent)" />
          <circle r="12" fill="none" stroke="var(--accent)" strokeWidth="1.5" opacity="0.5" />
          <text y="28" textAnchor="middle" className="fill-[var(--ink)] text-[12px] font-semibold">{HOME.flag} Pranay's Café, Austin</text>
          {routes.some((r) => !r.intl) && (
            <text y="43" textAnchor="middle" className="fill-[var(--ink-2)] text-[11px]">
              local: {usd(routes.filter((r) => !r.intl).reduce((t, r) => t + r.total, 0))}
            </text>
          )}
        </g>
        <AnimatePresence>
          {flight && flightGeo && (
            <motion.g key={flight.key} initial={{ x: flightGeo.xs[0], y: flightGeo.ys[0], opacity: 0 }}
              animate={{ x: flightGeo.xs, y: flightGeo.ys, opacity: [0, 1, 1, 1, 0.9] }} exit={{ opacity: 0 }}
              transition={{ duration: 1.6, ease: 'easeInOut' }}>
              <circle r="9" fill="var(--warn)" stroke="var(--surface)" strokeWidth="2" />
              <text y="4" textAnchor="middle" className="fill-[var(--surface)] text-[10px] font-bold">$</text>
              <text y="-16" textAnchor="middle" className="fill-[var(--ink)] text-[12px] font-bold">+{usd(flight.p.total)}</text>
            </motion.g>
          )}
        </AnimatePresence>
      </svg>
      <p className="mt-1 text-[11px] text-ink-3">Stylized map (dots generated in code). Payments run in the PayPal sandbox.</p>
    </section>
  );
}
