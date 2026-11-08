import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, RotateCcw } from 'lucide-react';
import { FEATURES, useFeatures, setFeature, resetFeatures } from '../lib/features.js';
import { spring } from '../lib/motion.js';

function Switch({ id, on, onChange, label }) {
  return (
    <button
      id={id} type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${on ? 'bg-accent' : 'bg-line'}`}
    >
      <motion.span layout transition={spring} className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow" style={{ left: on ? 22 : 2 }} />
    </button>
  );
}

/** Settings: every optional "wow" feature has an on/off switch (saved in this browser). */
export default function SettingsPanel({ open, onClose }) {
  const flags = useFeatures();
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    setTimeout(() => closeRef.current?.focus(), 40);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[66] flex items-start justify-center bg-black/40 px-4 pt-[8vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            role="dialog" aria-modal="true" aria-labelledby="settings-title"
            className="max-h-[84vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-5"
            style={{ boxShadow: 'var(--shadow-lg)' }}
            initial={{ y: -12, scale: 0.98 }} animate={{ y: 0, scale: 1, transition: spring }} exit={{ y: -8, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="settings-title" className="text-lg font-bold tracking-tight">Settings</h2>
                <p className="text-xs text-ink-2">Optional features. The purchasing flow, Guardian and PayPal work the same with all of them off.</p>
              </div>
              <button ref={closeRef} className="btn btn-sm h-9 w-9 px-0" onClick={onClose} aria-label="Close settings"><X size={16} /></button>
            </div>
            <ul className="mt-4 divide-y divide-line">
              {FEATURES.map((f) => (
                <li key={f.key} className="flex items-center justify-between gap-4 py-3">
                  <label htmlFor={`ff-${f.key}`} className="min-w-0 cursor-pointer">
                    <span className="block text-sm font-semibold">{f.label}</span>
                    <span className="block text-xs text-ink-2">{f.desc}</span>
                  </label>
                  <Switch id={`ff-${f.key}`} on={!!flags[f.key]} onChange={(v) => setFeature(f.key, v)} label={f.label} />
                </li>
              ))}
            </ul>
            <button className="btn btn-sm mt-3" onClick={resetFeatures}><RotateCcw size={14} aria-hidden="true" /> Reset to defaults</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
