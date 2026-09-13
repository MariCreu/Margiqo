import { parseOrdersCsv, parseProductsCsv, attachCost } from "./shopify.js";
import { analyzeDiscounts } from "./discountLeakage.js";
import { analyzeMargin, THRESHOLDS as MARGIN_THRESHOLDS } from "./marginLeak.js";
import { money, moneyPrecise, pct } from "./format.js";

export const NOT_INCLUDED = ["Payment fees", "Advertising", "Fulfillment", "Actual shipping cost", "Returns"];

const SEVERITY_ORDER = { CRITICAL: 0, WARNING: 1, INFO: 2 };

function marginCardFromFlag(flag, currency) {
  const avgNet = flag.revenueAfterDiscount / flag.units;
  const avgCost = flag.cogsKnownTotal / flag.units;
  const codeSuffix = flag.discountCode ? ` under discount code "${flag.discountCode}"` : "";

  if (flag.type === "negative_known_margin") {
    const whatToDo = flag.causedByDiscount
      ? `Exclude ${flag.name} from discount code "${flag.discountCode}", or reduce the discount so it stays above product cost.`
      : `Review the base price or supplier cost of ${flag.name} — it is unprofitable on known costs alone${codeSuffix}, before any discount is even considered.`;

    return {
      id: `neg-${flag.sku}-${flag.discountCode || "none"}`,
      severity: "CRITICAL",
      title: flag.name,
      subtitle: flag.discountCode ? `Discount code: ${flag.discountCode}` : null,
      whatWeFound: `${flag.units} units were sold below product cost${flag.causedByDiscount ? " after discount" : codeSuffix}.`,
      evidence: [
        { label: "Revenue after discount", value: money(flag.revenueAfterDiscount, currency) },
        { label: "Product cost", value: money(flag.cogsKnownTotal, currency) },
        ...(flag.costCoverage < 1
          ? [{ label: "Cost data coverage", value: `${Math.round(flag.costCoverage * 100)}% of these units` }]
          : []),
      ],
      knownProductMargin: flag.knownMargin,
      notIncluded: NOT_INCLUDED,
      whatToDo,
      calculation: [
        `${flag.units} units × avg. net price ${moneyPrecise(avgNet, currency)} = ${money(flag.revenueAfterDiscount, currency)}`,
        `${flag.units} units × cost/unit ${moneyPrecise(avgCost, currency)} = ${money(flag.cogsKnownTotal, currency)}`,
        `Known product margin = ${money(flag.revenueAfterDiscount, currency)} − ${money(flag.cogsKnownTotal, currency)} = ${money(flag.knownMargin, currency)}`,
      ],
      impact: flag.impact,
    };
  }

  // thin_margin_high_volume
  return {
    id: `thin-${flag.sku}`,
    severity: "WARNING",
    title: flag.name,
    subtitle: null,
    whatWeFound: `${flag.units} units sold with only ${pct(flag.knownMarginRate, 1)} known margin — a small cost increase or extra discount would erase it.`,
    evidence: [
      { label: "Revenue after discount", value: money(flag.revenueAfterDiscount, currency) },
      { label: "Product cost", value: money(flag.cogsKnownTotal, currency) },
      ...(flag.costCoverage < 1
        ? [{ label: "Cost data coverage", value: `${Math.round(flag.costCoverage * 100)}% of these units` }]
        : []),
    ],
    knownProductMargin: flag.knownMargin,
    notIncluded: NOT_INCLUDED,
    whatToDo: `Review pricing or supplier cost for ${flag.name} before pushing more volume through it.`,
    calculation: [
      `${flag.units} units × avg. net price ${moneyPrecise(avgNet, currency)} = ${money(flag.revenueAfterDiscount, currency)}`,
      `${flag.units} units × cost/unit ${moneyPrecise(avgCost, currency)} = ${money(flag.cogsKnownTotal, currency)}`,
      `Known margin rate = ${money(flag.knownMargin, currency)} ÷ ${money(flag.revenueAfterDiscount, currency)} = ${pct(flag.knownMarginRate, 1)}`,
    ],
    impact: Math.abs(flag.impact),
  };
}

function concentrationCard(flag, currency, marginKnownForKey) {
  if (marginKnownForKey) return null; // a sharper, evidenced card already covers this SKU/code

  // We may already have enough cost data on these exact lines to know the
  // margin is fine — in that case there's nothing to warn about, and saying
  // "add product costs" would be false (we already have them).
  const known = flag.evidence.filter((i) => i.costKnown);
  const coverage = flag.evidence.length > 0 ? known.length / flag.evidence.length : 0;
  if (coverage >= 0.8) {
    const netRevenue = known.reduce((s, i) => s + i.netRevenue, 0);
    const cogs = known.reduce((s, i) => s + i.cogs, 0);
    const margin = netRevenue - cogs;
    const marginRate = netRevenue > 0 ? margin / netRevenue : null;
    if (margin >= 0 && marginRate !== null && marginRate >= MARGIN_THRESHOLDS.THIN_MARGIN_RATE) {
      return null; // evidenced healthy margin despite the large discount — not a leak
    }
  }

  const subject = flag.dimension === "code" ? `Discount code "${flag.label}"` : flag.label;
  const whatToDo =
    coverage > 0
      ? `Product cost data only covers ${Math.round(coverage * 100)}% of these sales — add the missing "Cost per item" values to confirm whether this is actually eating margin.`
      : "Add product costs to calculate the true margin impact — right now we can only confirm the discount is concentrated, not whether it's unprofitable.";

  return {
    id: `conc-${flag.dimension}-${flag.key}`,
    severity: "INFO",
    title: subject,
    subtitle: flag.dimension === "code" ? null : "Concentrated discount exposure",
    whatWeFound: `${subject} accounts for ${pct(flag.discountShare)} of all discounts given, but only ${pct(flag.revenueShare)} of gross revenue — an average ${pct(flag.discountRate)} off, concentrated on a narrow set of sales.`,
    evidence: [
      { label: "Total discount", value: money(flag.totalDiscount, currency) },
      { label: "Gross revenue covered", value: money(flag.grossRevenue, currency) },
      { label: "Average discount rate", value: pct(flag.discountRate) },
    ],
    knownProductMargin: null,
    marginUnknown: true,
    notIncluded: null,
    whatToDo,
    calculation: [
      `Discount share = ${money(flag.totalDiscount, currency)} ÷ total discounts = ${pct(flag.discountShare)}`,
      `Revenue share = ${money(flag.grossRevenue, currency)} ÷ total gross revenue = ${pct(flag.revenueShare)}`,
      `Concentration ratio = ${pct(flag.discountShare)} ÷ ${pct(flag.revenueShare)} = ${flag.concentrationRatio.toFixed(1)}x`,
    ],
    impact: flag.totalDiscount,
  };
}

export function diagnose({ ordersCsvText, productsCsvText }) {
  const orders = parseOrdersCsv(ordersCsvText);

  if (orders.meta.missingRequired.length > 0) {
    return {
      ok: false,
      error: "orders_missing_columns",
      missingRequired: orders.meta.missingRequired,
    };
  }

  const products = productsCsvText ? parseProductsCsv(productsCsvText) : null;
  const costBySku = products ? products.costBySku : new Map();
  const lineItems = attachCost(orders.lineItems, costBySku);
  const currency = orders.meta.currency || "EUR";

  const discountResult = orders.meta.hasDiscountData ? analyzeDiscounts(lineItems, orders.meta) : null;
  const marginResult = analyzeMargin(lineItems);

  const marginEvidencedKeys = new Set();
  const cards = [];

  if (marginResult.applicable) {
    for (const flag of marginResult.flags) {
      cards.push(marginCardFromFlag(flag, currency));
      marginEvidencedKeys.add(`sku:${flag.sku}`);
      marginEvidencedKeys.add(`code:${flag.discountCode || ""}`);
    }
  }

  if (discountResult) {
    for (const flag of discountResult.flags) {
      const key = flag.dimension === "code" ? `code:${flag.key || ""}` : `sku:${flag.key}`;
      const card = concentrationCard(flag, currency, marginEvidencedKeys.has(key));
      if (card) cards.push(card);
    }
  }

  cards.sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (s !== 0) return s;
    return b.impact - a.impact;
  });

  const knownMarginAtRisk = cards
    .filter((c) => c.severity === "CRITICAL" || c.severity === "WARNING")
    .reduce((s, c) => s + Math.abs(c.knownProductMargin ?? 0), 0);

  const costCoverageSkus = new Set(lineItems.map((l) => l.sku)).size;
  const costKnownSkus = new Set(lineItems.filter((l) => l.costKnown).map((l) => l.sku)).size;

  return {
    ok: true,
    currency,
    meta: {
      ordersCount: orders.meta.ordersCount,
      lineItemsCount: orders.meta.lineItemsCount,
      hasDiscountData: orders.meta.hasDiscountData,
      hasDiscountCodeData: orders.meta.hasDiscountCodeData,
      productsFileProvided: !!productsCsvText,
      costCoverage: {
        skusTotal: costCoverageSkus,
        skusWithCost: costKnownSkus,
        pct: costCoverageSkus > 0 ? costKnownSkus / costCoverageSkus : 0,
      },
      marginAnalysisAvailable: marginResult.applicable,
    },
    headline: {
      leaksCount: cards.length,
      knownMarginAtRisk,
    },
    discountOverview: discountResult,
    marginOverview: marginResult,
    leaks: cards,
  };
}
