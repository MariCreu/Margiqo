// Generates the Phase 1 demo dataset for a fictional Shopify store,
// "Aurora Home & Living". Deterministic on purpose, so the expected scan
// result (see docs/DEMO-SCENARIO.md) never drifts from what's on disk.
//
// Run: node demo-data/generate.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

const ORDER_HEADER = [
  "Name",
  "Email",
  "Financial Status",
  "Currency",
  "Discount Code",
  "Discount Amount",
  "Created at",
  "Lineitem quantity",
  "Lineitem name",
  "Lineitem sku",
  "Lineitem price",
  "Lineitem discount",
  "Payment Method",
];

const PRODUCT_HEADER = ["Handle", "Title", "Vendor", "Variant SKU", "Variant Price", "Cost per item"];

let orderSeq = 2001;
const rows = [];
const round2 = (n) => Math.round(n * 100) / 100;

function order(sku, name, price, qty, { code = "", discount = 0, email = "customer@example.com", date = "2026-08-20 10:00:00 -0400" } = {}) {
  rows.push([
    `#${orderSeq++}`,
    email,
    "paid",
    "EUR",
    code,
    discount ? round2(discount) : "",
    date,
    qty,
    name,
    sku,
    price,
    discount ? round2(discount) : 0,
    "shopify_payments",
  ]);
}

// One multi-line order, to exercise the real Shopify export quirk where
// only the first row of an order carries order-level fields (here: Name,
// Email, Financial Status, Currency, Created at) and continuation rows
// leave them blank.
function multiLineOrder(lines, { email = "customer@example.com", date = "2026-08-21 09:15:00 -0400" } = {}) {
  const name = `#${orderSeq++}`;
  lines.forEach((line, idx) => {
    rows.push([
      idx === 0 ? name : "",
      idx === 0 ? email : "",
      idx === 0 ? "paid" : "",
      idx === 0 ? "EUR" : "",
      line.code || "",
      idx === 0 ? (line.discount ? round2(line.discount) : "") : "",
      idx === 0 ? date : "",
      line.qty,
      line.name,
      line.sku,
      line.price,
      line.discount ? round2(line.discount) : 0,
      idx === 0 ? "shopify_payments" : "",
    ]);
  });
}

// --- CRITICAL: Summer Bundle Pack sold below cost after SUMMER20 -----------
// 27 units @ €68.75, 20% off -> net €1,485.00; cost €58/unit -> COGS €1,566.00
// Known product margin = -€81 (see docs/FORMULAS.md worked example)
for (const qty of [6, 5, 4, 6, 6]) {
  order("SUMMER-PACK", "Summer Bundle Pack", 68.75, qty, { code: "SUMMER20", discount: 68.75 * qty * 0.2 });
}

// --- Not a leak: Reed Diffuser at 50% off, but margin stays healthy --------
// 20 units @ €30, 50% off -> net €300; cost €10/unit -> COGS €200; margin €100 (33%)
for (const qty of [8, 7, 5]) {
  order("DIFFUSER-REED", "Reed Diffuser", 30, qty, { code: "CLEAROUT50", discount: 30 * qty * 0.5 });
}

// --- INFO: Ceramic Vase under an aggressive, concentrated code, cost unknown
for (const qty of [8, 7]) {
  order("VASE-CERAMIC", "Ceramic Vase", 22, qty, { code: "VASEFLASH35", discount: 22 * qty * 0.35 });
}
order("VASE-CERAMIC", "Ceramic Vase", 22, 10, { code: "VIP15", discount: 22 * 10 * 0.15 });
for (const qty of [5, 5, 5, 5, 5, 5, 5, 5]) order("VASE-CERAMIC", "Ceramic Vase", 22, qty);

// --- WARNING: Knit Throw Blanket — thin margin at real volume, no discount -
// 40 units @ €45; cost €41.50/unit -> margin €140 total (7.8%)
for (const qty of [10, 10, 10, 10]) order("THROW-BLANKET", "Knit Throw Blanket", 45, qty);

// --- Healthy baseline SKUs: some carry the sitewide VIP15 code, spread
// evenly enough that it never looks concentrated on any one of them.
order("CANDLE-LAV", "Lavender Candle", 24, 10, { code: "VIP15", discount: 24 * 10 * 0.15 });
for (const qty of [8, 8, 8, 8, 8]) order("CANDLE-LAV", "Lavender Candle", 24, qty);

order("CANDLE-VAN", "Vanilla Candle", 24, 10, { code: "VIP15", discount: 24 * 10 * 0.15 });
for (const qty of [8, 8, 8, 8, 8]) order("CANDLE-VAN", "Vanilla Candle", 24, qty);

order("MUG-CERAMIC", "Ceramic Mug", 18, 10, { code: "VIP15", discount: 18 * 10 * 0.15 });
for (const qty of [10, 10, 10, 10, 10, 10]) order("MUG-CERAMIC", "Ceramic Mug", 18, qty);

for (const qty of [10, 10, 10, 10, 10, 10, 10, 10]) order("TOTE-CANVAS", "Canvas Tote Bag", 16, qty);
for (const qty of Array(10).fill(10)) order("NOTEBOOK-KRAFT", "Kraft Notebook", 9, qty);
for (const qty of [20, 20, 20, 20, 20, 20]) order("SOAP-BAR", "Handmade Soap Bar", 7, qty);

// A couple of small, single-unit orders for texture/realism.
order("CANDLE-LAV", "Lavender Candle", 24, 1);
order("MUG-CERAMIC", "Ceramic Mug", 18, 2);

// The multi-line order exercising the forward-fill quirk.
multiLineOrder([
  { sku: "CANDLE-LAV", name: "Lavender Candle", price: 24, qty: 2 },
  { sku: "MUG-CERAMIC", name: "Ceramic Mug", price: 18, qty: 3 },
]);

const ordersCsv = [ORDER_HEADER, ...rows].map((r) => r.map(csvField).join(",")).join("\n") + "\n";

function csvField(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const products = [
  ["summer-bundle-pack", "Summer Bundle Pack", "Aurora Home & Living", "SUMMER-PACK", 68.75, 58],
  ["lavender-candle", "Lavender Candle", "Aurora Home & Living", "CANDLE-LAV", 24, 8],
  ["vanilla-candle", "Vanilla Candle", "Aurora Home & Living", "CANDLE-VAN", 24, 8],
  ["ceramic-mug", "Ceramic Mug", "Aurora Home & Living", "MUG-CERAMIC", 18, 6.5],
  ["knit-throw-blanket", "Knit Throw Blanket", "Aurora Home & Living", "THROW-BLANKET", 45, 41.5],
  ["reed-diffuser", "Reed Diffuser", "Aurora Home & Living", "DIFFUSER-REED", 30, 10],
  ["canvas-tote-bag", "Canvas Tote Bag", "Aurora Home & Living", "TOTE-CANVAS", 16, 5],
  ["kraft-notebook", "Kraft Notebook", "Aurora Home & Living", "NOTEBOOK-KRAFT", 9, 3],
  ["handmade-soap-bar", "Handmade Soap Bar", "Aurora Home & Living", "SOAP-BAR", 7, 2.5],
  // Cost per item deliberately left blank — this merchant never filled it in.
  ["ceramic-vase", "Ceramic Vase", "Aurora Home & Living", "VASE-CERAMIC", 22, ""],
];
const productsCsv = [PRODUCT_HEADER, ...products].map((r) => r.map(csvField).join(",")).join("\n") + "\n";

fs.writeFileSync(path.join(dir, "orders.csv"), ordersCsv);
fs.writeFileSync(path.join(dir, "products.csv"), productsCsv);

console.log(`Wrote ${rows.length} order lines and ${products.length} products.`);
