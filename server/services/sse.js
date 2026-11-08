// Server-Sent Events hub. One stream (/api/agent/stream) carries:
//   - agent timeline steps (kind: 'step')   -> replayed to late joiners
//   - app events (kind: 'event')            -> e.g. purchase updated, paused, payment
// WHY SSE (not WebSockets): one-way server->browser, works through Render's proxy,
// auto-reconnects in the browser, zero dependencies.

const clients = new Set();
let runSteps = []; // steps of the latest agent run
let counter = 0;

export function addClient(res, snapshot = {}) {
  clients.add(res);
  send(res, 'hello', { ...snapshot, steps: runSteps });
  res.on('close', () => clients.delete(res));
}

function send(res, eventName, payload) {
  try {
    res.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
  } catch {
    clients.delete(res);
  }
}

function broadcast(eventName, payload) {
  for (const res of clients) send(res, eventName, payload);
}

export function resetRun() {
  runSteps = [];
}

/**
 * Agent timeline step.
 * role: scout | guardian | treasurer | system | owner
 * type: start | thinking | tool | result | verdict | paid | approval | delayed | blocked | error | summary | done
 */
export function step(role, type, message, data) {
  const s = { id: ++counter, ts: new Date().toISOString(), role, type, message, data };
  runSteps.push(s);
  broadcast('step', s);
  return s;
}

/** App-level event (no timeline entry). */
export function event(type, data = {}) {
  broadcast('app', { id: ++counter, ts: new Date().toISOString(), type, ...data });
}

export function clientCount() {
  return clients.size;
}
