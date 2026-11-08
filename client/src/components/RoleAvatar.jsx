import React from 'react';
import { Radar, ShieldCheck, Landmark, Signature, Bot } from 'lucide-react';

// Scout = violet (AI), Guardian = amber (code), Treasurer = emerald (code + PayPal).
export const ROLE_META = {
  scout: { name: 'Scout', kind: 'AI', Icon: Radar, cls: 'bg-scout-soft text-scout', ring: 'ring-scout/30' },
  guardian: { name: 'Guardian', kind: 'Code', Icon: ShieldCheck, cls: 'bg-guardian-soft text-guardian', ring: 'ring-guardian/30' },
  treasurer: { name: 'Treasurer', kind: 'Code + PayPal', Icon: Landmark, cls: 'bg-treasurer-soft text-treasurer', ring: 'ring-treasurer/30' },
  owner: { name: 'Pranay', kind: 'Owner', Icon: Signature, cls: 'bg-owner-soft text-owner', ring: 'ring-owner/30' },
  system: { name: 'System', kind: 'System', Icon: Bot, cls: 'bg-surface-2 text-ink-2', ring: 'ring-line' },
};

export default function RoleAvatar({ role = 'system', size = 32, className = '' }) {
  const m = ROLE_META[role] || ROLE_META.system;
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-xl ring-1 ${m.cls} ${m.ring} ${className}`}
      style={{ width: size, height: size }}
      title={`${m.name} (${m.kind})`}
      aria-label={m.name}
    >
      <m.Icon size={size * 0.5} strokeWidth={2.2} aria-hidden="true" />
    </span>
  );
}
