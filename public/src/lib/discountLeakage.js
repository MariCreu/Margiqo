// Detector 1: Discount Leakage.
//
// Every number here comes straight from orders.csv ("Lineitem price",
// "Lineitem quantity", "Lineitem discount", "Discount Code"). Nothing is
// estimated. A discount is only flagged as a leak when there is evidence of
// disproportionate concentration, not merely because it is large.

export const THRESHOLDS = {
  // A code/SKU must move at least this much money before we bother flagging it.
  MATERIALITY_ABS: 30,
  // ...and represent at least this share of total discount revenue.
  MATERIALITY_SHARE: 0.02,
  // Concentration: this code/SKU's share of discounts vs its share of revenue.
  CONCENTRATION_RATIO: 1.5,
  // Average discount rate within the code/SKU, for it to count as "aggressive".
  AGGRESSIVE_RATE: 0.25,
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

function summarizeGroup(items, totalGrossRevenue, totalDiscount) {
  const grossRevenue = items.reduce((s, i) => s + i.grossRevenue, 0);
  const discount = items.reduce((s, i) => s + i.lineDiscount, 0);
  return {
    lines: items.length,
    grossRevenue,
    totalDiscount: discount,
    discountRate: grossRevenue > 0 ? discount / grossRevenue : 0,
    revenueShare: totalGrossRevenue > 0 ? grossRevenue / totalGrossRevenue : 0,
    discountShare: totalDiscount > 0 ? discount / totalDiscount : 0,
  };
}

export function analyzeDiscounts(lineItems, meta) {
  const totalGrossRevenue = lineItems.reduce((s, i) => s + i.grossRevenue, 0);
  const totalDiscount = lineItems.reduce((s, i) => s + i.lineDiscount, 0);
  const discountRateGlobal = totalGrossRevenue > 0 ? totalDiscount / totalGrossRevenue : 0;

  const byCode = meta.hasDiscountCodeData
    ? [...groupBy(lineItems, (i) => i.discountCode).entries()]
        .map(([code, items]) => ({ code, ...summarizeGroup(items, totalGrossRevenue, totalDiscount), items }))
        .filter((g) => g.totalDiscount > 0)
        .sort((a, b) => b.totalDiscount - a.totalDiscount)
    : [];

  const bySku = [...groupBy(lineItems, (i) => i.sku).entries()]
    .map(([sku, items]) => ({
      sku,
      name: items[0].name,
      ...summarizeGroup(items, totalGrossRevenue, totalDiscount),
      items,
    }))
    .filter((g) => g.totalDiscount > 0)
    .sort((a, b) => b.totalDiscount - a.totalDiscount);

  const flags = [];

  const considerConcentration = (group, dimension) => {
    if (group.totalDiscount < THRESHOLDS.MATERIALITY_ABS) return;
    if (group.discountShare < THRESHOLDS.MATERIALITY_SHARE) return;
    const concentrationRatio = group.revenueShare > 0 ? group.discountShare / group.revenueShare : Infinity;
    if (concentrationRatio < THRESHOLDS.CONCENTRATION_RATIO) return;
    if (group.discountRate < THRESHOLDS.AGGRESSIVE_RATE) return;

    flags.push({
      type: "discount_concentration",
      dimension, // 'code' | 'sku'
      key: dimension === "code" ? group.code : group.sku,
      label: dimension === "code" ? group.code : group.name,
      totalDiscount: group.totalDiscount,
      discountRate: group.discountRate,
      concentrationRatio,
      revenueShare: group.revenueShare,
      discountShare: group.discountShare,
      lines: group.lines,
      grossRevenue: group.grossRevenue,
      evidence: group.items,
    });
  };

  for (const g of byCode) considerConcentration(g, "code");
  for (const g of bySku) considerConcentration(g, "sku");

  return {
    totalGrossRevenue,
    totalDiscount,
    discountRateGlobal,
    byCode,
    bySku,
    flags,
  };
}
