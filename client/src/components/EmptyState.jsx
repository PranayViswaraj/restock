import React from 'react';

/** Friendly empty state with a small illustration made of simple shapes. */
export default function EmptyState({ title, body, action, tone = 'accent' }) {
  const color = { accent: 'var(--accent)', ok: 'var(--ok)', guardian: 'var(--guardian)' }[tone] || 'var(--accent)';
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      <svg width="96" height="72" viewBox="0 0 96 72" aria-hidden="true">
        <rect x="14" y="18" width="52" height="40" rx="10" fill="var(--surface-2)" stroke="var(--line)" />
        <rect x="24" y="30" width="26" height="5" rx="2.5" fill="var(--line)" />
        <rect x="24" y="40" width="18" height="5" rx="2.5" fill="var(--line)" />
        <circle cx="68" cy="22" r="14" fill={color} opacity="0.14" />
        <circle cx="68" cy="22" r="7" fill={color} opacity="0.85" />
        <circle cx="80" cy="54" r="5" fill={color} opacity="0.35" />
      </svg>
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-xs text-xs text-ink-2">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
