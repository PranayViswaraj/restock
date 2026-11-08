// All the maths lives here, in plain code — the LLM never does arithmetic.
//
// Forecast: weighted moving average of daily sales.
//   weightedDaily = 60% × (average of the last 3 days) + 40% × (average of the earlier days)
// WHY: reacts quickly to a spike (the cold-coffee heat wave) without
// overreacting to a single noisy day.
import { read } from './store.js';

const RECENT_DAYS = 3;
const RECENT_WEIGHT = 0.6;
export const TARGET_DAYS_OF_STOCK = 7;
const PENDING = ['awaiting-approval', 'delayed'];

const round = (n, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

/** Pure: per-item stats + trend from a sales array. */
export function summarize(sales, days = 30) {
  const dates = [...new Set(sales.map((s) => s.date))].sort().slice(-days);
  const keep = new Set(dates);
  const byItem = {};
  for (const s of sales) if (keep.has(s.date)) (byItem[s.item] ||= []).push(s);

  const items = Object.entries(byItem).map(([item, rows]) => {
    rows.sort((a, b) => a.date.localeCompare(b.date));
    const qty = rows.map((r) => r.quantity);
    const recentAvg = avg(qty.slice(-RECENT_DAYS));
    const earlierAvg = avg(qty.slice(0, -RECENT_DAYS)) || recentAvg;
    const trendPct = earlierAvg ? Math.round(((recentAvg - earlierAvg) / earlierAvg) * 100) : 0;
    return {
      item,
      totalQuantity: qty.reduce((a, b) => a + b, 0),
      totalRevenue: round(rows.reduce((a, r) => a + r.revenue, 0)),
      avgPrice: round(rows.reduce((a, r) => a + r.revenue, 0) / Math.max(1, qty.reduce((a, b) => a + b, 0))),
      avgDailyEarlier: round(earlierAvg, 1),
      avgDailyLast3Days: round(recentAvg, 1),
      trendPct,
      trend: trendPct >= 15 ? 'spiking' : trendPct <= -15 ? 'falling' : 'steady',
      weightedDailySales: round(RECENT_WEIGHT * recentAvg + (1 - RECENT_WEIGHT) * earlierAvg, 1),
      daily: rows.map((r) => ({ date: r.date, quantity: r.quantity })),
    };
  });
  return { days: dates.length, from: dates[0], to: dates[dates.length - 1], currency: 'USD', items };
}

export function salesSummary(days = 30) {
  return summarize(read('sales'), days);
}

/** Pure: forecast inventory items given a sales summary and pending purchases. */
export function forecastItems(inventory, summary, purchases = [], sku) {
  const rate = Object.fromEntries(summary.items.map((i) => [i.item, i]));
  return inventory
    .filter((inv) => !sku || sku === 'all' || inv.sku === sku)
    .map((inv) => {
      let dailyUsage = 0;
      const drivers = [];
      const usageSeries = {}; // date -> units used (for the sparkline)
      for (const [menuItem, perSale] of Object.entries(inv.usagePerSale || {})) {
        const s = rate[menuItem];
        if (!s) continue;
        dailyUsage += s.weightedDailySales * perSale;
        drivers.push({ menuItem, trendPct: s.trendPct });
        for (const d of s.daily.slice(-14)) usageSeries[d.date] = (usageSeries[d.date] || 0) + d.quantity * perSale;
      }
      const daysOfStockLeft = dailyUsage > 0 ? round(inv.stock / dailyUsage, 1) : null;
      const pending = purchases.find((p) => p.sku === inv.sku && PENDING.includes(p.status));
      return {
        sku: inv.sku,
        name: inv.name,
        category: inv.category,
        unit: inv.unit,
        stock: inv.stock,
        reorderPoint: inv.reorderPoint,
        dailyUsage: round(dailyUsage, 2),
        daysOfStockLeft,
        urgency: daysOfStockLeft === null ? 'unknown' : daysOfStockLeft < 3 ? 'urgent' : daysOfStockLeft < 5 ? 'soon' : 'ok',
        recommendedUnits: Math.max(0, Math.ceil(dailyUsage * TARGET_DAYS_OF_STOCK - inv.stock)),
        searchQuery: inv.searchQuery,
        pendingPurchaseId: pending ? pending.id : null,
        pendingStatus: pending ? pending.status : null,
        drivers,
        usageTrend: Object.keys(usageSeries).sort().map((date) => round(usageSeries[date], 2)),
      };
    });
}

export function forecast(sku) {
  return {
    targetDaysOfStock: TARGET_DAYS_OF_STOCK,
    items: forecastItems(read('inventory'), salesSummary(30), read('purchases'), sku),
  };
}
