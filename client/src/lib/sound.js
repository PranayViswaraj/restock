// Tiny UI sounds synthesized with the Web Audio API (no audio files).
// Off by default; switched on in Settings or with the speaker button.
import { isOn } from './features.js';

let ctx = null;
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(ac, { freq, start = 0, dur = 0.14, type = 'sine', gain = 0.06, slideTo }) {
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const SOUNDS = {
  // bright two-note "coin"
  payment: (ac) => { tone(ac, { freq: 988, dur: 0.09 }); tone(ac, { freq: 1319, start: 0.08, dur: 0.22 }); },
  // low, short "thud" for a Guardian block
  block: (ac) => { tone(ac, { freq: 220, dur: 0.22, type: 'triangle', gain: 0.08, slideTo: 110 }); },
  // rising three-note chime for an owner approval
  approve: (ac) => { [659, 831, 988].forEach((f, i) => tone(ac, { freq: f, start: i * 0.07, dur: 0.18, gain: 0.05 })); },
};

export function playSound(name) {
  if (!isOn('sound')) return;
  try {
    const ac = audio();
    if (ac && SOUNDS[name]) SOUNDS[name](ac);
  } catch { /* sound is optional */ }
}
