// Tiny in-memory rate limiter (no dependency). Protects the free AI quota and the
// PayPal sandbox from abuse while the public demo link is open for judging.
//
//   rateLimit({ name, windowMs, max, globalMax }) -> Express middleware
//
// Per-IP limit plus an optional global limit across all visitors. Single
// instance only (that's all the free Render plan runs), so memory is enough.

/** Pure core, exported for tests: returns { ok, retryAfterSec }. */
export function createLimiter({ windowMs, max, globalMax = Infinity, now = () => Date.now() }) {
  const hits = new Map(); // key -> { count, resetAt }
  let global = { count: 0, resetAt: 0 };

  function take(key) {
    const t = now();
    if (t >= global.resetAt) global = { count: 0, resetAt: t + windowMs };
    let h = hits.get(key);
    if (!h || t >= h.resetAt) { h = { count: 0, resetAt: t + windowMs }; hits.set(key, h); }
    if (h.count >= max) return { ok: false, retryAfterSec: Math.ceil((h.resetAt - t) / 1000), scope: 'you' };
    if (global.count >= globalMax) return { ok: false, retryAfterSec: Math.ceil((global.resetAt - t) / 1000), scope: 'everyone' };
    h.count++;
    global.count++;
    if (hits.size > 5000) { // prune old keys
      for (const [k, v] of hits) if (t >= v.resetAt) hits.delete(k);
    }
    return { ok: true };
  }
  return { take };
}

export function rateLimit({ name, windowMs, max, globalMax }) {
  const limiter = createLimiter({ windowMs, max, globalMax });
  return (req, res, next) => {
    const r = limiter.take(req.ip || 'unknown');
    if (r.ok) return next();
    res.set('Retry-After', String(r.retryAfterSec));
    const mins = Math.max(1, Math.round(r.retryAfterSec / 60));
    return res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: r.scope === 'you'
          ? `Easy there! ${name} is limited to protect the free AI and PayPal sandbox quotas. Try again in about ${mins} min.`
          : `Lots of people are trying ${name} right now. Try again in about ${mins} min.`,
      },
    });
  };
}
