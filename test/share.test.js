import { test } from "node:test";
import assert from "node:assert/strict";
import { diagnose } from "../public/src/lib/diagnose.js";
import { buildShareSummary } from "../public/src/lib/share.js";

const ORDER_HEADER = "Name,Currency,Discount Code,Lineitem quantity,Lineitem name,Lineitem sku,Lineitem price,Lineitem discount";
const PRODUCT_HEADER = "Variant SKU,Title,Cost per item";

test("share summary is plain text and includes headline + every leak, no HTML", () => {
  const ordersCsv = [ORDER_HEADER, "#1,EUR,SUMMER20,27,Summer Bundle Pack,SUMMER-PACK,68.75,371.25"].join("\n");
  const productsCsv = [PRODUCT_HEADER, "SUMMER-PACK,Summer Bundle Pack,58"].join("\n");
  const report = diagnose({ ordersCsvText: ordersCsv, productsCsvText: productsCsv });

  const summary = buildShareSummary(report, { isDemo: false });
  assert.ok(summary.includes("1 potential margin leak detected"));
  assert.ok(summary.includes("CRITICAL"));
  assert.ok(summary.includes("Summer Bundle Pack"));
  assert.ok(summary.includes("Not included: payment fees"));
  assert.ok(!summary.includes("<"), "summary should be plain text, not HTML");
});

test("share summary marks demo scans distinctly", () => {
  const ordersCsv = [ORDER_HEADER, "#1,EUR,,1,Widget,W-1,10,0"].join("\n");
  const report = diagnose({ ordersCsvText: ordersCsv, productsCsvText: null });
  const summary = buildShareSummary(report, { isDemo: true });
  assert.ok(summary.startsWith("Margiqo Margin Scan (demo data)"));
});

test("share summary never claims a known figure for an UNKNOWN-margin leak", () => {
  const items = [
    "#1,EUR,BIGCODE,5,Widget,W-1,100,200",
    ...Array.from({ length: 10 }, (_, i) => `#${i + 2},EUR,,10,Other,O-${i},100,0`),
  ];
  const ordersCsv = [ORDER_HEADER, ...items].join("\n");
  const report = diagnose({ ordersCsvText: ordersCsv, productsCsvText: null });
  const summary = buildShareSummary(report, { isDemo: false });
  assert.ok(summary.includes("UNKNOWN"));
});

test("share summary translates to Spanish when locale is es", () => {
  const ordersCsv = [ORDER_HEADER, "#1,EUR,SUMMER20,27,Summer Bundle Pack,SUMMER-PACK,68.75,371.25"].join("\n");
  const productsCsv = [PRODUCT_HEADER, "SUMMER-PACK,Summer Bundle Pack,58"].join("\n");
  const report = diagnose({ ordersCsvText: ordersCsv, productsCsvText: productsCsv, locale: "es" });

  const summary = buildShareSummary(report, { isDemo: true, locale: "es" });
  assert.ok(summary.startsWith("Escaneo de margen de Margiqo (datos de demostración)"));
  assert.ok(summary.includes("fuga de margen detectada"));
  assert.ok(summary.includes("No incluido: comisiones de pago"));
  assert.ok(!summary.includes("<"), "summary should be plain text, not HTML");
});
