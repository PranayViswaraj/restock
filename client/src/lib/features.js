// Feature flags for the "wow" layer. Every one can be switched off without
// touching the core purchasing flow.
//
// Precedence: the viewer's choice (Settings panel, saved in localStorage)
//   > the server default (FEATURE_* env vars, sent in /api/config)
//   > the built-in default below.
import { useSyncExternalStore } from 'react';

export const FEATURES = [
  { key: 'storyMode', label: 'Story Mode', desc: 'Cinematic 60-second auto-play demo with captions and spotlight.', default: true },
  { key: 'brainView', label: 'Agent Brain view', desc: 'Live node graph: Scout → Guardian → Treasurer → PayPal lights up during a run.', default: true },
  { key: 'paymentRoutes', label: 'Global payment routes', desc: 'Dot-grid world with animated payment arcs from Austin to suppliers.', default: true },
  { key: 'scenarioLab', label: 'Scenario Lab', desc: 'Move sliders and watch the real Guardian code change its verdicts.', default: true },
  { key: 'mandateUpgrades', label: 'Mandate upgrades', desc: 'Version diff, English/JSON toggle and a signing ribbon.', default: true },
  { key: 'pwa', label: 'Installable app + alerts', desc: 'Offline app shell and browser notifications for approvals.', default: true },
  { key: 'landingCinema', label: 'Landing page cinema', desc: 'Gradient mesh, scroll reveals, tilt cards, magnetic button, live counters.', default: true },
  { key: 'microInteractions', label: 'Micro-interactions', desc: 'Button ripples, check draw-ins and phone haptics.', default: true },
  { key: 'explainToggle', label: 'Owner / Technical view', desc: 'Switch the Decision Trace between plain sentences and raw data.', default: true },
  { key: 'sound', label: 'UI sounds', desc: 'Tiny synthesized sounds for payments, blocks and approvals. Off by default.', default: false },
];

const STORAGE_KEY = 'restock-features';
const listeners = new Set();
let serverDefaults = {};
let overrides = {};
try { overrides = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch { overrides = {}; }

let snapshot = compute();
function compute() {
  return Object.fromEntries(FEATURES.map((f) => [f.key, f.key in overrides ? !!overrides[f.key] : f.key in serverDefaults ? !!serverDefaults[f.key] : f.default]));
}
function emit() {
  snapshot = compute();
  listeners.forEach((l) => l());
}

export function setServerDefaults(d) {
  if (!d || JSON.stringify(d) === JSON.stringify(serverDefaults)) return;
  serverDefaults = d;
  emit();
}

export function setFeature(key, on) {
  overrides = { ...overrides, [key]: !!on };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides)); } catch { /* storage unavailable */ }
  emit();
}

export function resetFeatures() {
  overrides = {};
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage unavailable */ }
  emit();
}

export const isOn = (key) => !!snapshot[key];

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
export function useFeatures() {
  return useSyncExternalStore(subscribe, () => snapshot);
}
export function useFeature(key) {
  return useFeatures()[key];
}
