// One shared EventSource for the whole app. Components subscribe with useSSE().
// Message kinds: hello (snapshot + replay), step (agent timeline), app (data events), conn.
import { useEffect, useRef } from 'react';

const listeners = new Set();
let source = null;

function emit(msg) {
  listeners.forEach((fn) => {
    try {
      fn(msg);
    } catch (err) {
      console.error('[sse listener]', err);
    }
  });
}

function ensureSource() {
  if (source || typeof EventSource === 'undefined') return;
  source = new EventSource('/api/agent/stream');
  source.addEventListener('hello', (e) => emit({ kind: 'hello', ...JSON.parse(e.data) }));
  source.addEventListener('step', (e) => emit({ kind: 'step', step: JSON.parse(e.data) }));
  source.addEventListener('app', (e) => emit({ kind: 'app', event: JSON.parse(e.data) }));
  source.onopen = () => emit({ kind: 'conn', connected: true });
  source.onerror = () => emit({ kind: 'conn', connected: false }); // the browser reconnects by itself
}

export function subscribe(fn) {
  ensureSource();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Subscribe for the component's lifetime; the latest handler is always used. */
export function useSSE(handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => subscribe((m) => ref.current(m)), []);
}
