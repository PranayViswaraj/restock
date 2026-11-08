import { describe, it, expect } from 'vitest';
import { evaluate, earliestCoveredDate, statusForVerdict } from '../guardian/guardian.js';

const RULES = {
  maxPerOrder: 100,
  maxPerWeek: 200,
  requireApprovalAbove: 30,
  minBalanceBuffer: 500,
  newSupplierNeedsApproval: true,
  maxPriceDeviationPct: 50,
  approvedCategories: ['packaging', 'beverage-supplies', 'food-supplies'],
};
const MANDATE = { version: 1, status: 'active', signedBy: 'Pranay', hash: 'abc123', rules: RULES };

/** A proposal that passes everything and is auto-approved; override per test. */
function input(over = {}) {
  return {
    proposal: { sku: 'cups-16oz', category: 'packaging', supplierId: 'sup-a', quantity: 1, total: 22, unitPrice: 0.044, ...over.proposal },
    mandate: over.mandate === undefined ? MANDATE : over.mandate,
    weekToDateSpend: over.weekToDateSpend ?? 40,
    marketAvgUnitPrice: over.marketAvgUnitPrice === undefined ? 0.054 : over.marketAvgUnitPrice,
    supplier: { id: 'sup-a', name: 'Chennai EcoPack', isNew: false, ...over.supplier },
    cash: { balance: 620, upcomingSettlements: [{ date: '2030-01-03', amount: 850, source: 'Card sales' }], ...over.cash },
    today: '2030-01-01',
  };
}
const check = (r, rule) => r.checks.find((c) => c.rule === rule);

describe('Guardian verdicts', () => {
  it('APPROVE_AUTO when every check passes and total is under the auto-approve limit', () => {
    const r = evaluate(input());
    expect(r.verdict).toBe('APPROVE_AUTO');
    expect(r.checks).toHaveLength(7);
    expect(r.checks.every((c) => c.passed)).toBe(true);
  });

  it('NEEDS_APPROVAL when total is above requireApprovalAbove', () => {
    const r = evaluate(input({ proposal: { total: 32 } }));
    expect(r.verdict).toBe('NEEDS_APPROVAL');
    expect(r.reason).toMatch(/auto-approve limit/);
  });

  it('total exactly at requireApprovalAbove is still auto-approved', () => {
    expect(evaluate(input({ proposal: { total: 30 } })).verdict).toBe('APPROVE_AUTO');
  });

  it('NEEDS_APPROVAL for a new supplier when the mandate says so', () => {
    const r = evaluate(input({ supplier: { isNew: true, name: 'New Co' } }));
    expect(r.verdict).toBe('NEEDS_APPROVAL');
    expect(check(r, 'newSupplier').needsApproval).toBe(true);
  });

  it('new supplier is auto-approved when newSupplierNeedsApproval is false', () => {
    const mandate = { ...MANDATE, rules: { ...RULES, newSupplierNeedsApproval: false } };
    expect(evaluate(input({ mandate, supplier: { isNew: true } })).verdict).toBe('APPROVE_AUTO');
  });
});

describe('Guardian rules (each one can block)', () => {
  it('1. blocks without a mandate', () => {
    const r = evaluate(input({ mandate: null }));
    expect(r.verdict).toBe('BLOCK');
    expect(check(r, 'mandate').passed).toBe(false);
  });

  it('1. blocks when the mandate is revoked', () => {
    const r = evaluate(input({ mandate: { ...MANDATE, status: 'revoked' } }));
    expect(r.verdict).toBe('BLOCK');
    expect(check(r, 'mandate').detail).toMatch(/revoked/);
  });

  it('1. blocks an unsigned mandate', () => {
    expect(evaluate(input({ mandate: { ...MANDATE, hash: null } })).verdict).toBe('BLOCK');
  });

  it('2. blocks an unapproved category', () => {
    const r = evaluate(input({ proposal: { category: 'electronics' } }));
    expect(r.verdict).toBe('BLOCK');
    expect(check(r, 'category').passed).toBe(false);
  });

  it('3. blocks a total above maxPerOrder', () => {
    const r = evaluate(input({ proposal: { total: 120 } }));
    expect(r.verdict).toBe('BLOCK');
    expect(check(r, 'maxPerOrder').passed).toBe(false);
  });

  it('4. blocks when week-to-date + total exceeds maxPerWeek', () => {
    const r = evaluate(input({ weekToDateSpend: 190, proposal: { total: 22 } }));
    expect(r.verdict).toBe('BLOCK');
    expect(check(r, 'maxPerWeek').passed).toBe(false);
  });

  it('5. blocks a price 280% of normal (the QuickSupply trap)', () => {
    const r = evaluate(input({ proposal: { unitPrice: 8.82, total: 52.92 }, marketAvgUnitPrice: 3.15, supplier: { isNew: true, name: 'QuickSupply Deals' } }));
    expect(r.verdict).toBe('BLOCK');
    expect(check(r, 'priceDeviation').ratioPct).toBe(280);
    expect(r.reason).toMatch(/280% of normal/);
  });

  it('5. allows a price within the deviation limit', () => {
    const r = evaluate(input({ proposal: { unitPrice: 0.08 }, marketAvgUnitPrice: 0.054 }));
    expect(check(r, 'priceDeviation').passed).toBe(true); // 148% of normal, +48% <= +50%
  });

  it('5. skips the price check when there is no history', () => {
    const r = evaluate(input({ marketAvgUnitPrice: null }));
    expect(check(r, 'priceDeviation').passed).toBe(true);
    expect(check(r, 'priceDeviation').detail).toMatch(/skipped/);
  });

  it('7. DELAY when only the cash buffer fails and a settlement covers it', () => {
    const r = evaluate(input({ proposal: { total: 84 }, cash: { balance: 571 } }));
    expect(r.verdict).toBe('DELAY');
    expect(r.delayUntil).toBe('2030-01-03');
    expect(r.checks.filter((c) => !c.passed).map((c) => c.rule)).toEqual(['cashBuffer']);
  });

  it('7. BLOCK when cash fails and no settlement can cover it', () => {
    const r = evaluate(input({ proposal: { total: 84 }, cash: { balance: 571, upcomingSettlements: [] } }));
    expect(r.verdict).toBe('BLOCK');
  });

  it('cash failure plus another failure is a BLOCK, not a DELAY', () => {
    const r = evaluate(input({ proposal: { total: 84, category: 'electronics' }, cash: { balance: 571 } }));
    expect(r.verdict).toBe('BLOCK');
  });
});

describe('earliestCoveredDate', () => {
  const settlements = [
    { date: '2030-01-05', amount: 100 },
    { date: '2030-01-02', amount: 20 },
    { date: '2029-12-30', amount: 9999 }, // in the past: ignored
  ];
  it('returns the first date when cumulative settlements cover the shortfall', () => {
    expect(earliestCoveredDate({ balance: 550, total: 80, buffer: 500, settlements, today: '2030-01-01' })).toBe('2030-01-05');
  });
  it('returns null when nothing covers it', () => {
    expect(earliestCoveredDate({ balance: 100, total: 80, buffer: 500, settlements, today: '2030-01-01' })).toBeNull();
  });
});

describe('statusForVerdict', () => {
  it('maps every verdict to a purchase status', () => {
    expect(statusForVerdict('BLOCK')).toBe('blocked');
    expect(statusForVerdict('DELAY')).toBe('delayed');
    expect(statusForVerdict('NEEDS_APPROVAL')).toBe('awaiting-approval');
  });
});
