import React, { useCallback, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { gridTheme, columnStateProps, resetColumnState } from '../lib/grid.js';
import { useApp } from '../lib/store.jsx';
import { usd, STATUS } from '../lib/format.js';
import StatusBadge from './StatusBadge.jsx';
import GridToolbar from './GridToolbar.jsx';

const PAID = ['auto-paid', 'approved-paid'];
const STATE_KEY = 'purchases';

const ItemCell = ({ data, node }) => (node.rowPinned ? (
  <div className="py-2 leading-tight">
    <div className="text-[13px] font-semibold">{data.productName}</div>
    <div className="text-[11px] text-ink-3">{data.sub}</div>
  </div>
) : (
  <div className="py-2 leading-tight">
    <div className="text-[13px] font-medium">{data.productName}</div>
    <div className="text-[11px] text-ink-3">{data.sku}{data.seeded ? ' · seeded history' : ''}</div>
  </div>
));
const SupplierCell = ({ data, node }) => (node.rowPinned ? null : (
  <div className="flex items-center gap-2">
    <span className="text-base leading-none" aria-hidden="true">{data.flag}</span>
    <span className="truncate">{data.supplierName}</span>
    {data.international && <span className="badge bg-info-soft text-info">Intl</span>}
  </div>
));

// Progress bar: how much of the weekly budget this one order uses.
const BudgetCell = ({ value, node }) => {
  if (value == null || node.rowPinned) return null; // totals span many weeks
  const pct = Math.min(100, Math.round(value * 100));
  const tone = pct > 40 ? 'var(--warn)' : 'var(--ok)';
  return (
    <div className="flex h-full items-center gap-2" title={`${pct}% of the weekly budget`}>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone }} />
      </div>
      <span className="text-[12px] tabular-nums text-ink-2">{pct}%</span>
    </div>
  );
};

/**
 * Every purchase: sort, filter, quick search, CSV export, saved column layout,
 * and a pinned totals row that follows the active filters.
 * Click a row for its Decision Trace.
 */
export default function PurchasesGrid() {
  const { purchases, openTrace, mandate } = useApp();
  const weekly = mandate?.rules?.maxPerWeek || null;
  const gridRef = useRef(null);
  const [quick, setQuick] = useState('');
  const [totals, setTotals] = useState([]);

  const columnDefs = useMemo(() => [
    {
      headerName: 'Date', field: 'createdAt', sort: 'desc', width: 112, filter: 'agDateColumnFilter',
      valueGetter: (p) => (p.data.createdAt ? new Date(p.data.createdAt) : null),
      valueFormatter: (p) => (p.value ? p.value.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''),
    },
    { headerName: 'Item', field: 'productName', minWidth: 160, flex: 1.2, cellRenderer: ItemCell, autoHeight: true, filter: 'agTextColumnFilter' },
    { headerName: 'Supplier', field: 'supplierName', minWidth: 165, flex: 1, cellRenderer: SupplierCell, filter: 'agTextColumnFilter' },
    { headerName: 'Qty', field: 'quantity', width: 108, filter: 'agNumberColumnFilter', valueFormatter: (p) => (p.node.rowPinned ? '' : `${p.value} × ${p.data.unitsPerPack || 1} ${p.data.unit || ''}`) },
    { headerName: 'Total', field: 'total', width: 100, type: 'rightAligned', filter: 'agNumberColumnFilter', valueFormatter: (p) => usd(p.value), cellClass: (p) => (p.node.rowPinned ? 'font-bold' : '') },
    { headerName: 'Saved', field: 'savedVsLocal', width: 92, type: 'rightAligned', filter: 'agNumberColumnFilter', valueFormatter: (p) => (p.value ? usd(p.value) : '—'), cellClass: (p) => (p.value ? 'text-ok font-semibold' : '') },
    {
      headerName: 'Of weekly budget', colId: 'budget', width: 132, filter: 'agNumberColumnFilter', cellRenderer: BudgetCell,
      valueGetter: (p) => (weekly ? (p.data.total || 0) / weekly : null),
    },
    {
      headerName: 'Status', field: 'status', width: 152, cellRenderer: (p) => (p.node.rowPinned ? null : <StatusBadge status={p.value} />), filter: 'agTextColumnFilter',
      getQuickFilterText: (p) => STATUS[p.value]?.label || p.value,
    },
    {
      headerName: 'PayPal ID', colId: 'paypal', width: 150, filter: 'agTextColumnFilter',
      valueGetter: (p) => (p.node.rowPinned ? '' : p.data.paypal?.id || '—'),
      tooltipValueGetter: (p) => (p.data.paypal ? `${p.data.paypal.method === 'payout' ? 'Payout batch' : 'Order'} · ${p.data.paypal.status}${p.data.paypal.mock ? ' (mock)' : ''}` : undefined),
      cellClass: 'font-mono text-[12px]',
    },
    { headerName: 'Why?', field: 'reason', minWidth: 260, flex: 2.4, wrapText: true, autoHeight: true, filter: 'agTextColumnFilter', cellClass: 'why-cell' },
  ], [weekly]);

  // Pinned totals = paid orders among the rows currently shown (after filters + search).
  const updateTotals = useCallback((e) => {
    let shown = 0; let paid = 0; let spend = 0; let saved = 0;
    e.api.forEachNodeAfterFilter((n) => {
      shown++;
      if (PAID.includes(n.data.status)) { paid++; spend += n.data.total || 0; saved += n.data.savedVsLocal || 0; }
    });
    // The id includes the counts so the Item cell re-renders when they change
    // (AG Grid only refreshes a custom cell when its own field value changes).
    const row = {
      id: `__totals-${paid}-${shown}`, productName: 'Total paid', sub: `${paid} paid of ${shown} shown`,
      total: Math.round(spend * 100) / 100, savedVsLocal: Math.round(saved * 100) / 100,
    };
    // Only update when the numbers change, so this can never loop with the grid.
    setTotals((prev) => (prev[0] && prev[0].sub === row.sub && prev[0].total === row.total && prev[0].savedVsLocal === row.savedVsLocal ? prev : [row]));
  }, []);

  const exportCsv = () => gridRef.current?.api?.exportDataAsCsv({
    fileName: `restock-purchases-${new Date().toISOString().slice(0, 10)}.csv`,
    columnKeys: ['createdAt', 'productName', 'supplierName', 'quantity', 'total', 'savedVsLocal', 'status', 'paypal', 'reason'],
    processCellCallback: (p) => (p.value instanceof Date ? p.value.toISOString() : p.value),
  });

  return (
    <section className="card" aria-labelledby="purchases-title" data-tour="purchases">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="purchases-title" className="card-title">Purchases</h2>
          <p className="card-sub">Click any row for its full Decision Trace. The totals row follows your filters.</p>
        </div>
        <GridToolbar label="purchases" quick={quick} onQuick={setQuick} onCsv={exportCsv} onReset={() => resetColumnState(gridRef.current?.api, STATE_KEY)} />
      </div>
      <div className="ag-theme-restock h-[460px]">
        <AgGridReact
          ref={gridRef}
          theme={gridTheme}
          rowData={purchases || []}
          loading={!purchases}
          columnDefs={columnDefs}
          defaultColDef={{ sortable: true, resizable: true }}
          getRowId={(p) => p.data.id}
          quickFilterText={quick}
          pinnedBottomRowData={totals}
          getRowStyle={(p) => (p.node.rowPinned ? { background: 'var(--surface-2)', cursor: 'default' } : undefined)}
          onRowClicked={(e) => !e.node.rowPinned && openTrace(e.data.id)}
          onModelUpdated={updateTotals}
          tooltipShowDelay={300}
          animateRows
          overlayNoRowsTemplate="<span>No purchases yet. Run the agent.</span>"
          {...columnStateProps(STATE_KEY)}
        />
      </div>
    </section>
  );
}
