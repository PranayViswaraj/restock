import React from 'react';
import { useApp } from '../lib/store.jsx';

/** Live service status: each external service shows Live or Mock (honesty rule). */
export default function StatusPills({ className = '' }) {
  const { config, connected } = useApp();
  const s = config?.services;
  const pills = [
    { label: 'AI', live: s?.llm.live, title: s?.llm.live ? `${s.llm.provider} · ${s.llm.model}` : 'Rule-based Scout (no LLM key)' },
    { label: 'PayPal', live: s?.paypal.live, title: s?.paypal.live ? 'PayPal sandbox' : 'Mock PayPal (no sandbox keys)', liveText: 'Sandbox' },
    { label: 'Channel3', live: s?.channel3.live, title: s?.channel3.live ? 'Channel3 API' : 'Mock catalog' },
  ];
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`} aria-label="Service status">
      {pills.map((p) => (
        <span key={p.label} title={p.title} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-2">
          <span className={`h-1.5 w-1.5 rounded-full ${!s ? 'bg-line' : p.live ? 'bg-ok' : 'bg-warn'}`} aria-hidden="true" />
          {p.label}
          <span className="font-semibold text-ink">{!s ? '…' : p.live ? p.liveText || 'Live' : 'Mock'}</span>
        </span>
      ))}
      <span className="sr-only">{connected ? 'Live updates connected' : 'Live updates reconnecting'}</span>
    </div>
  );
}
