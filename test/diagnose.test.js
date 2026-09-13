import { test } from "node:test";
import assert from "node:assert/strict";
import { diagnose, NOT_INCLUDED } from "../src/lib/diagnose.js";

const ORDER_HEADER = "Name,Currency,Discount Code,Lineitem quantity,Lineitem name,Lineitem sku,Lineitem price,Lineitem discount";
const PRODUCT_HEADER = "Variant SKU,Title,Cost per item";

test("end to end: Summer Pack scenario produces a CRITICAL card with full calculation trail", () => {
  const ordersCsv = [ORDER_HEADER, "#1,EUR,SUMMER20,27,Summer Pack,SUMMER-PACK,68.75,371.25"].join("\n");
  const productsCsv = [PRODUCT_HEADER, "SUMMER-PACK,Summer Pack,58"].join("\n");

  const result = diagnose({ ordersCsvText: ordersCsv, productsCsvText: productsCsv });

  assert.equal(result.ok, true);
  assert.equal(result.meta.marginAnalysisAvailable, true);
  assert.equal(result.headline.leaksCount, 1);
  assert.equal(Math.round(result.headline.knownMarginAtRisk), 81);

  const card = result.leaks[0];
  assert.equal(card.severity, "CRITICAL");
  assert.equal(card.title, "Summer Pack");
  assert.equal(Math.round(card.knownProductMargin), -81);
  assert.deepEqual(card.notIncluded, NOT_INCLUDED);
  assert.ok(card.calculation.length >= 3);
  assert.ok(card.whatToDo.includes("SUMMER20"));
});

test("runs discount leakage even with no products.csv, and marks margin as unavailable", () => {
  const items = [
    "#1,EUR,BIGCODE,5,Widget,W-1,100,200",
    ...Array.from({ length: 10 }, (_, i) => `#${i + 2},EUR,,10,Other,O-${i},100,0`),
  ];
  const ordersCsv = [ORDER_HEADER, ...items].join("\n");

  const result = diagnose({ ordersCsvText: ordersCsv, productsCsvText: null });

  assert.equal(result.ok, true);
  assert.equal(result.meta.productsFileProvided, false);
  assert.equal(result.meta.marginAnalysisAvailable, false);
  assert.ok(result.leaks.length > 0, "discount concentration should still be detected without cost data");
  assert.equal(result.leaks[0].knownProductMargin, null);
  assert.equal(result.leaks[0].marginUnknown, true);
});

test("does not block the scan when orders.csv has the required columns but products.csv is missing cost coverage", () => {
  const ordersCsv = [ORDER_HEADER, "#1,EUR,,1,Widget,W-1,100,0"].join("\n");
  const productsCsv = [PRODUCT_HEADER, "W-1,Widget,"].join("\n"); // cost blank
  const result = diagnose({ ordersCsvText: ordersCsv, productsCsvText: productsCsv });

  assert.equal(result.ok, true);
  assert.equal(result.meta.costCoverage.skusWithCost, 0);
  assert.equal(result.meta.marginAnalysisAvailable, false);
});

test("reports missing required order columns instead of a silent empty scan", () => {
  const result = diagnose({ ordersCsvText: "Name,Email\n#1,a@x.com\n", productsCsvText: null });
  assert.equal(result.ok, false);
  assert.equal(result.error, "orders_missing_columns");
  assert.ok(result.missingRequired.length > 0);
});

test("reports an empty orders file distinctly from a wrong-shaped one", () => {
  const result = diagnose({ ordersCsvText: "", productsCsvText: null });
  assert.equal(result.ok, false);
  assert.equal(result.error, "orders_empty");
});

test("flags a Products file uploaded into the Orders slot with an actionable hint", () => {
  const result = diagnose({ ordersCsvText: "Variant SKU,Title,Cost per item\nW-1,Widget,4\n", productsCsvText: null });
  assert.equal(result.ok, false);
  assert.equal(result.looksLikeProductsFile, true);
});

test("known-margin aggregation never includes an UNKNOWN card's impact", () => {
  // One CRITICAL card with cost data (known -€50), and one concentrated
  // discount code on a SKU with no cost data at all (margin unknown).
  const ordersCsv = [
    ORDER_HEADER,
    "#1,EUR,LOSSCODE,10,Loss Item,LOSS-1,10,60", // net 40, cost 90 -> known margin -50
    "#2,EUR,BIGCODE,5,No Cost Item,NOCOST-1,100,200", // aggressive discount, no cost data
    ...Array.from({ length: 10 }, (_, i) => `#${i + 3},EUR,,10,Filler,F-${i},100,0`),
  ].join("\n");
  const productsCsv = [PRODUCT_HEADER, "LOSS-1,Loss Item,9"].join("\n"); // cost/unit 9 * 10 = 90

  const result = diagnose({ ordersCsvText: ordersCsv, productsCsvText: productsCsv });

  const unknownCard = result.leaks.find((l) => l.knownProductMargin === null);
  const knownCard = result.leaks.find((l) => l.knownProductMargin !== null);
  assert.ok(unknownCard, "expected an UNKNOWN-margin card for the no-cost SKU");
  assert.ok(knownCard, "expected a KNOWN-margin card for the loss-making SKU");

  // The aggregate headline figure must equal only the KNOWN card's impact —
  // an UNKNOWN card can never contribute a euro amount to it.
  assert.equal(Math.round(result.headline.knownMarginAtRisk), Math.round(Math.abs(knownCard.knownProductMargin)));
});
