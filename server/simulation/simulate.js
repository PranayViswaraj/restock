// Deterministic 30-day simulation: "Without Restock" vs "With Restock".
// Pure code — same inputs always give the same output, and the LLM is never
// called per day (WHY: fast, free, repeatable on stage).
//
// Same demand for both sides (from seeded sales). Differences:
//   WITHOUT: owner checks stock once a week (and when something runs out), orders
//            from the usual local supplier at the average price, no trend awareness.
//   WITH:    daily weighted forecast, reorders before running out, best-value supplier
//            (local or international), every order checked by the real Guardian.
import { evaluate } from '../guardian/guardian.js';

export const DEFAULT_ASSUMPTIONS = {
  manualHoursPerWeek: 3, // owner time spent checking stock, comparing and paying
  lostSalePerStockout: 60, // $ of sales lost per item per stockout day
  leadTimeLocalDays: 2,
  leadTimeInternationalDays: 3,
  startingCash: 1500,
  cashInflowPctOfRevenue: 0.3,
};

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * @param {object} p
 * @param {Array} p.sales      sales.json rows
 * @param {Array} p.inventory  inventory.json rows
 * @param {Array} p.offers     catalog offers { id, supplierId, sku, price, unitsPerPack, unitPrice, inStock }
 * @param {Array} p.suppliers  suppliers.json rows
 * @param {object} p.mandate   signed mandate (rules used by Guardian)
 * @param {object} p.assumptions overrides for DEFAULT_ASSUMPTIONS
 */
export function simulate({ sales, inventory, offers, suppliers, mandate, assumptions = {} }) {
  const a = { ...DEFAULT_ASSUMPTIONS, ...assumptions };
  const rules = mandate.rules;
  const dates = [...new Set(sales.map((s) => s.date))].sort();
  const supplierById = Object.fromEntries(suppliers.map((s) => [s.id, s]));
  const revenueByDate = {};
  const qtyByDateItem = {};
  for (const s of sales) {
    revenueByDate[s.date] = (revenueByDate[s.date] || 0) + s.revenue;
    qtyByDateItem[`${s.date}|${s.item}`] = s.quantity;
  }
  const demand = (inv, date) => Object.entries(inv.usagePerSale).reduce((t, [item, per]) => t + (qtyByDateItem[`${date}|${item}`] || 0) * per, 0);
  const avgUsage = Object.fromEntries(inventory.map((inv) => [inv.sku, dates.reduce((t, d) => t + demand(inv, d), 0) / dates.length]));

  // Price references
  // Today's out-of-stock flags don't apply to the past 30 days, so use every established offer.
  const established = offers.filter((o) => o.sku && !supplierById[o.supplierId]?.isNew);
  const skuOffers = (sku) => established.filter((o) => o.sku === sku);
  const isLocal = (o) => supplierById[o.supplierId]?.country === 'US';
  const avgPrice = (sku) => { const l = skuOffers(sku); return l.reduce((t, o) => t + o.unitPrice, 0) / l.length; };
  const localOffer = (sku) => skuOffers(sku).filter(isLocal).sort((x, y) => x.unitPrice - y.unitPrice)[0] || skuOffers(sku)[0];
  const bestOffer = (sku) => [...skuOffers(sku)].sort((x, y) => x.unitPrice - y.unitPrice)[0];

  const makeSide = () => ({
    stock: Object.fromEntries(inventory.map((inv) => [inv.sku, Math.round(avgUsage[inv.sku] * 5)])),
    pipeline: [], // { arrive, sku, units }
    cash: a.startingCash,
    stockouts: 0, lostSales: 0, spend: 0, saved: 0, crossBorderSaved: 0,
    orders: 0, autoOrders: 0, approvals: 0, blocked: 0, violations: 0, bufferDays: 0, weekLog: [],
  });
  const without = makeSide();
  const withR = makeSide();
  const frames = [];

  dates.forEach((date, day) => {
    const events = [];
    for (const side of [without, withR]) {
      // deliveries
      side.pipeline = side.pipeline.filter((o) => {
        if (o.arrive <= day) { side.stock[o.sku] += o.units; return false; }
        return true;
      });
      side.cash += (revenueByDate[date] || 0) * a.cashInflowPctOfRevenue;
    }

    // ---- consume demand, count stockouts
    for (const inv of inventory) {
      const need = demand(inv, date);
      for (const [name, side] of [['without', without], ['with', withR]]) {
        if (side.stock[inv.sku] < need) {
          side.stockouts += 1;
          side.lostSales += a.lostSalePerStockout;
          side.stock[inv.sku] = 0;
          events.push({ side: name, type: 'stockout', sku: inv.sku });
        } else {
          side.stock[inv.sku] -= need;
        }
      }
    }

    // ---- WITHOUT: weekly check (day 0, 7, 14…) or panic order after a stockout
    for (const inv of inventory) {
      const onOrder = without.pipeline.some((o) => o.sku === inv.sku);
      const weekly = day % 7 === 0 && without.stock[inv.sku] < avgUsage[inv.sku] * 7;
      const panic = without.stock[inv.sku] === 0;
      if (!onOrder && (weekly || panic)) {
        const o = localOffer(inv.sku);
        const units = Math.max(o.unitsPerPack, Math.ceil((avgUsage[inv.sku] * 10 - without.stock[inv.sku]) / o.unitsPerPack) * o.unitsPerPack);
        const price = avgPrice(inv.sku) * (panic ? 1.1 : 1); // rush orders cost more
        const total = round2(units * price);
        without.pipeline.push({ arrive: day + a.leadTimeLocalDays, sku: inv.sku, units });
        without.spend += total; without.cash -= total; without.orders += 1;
        events.push({ side: 'without', type: 'order', sku: inv.sku });
      }
    }

    // ---- WITH: daily weighted forecast, reorder before stockout, Guardian on every order
    const recent = dates.slice(Math.max(0, day - 2), day + 1);
    const earlier = dates.slice(0, Math.max(0, day - 2));
    for (const inv of inventory) {
      const recentAvg = recent.reduce((t, d) => t + demand(inv, d), 0) / recent.length;
      const earlierAvg = earlier.length ? earlier.reduce((t, d) => t + demand(inv, d), 0) / earlier.length : recentAvg;
      const usage = 0.6 * recentAvg + 0.4 * earlierAvg;
      const onOrderUnits = withR.pipeline.filter((o) => o.sku === inv.sku).reduce((t, o) => t + o.units, 0);
      const best = bestOffer(inv.sku);
      const lead = isLocal(best) ? a.leadTimeLocalDays : a.leadTimeInternationalDays;
      // Trap offers on fixed days (3 per month): a new supplier pitches syrup at 280%
      // of normal. Guardian must block every one.
      if (inv.sku === 'caramel-syrup' && [5, 14, 23].includes(day)) {
        const trap = { unitPrice: best.unitPrice * 2.8, price: best.price * 2.8 };
        const verdict = evaluate({
          proposal: { sku: inv.sku, category: inv.category, supplierId: 'trap', quantity: 1, total: trap.price, unitPrice: trap.unitPrice },
          mandate, weekToDateSpend: 0, marketAvgUnitPrice: avgPrice(inv.sku),
          supplier: { id: 'trap', name: 'New supplier', isNew: true }, cash: { balance: withR.cash, upcomingSettlements: [] }, today: date,
        });
        if (verdict.verdict === 'BLOCK') { withR.blocked += 1; events.push({ side: 'with', type: 'blocked', sku: inv.sku }); }
      }
      if (withR.stock[inv.sku] + onOrderUnits >= usage * (lead + 2)) continue;

      const packsWanted = Math.max(1, Math.ceil((usage * 7 - withR.stock[inv.sku] - onOrderUnits) / best.unitsPerPack));
      const packs = Math.max(1, Math.min(packsWanted, Math.floor(rules.maxPerOrder / best.price)));
      const total = round2(packs * best.price);
      const weekSpend = withR.weekLog.filter((w) => w.day > day - 7).reduce((t, w) => t + w.total, 0);
      const verdict = evaluate({
        proposal: { sku: inv.sku, category: inv.category, supplierId: best.supplierId, quantity: packs, total, unitPrice: best.unitPrice },
        mandate, weekToDateSpend: weekSpend, marketAvgUnitPrice: avgPrice(inv.sku),
        supplier: supplierById[best.supplierId], cash: { balance: withR.cash, upcomingSettlements: [] }, today: date,
      });
      // Blocked by a hard rule (e.g. category not in the mandate): skip. Only trap offers count as "risky blocked".
      if (verdict.verdict === 'BLOCK' && verdict.checks.some((c) => !c.passed && c.rule !== 'maxPerWeek')) continue;
      // Over-limit orders (amount or weekly budget) go to the owner, who approves with one tap.
      const auto = verdict.verdict === 'APPROVE_AUTO';
      if (auto) withR.autoOrders += 1; else withR.approvals += 1;
      // A violation = money moved automatically while a rule failed. By construction this stays 0.
      if (auto && verdict.checks.some((c) => !c.passed)) withR.violations += 1;

      const units = packs * best.unitsPerPack;
      withR.pipeline.push({ arrive: day + lead, sku: inv.sku, units });
      withR.spend += total; withR.cash -= total; withR.orders += 1;
      withR.weekLog.push({ day, total });
      withR.saved += Math.max(0, (avgPrice(inv.sku) - best.unitPrice) * units);
      if (!isLocal(best)) withR.crossBorderSaved += Math.max(0, (localOffer(inv.sku).unitPrice - best.unitPrice) * units);
      events.push({ side: 'with', type: 'order', sku: inv.sku, international: !isLocal(best) });
    }

    for (const side of [without, withR]) if (side.cash >= rules.minBalanceBuffer) side.bufferDays += 1;

    const health = (side) => Math.round((inventory.filter((inv) => side.stock[inv.sku] > 0).length / inventory.length) * 100);
    frames.push({
      day: day + 1, date, events,
      without: { stockouts: without.stockouts, lostSales: round2(without.lostSales), spend: round2(without.spend), health: health(without) },
      with: { stockouts: withR.stockouts, lostSales: round2(withR.lostSales), spend: round2(withR.spend), health: health(withR), saved: round2(withR.saved), blocked: withR.blocked },
    });
  });

  const weeks = dates.length / 7;
  const autoPct = withR.orders ? Math.round((withR.autoOrders / withR.orders) * 100) : 0;
  // Owner still spends ~2 minutes per approval.
  const hoursSavedPerWeek = round2(Math.max(0, a.manualHoursPerWeek - (withR.approvals / weeks) * (2 / 60)));

  return {
    assumptions: a,
    days: dates.length,
    frames,
    kpis: {
      stockoutsPrevented: without.stockouts - withR.stockouts,
      lostSalesAvoided: round2(without.lostSales - withR.lostSales),
      moneySaved: round2(withR.saved),
      hoursSavedPerWeek,
      autoPct,
      riskyBlocked: withR.blocked,
      ruleViolations: withR.violations,
      daysCashBuffer: withR.bufferDays,
      crossBorderSavings: round2(withR.crossBorderSaved),
    },
    totals: {
      without: { stockouts: without.stockouts, lostSales: round2(without.lostSales), spend: round2(without.spend), orders: without.orders },
      with: { stockouts: withR.stockouts, lostSales: round2(withR.lostSales), spend: round2(withR.spend), orders: withR.orders, approvals: withR.approvals },
    },
  };
}
