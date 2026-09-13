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
