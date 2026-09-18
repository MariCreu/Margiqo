import { parseOrdersCsv, parseProductsCsv, attachCost } from "./shopify.js";
import { analyzeDiscounts } from "./discountLeakage.js";
import { analyzeMargin, THRESHOLDS as MARGIN_THRESHOLDS } from "./marginLeak.js";
import { money, moneyPrecise, pct } from "./format.js";
import { getStrings, getNumberLocale } from "./i18n.js";

export const NOT_INCLUDED = getStrings("en").diagnose.notIncluded;

const SEVERITY_ORDER = { CRITICAL: 0, WARNING: 1, INFO: 2 };

function marginCardFromFlag(flag, currency, locale) {
  const t = getStrings(locale).diagnose;
  const numberLocale = getNumberLocale(locale);
  const avgNet = flag.revenueAfterDiscount / flag.units;
  const avgCost = flag.cogsKnownTotal / flag.units;
  const codeSuffix = t.codeSuffix(flag.discountCode);

  if (flag.type === "negative_known_margin") {
    const whatToDo = flag.causedByDiscount
      ? t.negativeMargin.whatToDoCaused(flag.name, flag.discountCode)
      : t.negativeMargin.whatToDoOther(flag.name, codeSuffix);

    return {
      id: `neg-${flag.sku}-${flag.discountCode || "none"}`,
      severity: "CRITICAL",
      title: flag.name,
      subtitle: flag.discountCode ? t.negativeMargin.subtitle(flag.discountCode) : null,
      whatWeFound: flag.causedByDiscount
        ? t.negativeMargin.whatFoundCaused(flag.units)
        : t.negativeMargin.whatFoundOther(flag.units, codeSuffix),
      evidence: [
        { label: t.evidence.revenueAfterDiscount, value: money(flag.revenueAfterDiscount, currency, numberLocale) },
        { label: t.evidence.productCost, value: money(flag.cogsKnownTotal, currency, numberLocale) },
        ...(flag.costCoverage < 1
          ? [{ label: t.evidence.costDataCoverageLabel, value: t.evidence.costCoverageValue(Math.round(flag.costCoverage * 100)) }]
          : []),
      ],
      knownProductMargin: flag.knownMargin,
      notIncluded: t.notIncluded,
      whatToDo,
      calculation: [
        t.calc.avgPriceLine(flag.units, moneyPrecise(avgNet, currency, numberLocale), money(flag.revenueAfterDiscount, currency, numberLocale)),
        t.calc.costLine(flag.units, moneyPrecise(avgCost, currency, numberLocale), money(flag.cogsKnownTotal, currency, numberLocale)),
        t.calc.marginLine(money(flag.revenueAfterDiscount, currency, numberLocale), money(flag.cogsKnownTotal, currency, numberLocale), money(flag.knownMargin, currency, numberLocale)),
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
    whatWeFound: t.thinMargin.whatFound(flag.units, pct(flag.knownMarginRate, 1)),
    evidence: [
      { label: t.evidence.revenueAfterDiscount, value: money(flag.revenueAfterDiscount, currency, numberLocale) },
      { label: t.evidence.productCost, value: money(flag.cogsKnownTotal, currency, numberLocale) },
      ...(flag.costCoverage < 1
        ? [{ label: t.evidence.costDataCoverageLabel, value: t.evidence.costCoverageValue(Math.round(flag.costCoverage * 100)) }]
        : []),
    ],
    knownProductMargin: flag.knownMargin,
    notIncluded: t.notIncluded,
    whatToDo: t.thinMargin.whatToDo(flag.name),
    calculation: [
      t.calc.avgPriceLine(flag.units, moneyPrecise(avgNet, currency, numberLocale), money(flag.revenueAfterDiscount, currency, numberLocale)),
      t.calc.costLine(flag.units, moneyPrecise(avgCost, currency, numberLocale), money(flag.cogsKnownTotal, currency, numberLocale)),
      t.calc.marginRateLine(money(flag.knownMargin, currency, numberLocale), money(flag.revenueAfterDiscount, currency, numberLocale), pct(flag.knownMarginRate, 1)),
    ],
    impact: Math.abs(flag.impact),
  };
}

function concentrationCard(flag, currency, marginKnownForKey, locale) {
  if (marginKnownForKey) return null; // a sharper, evidenced card already covers this SKU/code

  const t = getStrings(locale).diagnose;
  const numberLocale = getNumberLocale(locale);

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

  const subject = flag.dimension === "code" ? t.concentration.subjectCode(flag.label) : flag.label;
  const whatToDo = coverage > 0 ? t.concentration.whatToDoPartial(Math.round(coverage * 100)) : t.concentration.whatToDoNone;

  return {
    id: `conc-${flag.dimension}-${flag.key}`,
    severity: "INFO",
    title: subject,
    subtitle: flag.dimension === "code" ? null : t.concentration.subtitleSku,
    whatWeFound: t.concentration.whatFound(subject, pct(flag.discountShare), pct(flag.revenueShare), pct(flag.discountRate)),
    evidence: [
      { label: t.evidence.totalDiscount, value: money(flag.totalDiscount, currency, numberLocale) },
      { label: t.evidence.grossRevenueCovered, value: money(flag.grossRevenue, currency, numberLocale) },
      { label: t.evidence.averageDiscountRate, value: pct(flag.discountRate) },
    ],
    knownProductMargin: null,
    marginUnknown: true,
    notIncluded: null,
    whatToDo,
    calculation: [
      t.calc.discountShareLine(money(flag.totalDiscount, currency, numberLocale), pct(flag.discountShare)),
      t.calc.revenueShareLine(money(flag.grossRevenue, currency, numberLocale), pct(flag.revenueShare)),
      t.calc.concentrationLine(pct(flag.discountShare), pct(flag.revenueShare), flag.concentrationRatio.toFixed(1)),
    ],
    impact: flag.totalDiscount,
  };
}

export function diagnose({ ordersCsvText, productsCsvText, locale = "en" }) {
  const orders = parseOrdersCsv(ordersCsvText);

  if (orders.meta.missingRequired.length > 0) {
    return {
      ok: false,
      error: orders.meta.isEmpty ? "orders_empty" : "orders_missing_columns",
      missingRequired: orders.meta.missingRequired,
      looksLikeProductsFile: orders.meta.looksLikeProductsFile,
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
      cards.push(marginCardFromFlag(flag, currency, locale));
      marginEvidencedKeys.add(`sku:${flag.sku}`);
      marginEvidencedKeys.add(`code:${flag.discountCode || ""}`);
    }
  }

  if (discountResult) {
    for (const flag of discountResult.flags) {
      const key = flag.dimension === "code" ? `code:${flag.key || ""}` : `sku:${flag.key}`;
      const card = concentrationCard(flag, currency, marginEvidencedKeys.has(key), locale);
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
