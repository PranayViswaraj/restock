import React from 'react';
import { Download, Search, RotateCcw } from 'lucide-react';

/** Shared AG Grid toolbar: quick filter, CSV export, reset saved column layout. */
export default function GridToolbar({ label, quick, onQuick, onCsv, onReset }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative">
        <span className="sr-only">Search {label}</span>
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <input className="input w-48 pl-8 sm:w-56" type="search" placeholder="Quick search…" value={quick} onChange={(e) => onQuick(e.target.value)} />
      </label>
      {onCsv && <button className="btn" onClick={onCsv}><Download size={15} aria-hidden="true" /> CSV</button>}
      {onReset && (
        <button className="btn btn-sm h-9 w-9 px-0" onClick={onReset} title="Reset column layout" aria-label={`Reset ${label} column layout`}>
          <RotateCcw size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
