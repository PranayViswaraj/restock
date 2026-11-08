import React from 'react';
import { motion } from 'framer-motion';
import { Radar, ShieldCheck, Landmark } from 'lucide-react';

const NODES = [
  { key: 'scout', name: 'Scout', kind: 'AI', Icon: Radar, cls: 'bg-scout-soft text-scout ring-scout/30', line: 'Reads sales, forecasts, compares suppliers, proposes.' },
  { key: 'guardian', name: 'Guardian', kind: 'Code', Icon: ShieldCheck, cls: 'bg-guardian-soft text-guardian ring-guardian/30', line: '7 deterministic checks. Its verdict is final.' },
  { key: 'treasurer', name: 'Treasurer', kind: 'Code + PayPal', Icon: Landmark, cls: 'bg-treasurer-soft text-treasurer ring-treasurer/30', line: 'Protects cash, pays, records receipts.' },
];

function Connector({ delay }) {
  return (
    <div className="relative mx-1 hidden h-0.5 flex-1 overflow-hidden rounded bg-line md:block" aria-hidden="true">
      <motion.span className="absolute inset-y-0 w-10 rounded bg-gradient-to-r from-transparent via-accent to-transparent"
        initial={{ x: '-100%' }} animate={{ x: '400%' }} transition={{ duration: 1.8, repeat: Infinity, delay, ease: 'easeInOut' }} />
    </div>
  );
}

/** Animated Scout → Guardian → Treasurer → PayPal flow for the landing page. */
export default function RoleDiagram() {
  return (
    <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center" role="img" aria-label="Scout (AI) proposes, Guardian (code) checks, Treasurer (code) pays with PayPal">
      {NODES.map((n, i) => (
        <React.Fragment key={n.key}>
          <motion.div
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 260, damping: 25, delay: i * 0.15 }}
            className="card hover-lift flex-1 p-4 text-left md:max-w-[220px]"
          >
            <span className={`grid h-10 w-10 place-items-center rounded-xl ring-1 ${n.cls}`}><n.Icon size={20} aria-hidden="true" /></span>
            <div className="mt-3 text-sm font-bold">{n.name} <span className="text-xs font-medium text-ink-3">· {n.kind}</span></div>
            <p className="mt-1 text-xs text-ink-2">{n.line}</p>
          </motion.div>
          <Connector delay={i * 0.6} />
        </React.Fragment>
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
        transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.5 }}
        className="grid place-items-center rounded-2xl bg-[#ffc439] px-5 py-4 text-center text-lg font-extrabold italic text-[#003087] md:w-32"
      >
        Pay<span className="text-[#009cde]">Pal</span>
        <span className="mt-1 text-[10px] font-semibold not-italic text-[#111]/70">Payouts · Orders v2</span>
      </motion.div>
    </div>
  );
}
