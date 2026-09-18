// Central string table for the two supported locales. diagnose.js, app.js
// and share.js pull every user-facing string from here instead of
// hardcoding English — this file changes what language things are said
// in, never what's computed (the underlying numbers/logic are identical
// regardless of locale; only format.js's number formatting differs).
//
// Locale is detected once, from the page itself (<html lang="...">), by
// getLocale() below — each static page (public/index.html vs
// public/es/index.html) declares its own lang, so there's no runtime
// switcher state to manage.

export const NUMBER_LOCALE = { en: "en-US", es: "es-ES" };

function codeSuffixEn(code) {
  return code ? ` under discount code "${code}"` : "";
}
function codeSuffixEs(code) {
  return code ? ` bajo el código de descuento "${code}"` : "";
}

const en = {
  diagnose: {
    notIncluded: ["Payment fees", "Advertising", "Fulfillment", "Actual shipping cost", "Returns"],
    codeSuffix: codeSuffixEn,
    negativeMargin: {
      whatFoundCaused: (units) => `${units} units were sold below product cost after discount.`,
      whatFoundOther: (units, codeSuffix) => `${units} units were sold below product cost${codeSuffix}.`,
      whatToDoCaused: (name, code) => `Exclude ${name} from discount code "${code}", or reduce the discount so it stays above product cost.`,
      whatToDoOther: (name, codeSuffix) => `Review the base price or supplier cost of ${name} — it is unprofitable on known costs alone${codeSuffix}, before any discount is even considered.`,
      subtitle: (code) => `Discount code: ${code}`,
    },
    evidence: {
      revenueAfterDiscount: "Revenue after discount",
      productCost: "Product cost",
      costDataCoverageLabel: "Cost data coverage",
      costCoverageValue: (pctRounded) => `${pctRounded}% of these units`,
      totalDiscount: "Total discount",
      grossRevenueCovered: "Gross revenue covered",
      averageDiscountRate: "Average discount rate",
    },
    calc: {
      avgPriceLine: (units, avgNet, revenue) => `${units} units × avg. net price ${avgNet} = ${revenue}`,
      costLine: (units, avgCost, cogs) => `${units} units × cost/unit ${avgCost} = ${cogs}`,
      marginLine: (revenue, cogs, margin) => `Known product margin = ${revenue} − ${cogs} = ${margin}`,
      marginRateLine: (margin, revenue, rate) => `Known margin rate = ${margin} ÷ ${revenue} = ${rate}`,
      discountShareLine: (totalDiscount, share) => `Discount share = ${totalDiscount} ÷ total discounts = ${share}`,
      revenueShareLine: (grossRevenue, share) => `Revenue share = ${grossRevenue} ÷ total gross revenue = ${share}`,
      concentrationLine: (share, revShare, ratio) => `Concentration ratio = ${share} ÷ ${revShare} = ${ratio}x`,
    },
    thinMargin: {
      whatFound: (units, rate) => `${units} units sold with only ${rate} known margin — a small cost increase or extra discount would erase it.`,
      whatToDo: (name) => `Review pricing or supplier cost for ${name} before pushing more volume through it.`,
    },
    concentration: {
      subjectCode: (code) => `Discount code "${code}"`,
      subtitleSku: "Concentrated discount exposure",
      whatFound: (subject, discountShare, revenueShare, rate) =>
        `${subject} accounts for ${discountShare} of all discounts given, but only ${revenueShare} of gross revenue — an average ${rate} off, concentrated on a narrow set of sales.`,
      whatToDoPartial: (pctRounded) =>
        `Product cost data only covers ${pctRounded}% of these sales — add the missing "Cost per item" values to confirm whether this is actually eating margin.`,
      whatToDoNone: "Add product costs to calculate the true margin impact — right now we can only confirm the discount is concentrated, not whether it's unprofitable.",
    },
  },
  app: {
    fileStatus: {
      ordersEmpty: "This file looks empty — export orders again from Shopify Admin → Orders → Export.",
      ordersLooksLikeProducts: "This looks like a Products export — upload it in the Products field instead.",
      ordersMissingColumns: (list) => `Missing required column(s): ${list}. Make sure this is an unmodified Shopify orders export.`,
      ordersOk: (lines, orders) => `${lines} order lines across ${orders} orders detected`,
      ordersNoDiscountColumn: "no discount column found — discount analysis will be skipped",
      productsEmpty: "This file looks empty — margin analysis will stay UNKNOWN.",
      productsLooksLikeOrders: "This looks like an Orders export — upload it in the Orders field instead.",
      productsNoSkuColumn: "Could not find a 'Variant SKU' column — margin analysis will stay UNKNOWN",
      productsNoCostColumn: "No 'Cost per item' data found — margin analysis will stay UNKNOWN",
      productsOk: (withCost, total) => `Cost data found for ${withCost} of ${total} SKUs`,
    },
    kpis: { grossRevenue: "Gross revenue", totalDiscountGiven: "Total discount given", discountRate: "Discount rate" },
    scanBasis: { orders: "Orders", orderLines: "Order lines", productsWithCost: "Products with a known cost", noneProvided: "none provided" },
    table: { noMaterialConcentration: "No material discount concentration found", noCode: "(no code)" },
    severity: { CRITICAL: "Critical", WARNING: "Warning", INFO: "Info" },
    marginUnknown: "Margin unknown",
    headline: {
      leaksDetected: (n) => `${n} potential margin leak${n === 1 ? "" : "s"} detected`,
      atRisk: (amount) => `${amount} known product margin at risk`,
      atRiskQualifier: "known product margin at risk",
      none: "No known margin at risk found",
    },
    copySummary: { copied: "Copied!", couldNotCopy: "Could not copy" },
    resultsError: (list) => `Could not run the scan: missing required column(s) (${list}). Make sure this is an unmodified Shopify orders export.`,
    noLeaksMatched: "No leaks matched our detection thresholds in this data.",
  },
  share: {
    title: (isDemo) => `Margiqo Margin Scan${isDemo ? " (demo data)" : ""}`,
    notIncludedLine: "Not included: payment fees, advertising, fulfillment, actual shipping cost, returns.",
    generatedBy: "Generated by Margiqo (prototype) — a free, self-service Shopify margin leak scanner.",
    unknown: "UNKNOWN",
  },
};

const es = {
  diagnose: {
    notIncluded: ["Comisiones de pago", "Publicidad", "Logística y preparación", "Coste real de envío", "Devoluciones"],
    codeSuffix: codeSuffixEs,
    negativeMargin: {
      whatFoundCaused: (units) => `Se vendieron ${units} unidades por debajo del coste del producto tras aplicar el descuento.`,
      whatFoundOther: (units, codeSuffix) => `Se vendieron ${units} unidades por debajo del coste del producto${codeSuffix}.`,
      whatToDoCaused: (name, code) => `Excluye ${name} del código de descuento "${code}", o reduce el descuento para que se mantenga por encima del coste del producto.`,
      whatToDoOther: (name, codeSuffix) => `Revisa el precio base o el coste de proveedor de ${name} — no es rentable solo con los costes conocidos${codeSuffix}, antes de considerar ningún descuento.`,
      subtitle: (code) => `Código de descuento: ${code}`,
    },
    evidence: {
      revenueAfterDiscount: "Ingresos tras descuento",
      productCost: "Coste del producto",
      costDataCoverageLabel: "Cobertura de datos de coste",
      costCoverageValue: (pctRounded) => `${pctRounded}% de estas unidades`,
      totalDiscount: "Descuento total",
      grossRevenueCovered: "Ingresos brutos cubiertos",
      averageDiscountRate: "Descuento medio",
    },
    calc: {
      avgPriceLine: (units, avgNet, revenue) => `${units} unidades × precio neto medio ${avgNet} = ${revenue}`,
      costLine: (units, avgCost, cogs) => `${units} unidades × coste/unidad ${avgCost} = ${cogs}`,
      marginLine: (revenue, cogs, margin) => `Margen de producto conocido = ${revenue} − ${cogs} = ${margin}`,
      marginRateLine: (margin, revenue, rate) => `Tasa de margen conocido = ${margin} ÷ ${revenue} = ${rate}`,
      discountShareLine: (totalDiscount, share) => `Cuota de descuento = ${totalDiscount} ÷ descuento total = ${share}`,
      revenueShareLine: (grossRevenue, share) => `Cuota de ingresos = ${grossRevenue} ÷ ingresos brutos totales = ${share}`,
      concentrationLine: (share, revShare, ratio) => `Ratio de concentración = ${share} ÷ ${revShare} = ${ratio}x`,
    },
    thinMargin: {
      whatFound: (units, rate) => `Se vendieron ${units} unidades con solo un ${rate} de margen conocido — una pequeña subida de coste o un descuento adicional lo eliminaría.`,
      whatToDo: (name) => `Revisa el precio o el coste de proveedor de ${name} antes de escalar más volumen.`,
    },
    concentration: {
      subjectCode: (code) => `El código de descuento "${code}"`,
      subtitleSku: "Exposición concentrada a descuentos",
      whatFound: (subject, discountShare, revenueShare, rate) =>
        `${subject} supone el ${discountShare} de todo el descuento concedido, pero solo el ${revenueShare} de los ingresos brutos — una media del ${rate} de descuento, concentrado en un grupo reducido de ventas.`,
      whatToDoPartial: (pctRounded) =>
        `Los datos de coste de producto solo cubren el ${pctRounded}% de estas ventas — añade los valores de "Cost per item" que faltan para confirmar si esto realmente está dañando el margen.`,
      whatToDoNone: "Añade costes de producto para calcular el impacto real en el margen — de momento solo podemos confirmar que el descuento está concentrado, no si es deficitario.",
    },
  },
  app: {
    fileStatus: {
      ordersEmpty: "Este archivo parece vacío — vuelve a exportar los pedidos desde Shopify Admin → Pedidos → Exportar.",
      ordersLooksLikeProducts: "Esto parece una exportación de Productos — súbelo en el campo de Productos.",
      ordersMissingColumns: (list) => `Faltan columnas obligatorias: ${list}. Asegúrate de que es una exportación de pedidos de Shopify sin modificar.`,
      ordersOk: (lines, orders) => `${lines} líneas de pedido detectadas en ${orders} pedidos`,
      ordersNoDiscountColumn: "no se encontró columna de descuento — se omitirá el análisis de descuentos",
      productsEmpty: "Este archivo parece vacío — el análisis de margen quedará como DESCONOCIDO.",
      productsLooksLikeOrders: "Esto parece una exportación de Pedidos — súbelo en el campo de Pedidos.",
      productsNoSkuColumn: "No se encontró la columna 'Variant SKU' — el análisis de margen quedará como DESCONOCIDO",
      productsNoCostColumn: "No se encontraron datos de 'Cost per item' — el análisis de margen quedará como DESCONOCIDO",
      productsOk: (withCost, total) => `Coste encontrado para ${withCost} de ${total} SKUs`,
    },
    kpis: { grossRevenue: "Ingresos brutos", totalDiscountGiven: "Descuento total concedido", discountRate: "Tasa de descuento" },
    scanBasis: { orders: "Pedidos", orderLines: "Líneas de pedido", productsWithCost: "Productos con coste conocido", noneProvided: "ninguno proporcionado" },
    table: { noMaterialConcentration: "No se encontró concentración de descuento significativa", noCode: "(sin código)" },
    severity: { CRITICAL: "Crítico", WARNING: "Aviso", INFO: "Info" },
    marginUnknown: "Margen desconocido",
    headline: {
      leaksDetected: (n) => `${n} posible${n === 1 ? "" : "s"} fuga${n === 1 ? "" : "s"} de margen detectada${n === 1 ? "" : "s"}`,
      atRisk: (amount) => `${amount} de margen de producto conocido en riesgo`,
      atRiskQualifier: "de margen de producto conocido en riesgo",
      none: "No se encontró margen conocido en riesgo",
    },
    copySummary: { copied: "¡Copiado!", couldNotCopy: "No se pudo copiar" },
    resultsError: (list) => `No se pudo ejecutar el escaneo: faltan columnas obligatorias (${list}). Asegúrate de que es una exportación de pedidos de Shopify sin modificar.`,
    noLeaksMatched: "Ningún resultado superó nuestros umbrales de detección con estos datos.",
  },
  share: {
    title: (isDemo) => `Escaneo de margen de Margiqo${isDemo ? " (datos de demostración)" : ""}`,
    notIncludedLine: "No incluido: comisiones de pago, publicidad, logística, coste real de envío, devoluciones.",
    generatedBy: "Generado por Margiqo (prototipo) — un escáner de fugas de margen para Shopify, gratuito y self-service.",
    unknown: "DESCONOCIDO",
  },
};

const LOCALES = { en, es };

export function getStrings(locale) {
  return LOCALES[locale] || LOCALES.en;
}

export function getNumberLocale(locale) {
  return NUMBER_LOCALE[locale] || NUMBER_LOCALE.en;
}

// Reads the page's own declared language — each static HTML file (e.g.
// public/index.html vs public/es/index.html) sets <html lang="...">, so
// this is the single source of truth, no separate runtime state.
export function getLocale() {
  const lang = (typeof document !== "undefined" && document.documentElement.lang) || "en";
  return LOCALES[lang] ? lang : "en";
}
