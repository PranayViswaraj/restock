import React from 'react';
import { ExternalLink } from 'lucide-react';
import { dateTime } from '../lib/format.js';

/** The PayPal IDs and statuses that prove a payment happened (Decision Trace + receipt). */
export function paypalRows(p) {
  const pp = p.paypal;
  if (!pp?.id) return [];
  const rows = pp.method === 'payout'
    ? [
      ['Method', `PayPal Payouts${p.international ? ' · cross-border' : ''}`],
      ['Payout batch ID', pp.id, true],
      ['Batch status', pp.status],
      pp.itemStatus && ['Item status', pp.itemStatus],
      pp.itemId && ['Payout item ID', pp.itemId, true],
      pp.transactionId && ['Transaction ID', pp.transactionId, true],
      pp.receiver && ['Paid to (sandbox)', `${pp.receiver}${pp.receiverSource ? ` · ${pp.receiverSource}` : ''}`],
    ]
    : [
      ['Method', 'PayPal Orders v2 · owner approved'],
      ['Order ID', pp.id, true],
      ['Order status', pp.status],
      pp.captureId && ['Capture ID', pp.captureId, true],
      pp.captureStatus && ['Capture status', pp.captureStatus],
    ];
  if (p.paidAt) rows.push(['Paid', dateTime(p.paidAt)]);
  return rows.filter(Boolean);
}

export default function PayPalProof({ p, compact = false }) {
  const rows = paypalRows(p);
  if (!rows.length) return null;
  const mock = !!p.paypal.mock || p.seeded;
  return (
    <div>
      <dl className={`grid gap-y-1.5 ${compact ? 'grid-cols-[150px_1fr] text-sm' : 'grid-cols-[130px_1fr] text-xs'}`}>
        {rows.map(([k, v, mono]) => (
          <React.Fragment key={k}>
            <dt className="text-ink-3">{k}</dt>
            <dd className={mono ? 'break-all font-mono' : 'break-words'}>{v}</dd>
          </React.Fragment>
        ))}
      </dl>
      <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-[11px] text-ink-2 no-print">
        {mock ? (
          <>{p.seeded ? 'Seeded demo history' : 'Mock PayPal ID (no sandbox keys set)'}: this ID is not in PayPal.</>
        ) : (
          <>
            <b className="text-ink">View in PayPal sandbox dashboard:</b> log in at{' '}
            <a className="link inline-flex items-center gap-0.5" href="https://www.sandbox.paypal.com/" target="_blank" rel="noreferrer">sandbox.paypal.com <ExternalLink size={11} aria-hidden="true" /></a>{' '}
            as the café&apos;s sandbox business account and open Activity, or check API calls in the{' '}
            <a className="link inline-flex items-center gap-0.5" href="https://developer.paypal.com/dashboard/" target="_blank" rel="noreferrer">developer dashboard <ExternalLink size={11} aria-hidden="true" /></a>.
          </>
        )}
      </p>
    </div>
  );
}
