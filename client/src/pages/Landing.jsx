import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Radar, ShieldCheck, Landmark, Power, BookLock, Signature, Clapperboard, Clock, PackageX, Wallet, FlaskConical } from 'lucide-react';
import { Link, navigate } from '../lib/router.jsx';
import { post } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { fadeUp, stagger } from '../lib/motion.js';
import { useFeatures } from '../lib/features.js';
import { startStory } from '../lib/story.js';
import { formatKpi } from '../lib/format.js';
import RoleDiagram from '../components/RoleDiagram.jsx';
import NumberTicker from '../components/NumberTicker.jsx';
import { Logo } from '../components/Header.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { TiltCard, Magnetic, MeshBackground, RevealWords } from '../components/Cinema.jsx';

const VALUES = [
  { Icon: Radar, title: 'Decide', role: 'Scout · AI', cls: 'text-scout bg-scout-soft', body: 'Reads 30 days of sales, spots the cold-coffee spike, forecasts days of stock left, and compares local and international suppliers.' },
  { Icon: ShieldCheck, title: 'Guard', role: 'Guardian · Code', cls: 'text-guardian bg-guardian-soft', body: 'Checks every proposal against your signed mandate: limits, price anomalies, new suppliers, cash buffer. The AI cannot talk its way past it.' },
  { Icon: Landmark, title: 'Pay', role: 'Treasurer · PayPal', cls: 'text-treasurer bg-treasurer-soft', body: 'Pays suppliers worldwide through PayPal: Payouts for auto-pay, Orders v2 checkout for your one-tap approvals.' },
];

const PROBLEMS = [
  { Icon: Clock, title: 'Hours lost', body: 'Owners spend hours a week checking stock and reordering supplies by hand.' },
  { Icon: PackageX, title: 'Stockouts', body: 'Forget once and the cups run out mid-rush. Every empty shelf is a lost sale.' },
  { Icon: Wallet, title: 'No trust', body: 'AI could do the job, but no owner hands an AI their PayPal account. That is the real blocker.' },
];

const TRUST = [
  { Icon: Signature, text: 'Signed money mandate (SHA-256, versioned)' },
  { Icon: Power, text: 'Kill switch stops every payment instantly' },
  { Icon: BookLock, text: 'Tamper-evident, hash-chained audit ledger' },
];

const IMPACT_KEYS = ['stockoutsPrevented', 'crossBorderSavings', 'riskyBlocked', 'ruleViolations'];

export default function Landing({ theme, onToggleTheme }) {
  const { toast, kpis } = useApp();
  const flags = useFeatures();
  const cinema = flags.landingCinema;

  const demo = async () => {
    if (flags.storyMode) { startStory(); return; }
    navigate('/app');
    try { await post('/api/demo/run'); } catch (err) { toast(err.message, 'error'); }
  };
  const impact = IMPACT_KEYS.map((k) => (kpis || []).find((x) => x.key === k)).filter(Boolean);
  const Card = cinema ? TiltCard : motion.div;
  const Mag = cinema ? Magnetic : React.Fragment;

  return (
    <div className="relative min-h-screen overflow-hidden">
      {cinema ? <MeshBackground /> : (
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <div className="animated-gradient absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full opacity-30 blur-3xl" style={{ background: 'radial-gradient(circle, var(--accent-2), transparent 70%)' }} />
          <div className="animated-gradient absolute -right-32 top-40 h-[480px] w-[480px] rounded-full opacity-25 blur-3xl" style={{ background: 'radial-gradient(circle, var(--scout), transparent 70%)', animationDelay: '-6s' }} />
        </div>
      )}

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
            {cinema ? <RevealWords text="The trust layer for" delay={0.15} /> : 'The trust layer for'}{' '}
            <span className="bg-gradient-to-r from-accent via-scout to-treasurer bg-clip-text text-transparent">agentic commerce</span>.
          </motion.h1>
          <motion.p variants={fadeUp} className="mx-auto mt-5 max-w-2xl text-base text-ink-2 sm:text-lg">
            AI agents will soon spend money for businesses, but no owner trusts an AI with their money yet. Restock decides what to buy,
            guards every dollar with rules enforced in code, and pays suppliers worldwide through PayPal.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Mag>
              <button className="btn btn-primary btn-lg" onClick={demo}>
                <Clapperboard size={18} aria-hidden="true" /> {flags.storyMode ? 'Watch Restock work (1 min)' : 'Watch Demo mode'}
              </button>
            </Mag>
            <Link to="/app" className="btn btn-lg">Open Pranay's Café <ArrowRight size={18} aria-hidden="true" /></Link>
          </motion.div>
          <motion.p variants={fadeUp} className="mt-4 text-sm font-semibold tracking-tight text-ink">
            The AI decides. The code guards the money. PayPal moves it.
          </motion.p>
        </motion.section>

        {cinema && (
          <motion.section variants={stagger(0.1)} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} className="mt-20" aria-labelledby="problem-title">
            <motion.h2 variants={fadeUp} id="problem-title" className="text-center text-2xl font-bold tracking-tight sm:text-3xl">The problem</motion.h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {PROBLEMS.map((p) => (
                <motion.article key={p.title} variants={fadeUp} className="rounded-2xl border border-line bg-surface/70 p-5">
                  <p.Icon size={20} className="text-bad" aria-hidden="true" />
                  <h3 className="mt-3 font-bold">{p.title}</h3>
                  <p className="mt-1 text-sm text-ink-2">{p.body}</p>
                </motion.article>
              ))}
            </div>
          </motion.section>
        )}

        <section className="mt-16" aria-label="How Restock works">
          <RoleDiagram />
        </section>

        <motion.section variants={stagger(0.1)} initial="hidden" whileInView="show" viewport={{ once: true }} className="mt-16 grid gap-4 md:grid-cols-3">
          {VALUES.map((v) => (
            <motion.div key={v.title} variants={fadeUp}>
              <Card className="card hover-lift h-full">
                <span className={`grid h-11 w-11 place-items-center rounded-xl ${v.cls}`}><v.Icon size={22} aria-hidden="true" /></span>
                <h2 className="mt-4 text-xl font-bold tracking-tight">{v.title}</h2>
                <p className="text-xs font-semibold text-ink-3">{v.role}</p>
                <p className="mt-2 text-sm text-ink-2">{v.body}</p>
              </Card>
            </motion.div>
          ))}
        </motion.section>

        <motion.section variants={stagger(0.08)} initial="hidden" whileInView="show" viewport={{ once: true }} className="mt-10 grid gap-3 sm:grid-cols-3" aria-label="Trust and safety">
          {TRUST.map((t) => (
            <motion.div key={t.text} variants={fadeUp} className="flex items-center gap-3 rounded-2xl border border-line bg-surface/70 px-4 py-3 text-sm">
              <t.Icon size={18} className="shrink-0 text-accent" aria-hidden="true" /> {t.text}
            </motion.div>
          ))}
        </motion.section>

        {cinema && impact.length > 0 && (
          <motion.section variants={stagger(0.1)} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} className="mt-16" aria-labelledby="impact-title">
            <motion.h2 variants={fadeUp} id="impact-title" className="text-center text-2xl font-bold tracking-tight sm:text-3xl">Impact, live from this demo café</motion.h2>
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              {impact.map((k) => (
                <motion.div key={k.key} variants={fadeUp} className="card text-center">
                  <div className={`text-3xl font-bold tracking-tight ${k.mustBeZero ? 'text-ok' : ''}`}>
                    <NumberTicker value={Number(k.value) || 0} format={(n) => formatKpi(n, k.format)} duration={1.4} />
                  </div>
                  <div className="mt-1 text-xs text-ink-2">{k.label}</div>
                </motion.div>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-ink-3">Computed from the purchases in this demo (seeded data, PayPal sandbox).</p>
            <div className="mt-6 flex justify-center">
              <Link to="/lab" className="btn"><FlaskConical size={16} aria-hidden="true" /> Try to trick the Guardian</Link>
            </div>
          </motion.section>
        )}

        <p className="mt-14 text-center text-xs text-ink-3">
          Demo business: Pranay's Café, Austin, Texas. Sales are seeded demo data; payments run in the PayPal sandbox. No real money moves.
        </p>
      </main>
    </div>
  );
}
