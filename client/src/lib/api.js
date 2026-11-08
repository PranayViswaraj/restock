// Tiny fetch helper: JSON in, JSON out, readable errors ({ error: { code, message, details } }).
export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the Restock server. Is it running?', { status: 0, code: 'NETWORK' });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data.error || {};
    throw new ApiError(e.message || `Request failed (${res.status})`, { status: res.status, code: e.code, details: e.details });
  }
  return data;
}

export const post = (path, body) => api(path, { method: 'POST', body: body || {} });
