// Shared look for Guardian verdicts (always icon + text, never color alone).
import { CircleCheck, Clock, Timer, Ban } from 'lucide-react';

export const VERDICT = {
  APPROVE_AUTO: { label: 'Auto-pay', short: 'Approve', cls: 'bg-ok-soft text-ok', color: 'var(--ok)', Icon: CircleCheck },
  NEEDS_APPROVAL: { label: 'Needs approval', short: 'Ask owner', cls: 'bg-warn-soft text-warn', color: 'var(--warn)', Icon: Clock },
  DELAY: { label: 'Delay (cash)', short: 'Delay', cls: 'bg-owner-soft text-owner', color: 'var(--owner)', Icon: Timer },
  BLOCK: { label: 'Blocked', short: 'Block', cls: 'bg-bad-soft text-bad', color: 'var(--bad)', Icon: Ban },
};
