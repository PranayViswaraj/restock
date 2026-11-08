import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookLock, ShieldCheck, ShieldX, Link2, Receipt } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { Link } from '../lib/router.jsx';
import { dateTime, shortHash, usd } from '../lib/format.js';
import { spring } from '../lib/motion.js';
import RoleAvatar from '../components/RoleAvatar.jsx';
import { SkeletonCard } from '../components/Skeleton.jsx';

const summarize = (d) => {
  if (!d) return '';
  return d.message || d.reason || d.summary || Object.entries(d).filter(([, v]) => typeof v !== 'object').slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(' · ');
};

/** Hash-chained audit log with an animated integrity check, plus receipts. */
export default function Ledger() {
  const { purchases } = useApp();
  const [entries, setEntries] = useState(null);
  const [checking, setChecking] = useState(-1);
  const [result, setResult] = useState(null);
  const listRef = useRef(null);

  const load = () => api('/api/audit').then(setEntries).catch(() => setEntries([]));
  useEffect(() => { load(); }, [purchases?.length]);

  const verify = async () => {
    setResult(null);
    const r = await api('/api/audit/verify');
    // Animate through the chain (oldest → newest), fast enough to feel like a scan.
    const total = entries.length;
    const step = Math.max(12, Math.min(60, 1800 / Math.max(1, total)));
    for (let i = total - 1; i >= 0; i--) {
      setChecking(i);
      listRef.current?.querySelector(`[data-idx="${i}"]`)?.scrollIntoView({ block: 'nearest' });
      await new Promise((res) => setTimeout(res, step));
    }
    setChecking(-1);
    setResult(r);
  };

  const receipts = (purchases || []).filter((p) => ['auto-paid', 'approved-paid'].includes(p.status)).slice().reverse();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><BookLock size={22} className="text-accent" aria-hidden="true" /> Ledger</h1>
          <p className="text-sm text-ink-2">Every action by Scout, Guardian, Treasurer and Pranay, in a tamper-evident SHA-256 hash chain.</p>
        </div>
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {result && (
              <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1, transition: spring }}
                className={`badge px-3 py-1.5 text-sm ${result.ok ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad'}`} role="status">
                {result.ok ? <ShieldCheck size={16} /> : <ShieldX size={16} />} {result.ok ? `Chain intact · ${result.checked} entries` : result.reason}
              </motion.span>
            )}
          </AnimatePresence>
          <button className="btn btn-primary" onClick={verify} disabled={!entries?.length || checking >= 0}>{checking >= 0 ? 'Verifying…' : 'Verify integrity'}</button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <section className="card p-0">
          {!entries ? <SkeletonCard lines={8} className="border-0 shadow-none" /> : (
            <ol ref={listRef} className="max-h-[640px] divide-y divide-line overflow-y-auto">
              {entries.map((e, i) => {
                const active = i === checking;
                const verified = checking >= 0 && i > checking;
                return (
                  <li key={e.seq} data-idx={i} className={`flex gap-3 px-5 py-3 transition-colors ${active ? 'bg-accent-soft' : ''}`}>
                    <RoleAvatar role={e.role} size={30} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 text-xs">
                        <span className="font-semibold">#{e.seq} {e.action}</span>
                        <span className="text-ink-3">{dateTime(e.timestamp)}</span>
                        {(verified || (result?.ok && checking < 0)) && <ShieldCheck size={13} className="text-ok" aria-label="verified" />}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-ink-2">{summarize(e.data)}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-1 font-mono text-[10.5px] text-ink-3">
                        <span title={e.prevHash}>{shortHash(e.prevHash)}</span> <Link2 size={10} aria-hidden="true" /> <span title={e.hash} className="text-ink-2">{shortHash(e.hash)}</span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="card h-fit">
          <h2 className="card-title flex items-center gap-2"><Receipt size={16} aria-hidden="true" /> Receipts</h2>
          <p className="card-sub">Printable, hash-stamped receipt for every payment.</p>
          <ul className="mt-3 max-h-[560px] space-y-1.5 overflow-y-auto">
            {receipts.map((p) => (
              <li key={p.id}>
                <Link to={`/receipt/${p.id}`} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs hover:bg-accent-soft">
                  <span className="truncate">{p.flag} {p.productName}</span><span className="shrink-0 font-semibold">{usd(p.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
