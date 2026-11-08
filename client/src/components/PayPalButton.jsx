import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { post } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { usd } from '../lib/format.js';

// Load the PayPal JS SDK once. The client ID comes from GET /api/config — never the secret.
let sdkPromise = null;
function loadSdk(clientId) {
  if (window.paypal?.Buttons) return Promise.resolve(window.paypal);
  sdkPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons`;
    s.async = true;
    s.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error('PayPal SDK loaded without the paypal object')));
    s.onerror = () => { sdkPromise = null; reject(new Error('Could not load PayPal checkout (network or ad blocker).')); };
    document.head.appendChild(s);
  });
  return sdkPromise;
}

/**
 * Real PayPal Smart Button (sandbox) for an awaiting purchase:
 * createOrder -> POST /api/paypal/orders, onApprove -> POST /api/paypal/orders/:id/capture.
 * In mock mode a simulated button runs the same two API calls.
 */
export default function PayPalButton({ purchase, onPaid, onError }) {
  const { config } = useApp();
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const live = !!config?.paypalClientId;

  useEffect(() => {
    if (!live || !ref.current) return undefined;
    let buttons = null;
    let cancelled = false;
    loadSdk(config.paypalClientId)
      .then((paypal) => {
        if (cancelled || !ref.current) return undefined;
        buttons = paypal.Buttons({
          style: { layout: 'horizontal', color: 'gold', shape: 'pill', label: 'pay', height: 42, tagline: false },
          createOrder: async () => (await post('/api/paypal/orders', { purchaseId: purchase.id })).id,
          onApprove: async (data) => {
            try {
              const r = await post(`/api/paypal/orders/${data.orderID}/capture`);
              onPaid?.(r.purchase);
            } catch (err) {
              onError?.(err.message);
            }
          },
          onCancel: () => onError?.('PayPal window closed. Nothing was paid.'),
          onError: (err) => onError?.(`PayPal error: ${err?.message || err}`),
        });
        ref.current.innerHTML = '';
        return buttons.render(ref.current);
      })
      .catch((err) => !cancelled && onError?.(err.message));
    return () => {
      cancelled = true;
      try { buttons?.close?.(); } catch { /* ignore */ }
    };
  }, [live, config?.paypalClientId, purchase.id, onPaid, onError]);

  if (live) return <div ref={ref} className="min-h-[42px] w-full max-w-[320px]" />;

  const simulate = async () => {
    setBusy(true);
    try {
      const order = await post('/api/paypal/orders', { purchaseId: purchase.id });
      const r = await post(`/api/paypal/orders/${order.id}/capture`);
      onPaid?.(r.purchase);
    } catch (err) {
      onError?.(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={simulate}
      disabled={busy}
      className="inline-flex h-[42px] w-full max-w-[320px] items-center justify-center gap-2 rounded-full bg-[#ffc439] px-5 text-sm font-bold text-[#111] shadow-sm transition hover:brightness-95 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      title="Mock mode: runs the same create + capture calls without opening PayPal"
    >
      {busy ? 'Approving…' : <>Pay {usd(purchase.total)} with <span className="italic text-[#003087]">Pay<span className="text-[#009cde]">Pal</span></span></>}
      <span className="rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold">simulated</span>
    </motion.button>
  );
}
