import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeMargin, THRESHOLDS } from "../src/lib/marginLeak.js";
import { attachCost } from "../src/lib/shopify.js";

function rawLi({ sku, code, price, qty, discount }) {
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

test("reports not applicable when no product cost data exists at all", () => {
  const items = attachCost([rawLi({ sku: "A", code: null, price: 10, qty: 1, discount: 0 })], new Map());
  const result = analyzeMargin(items);
  assert.equal(result.applicable, false);
  assert.equal(result.reason, "no_cost_data");
});

test("the Summer Pack example: a discount turns a profitable SKU into a loss", () => {
  // 27 units, price 68.75, 20% off (SUMMER20) -> net revenue 1485.00, cost 58/unit -> cogs 1566.00
  const items = attachCost(
    [rawLi({ sku: "SUMMER-PACK", code: "SUMMER20", price: 68.75, qty: 27, discount: 371.25 })],
    new Map([["SUMMER-PACK", 58]])
  );
  const result = analyzeMargin(items);
  assert.equal(result.applicable, true);

  const flag = result.flags.find((f) => f.type === "negative_known_margin");
  assert.ok(flag, "expected a negative known margin flag");
  assert.equal(Math.round(flag.revenueAfterDiscount), 1485);
  assert.equal(Math.round(flag.cogsKnownTotal), 1566);
  assert.equal(Math.round(flag.knownMargin), -81);
  assert.equal(flag.causedByDiscount, true, "would have been profitable at full price");
});

test("a SKU already unprofitable before any discount is not blamed on the discount", () => {
  const items = attachCost([rawLi({ sku: "BAD-COST", code: "ANY10", price: 10, qty: 5, discount: 5 })], new Map([["BAD-COST", 20]]));
  const result = analyzeMargin(items);
  const flag = result.flags.find((f) => f.type === "negative_known_margin");
  assert.ok(flag);
  assert.equal(flag.causedByDiscount, false);
});

test("flags thin margin at high volume, but not a single small sale", () => {
  const highVolumeThin = attachCost(
    [rawLi({ sku: "THIN", code: null, price: 10, qty: 100, discount: 0 })], // revenue 1000, margin rate must be < 8%
    new Map([["THIN", 9.3]]) // margin 7% roughly
  );
  const result = analyzeMargin(highVolumeThin);
  const flag = result.flags.find((f) => f.type === "thin_margin_high_volume");
  assert.ok(flag, "expected a thin-margin flag for a high-revenue, low-margin SKU");
  assert.ok(flag.knownMarginRate < THRESHOLDS.THIN_MARGIN_RATE);

  const smallSaleThin = attachCost([rawLi({ sku: "SMALL", code: null, price: 10, qty: 1, discount: 0 })], new Map([["SMALL", 9.3]]));
  const smallResult = analyzeMargin(smallSaleThin);
  assert.equal(
    smallResult.flags.find((f) => f.sku === "SMALL"),
    undefined,
    "a single low-revenue sale shouldn't be surfaced as a volume risk"
  );
});

test("a SKU with only partial cost coverage still computes margin from the known lines", () => {
  const items = attachCost(
    [rawLi({ sku: "PARTIAL", code: null, price: 10, qty: 1, discount: 0 }), rawLi({ sku: "PARTIAL", code: null, price: 10, qty: 1, discount: 0 })],
    new Map() // no cost known for either line in this call — sanity check zero coverage skips
  );
  const result = analyzeMargin(items);
  assert.equal(result.applicable, false);
});

test("healthy margin produces no flags", () => {
  const items = attachCost([rawLi({ sku: "GOOD", code: null, price: 100, qty: 10, discount: 0 })], new Map([["GOOD", 40]]));
  const result = analyzeMargin(items);
  assert.equal(result.flags.length, 0);
});
