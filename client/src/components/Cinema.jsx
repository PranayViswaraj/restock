import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';

const finePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches;

/** Card with a subtle 3D tilt that follows the pointer (mouse only, reduced-motion aware). */
export function TiltCard({ children, className = '', max = 7, ...rest }) {
  const reduce = useReducedMotion();
  const rx = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });
  const ry = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });
  const on = !reduce && finePointer();
  const move = (e) => {
    if (!on) return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 2 * max);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 2 * max);
  };
  const leave = () => { rx.set(0); ry.set(0); };
  return (
    <motion.div {...rest} className={className} onPointerMove={move} onPointerLeave={leave}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900, ...(rest.style || {}) }}>
      {children}
    </motion.div>
  );
}

/** Wrapper that gently pulls its child toward the pointer (the "magnetic" button). */
export function Magnetic({ children, strength = 0.28, className = '' }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const x = useSpring(0, { stiffness: 260, damping: 18 });
  const y = useSpring(0, { stiffness: 260, damping: 18 });
  const on = !reduce && finePointer();
  return (
    <motion.span ref={ref} className={`inline-block ${className}`} style={{ x, y }}
      onPointerMove={(e) => {
        if (!on) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => { x.set(0); y.set(0); }}>
      {children}
    </motion.span>
  );
}

/** Drifting gradient mesh (CSS transform animation only). */
export function MeshBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="mesh-a absolute -left-[15%] -top-[20%] h-[70vh] w-[70vh] rounded-full opacity-35 blur-3xl" style={{ background: 'radial-gradient(circle, var(--accent-2), transparent 65%)' }} />
      <div className="mesh-b absolute -right-[10%] top-[10%] h-[60vh] w-[60vh] rounded-full opacity-30 blur-3xl" style={{ background: 'radial-gradient(circle, var(--scout), transparent 65%)' }} />
      <div className="mesh-c absolute bottom-[-20%] left-[25%] h-[65vh] w-[65vh] rounded-full opacity-25 blur-3xl" style={{ background: 'radial-gradient(circle, var(--treasurer), transparent 65%)' }} />
      <div className="mesh-b absolute bottom-[10%] right-[20%] h-[40vh] w-[40vh] rounded-full opacity-20 blur-3xl" style={{ background: 'radial-gradient(circle, var(--guardian), transparent 65%)', animationDelay: '-9s' }} />
    </div>
  );
}

/** Headline that reveals word by word. */
export function RevealWords({ text, className = '', delay = 0 }) {
  const words = text.split(' ');
  return (
    <span className={className} aria-label={text}>
      {words.map((w, i) => (
        <motion.span key={`${w}-${i}`} aria-hidden="true" className="inline-block"
          initial={{ opacity: 0, y: '0.5em' }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + i * 0.07, type: 'spring', stiffness: 220, damping: 22 }}>
          {w}{i < words.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </span>
  );
}
