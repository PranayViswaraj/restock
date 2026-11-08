// App-wide data + UI state, kept live by the SSE stream.
// WHY one provider: every page shows the same purchases/cash/status, and SSE
// events (payment made, purchase blocked, agent paused) must update all of them at once.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import { useSSE } from './sse.js';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

const ENDPOINTS = {
  config: '/api/config',
  status: '/api/status',
  purchases: '/api/purchases',
  inventory: '/api/inventory',
  cash: '/api/cash',
  kpis: '/api/kpis',
  mandate: '/api/mandate',
};

let confettiModule = null;
export async function celebrate(kind = 'small') {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  confettiModule ||= (await import('canvas-confetti')).default;
  confettiModule({
    particleCount: kind === 'big' ? 90 : 45,
    spread: kind === 'big' ? 80 : 60,
    startVelocity: 32,
    origin: { y: 0.75 },
    scalar: 0.8,
    ticks: 140,
    colors: ['#6366f1', '#34d399', '#fbbf24', '#a78bfa'],
  });
}

export function AppProvider({ children }) {
  const [data, setData] = useState({});
  const [loaded, setLoaded] = useState({});
  const [error, setError] = useState('');
  const [steps, setSteps] = useState([]);
  const [connected, setConnected] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [shield, setShield] = useState(null);
  const [arcs, setArcs] = useState([]);
  const [drawerId, setDrawerId] = useState(null);
  const savedMilestone = useRef(0);

  const toast = useCallback((message, kind = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-3), { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  // Stable callbacks: overlays use them in effect deps, so they must not change on
  // every live update (otherwise their auto-dismiss timers keep restarting).
  const clearShield = useCallback(() => setShield(null), []);
  const nextArc = useCallback(() => setArcs((a) => a.slice(1)), []);

  const refresh = useCallback(async (keys = Object.keys(ENDPOINTS)) => {
    const results = await Promise.allSettled(keys.map((k) => api(ENDPOINTS[k])));
    const next = {};
    let firstError = '';
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') next[keys[i]] = r.value;
      else firstError ||= r.reason.message;
    });
    setData((d) => ({ ...d, ...next }));
    setLoaded((l) => ({ ...l, ...Object.fromEntries(Object.keys(next).map((k) => [k, true])) }));
    setError(firstError);
  }, []);

  // First load: wait for the server to answer /api/health before loading data.
  // On free hosting a sleeping server takes 30-60s to wake; after 2.5s we show a
  // friendly "waking up" screen instead of a wall of errors, and keep retrying.
  const [waking, setWaking] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const slow = setTimeout(() => !cancelled && setWaking(true), 2500);
    (async () => {
      const started = Date.now();
      while (!cancelled) {
        try { await api('/api/health'); break; } catch {
          if (Date.now() - started > 150000) break; // give up waiting; show normal errors
          if (!cancelled) setWaking(true);
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
      clearTimeout(slow);
      if (!cancelled) { setWaking(false); refresh(); }
    })();
    return () => { cancelled = true; clearTimeout(slow); };
  }, [refresh]);

  // Debounced refresh of derived data after bursts of purchase events.
  const pending = useRef(null);
  const refreshDerived = useCallback(() => {
    clearTimeout(pending.current);
    pending.current = setTimeout(() => refresh(['kpis', 'inventory', 'cash', 'status']), 250);
  }, [refresh]);

  useSSE((msg) => {
    if (msg.kind === 'conn') return setConnected(msg.connected);
    if (msg.kind === 'hello') {
      setConnected(true);
      setSteps(msg.steps || []);
      setData((d) => ({ ...d, status: { ...(d.status || {}), running: msg.running, paused: msg.paused } }));
      return undefined;
    }
    if (msg.kind === 'step') {
      setSteps((prev) => (msg.step.type === 'start' ? [msg.step] : [...prev, msg.step]));
      return undefined;
    }
    const e = msg.event;
    switch (e.type) {
      case 'purchase': {
        setData((d) => {
          const list = d.purchases ? [...d.purchases] : [];
          const i = list.findIndex((p) => p.id === e.purchase.id);
          if (i >= 0) list[i] = e.purchase; else list.push(e.purchase);
          return { ...d, purchases: list };
        });
        refreshDerived();
        break;
      }
      case 'blocked':
        setShield({ headline: e.headline, purchase: e.purchase });
        break;
      case 'payment': {
        setArcs((a) => [...a, { ...e, key: e.purchaseId + e.ts }]);
        toast(`Paid ${'$' + e.total.toFixed(2)} to ${e.flag} ${e.supplierName}${e.savedVsLocal ? ` · saved $${e.savedVsLocal.toFixed(2)} vs local` : ''}`, 'success');
        break;
      }
      case 'state':
        setData((d) => ({ ...d, status: { ...(d.status || {}), paused: e.paused } }));
        toast(e.paused ? 'Agent paused. No payments will be made.' : 'Agent resumed.', e.paused ? 'warn' : 'info');
        break;
      case 'run':
        setData((d) => ({ ...d, status: { ...(d.status || {}), running: e.running } }));
        if (!e.running) refreshDerived();
        break;
      case 'mandate':
        setData((d) => ({ ...d, mandate: e.mandate }));
        refresh(['status']);
        break;
      case 'cash':
        refresh(['cash', 'kpis']);
        break;
      case 'reset':
        setSteps([]);
        savedMilestone.current = 0;
        refresh();
        break;
      case 'toast':
        toast(e.message, e.kind);
        if (e.kind === 'success') celebrate('small');
        break;
      default:
    }
    return undefined;
  });

  // Confetti for savings milestones (every $25 saved), small and brief.
  useEffect(() => {
    const saved = (data.kpis || []).find((k) => k.key === 'crossBorderSavings')?.value || 0;
    const milestone = Math.floor(saved / 25);
    if (savedMilestone.current && milestone > savedMilestone.current) {
      celebrate('small');
      toast(`Savings milestone: $${(milestone * 25).toFixed(0)}+ saved cross-border`, 'success');
    }
    savedMilestone.current = Math.max(savedMilestone.current, milestone) || milestone;
  }, [data.kpis, toast]);

  const value = useMemo(() => ({
    ...data,
    loaded, error, steps, connected, toasts, shield, arcs, drawerId, waking,
    refresh, toast, dismissToast, clearShield, nextArc,
    openTrace: setDrawerId,
  }), [data, loaded, error, steps, connected, toasts, shield, arcs, drawerId, waking, refresh, toast, dismissToast, clearShield, nextArc]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
