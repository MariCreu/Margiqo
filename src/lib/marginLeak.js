// Detector 2: Low / Negative Product Margin.
//
// Formula (deterministic, documented in docs/FORMULAS.md):
//   revenueAfterDiscount = unitPrice * quantity - lineDiscount
//   COGS                 = costPerItem * quantity            (only if cost known)
//   knownProductMargin   = revenueAfterDiscount - COGS
//
// "Known product margin" excludes payment fees, advertising, fulfillment,
// actual shipping cost and returns — it is never presented as "profit".
// Every flag here requires costKnown lines; SKUs with no cost data are
// reported separately as UNKNOWN, never assumed to be fine or a problem.

export const THRESHOLDS = {
  // Below this known-margin rate, a SKU's margin is "thin" enough to flag.
  THIN_MARGIN_RATE: 0.08,
  // Minimum revenue (after discount) for a thin-margin SKU to matter enough
  // to surface — avoids flagging a rounding error on a single €5 sale.
  THIN_MARGIN_MIN_REVENUE: 150,
};

function groupBy(lineItems, keyFn) {
  const groups = new Map();
  for (const li of lineItems) {
    const key = keyFn(li);
    if (key === null || key === undefined) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(li);
  }
  return groups;
}

function summarize(items) {
  const known = items.filter((i) => i.costKnown);
  const units = items.reduce((s, i) => s + i.quantity, 0);
  const revenueAfterDiscount = items.reduce((s, i) => s + i.netRevenue, 0);
  const revenueWithoutDiscount = items.reduce((s, i) => s + i.grossRevenue, 0);
  const cogsKnownTotal = known.reduce((s, i) => s + i.cogs, 0);
  const knownRevenue = known.reduce((s, i) => s + i.netRevenue, 0);
  const knownMargin = known.length > 0 ? knownRevenue - cogsKnownTotal : null;
  const marginWithoutDiscount =
    known.length > 0 ? known.reduce((s, i) => s + i.grossRevenue, 0) - cogsKnownTotal : null;
  return {
    units,
    lines: items.length,
    linesWithCost: known.length,
    costCoverage: items.length > 0 ? known.length / items.length : 0,
    revenueAfterDiscount,
    revenueWithoutDiscount,
    cogsKnownTotal: known.length > 0 ? cogsKnownTotal : null,
    knownMargin,
    knownMarginRate: knownMargin !== null && knownRevenue > 0 ? knownMargin / knownRevenue : null,
    marginWithoutDiscount,
  };
}

export function analyzeMargin(lineItemsWithCost) {
  const anyCostData = lineItemsWithCost.some((i) => i.costKnown);
  if (!anyCostData) {
    return { applicable: false, reason: "no_cost_data" };
  }

  const bySkuCode = [...groupBy(lineItemsWithCost, (i) => `${i.sku}::${i.discountCode || ""}`).entries()].map(
    ([key, items]) => ({
      sku: items[0].sku,
      name: items[0].name,
      discountCode: items[0].discountCode,
      ...summarize(items),
      items,
    })
  );

  const bySku = [...groupBy(lineItemsWithCost, (i) => i.sku).entries()].map(([sku, items]) => ({
    sku,
    name: items[0].name,
    ...summarize(items),
    items,
  }));

  const flags = [];

  // a) Negative known margin at the SKU+discount-code level — the most
  //    concrete, causal signal: this specific combination lost money.
  for (const g of bySkuCode) {
    if (g.linesWithCost === 0) continue;
    if (g.knownMargin === null || g.knownMargin >= 0) continue;

    const wouldHaveBeenProfitable = g.marginWithoutDiscount !== null && g.marginWithoutDiscount > 0;

    flags.push({
      type: "negative_known_margin",
      sku: g.sku,
      name: g.name,
      discountCode: g.discountCode,
      units: g.units,
      revenueAfterDiscount: g.revenueAfterDiscount,
      cogsKnownTotal: g.cogsKnownTotal,
      knownMargin: g.knownMargin,
      marginWithoutDiscount: g.marginWithoutDiscount,
      causedByDiscount: wouldHaveBeenProfitable && g.discountCode !== null,
      costCoverage: g.costCoverage,
      impact: Math.abs(g.knownMargin),
    });
  }

  // b) Thin margin at high volume — no single sale is a loss, but the
  //    buffer is small enough that a minor cost or price change would flip
  //    it negative. Sorted/filtered by absolute revenue, not just rate.
  for (const g of bySku) {
    if (g.linesWithCost === 0) continue;
    if (g.knownMarginRate === null) continue;
    if (g.knownMarginRate < 0) continue; // already covered by (a) at the code level
    if (g.knownMarginRate >= THRESHOLDS.THIN_MARGIN_RATE) continue;
    if (g.revenueAfterDiscount < THRESHOLDS.THIN_MARGIN_MIN_REVENUE) continue;

    flags.push({
      type: "thin_margin_high_volume",
      sku: g.sku,
      name: g.name,
      units: g.units,
      revenueAfterDiscount: g.revenueAfterDiscount,
      cogsKnownTotal: g.cogsKnownTotal,
      knownMargin: g.knownMargin,
      knownMarginRate: g.knownMarginRate,
      costCoverage: g.costCoverage,
      impact: g.knownMargin,
    });
  }

  return {
    applicable: true,
    bySku,
    bySkuCode,
    flags,
  };
}
