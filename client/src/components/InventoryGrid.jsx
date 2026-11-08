import React, { useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { gridTheme, columnStateProps, resetColumnState } from '../lib/grid.js';
import GridToolbar from './GridToolbar.jsx';
import { useApp } from '../lib/store.jsx';
import Sparkline from './Sparkline.jsx';

const DaysCell = ({ value }) => {
  if (value === null || value === undefined) return <span className="text-ink-3">—</span>;
  const tone = value < 3 ? 'bg-bad-soft text-bad' : value < 5 ? 'bg-warn-soft text-warn' : 'bg-ok-soft text-ok';
  return <span className={`badge ${tone}`}>{value} days{value < 3 ? ' · low' : ''}</span>;
};

const DriverCell = ({ value }) => {
  const top = [...(value || [])].sort((a, b) => b.trendPct - a.trendPct)[0];
  if (!top) return '—';
  return <span>{top.trendPct >= 15 ? '▲' : top.trendPct <= -15 ? '▼' : '→'} {top.menuItem} {top.trendPct > 0 ? '+' : ''}{top.trendPct}%</span>;
};

/** Supplies + live forecast; days-left turns red under 3 days; sparkline of 14-day usage. */
export default function InventoryGrid() {
  const { inventory } = useApp();
  const gridRef = useRef(null);
  const [quick, setQuick] = useState('');
  const columnDefs = useMemo(() => [
    { headerName: 'Supply', field: 'name', minWidth: 190, flex: 1.3, filter: 'agTextColumnFilter' },
    { headerName: 'In stock', field: 'stock', width: 120, valueFormatter: (p) => `${p.value} ${p.data.unit}` },
    { headerName: 'Daily use', field: 'dailyUsage', width: 125, valueFormatter: (p) => `${p.value} ${p.data.unit}` },
    { headerName: 'Usage (14d)', field: 'usageTrend', width: 135, sortable: false, cellDataType: false, cellRenderer: (p) => <div className="flex h-full items-center"><Sparkline values={p.value} /></div> },
    { headerName: 'Days left', field: 'daysOfStockLeft', width: 140, sort: 'asc', cellRenderer: DaysCell, filter: 'agNumberColumnFilter' },
    { headerName: 'Demand driver', field: 'drivers', width: 175, sortable: false, cellDataType: false, cellRenderer: DriverCell },
    { headerName: 'Category', field: 'category', width: 160, filter: 'agTextColumnFilter' },
    { headerName: 'Order', field: 'pendingStatus', width: 150, valueFormatter: (p) => (p.value === 'delayed' ? 'Delayed (cash)' : p.value === 'awaiting-approval' ? 'Awaiting you' : '—') },
  ], []);

  return (
    <section className="card" aria-labelledby="inventory-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="inventory-title" className="card-title">Inventory & forecast</h2>
          <p className="card-sub">Days left = stock ÷ weighted daily usage (last 3 days weigh 60%). Computed in code, not by the AI.</p>
        </div>
        <GridToolbar
          label="inventory" quick={quick} onQuick={setQuick}
          onCsv={() => gridRef.current?.api?.exportDataAsCsv({ fileName: `restock-inventory-${new Date().toISOString().slice(0, 10)}.csv`, columnKeys: ['name', 'stock', 'dailyUsage', 'daysOfStockLeft', 'category', 'pendingStatus'] })}
          onReset={() => resetColumnState(gridRef.current?.api, 'inventory')}
        />
      </div>
      <div className="ag-theme-restock h-[330px]">
        <AgGridReact
          ref={gridRef}
          theme={gridTheme}
          quickFilterText={quick}
          rowData={inventory || []}
          loading={!inventory}
          columnDefs={columnDefs}
          defaultColDef={{ sortable: true, resizable: true }}
          getRowId={(p) => p.data.sku}
          rowHeight={44}
          getRowStyle={(p) => (p.data.daysOfStockLeft !== null && p.data.daysOfStockLeft < 3 ? { background: 'var(--bad-soft)' } : undefined)}
          animateRows
          {...columnStateProps('inventory')}
        />
      </div>
    </section>
  );
}
