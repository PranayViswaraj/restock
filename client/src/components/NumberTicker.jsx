import React, { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

/** Counts from the previous value to the new one. Instant when reduced motion is on. */
export default function NumberTicker({ value = 0, format = (n) => Math.round(n).toString(), duration = 0.9 }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const prev = useRef(0);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      prev.current = value;
      return undefined;
    }
    const controls = animate(prev.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, duration, reduce]);

  return <span className="tabular-nums">{format(display)}</span>;
}
