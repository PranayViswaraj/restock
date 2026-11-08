import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Play, Clapperboard, Power, RotateCcw, Sun, LayoutDashboard, Signature, FlaskConical, Store, BookLock, Home, Compass, Film, Microscope, Settings } from 'lucide-react';
import { useFeatures } from '../lib/features.js';
import { startStory } from '../lib/story.js';
import { navigate } from '../lib/router.jsx';
import { post } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { spring } from '../lib/motion.js';

/** Ctrl/Cmd+K: run agent, pause, reset, open pages, toggle theme. */
export default function CommandPalette({ open, onClose, onToggleTheme, onStartTour, onOpenSettings }) {
  const { status, toast } = useApp();
  const flags = useFeatures();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const inputRef = useRef(null);

  const run = (fn, msg) => async () => {
    try {
      await fn();
      if (msg) toast(msg, 'info');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const commands = useMemo(() => [
    ...(flags.storyMode ? [{ label: 'Play Story Mode (1 min)', Icon: Film, action: startStory, hint: 'Demo' }] : []),
    { label: 'Run agent', Icon: Play, action: run(() => post('/api/agent/run')), hint: 'Agent' },
    { label: 'Run Demo mode (reset + scripted story)', Icon: Clapperboard, action: run(async () => { navigate('/app'); await post('/api/demo/run'); }), hint: 'Agent' },
    { label: status?.paused ? 'Resume agent' : 'Pause agent (kill switch)', Icon: Power, action: run(() => post(status?.paused ? '/api/agent/resume' : '/api/agent/pause')), hint: 'Safety' },
    { label: 'Reset demo data', Icon: RotateCcw, action: run(() => post('/api/demo/reset'), 'Demo data reset.'), hint: 'Demo' },
    { label: 'Toggle theme', Icon: Sun, action: onToggleTheme, hint: 'View' },
    { label: 'Start guided tour', Icon: Compass, action: () => { navigate('/app'); setTimeout(onStartTour, 300); }, hint: 'Help' },
    { label: 'Go to Landing', Icon: Home, action: () => navigate('/'), hint: 'Page' },
    { label: 'Go to Dashboard', Icon: LayoutDashboard, action: () => navigate('/app'), hint: 'Page' },
    { label: 'Go to Money mandate', Icon: Signature, action: () => navigate('/mandate'), hint: 'Page' },
    { label: 'Go to 30-day simulation', Icon: FlaskConical, action: () => navigate('/simulate'), hint: 'Page' },
    { label: 'Go to Suppliers', Icon: Store, action: () => navigate('/suppliers'), hint: 'Page' },
    { label: 'Go to Ledger', Icon: BookLock, action: () => navigate('/ledger'), hint: 'Page' },
    ...(flags.scenarioLab ? [{ label: 'Go to Scenario Lab', Icon: Microscope, action: () => navigate('/lab'), hint: 'Page' }] : []),
    { label: 'Open settings (feature switches)', Icon: Settings, action: onOpenSettings, hint: 'View' },
  ], [status?.paused, onToggleTheme, onStartTour, onOpenSettings, flags.storyMode, flags.scenarioLab]); // `run`/`toast` are stable enough for a palette

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));

  useEffect(() => {
    if (open) { setQ(''); setI(0); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  const choose = (c) => { onClose(); c?.action(); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(filtered.length - 1, x + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
    if (e.key === 'Enter') { e.preventDefault(); choose(filtered[i]); }
    if (e.key === 'Escape') onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[65] flex items-start justify-center bg-black/40 px-4 pt-[12vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            role="dialog" aria-modal="true" aria-label="Command palette"
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface"
            style={{ boxShadow: 'var(--shadow-lg)' }}
            initial={{ y: -12, scale: 0.98 }} animate={{ y: 0, scale: 1, transition: spring }} exit={{ y: -8, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Search size={16} className="text-ink-3" aria-hidden="true" />
              <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} onKeyDown={onKey}
                className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-ink-3" placeholder="Type a command…" aria-label="Search commands" />
              <span className="kbd">Esc</span>
            </div>
            <ul className="max-h-80 overflow-y-auto p-2" role="listbox">
              {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-3">No commands match.</li>}
              {filtered.map((c, idx) => (
                <li key={c.label} role="option" aria-selected={idx === i}>
                  <button onMouseEnter={() => setI(idx)} onClick={() => choose(c)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${idx === i ? 'bg-accent-soft text-ink' : 'text-ink-2'}`}>
                    <c.Icon size={16} aria-hidden="true" /> <span className="flex-1">{c.label}</span> <span className="text-[11px] text-ink-3">{c.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
