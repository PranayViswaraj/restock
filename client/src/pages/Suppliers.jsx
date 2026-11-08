import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { gridTheme, columnStateProps, resetColumnState } from '../lib/grid.js';
import GridToolbar from '../components/GridToolbar.jsx';
import { api } from '../lib/api.js';
import Sparkline from '../components/Sparkline.jsx';

const TrustCell = ({ value }) => {
  const tone = value >= 85 ? 'var(--ok)' : value >= 60 ? 'var(--warn)' : 'var(--bad)';
  return (
    <div className="flex h-full items-center gap-2" title={`Trust score ${value}/100`}>
      <div className="h-2 w-20 rounded-full bg-surface-2"><div className="h-full rounded-full" style={{ width: `${value}%`, background: tone }} /></div>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
};

/** Suppliers with an explainable trust score: on-time rate (50%), price stability (30%), history (20%). */
export default function Suppliers() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [quick, setQuick] = useState('');
  const gridRef = useRef(null);
  useEffect(() => { api('/api/suppliers').then(setRows).catch((e) => setError(e.message)); }, []);

  const columnDefs = useMemo(() => [
    { headerName: 'Supplier', field: 'name', minWidth: 210, flex: 1.3, filter: 'agTextColumnFilter', cellRenderer: (p) => <span><span aria-hidden="true">{p.data.flag}</span> {p.value} {p.data.isNew && <span className="badge ml-1 bg-warn-soft text-warn">NEW</span>}</span> },
    { headerName: 'Location', field: 'city', minWidth: 170, flex: 1, filter: 'agTextColumnFilter', valueFormatter: (p) => `${p.value} · ${p.data.countryName}` },
    { headerName: 'Trust score', field: 'trustScore', width: 160, sort: 'desc', cellRenderer: TrustCell, filter: 'agNumberColumnFilter' },
    { headerName: 'On-time', field: 'onTimeRate', width: 110, valueFormatter: (p) => (p.value == null ? 'no history' : `${Math.round(p.value * 100)}%`) },
    { headerName: 'Price stability', field: 'priceStability', width: 135, valueFormatter: (p) => (p.data.isNew ? '—' : `${p.value}%`) },
    { headerName: 'Price trend', field: 'priceTrend', width: 130, sortable: false, cellDataType: false, cellRenderer: (p) => <div className="flex h-full items-center"><Sparkline values={p.value} width={90} color="var(--treasurer)" /></div> },
    { headerName: 'Orders (history)', field: 'ordersCompleted', width: 140 },
    { headerName: 'Categories', field: 'categories', minWidth: 190, flex: 1, cellDataType: false, valueFormatter: (p) => p.value.join(', ') },
  ], []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
        <p className="text-sm text-ink-2">Local Texas suppliers and international partners in India, all paid through PayPal. New suppliers start untrusted, so Guardian asks Pranay first.</p>
      </div>
      {error && <p className="rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad" role="alert">{error}</p>}
      <section className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="card-sub">Sort by trust score, filter by country, export for your accountant.</p>
          <GridToolbar
            label="suppliers" quick={quick} onQuick={setQuick}
            onCsv={() => gridRef.current?.api?.exportDataAsCsv({ fileName: 'restock-suppliers.csv', columnKeys: ['name', 'city', 'trustScore', 'onTimeRate', 'priceStability', 'ordersCompleted', 'categories'] })}
            onReset={() => resetColumnState(gridRef.current?.api, 'suppliers')}
          />
        </div>
        <div className="ag-theme-restock h-[420px]">
          <AgGridReact ref={gridRef} theme={gridTheme} quickFilterText={quick} rowData={rows || []} loading={!rows && !error} columnDefs={columnDefs} defaultColDef={{ sortable: true, resizable: true }} rowHeight={46} getRowId={(p) => p.data.id} animateRows {...columnStateProps('suppliers')} />
        </div>
        <p className="mt-3 text-xs text-ink-3">Trust score = on-time rate × 50 + price stability × 30 + order history × 20. New suppliers score 15 until they build a record. Seeded demo data.</p>
      </section>
    </div>
  );
}
