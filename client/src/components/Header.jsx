import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, Signature, FlaskConical, Store, BookLock, Menu, X, Command, Microscope, Settings, Volume2, VolumeX } from 'lucide-react';
import { useFeatures, setFeature } from '../lib/features.js';
import { Link } from '../lib/router.jsx';
import StatusPills from './StatusPills.jsx';
import KillSwitch from './KillSwitch.jsx';
import ThemeToggle from './ThemeToggle.jsx';

export const NAV = [
  { to: '/app', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/mandate', label: 'Mandate', Icon: Signature },
  { to: '/simulate', label: 'Simulate', Icon: FlaskConical },
  { to: '/suppliers', label: 'Suppliers', Icon: Store },
  { to: '/ledger', label: 'Ledger', Icon: BookLock },
  { to: '/lab', label: 'Lab', Icon: Microscope, flag: 'scenarioLab' },
];

export function Logo({ size = 32 }) {
  return <img src="/favicon.svg" width={size} height={size} alt="" className="shrink-0" />;
}

/** Glassy sticky header: brand, nav, live service pills, kill switch, theme. */
export default function Header({ path, theme, onToggleTheme, onOpenPalette, onOpenSettings }) {
  const [open, setOpen] = useState(false);
  const flags = useFeatures();
  const nav = NAV.filter((n) => !n.flag || flags[n.flag]);
  return (
    <header className="glass sticky top-0 z-40 border-b border-line no-print">
      <div className="mx-auto flex max-w-[1360px] items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-accent" aria-label="Restock home">
          <Logo />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[15px] font-bold tracking-tight">Restock</div>
            <div className="truncate text-[11px] text-ink-2">Pranay's Café · Austin 🇺🇸</div>
          </div>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Main">
          {nav.map(({ to, label, Icon }) => {
            const active = path === to;
            return (
              <Link key={to} to={to} aria-current={active ? 'page' : undefined}
                className={`relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${active ? 'text-ink' : 'text-ink-2 hover:text-ink'}`}>
                {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-lg bg-surface-2" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                <Icon size={15} className="relative" aria-hidden="true" />
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <StatusPills className="hidden xl:flex xl:flex-nowrap" />
          <button className="btn btn-sm hidden gap-1.5 md:inline-flex" onClick={onOpenPalette} aria-label="Open command palette">
            <Command size={14} aria-hidden="true" /> <span className="kbd hidden 2xl:inline">Ctrl K</span>
          </button>
          <button className="btn btn-sm hidden h-9 w-9 px-0 sm:inline-flex" onClick={() => setFeature('sound', !flags.sound)} aria-pressed={!!flags.sound}
            aria-label={flags.sound ? 'Mute UI sounds' : 'Turn on UI sounds'} title={flags.sound ? 'Sounds on' : 'Sounds off'}>
            {flags.sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <button className="btn btn-sm h-9 w-9 px-0" onClick={onOpenSettings} aria-label="Open settings" title="Settings"><Settings size={15} /></button>
          <KillSwitch compact />
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button className="btn btn-sm h-9 w-9 px-0 lg:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Menu">
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-line lg:hidden"
            aria-label="Mobile"
          >
            <div className="grid gap-1 px-4 py-3">
              {nav.map(({ to, label, Icon }) => (
                <Link key={to} to={to} onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${path === to ? 'bg-surface-2 text-ink' : 'text-ink-2'}`}>
                  <Icon size={16} aria-hidden="true" /> {label}
                </Link>
              ))}
              <StatusPills className="mt-2" />
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
