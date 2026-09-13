import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeDiscounts, THRESHOLDS } from "../src/lib/discountLeakage.js";

function li({ sku, code, price, qty, discount }) {
  return {
    sku,
    name: sku,
    discountCode: code,
    unitPrice: price,
    quantity: qty,
    lineDiscount: discount,
    grossRevenue: price * qty,
    netRevenue: price * qty - discount,
  };
}

test("computes global discount rate from raw line items", () => {
  const items = [li({ sku: "A", code: null, price: 100, qty: 1, discount: 20 }), li({ sku: "B", code: null, price: 100, qty: 1, discount: 0 })];
  const result = analyzeDiscounts(items, { hasDiscountCodeData: true });
  assert.equal(result.totalGrossRevenue, 200);
  assert.equal(result.totalDiscount, 20);
  assert.equal(result.discountRateGlobal, 0.1);
});

test("does not flag a large discount that is not concentrated", () => {
  // Every SKU gets an identical 30% discount -> no disproportionate concentration anywhere.
  const items = Array.from({ length: 5 }, (_, i) => li({ sku: `S${i}`, code: "SITEWIDE30", price: 100, qty: 10, discount: 300 }));
  const result = analyzeDiscounts(items, { hasDiscountCodeData: true });
  assert.equal(result.flags.length, 0, "uniform, evenly-spread discounts are not evidence of a leak by themselves");
});

test("flags a code that absorbs disproportionate discount relative to its revenue share", () => {
  const items = [
    // NICHE10PCT: small revenue share but a very large share of total discount, at an aggressive rate.
    li({ sku: "A", code: "NICHE-BIG-DISCOUNT", price: 100, qty: 5, discount: 200 }), // 40% off, €500 gross
    // baseline: most revenue, tiny discount
    ...Array.from({ length: 10 }, (_, i) => li({ sku: `B${i}`, code: null, price: 100, qty: 10, discount: 0 })),
  ];
  const result = analyzeDiscounts(items, { hasDiscountCodeData: true });
  const flag = result.flags.find((f) => f.dimension === "code" && f.key === "NICHE-BIG-DISCOUNT");
  assert.ok(flag, "expected a concentration flag on the aggressive code");
  assert.ok(flag.discountRate >= THRESHOLDS.AGGRESSIVE_RATE);
  assert.ok(flag.concentrationRatio >= THRESHOLDS.CONCENTRATION_RATIO);
});

test("ignores discounts below the materiality floor", () => {
  const items = [li({ sku: "A", code: "TINY", price: 10, qty: 1, discount: 2 })];
  const result = analyzeDiscounts(items, { hasDiscountCodeData: true });
  assert.equal(result.flags.length, 0);
});

test("skips per-code breakdown when Discount Code column is absent", () => {
  const items = [li({ sku: "A", code: null, price: 100, qty: 1, discount: 20 })];
  const result = analyzeDiscounts(items, { hasDiscountCodeData: false });
  assert.deepEqual(result.byCode, []);
});
