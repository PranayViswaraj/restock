// AG Grid Community setup: register modules once; one theme built from CSS variables
// so light/dark switch instantly without re-mounting grids.
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);

export const gridTheme = themeQuartz.withParams({
  accentColor: 'var(--accent)',
  backgroundColor: 'var(--surface)',
  foregroundColor: 'var(--ink)',
  headerBackgroundColor: 'var(--surface-2)',
  headerTextColor: 'var(--ink-2)',
  borderColor: 'var(--line)',
  rowHoverColor: 'var(--surface-2)',
  chromeBackgroundColor: 'var(--surface-2)',
  fontFamily: 'inherit',
  fontSize: 13,
  headerFontWeight: 600,
  wrapperBorderRadius: 14,
  borderRadius: 8,
  spacing: 7,
});

// Column state (order, width, sort, visibility) persisted per grid in localStorage,
// so the owner's layout survives reloads. Wrapped in try/catch: storage can be
// blocked (private mode), and the grid must still work.
export function columnStateProps(key) {
  const storageKey = `restock-grid-${key}`;
  const save = (e) => {
    try { localStorage.setItem(storageKey, JSON.stringify(e.api.getColumnState())); } catch { /* storage unavailable */ }
  };
  return {
    onGridReady: (e) => {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
        if (Array.isArray(saved)) e.api.applyColumnState({ state: saved, applyOrder: true });
      } catch { /* ignore bad or missing state */ }
    },
    onSortChanged: save,
    onColumnMoved: (e) => e.finished && save(e),
    onColumnResized: (e) => e.finished && save(e),
    onColumnVisible: save,
  };
}

export function resetColumnState(api, key) {
  try { localStorage.removeItem(`restock-grid-${key}`); } catch { /* storage unavailable */ }
  api?.resetColumnState();
}
