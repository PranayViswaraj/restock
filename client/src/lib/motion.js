// Shared motion language. Springs for panels/cards, short fades elsewhere.
// <MotionConfig reducedMotion="user"> in App.jsx turns transforms into fades for
// people who ask their OS for reduced motion.
export const spring = { type: 'spring', stiffness: 260, damping: 25 };
export const softSpring = { type: 'spring', stiffness: 180, damping: 24 };

export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: spring },
};

export const stagger = (step = 0.06, delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } },
});

export const pop = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: spring },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.15 } },
};
