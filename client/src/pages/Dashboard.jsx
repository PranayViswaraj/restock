import React from 'react';
import { TriangleAlert } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { Link } from '../lib/router.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import KpiStrip from '../components/KpiStrip.jsx';
import AgentTimeline from '../components/AgentTimeline.jsx';
import Approvals from '../components/ApprovalCard.jsx';
import WeeklyBriefing from '../components/WeeklyBriefing.jsx';
import CashFlowStrip from '../components/CashFlowStrip.jsx';
import PurchasesGrid from '../components/PurchasesGrid.jsx';
import SpendChart from '../components/SpendChart.jsx';
import InventoryGrid from '../components/InventoryGrid.jsx';
import AskRestock from '../components/AskRestock.jsx';
import DemoCta from '../components/DemoCta.jsx';
import BrainView from '../components/BrainView.jsx';
import PaymentRoutes from '../components/PaymentRoutes.jsx';
import { useFeatures } from '../lib/features.js';

const Panel = ({ children }) => <ErrorBoundary compact>{children}</ErrorBoundary>;

export default function Dashboard({ theme }) {
  const { kpis, error, refresh, mandate, status } = useApp();
  const flags = useFeatures();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Good day, Pranay</h1>
          <p className="text-sm text-ink-2">
            Your purchasing agent team, guarded by mandate v{mandate?.version ?? '…'}.{' '}
            <span className="badge ml-1 bg-surface-2 text-ink-2" title={status?.salesSource?.note || undefined}>
              Sales source: {status?.salesSource?.label || '…'}
            </span>
          </p>
        </div>
        {mandate && mandate.status !== 'active' && (
          <Link to="/mandate" className="badge bg-bad-soft px-3 py-1.5 text-bad">
            <TriangleAlert size={13} aria-hidden="true" /> Mandate {mandate.status}: Guardian will block every purchase. Sign a new one →
          </Link>
        )}
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-bad-soft px-4 py-3 text-sm text-bad" role="alert">
          <span>{error}</span>
          <button className="btn btn-sm" onClick={() => refresh()}>Retry</button>
        </div>
      )}

      <Panel><DemoCta /></Panel>

      <div data-story="kpis"><Panel><KpiStrip kpis={kpis} /></Panel></div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-7">
          {flags.brainView && <div data-story="brain"><Panel><BrainView /></Panel></div>}
          <div data-story="timeline"><Panel><AgentTimeline /></Panel></div>
        </div>
        <div className="space-y-5 xl:col-span-5">
          <div data-story="approvals"><Panel><Approvals /></Panel></div>
          <Panel><WeeklyBriefing /></Panel>
        </div>
      </div>

      <div data-story="cash"><Panel><CashFlowStrip /></Panel></div>
      {flags.paymentRoutes && <div data-story="routes"><Panel><PaymentRoutes /></Panel></div>}
      <div data-story="purchases"><Panel><PurchasesGrid /></Panel></div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-7"><Panel><SpendChart theme={theme} /></Panel></div>
        <div className="xl:col-span-5"><Panel><AskRestock /></Panel></div>
      </div>

      <Panel><InventoryGrid /></Panel>
    </div>
  );
}
