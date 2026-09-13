import { parseCsv } from "./csv.js";

// Columns we actually rely on. Everything else in a real Shopify export is
// ignored on purpose — we never guess at fields we haven't verified exist.
const ORDER_REQUIRED = ["Name", "Lineitem sku", "Lineitem quantity", "Lineitem price"];
const ORDER_DISCOUNT_COL = "Lineitem discount";
const ORDER_DISCOUNT_CODE_COL = "Discount Code";
const ORDER_CURRENCY_COL = "Currency";

const PRODUCT_SKU_COL = "Variant SKU";
const PRODUCT_COST_COL = "Cost per item";
const PRODUCT_TITLE_COL = "Title";

// Handles plain numbers, currency-symbol prefixes, accounting-style
// parenthesized negatives, and both thousands-separator conventions
// (1,234.56 and 1.234,56) — the reasonable variety a merchant's export or
// a re-save through Excel might introduce. Anything else returns null
// (UNKNOWN) rather than guess.
function toNumberOrNull(raw) {
  if (raw === undefined || raw === null) return null;
  let s = String(raw).trim();
  if (s === "") return null;
  s = s.replace(/[€$£]/g, "").trim();

  let negative = false;
  const paren = s.match(/^\((.*)\)$/);
  if (paren) {
    negative = true;
    s = paren[1].trim();
  }

  if (!/^-?[\d.,]+$/.test(s)) return null;

  let normalized = s;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    normalized = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma > -1) {
    const digitsAfterComma = s.length - lastComma - 1;
    const commaCount = (s.match(/,/g) || []).length;
    normalized = commaCount === 1 && digitsAfterComma === 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/**
 * Parses a Shopify orders.csv export into normalized line items.
 *
 * Real Shopify order exports repeat one row per line item, but only the
 * FIRST row of each order carries the order-level fields (Discount Code,
 * Discount Amount, Currency, ...) — continuation rows leave them blank.
 * We forward-fill those from the order's first row.
 */
// A file that's missing the order columns but clearly has a Products
// export shape — lets the UI say "wrong field" instead of "bad file".
export function looksLikeProductsFile(headers) {
  return headers.includes(PRODUCT_SKU_COL) && !ORDER_REQUIRED.every((c) => headers.includes(c));
}
export function looksLikeOrdersFile(headers) {
  return headers.includes("Lineitem sku") && !headers.includes(PRODUCT_SKU_COL);
}

export function parseOrdersCsv(text) {
  const { headers, records } = parseCsv(text);

  const missingRequired = ORDER_REQUIRED.filter((c) => !headers.includes(c));
  const hasDiscountData = headers.includes(ORDER_DISCOUNT_COL);
  const hasDiscountCodeData = headers.includes(ORDER_DISCOUNT_CODE_COL);
  const hasCurrencyData = headers.includes(ORDER_CURRENCY_COL);

  const result = {
    lineItems: [],
    meta: {
      columns: headers,
      missingRequired,
      isEmpty: headers.length === 0,
      looksLikeProductsFile: missingRequired.length > 0 && looksLikeProductsFile(headers),
      hasDiscountData,
      hasDiscountCodeData,
      ordersCount: 0,
      lineItemsCount: 0,
      currency: null,
    },
  };

  if (missingRequired.length > 0) return result;

  let currentOrder = null;
  const seenOrders = new Set();
  let firstCurrency = null;

  for (const rec of records) {
    const name = (rec["Name"] || "").trim();
    const sku = (rec["Lineitem sku"] || "").trim();
    const qty = toNumberOrNull(rec["Lineitem quantity"]);
    const price = toNumberOrNull(rec["Lineitem price"]);

    if (name !== "") {
      currentOrder = {
        name,
        discountCode: hasDiscountCodeData ? (rec[ORDER_DISCOUNT_CODE_COL] || "").trim() || null : null,
        currency: hasCurrencyData ? (rec[ORDER_CURRENCY_COL] || "").trim() || null : null,
      };
    }

    // A row with no order name and no line item data is a blank/summary
    // artifact some exporters leave behind — skip it rather than guess.
    if (!currentOrder || sku === "" || qty === null || price === null) continue;

    if (!seenOrders.has(currentOrder.name)) seenOrders.add(currentOrder.name);
    if (!firstCurrency && currentOrder.currency) firstCurrency = currentOrder.currency;

    const lineDiscount = hasDiscountData ? toNumberOrNull(rec[ORDER_DISCOUNT_COL]) ?? 0 : 0;

    result.lineItems.push({
      orderName: currentOrder.name,
      discountCode: currentOrder.discountCode,
      sku,
      name: (rec["Lineitem name"] || sku).trim(),
      quantity: qty,
      unitPrice: price,
      lineDiscount,
      grossRevenue: qty * price,
      netRevenue: qty * price - lineDiscount,
    });
  }

  result.meta.ordersCount = seenOrders.size;
  result.meta.lineItemsCount = result.lineItems.length;
  result.meta.currency = firstCurrency;
  return result;
}

/**
 * Parses a Shopify products.csv export into a SKU -> cost-per-item map.
 * A SKU absent from the map, or present with an empty cost, is UNKNOWN —
 * never defaulted or estimated.
 */
export function parseProductsCsv(text) {
  const { headers, records } = parseCsv(text);

  const hasSkuColumn = headers.includes(PRODUCT_SKU_COL);
  const hasCostColumn = headers.includes(PRODUCT_COST_COL);

  const result = {
    costBySku: new Map(),
    titleBySku: new Map(),
    meta: {
      columns: headers,
      hasSkuColumn,
      hasCostColumn,
      isEmpty: headers.length === 0,
      looksLikeOrdersFile: !hasSkuColumn && looksLikeOrdersFile(headers),
      rowsTotal: 0,
      rowsWithSku: 0,
      rowsWithCost: 0,
    },
  };

  if (!hasSkuColumn) return result;

  for (const rec of records) {
    result.meta.rowsTotal++;
    const sku = (rec[PRODUCT_SKU_COL] || "").trim();
    if (sku === "") continue;
    result.meta.rowsWithSku++;

    if (hasCostColumn) {
      const cost = toNumberOrNull(rec[PRODUCT_COST_COL]);
      if (cost !== null) {
        result.costBySku.set(sku, cost);
        result.meta.rowsWithCost++;
      }
    }
    const title = (rec[PRODUCT_TITLE_COL] || "").trim();
    if (title) result.titleBySku.set(sku, title);
  }

  return result;
}

/**
 * Joins line items with the product cost map. Never invents a cost:
 * costKnown is false whenever the SKU isn't in costBySku.
 */
export function attachCost(lineItems, costBySku) {
  return lineItems.map((li) => {
    const unitCost = costBySku.has(li.sku) ? costBySku.get(li.sku) : null;
    const costKnown = unitCost !== null;
    const cogs = costKnown ? unitCost * li.quantity : null;
    return {
      ...li,
      unitCost,
      costKnown,
      cogs,
      knownMargin: costKnown ? li.netRevenue - cogs : null,
      marginWithoutDiscount: costKnown ? li.grossRevenue - cogs : null,
    };
  });
}
