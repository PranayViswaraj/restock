import { describe, it, expect } from 'vitest';
import { simulate } from '../simulation/simulate.js';
import { buildSales, buildInventory, buildSuppliers } from '../scripts/seed.js';
import { MOCK_CATALOG } from '../services/channel3.js';
import { buildSignedMandate, DEFAULT_RULES, parseMandateText, validateRules, DEFAULT_TEXT } from '../services/mandate.js';
import { computeKpis } from '../services/kpis.js';

const base = () => ({
  sales: buildSales(),
  inventory: buildInventory(),
  suppliers: buildSuppliers(),
  offers: MOCK_CATALOG.filter((o) => o.sku).map((o) => ({ ...o, unitPrice: o.price / o.unitsPerPack })),
  mandate: buildSignedMandate({ version: 1, sourceText: 'test', rules: DEFAULT_RULES, signedAt: '2030-01-01T00:00:00.000Z' }),
});

describe('30-day simulation', () => {
  it('is deterministic: same inputs give identical output', () => {
    expect(JSON.stringify(simulate(base()))).toBe(JSON.stringify(simulate(base())));
  });

  it('produces one frame per day', () => {
    const r = simulate(base());
    expect(r.days).toBe(30);
    expect(r.frames).toHaveLength(30);
    expect(r.frames[29].day).toBe(30);
  });

  it('never violates a rule and keeps the cash buffer every day', () => {
    const r = simulate(base());
    expect(r.kpis.ruleViolations).toBe(0);
    expect(r.kpis.daysCashBuffer).toBe(30);
  });

  it('Restock has fewer stockouts and blocks every trap offer', () => {
    const r = simulate(base());
    expect(r.totals.with.stockouts).toBeLessThan(r.totals.without.stockouts);
    expect(r.kpis.stockoutsPrevented).toBeGreaterThan(0);
    expect(r.kpis.riskyBlocked).toBe(3);
    expect(r.kpis.moneySaved).toBeGreaterThan(0);
    expect(r.kpis.crossBorderSavings).toBeGreaterThan(0);
  });

  it('assumptions change the outputs', () => {
    const a = simulate({ ...base(), assumptions: { lostSalePerStockout: 60 } });
    const b = simulate({ ...base(), assumptions: { lostSalePerStockout: 120 } });
    expect(b.kpis.lostSalesAvoided).toBe(a.kpis.lostSalesAvoided * 2);
  });
});

describe('mandate parsing', () => {
  it('parses the default plain-English mandate into the default rules', () => {
    expect(parseMandateText(DEFAULT_TEXT).rules).toEqual(DEFAULT_RULES);
  });

  it('rejects inconsistent rules with friendly errors', () => {
    const r = validateRules({ ...DEFAULT_RULES, maxPerWeek: 50 });
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toMatch(/weekly limit/);
  });

  it('rejects negative values', () => {
    expect(validateRules({ ...DEFAULT_RULES, minBalanceBuffer: -1 }).ok).toBe(false);
  });
});

describe('live KPIs', () => {
  it('counts zero rule violations when every paid purchase passed its checks', () => {
    const purchases = [
      { status: 'auto-paid', total: 22, savings: 5, savedVsLocal: 10, createdAt: new Date().toISOString(), forecast: { daysOfStockLeft: 1.8 }, guardianChecks: [{ passed: true }] },
      { status: 'blocked', total: 52, createdAt: new Date().toISOString(), guardianChecks: [{ passed: false }] },
    ];
    const k = Object.fromEntries(computeKpis({ purchases, cash: { balance: 600, history: [] }, mandate: { rules: DEFAULT_RULES } }).map((x) => [x.key, x.value]));
    expect(k.ruleViolations).toBe(0);
    expect(k.riskyBlocked).toBe(1);
    expect(k.crossBorderSavings).toBe(10);
    expect(k.stockoutsPrevented).toBe(1);
  });
});
