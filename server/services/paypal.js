// PayPal REST API wrapper — SANDBOX ONLY.
//   - OAuth2 client-credentials token (cached until it expires)
//   - Payouts API  -> agent auto-pays suppliers (no human click)
//   - Orders v2    -> owner approves over-limit purchases in PayPal checkout
// Uses built-in fetch. Every call returns plain objects; errors are thrown as
// PayPalError with a readable message so callers can mark a purchase "failed".
//
// Mock mode (USE_MOCK_PAYPAL=true, or no credentials) returns fake IDs so the
// demo works offline.
import crypto from 'node:crypto';
import { flag } from '../env.js';

const BASE = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';

export class PayPalError extends Error {
  constructor(message, { status, name, details, debugId } = {}) {
    super(message);
    this.status = status;
    this.paypalName = name;
    this.details = details;
    this.debugId = debugId;
  }
}

export function isMock() {
  return flag('USE_MOCK_PAYPAL') || !process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET;
}

// Safety net: refuse to talk to anything but the sandbox.
if (!BASE.includes('sandbox')) {
  throw new Error('Restock is a hackathon demo: PAYPAL_API_BASE must be the PayPal sandbox.');
}

// ---------- OAuth token (cached) ----------
let cachedToken = null; // { value, expiresAt }

export async function getAccessToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new PayPalError(`PayPal login failed (${res.status}): ${body.error_description || body.error || 'check PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET'}`, { status: res.status });
  }
  // Refresh 60 seconds early to be safe.
  cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
  return cachedToken.value;
}

/** Small helper for authenticated JSON requests. */
async function api(method, path, body, { idempotencyKey } = {}) {
  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  if (idempotencyKey) headers['PayPal-Request-Id'] = idempotencyKey; // safe retries, no double payments
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const detail = data.details?.[0];
    const msg = [data.name, data.message, detail?.issue, detail?.description].filter(Boolean).join(' — ') || `HTTP ${res.status}`;
    throw new PayPalError(`PayPal ${method} ${path} failed (${res.status}): ${msg}`, {
      status: res.status, name: data.name, details: data.details, debugId: data.debug_id,
    });
  }
  return data;
}

const money = (n) => Number(n).toFixed(2);
const fakeId = (prefix) => `${prefix}-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;

// ---------- Payouts (auto-pay) ----------

/** True when an error means "Payouts isn't enabled on this sandbox account". */
export function isPayoutsNotEnabled(err) {
  return err instanceof PayPalError && (
    err.status === 403 ||
    ['AUTHORIZATION_ERROR', 'NOT_AUTHORIZED', 'PERMISSION_DENIED'].includes(err.paypalName)
  );
}

/**
 * Send money from the café's sandbox business account to a supplier's email.
 * @returns {{id:string, status:string, itemId?:string}}
 */
export async function createPayout({ receiverEmail, amount, currency = 'USD', note, referenceId }) {
  if (isMock()) {
    return { id: fakeId('MOCK-PAYOUT'), status: 'SUCCESS', mock: true };
  }
  const data = await api('POST', '/v1/payments/payouts', {
    sender_batch_header: {
      sender_batch_id: `restock-${referenceId}`,
      email_subject: "You have a payment from Pranay's Café (via Restock)",
      email_message: note?.slice(0, 1000) || 'Supply order payment',
    },
    items: [{
      recipient_type: 'EMAIL',
      amount: { value: money(amount), currency },
      receiver: receiverEmail,
      note: note?.slice(0, 4000),
      sender_item_id: referenceId,
    }],
  }, { idempotencyKey: `payout-${referenceId}` });
  return {
    id: data.batch_header?.payout_batch_id,
    status: data.batch_header?.batch_status || 'PENDING',
    senderBatchId: data.batch_header?.sender_batch_header?.sender_batch_id,
  };
}

/** Look up a payout batch status (PENDING -> SUCCESS usually takes a few seconds in sandbox). */
export async function getPayoutStatus(batchId) {
  if (isMock()) return { id: batchId, status: 'SUCCESS' };
  const data = await api('GET', `/v1/payments/payouts/${encodeURIComponent(batchId)}`);
  const item = data.items?.[0];
  return {
    id: batchId,
    status: data.batch_header?.batch_status,
    itemStatus: item?.transaction_status,
    itemId: item?.payout_item_id,
    transactionId: item?.transaction_id,
    fee: item?.payout_item_fee?.value,
    errors: item?.errors?.message,
  };
}

// ---------- Orders v2 (owner approval) ----------

/** Create a checkout order for an over-limit purchase. The owner approves it with the PayPal button. */
export async function createOrder({ amount, currency = 'USD', description, referenceId }) {
  if (isMock()) {
    return { id: fakeId('MOCK-ORDER'), status: 'CREATED', mock: true };
  }
  const unit = {
    reference_id: referenceId,
    description: description?.slice(0, 127),
    amount: { currency_code: currency, value: money(amount) },
  };
  // Optional: pay a specific sandbox merchant. If unset, the app's own sandbox
  // business account receives the funds (see README "Decisions").
  if (process.env.PAYPAL_ORDER_PAYEE_EMAIL) unit.payee = { email_address: process.env.PAYPAL_ORDER_PAYEE_EMAIL };

  const data = await api('POST', '/v2/checkout/orders', {
    intent: 'CAPTURE',
    purchase_units: [unit],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "Pranay's Café · Restock",
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
        },
      },
    },
  }, { idempotencyKey: `order-${referenceId}-${Date.now()}` });
  return { id: data.id, status: data.status };
}

/** Capture an approved order — this is the moment the money actually moves. */
export async function captureOrder(orderId) {
  if (isMock()) {
    return { id: orderId, status: 'COMPLETED', captureId: fakeId('MOCK-CAPTURE'), mock: true };
  }
  const data = await api('POST', `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, undefined, {
    idempotencyKey: `capture-${orderId}`,
  });
  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  return {
    id: data.id,
    status: data.status,
    captureId: capture?.id,
    captureStatus: capture?.status,
    payerId: data.payer?.payer_id,
    sellerReceivable: capture?.seller_receivable_breakdown?.net_amount?.value,
  };
}

// ---------- Transaction Search (optional sales input) ----------

/**
 * List the café account's transactions (GET /v1/reporting/transactions).
 * Needs the "Transaction search" feature on the REST app; data can lag ~3 hours.
 * @returns {Promise<object[]>} transaction_details[]
 */
export async function searchTransactions({ start, end, maxPages = 5 }) {
  if (isMock()) return [];
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const qs = new URLSearchParams({
      start_date: start.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      end_date: end.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      fields: 'transaction_info,cart_info',
      page_size: '500',
      page: String(page),
    });
    const data = await api('GET', `/v1/reporting/transactions?${qs}`);
    out.push(...(data.transaction_details || []));
    if (!data.total_pages || page >= data.total_pages) break;
  }
  return out;
}

// ---------- Webhooks (optional) ----------

/**
 * Ask PayPal to verify a webhook's signature (POST /v1/notifications/verify-webhook-signature).
 * Requires PAYPAL_WEBHOOK_ID (from the developer dashboard, Webhooks section of your app).
 * @returns {Promise<boolean>}
 */
export async function verifyWebhookSignature(headers, event) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId || isMock()) return false;
  const data = await api('POST', '/v1/notifications/verify-webhook-signature', {
    auth_algo: headers['paypal-auth-algo'],
    cert_url: headers['paypal-cert-url'],
    transmission_id: headers['paypal-transmission-id'],
    transmission_sig: headers['paypal-transmission-sig'],
    transmission_time: headers['paypal-transmission-time'],
    webhook_id: webhookId,
    webhook_event: event,
  });
  return data.verification_status === 'SUCCESS';
}
