import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOrdersCsv, parseProductsCsv, attachCost } from "../src/lib/shopify.js";

const ORDER_HEADER = "Name,Email,Financial Status,Currency,Discount Code,Discount Amount,Lineitem quantity,Lineitem name,Lineitem sku,Lineitem price,Lineitem discount";

test("forward-fills order-level fields onto continuation line-item rows", () => {
  const csv = [
    ORDER_HEADER,
    "#1001,a@x.com,paid,EUR,SUMMER20,10.00,2,Shirt,SHIRT-1,25,5",
    ',,,,,,1,Hat,HAT-1,15,0', // continuation row of #1001 — Name is blank
    "#1002,b@x.com,paid,EUR,,0,1,Shirt,SHIRT-1,25,0",
  ].join("\n");

  const { lineItems, meta } = parseOrdersCsv(csv);

  assert.equal(meta.ordersCount, 2);
  assert.equal(lineItems.length, 3);
  assert.equal(lineItems[0].discountCode, "SUMMER20");
  assert.equal(lineItems[1].discountCode, "SUMMER20", "continuation row should inherit the order's discount code");
  assert.equal(lineItems[1].orderName, "#1001");
  assert.equal(lineItems[2].discountCode, null);
});

test("computes gross and net revenue per line", () => {
  const csv = [ORDER_HEADER, "#1,a@x.com,paid,EUR,CODE,5,3,Widget,W-1,10,5"].join("\n");
  const { lineItems } = parseOrdersCsv(csv);
  assert.equal(lineItems[0].grossRevenue, 30);
  assert.equal(lineItems[0].netRevenue, 25);
});

test("reports missing required columns instead of guessing", () => {
  const csv = "Name,Email\n#1,a@x.com\n";
  const { lineItems, meta } = parseOrdersCsv(csv);
  assert.deepEqual(lineItems, []);
  assert.ok(meta.missingRequired.includes("Lineitem sku"));
  assert.ok(meta.missingRequired.includes("Lineitem quantity"));
  assert.ok(meta.missingRequired.includes("Lineitem price"));
});

test("flags absence of the discount column instead of assuming zero discount", () => {
  const csv = "Name,Lineitem quantity,Lineitem sku,Lineitem price\n#1,1,W-1,10\n";
  const { meta, lineItems } = parseOrdersCsv(csv);
  assert.equal(meta.hasDiscountData, false);
  assert.equal(lineItems[0].lineDiscount, 0);
});

test("products.csv: parses cost per item and flags missing cost as unknown, not zero", () => {
  const csv = "Variant SKU,Title,Cost per item\nW-1,Widget,4.50\nW-2,Gadget,\n";
  const { costBySku, meta } = parseProductsCsv(csv);
  assert.equal(costBySku.get("W-1"), 4.5);
  assert.equal(costBySku.has("W-2"), false);
  assert.equal(meta.rowsWithCost, 1);
  assert.equal(meta.rowsWithSku, 2);
});

test("attachCost never invents a cost for an unmatched SKU", () => {
  const lineItems = [
    { sku: "W-1", quantity: 2, netRevenue: 20, grossRevenue: 20 },
    { sku: "UNKNOWN-SKU", quantity: 1, netRevenue: 10, grossRevenue: 10 },
  ];
  const costBySku = new Map([["W-1", 4]]);
  const result = attachCost(lineItems, costBySku);

  assert.equal(result[0].costKnown, true);
  assert.equal(result[0].cogs, 8);
  assert.equal(result[0].knownMargin, 12);

  assert.equal(result[1].costKnown, false);
  assert.equal(result[1].cogs, null);
  assert.equal(result[1].knownMargin, null);
});

test("treats an explicit cost of 0 as known, not missing", () => {
  const csv = "Variant SKU,Cost per item\nFREE-1,0\n";
  const { costBySku } = parseProductsCsv(csv);
  assert.equal(costBySku.get("FREE-1"), 0);
});
