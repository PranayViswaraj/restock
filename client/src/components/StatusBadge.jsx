import React from 'react';
import { CircleCheck, Clock, Ban, CircleX, Timer, Loader } from 'lucide-react';
import { STATUS } from '../lib/format.js';

export const TONE = {
  ok: 'bg-ok-soft text-ok',
  info: 'bg-info-soft text-info',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  owner: 'bg-owner-soft text-owner',
  muted: 'bg-surface-2 text-ink-2',
};
const ICON = { ok: CircleCheck, info: CircleCheck, warn: Clock, bad: Ban, owner: Timer, muted: CircleX };

/** Colored status pill. Always icon + text, never color alone. */
export default function StatusBadge({ status }) {
  const s = STATUS[status] || { tone: 'muted', label: status };
  const Icon = status === 'approved-auto' ? Loader : ICON[s.tone];
  return (
    <span className={`badge ${TONE[s.tone]}`}>
      <Icon size={12} strokeWidth={2.5} aria-hidden="true" />
      {s.label}
    </span>
  );
}
