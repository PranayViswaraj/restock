import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { AppProvider, useApp } from './lib/store.jsx';
import WakeScreen from './components/WakeScreen.jsx';
import { usePath, match } from './lib/router.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Header from './components/Header.jsx';
import Toasts from './components/Toasts.jsx';
import ShieldOverlay from './components/ShieldOverlay.jsx';
import PaymentArc from './components/PaymentArc.jsx';
import DecisionTraceDrawer from './components/DecisionTraceDrawer.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import GuidedTour from './components/GuidedTour.jsx';
import Landing from './pages/Landing.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Mandate from './pages/Mandate.jsx';
import Simulation from './pages/Simulation.jsx';
import Approve from './pages/Approve.jsx';
import Suppliers from './pages/Suppliers.jsx';
import Ledger from './pages/Ledger.jsx';
import Receipt from './pages/Receipt.jsx';

function initialTheme() {
  const t = document.documentElement.dataset.theme;
  return t === 'dark' ? 'dark' : 'light';
}

export default function App() {
  const path = usePath();
  const [theme, setTheme] = useState(initialTheme);
  const [palette, setPalette] = useState(false);
  const [tourKey, setTourKey] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('restock-theme', theme); } catch { /* storage unavailable */ }
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  const startTour = useCallback(() => setTourKey((k) => k + 1), []);

  // Ctrl/Cmd+K opens the command palette anywhere.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const approve = match('/approve/:id', path);
  const receipt = match('/receipt/:id', path);
  let page;
  let chrome = true;
  if (path === '/') { page = <Landing theme={theme} onToggleTheme={toggleTheme} />; chrome = false; }
  else if (approve) { page = <Approve id={approve.id} />; chrome = false; }
  else if (path === '/app') page = <Dashboard theme={theme} />;
  else if (path === '/mandate') page = <Mandate />;
  else if (path === '/simulate') page = <Simulation />;
  else if (path === '/suppliers') page = <Suppliers />;
  else if (path === '/ledger') page = <Ledger />;
  else if (receipt) page = <Receipt id={receipt.id} />;
  else page = <NotFound />;

  return (
    <MotionConfig reducedMotion="user">
      <AppProvider>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>
        {chrome && <Header path={path} theme={theme} onToggleTheme={toggleTheme} onOpenPalette={() => setPalette(true)} />}
        <ErrorBoundary key={path}>
          <AnimatePresence mode="wait">
            <motion.main
              id="main"
              key={path}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.25 } }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              className={chrome ? 'mx-auto max-w-[1360px] px-4 py-6 sm:px-6' : ''}
            >
              {page}
            </motion.main>
          </AnimatePresence>
        </ErrorBoundary>
        {chrome && <Footer />}
        <WakeScreen />
        <ShieldOverlay />
        <PaymentArc />
        <DecisionTraceDrawer />
        <Toasts />
        <CommandPalette open={palette} onClose={() => setPalette(false)} onToggleTheme={toggleTheme} onStartTour={startTour} />
        {path === '/app' && <GuidedTour key={tourKey} forceOpen={tourKey > 0} />}
      </AppProvider>
    </MotionConfig>
  );
}

// Honesty rule: always say where the sales data comes from.
function Footer() {
  const { status } = useApp();
  const sales = status?.salesSource?.label || 'Seeded demo data';
  return (
    <footer className="mx-auto max-w-[1360px] px-6 pb-8 text-center text-xs text-ink-3 no-print">
      The AI decides. The code guards the money. PayPal moves it. · Sales source: {sales} · PayPal sandbox, no real money moves.
    </footer>
  );
}

function NotFound() {
  return (
    <div className="card mx-auto max-w-md text-center">
      <h1 className="text-lg font-bold">Page not found</h1>
      <a href="/app" className="link mt-2 inline-block">Go to the dashboard</a>
    </div>
  );
}
