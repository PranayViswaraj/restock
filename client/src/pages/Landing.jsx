import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Radar, ShieldCheck, Landmark, Power, BookLock, Signature, Clapperboard } from 'lucide-react';
import { Link, navigate } from '../lib/router.jsx';
import { post } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { fadeUp, stagger } from '../lib/motion.js';
import RoleDiagram from '../components/RoleDiagram.jsx';
import { Logo } from '../components/Header.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

const VALUES = [
  { Icon: Radar, title: 'Decide', role: 'Scout · AI', cls: 'text-scout bg-scout-soft', body: 'Reads 30 days of sales, spots the cold-coffee spike, forecasts days of stock left, and compares local and international suppliers.' },
  { Icon: ShieldCheck, title: 'Guard', role: 'Guardian · Code', cls: 'text-guardian bg-guardian-soft', body: 'Checks every proposal against your signed mandate: limits, price anomalies, new suppliers, cash buffer. The AI cannot talk its way past it.' },
  { Icon: Landmark, title: 'Pay', role: 'Treasurer · PayPal', cls: 'text-treasurer bg-treasurer-soft', body: 'Pays suppliers worldwide through PayPal: Payouts for auto-pay, Orders v2 checkout for your one-tap approvals.' },
];

const TRUST = [
  { Icon: Signature, text: 'Signed money mandate (SHA-256, versioned)' },
  { Icon: Power, text: 'Kill switch stops every payment instantly' },
  { Icon: BookLock, text: 'Tamper-evident, hash-chained audit ledger' },
];

export default function Landing({ theme, onToggleTheme }) {
  const { toast } = useApp();
  const demo = async () => {
    navigate('/app');
    try { await post('/api/demo/run'); } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* animated gradient background */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="animated-gradient absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full opacity-30 blur-3xl" style={{ background: 'radial-gradient(circle, var(--accent-2), transparent 70%)' }} />
        <div className="animated-gradient absolute -right-32 top-40 h-[480px] w-[480px] rounded-full opacity-25 blur-3xl" style={{ background: 'radial-gradient(circle, var(--scout), transparent 70%)', animationDelay: '-6s' }} />
        <div className="animated-gradient absolute bottom-0 left-1/3 h-[420px] w-[420px] rounded-full opacity-20 blur-3xl" style={{ background: 'radial-gradient(circle, var(--treasurer), transparent 70%)', animationDelay: '-11s' }} />
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5"><Logo /> <span className="text-lg font-bold tracking-tight">Restock</span></div>
        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <Link to="/app" className="btn">Open app</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20">
        <motion.section variants={stagger(0.09)} initial="hidden" animate="show" className="pt-10 text-center sm:pt-16">
          <motion.p variants={fadeUp} className="mx-auto inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink-2">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" /> PayPal AI Hackathon · agentic commerce
          </motion.p>
          <motion.h1 variants={fadeUp} className="mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            The trust layer for{' '}
            <span className="bg-gradient-to-r from-accent via-scout to-treasurer bg-clip-text text-transparent">agentic commerce</span>.
          </motion.h1>
          <motion.p variants={fadeUp} className="mx-auto mt-5 max-w-2xl text-base text-ink-2 sm:text-lg">
            AI agents will soon spend money for businesses, but no owner trusts an AI with their money yet. Restock decides what to buy,
            guards every dollar with rules enforced in code, and pays suppliers worldwide through PayPal.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/app" className="btn btn-primary btn-lg">Open Pranay's Café <ArrowRight size={18} aria-hidden="true" /></Link>
            <button className="btn btn-lg" onClick={demo}><Clapperboard size={18} aria-hidden="true" /> Watch Demo mode</button>
          </motion.div>
          <motion.p variants={fadeUp} className="mt-4 text-sm font-semibold tracking-tight text-ink">
            The AI decides. The code guards the money. PayPal moves it.
          </motion.p>
        </motion.section>

        <section className="mt-16" aria-label="How Restock works">
          <RoleDiagram />
        </section>

        <motion.section variants={stagger(0.1)} initial="hidden" whileInView="show" viewport={{ once: true }} className="mt-16 grid gap-4 md:grid-cols-3">
          {VALUES.map((v) => (
            <motion.article key={v.title} variants={fadeUp} className="card hover-lift">
              <span className={`grid h-11 w-11 place-items-center rounded-xl ${v.cls}`}><v.Icon size={22} aria-hidden="true" /></span>
              <h2 className="mt-4 text-xl font-bold tracking-tight">{v.title}</h2>
              <p className="text-xs font-semibold text-ink-3">{v.role}</p>
              <p className="mt-2 text-sm text-ink-2">{v.body}</p>
            </motion.article>
          ))}
        </motion.section>

        <section className="mt-10 grid gap-3 sm:grid-cols-3" aria-label="Trust and safety">
          {TRUST.map((t) => (
            <div key={t.text} className="flex items-center gap-3 rounded-2xl border border-line bg-surface/70 px-4 py-3 text-sm">
              <t.Icon size={18} className="shrink-0 text-accent" aria-hidden="true" /> {t.text}
            </div>
          ))}
        </section>

        <p className="mt-14 text-center text-xs text-ink-3">
          Demo business: Pranay's Café, Austin, Texas. Sales are seeded demo data; payments run in the PayPal sandbox. No real money moves.
        </p>
      </main>
    </div>
  );
}
