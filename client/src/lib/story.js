// Tiny global switch for Story Mode, so the landing page, the command palette
// and the dashboard can all start it.
import { useSyncExternalStore } from 'react';

let state = { active: false, runKey: 0 };
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export function startStory() { state = { active: true, runKey: state.runKey + 1 }; emit(); }
export function stopStory() { state = { ...state, active: false }; emit(); }
export function useStory() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}
