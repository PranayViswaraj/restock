// GUARDIAN — deterministic code, never an LLM. Its verdict is final.
//
// Pure functions only: no file access, no clock reads, no network. Everything it
// needs is passed in. WHY: so every rule is predictable, explainable and unit-tested,
// and the AI has no way to talk its way past it.
//
// Verdicts:
//   APPROVE_AUTO   every check passes and total <= requireApprovalAbove
//   NEEDS_APPROVAL every check passes, but the amount (or a new supplier) needs the owner
//   DELAY          ONLY the cash-buffer check fails, and a known settlement will cover it
//   BLOCK          anything else

export const VERDICTS = ['APPROVE_AUTO', 'NEEDS_APPROVAL', 'DELAY', 'BLOCK'];

const usd = (n) => `$${Number(n).toFixed(2)}`;
const usdUnit = (n) => (n < 1 ? `$${Number(n).toFixed(3)}` : usd(n));

/**
 * @param {object} input
 * @param {object} input.proposal  { sku, category, supplierId, quantity, total, unitPrice }  unitPrice = per single unit
 * @param {object} input.mandate   { status, signedBy, hash, rules: {...} } (may be null)
 * @param {number} input.weekToDateSpend  paid + awaiting spend in the last 7 days
 * @param {number|null} input.marketAvgUnitPrice  30-day average unit price for this SKU (null if no history)
 * @param {object} input.supplier  { id, name, isNew }
 * @param {object} input.cash      { balance, upcomingSettlements: [{date, amount, source}] }
 * @param {string} input.today     ISO date (YYYY-MM-DD), used for settlement timing
 * @returns {{ verdict, checks: Array<{rule, passed, detail, needsApproval?}>, reason, delayUntil }}
 */
export function evaluate({ proposal, mandate, weekToDateSpend = 0, marketAvgUnitPrice = null, supplier, cash, today }) {
  const rules = mandate?.rules || {};
  const total = round2(proposal.total);
  const checks = [];

  // 1. Mandate is active and signed
  const mandateOk = !!mandate && mandate.status === 'active' && !!mandate.signedBy && !!mandate.hash;
  checks.push({
    rule: 'mandate',
    passed: mandateOk,
    detail: mandateOk
      ? `Mandate v${mandate.version} signed by ${mandate.signedBy} is active.`
      : mandate?.status === 'revoked'
        ? 'The money mandate has been revoked by the owner.'
        : 'No active, signed money mandate.',
  });

  // 2. Category approved
  const catOk = (rules.approvedCategories || []).includes(proposal.category);
  checks.push({
    rule: 'category',
    passed: catOk,
    detail: catOk ? `"${proposal.category}" is an approved category.` : `"${proposal.category}" is not an approved category.`,
  });

  // 3. Per-order limit
  const orderOk = Number.isFinite(rules.maxPerOrder) && total <= rules.maxPerOrder;
  checks.push({
    rule: 'maxPerOrder',
    passed: orderOk,
    detail: `${usd(total)} ${orderOk ? '≤' : '>'} ${usd(rules.maxPerOrder ?? 0)} per-order limit.`,
  });

  // 4. Weekly budget
  const weekAfter = round2(weekToDateSpend + total);
  const weekOk = Number.isFinite(rules.maxPerWeek) && weekAfter <= rules.maxPerWeek;
  checks.push({
    rule: 'maxPerWeek',
    passed: weekOk,
    detail: `Week-to-date ${usd(weekToDateSpend)} + ${usd(total)} = ${usd(weekAfter)} ${weekOk ? '≤' : '>'} ${usd(rules.maxPerWeek ?? 0)} weekly limit.`,
  });

  // 5. Price anomaly vs 30-day average
  let priceCheck;
  if (!marketAvgUnitPrice) {
    priceCheck = { rule: 'priceDeviation', passed: true, detail: 'No 30-day price history for this item; price check skipped.' };
  } else {
    const ratioPct = Math.round((proposal.unitPrice / marketAvgUnitPrice) * 100);
    const deviationPct = ratioPct - 100;
    const limit = rules.maxPriceDeviationPct ?? 0;
    const ok = deviationPct <= limit;
    priceCheck = {
      rule: 'priceDeviation',
      passed: ok,
      ratioPct,
      detail: ok
        ? `${usdUnit(proposal.unitPrice)}/unit is ${ratioPct}% of the 30-day average (${usdUnit(marketAvgUnitPrice)}), within +${limit}%.`
        : `Price is ${ratioPct}% of normal: ${usdUnit(proposal.unitPrice)}/unit vs ${usdUnit(marketAvgUnitPrice)} 30-day average (limit +${limit}%).`,
    };
  }
  checks.push(priceCheck);

  // 6. New supplier -> owner must approve (escalates, does not block)
  const newSupplierFlag = !!supplier?.isNew && rules.newSupplierNeedsApproval !== false;
  checks.push({
    rule: 'newSupplier',
    passed: true,
    needsApproval: newSupplierFlag,
    detail: newSupplierFlag
      ? `${supplier.name} is a new supplier — the mandate requires owner approval.`
      : `${supplier?.name || 'Supplier'} is a known supplier.`,
  });

  // 7. Cash buffer
  const balance = Number(cash?.balance ?? 0);
  const buffer = rules.minBalanceBuffer ?? 0;
  const after = round2(balance - total);
  const cashOk = after >= buffer;
  checks.push({
    rule: 'cashBuffer',
    passed: cashOk,
    detail: `Balance ${usd(balance)} − ${usd(total)} = ${usd(after)} ${cashOk ? '≥' : '<'} ${usd(buffer)} buffer.`,
  });

  // ---- verdict ----
  const failed = checks.filter((c) => !c.passed);
  if (failed.length === 0) {
    const overAuto = total > (rules.requireApprovalAbove ?? 0);
    if (overAuto || newSupplierFlag) {
      const why = overAuto ? `${usd(total)} is above the ${usd(rules.requireApprovalAbove)} auto-approve limit` : `${supplier.name} is a new supplier`;
      return { verdict: 'NEEDS_APPROVAL', checks, reason: `${why}. Waiting for owner approval.`, delayUntil: null };
    }
    return { verdict: 'APPROVE_AUTO', checks, reason: 'All checks passed. Paying automatically.', delayUntil: null };
  }

  if (failed.length === 1 && failed[0].rule === 'cashBuffer') {
    const delayUntil = earliestCoveredDate({ balance, total, buffer, settlements: cash?.upcomingSettlements, today });
    if (delayUntil) {
      return {
        verdict: 'DELAY',
        checks,
        reason: `Paying now would drop the balance below the ${usd(buffer)} buffer. Delayed until ${delayUntil}, when incoming settlements cover it.`,
        delayUntil,
      };
    }
    return { verdict: 'BLOCK', checks, reason: `Not enough cash: paying would break the ${usd(buffer)} buffer and no settlement covers it.`, delayUntil: null };
  }

  const first = failed.find((c) => c.rule !== 'cashBuffer') || failed[0];
  return { verdict: 'BLOCK', checks, reason: `Blocked by Guardian: ${first.detail}`, delayUntil: null };
}

/**
 * Earliest settlement date after which (balance + settlements so far − total) >= buffer.
 * Returns ISO date string or null.
 */
export function earliestCoveredDate({ balance, total, buffer, settlements = [], today }) {
  let running = balance;
  const upcoming = [...settlements]
    .filter((s) => !today || s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const s of upcoming) {
    running += Number(s.amount) || 0;
    if (running - total >= buffer) return s.date;
  }
  return null;
}

/** Status a purchase gets for each verdict (before the Treasurer acts). */
export function statusForVerdict(verdict) {
  return { APPROVE_AUTO: 'approved-auto', NEEDS_APPROVAL: 'awaiting-approval', DELAY: 'delayed', BLOCK: 'blocked' }[verdict];
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}
