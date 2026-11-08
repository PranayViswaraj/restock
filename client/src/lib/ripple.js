// Material-style ripple on every .btn (transform + opacity only, ~450ms).
// One delegated listener for the whole app; respects reduced motion and the
// "Micro-interactions" feature flag.
import { isOn } from './features.js';

export function installRipple() {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  document.addEventListener('pointerdown', (e) => {
    if (!isOn('microInteractions') || reduce?.matches || e.button !== 0) return;
    const btn = e.target.closest?.('.btn');
    if (!btn || btn.disabled) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const dot = document.createElement('span');
    dot.className = 'ripple';
    dot.style.width = dot.style.height = `${size}px`;
    dot.style.left = `${e.clientX - rect.left - size / 2}px`;
    dot.style.top = `${e.clientY - rect.top - size / 2}px`;
    btn.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove(), { once: true });
    setTimeout(() => dot.remove(), 900); // safety net
  }, { passive: true });
}
