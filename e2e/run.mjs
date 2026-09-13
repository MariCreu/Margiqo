// End-to-end check of the full upload -> scan -> diagnosis flow in a real
// browser, against the demo dataset. Not a test framework — just enough to
// prove the UI renders what the pure detector logic computes.
import { chromium } from "playwright";
import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { diagnose } from "../src/lib/diagnose.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4321;

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

function startServer() {
  const server = createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    const filePath = path.join(projectRoot, urlPath);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

async function main() {
  const shotsDir = path.join(projectRoot, "e2e", "screenshots");
  fs.mkdirSync(shotsDir, { recursive: true });

  const ordersPath = path.join(projectRoot, "demo-data", "orders.csv");
  const productsPath = path.join(projectRoot, "demo-data", "products.csv");

  // Ground truth computed directly from the same pure functions the UI calls.
  const expected = diagnose({
    ordersCsvText: fs.readFileSync(ordersPath, "utf8"),
    productsCsvText: fs.readFileSync(productsPath, "utf8"),
  });
  assert.equal(expected.ok, true);

  const server = await startServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await page.goto(`http://localhost:${PORT}/`);

    await page.screenshot({ path: path.join(shotsDir, "01-landing.png"), fullPage: true });
    assert.match(await page.textContent("h1"), /leaking money/i);

    await page.click("#btn-start");
    await page.waitForSelector("#screen-upload:not([hidden])");
    await page.screenshot({ path: path.join(shotsDir, "02-upload-empty.png"), fullPage: true });

    await page.setInputFiles("#file-orders", ordersPath);
    await page.waitForFunction(() => document.getElementById("orders-status").textContent.length > 0);
    const ordersStatus = await page.textContent("#orders-status");
    assert.match(ordersStatus, /70 order lines across 69 orders/);

    await page.setInputFiles("#file-products", productsPath);
    await page.waitForFunction(() => document.getElementById("products-status").textContent.length > 0);
    const productsStatus = await page.textContent("#products-status");
    assert.match(productsStatus, /Cost data found for 9 of 10 SKUs/);

    await page.screenshot({ path: path.join(shotsDir, "03-upload-filled.png"), fullPage: true });

    assert.equal(await page.isEnabled("#btn-scan"), true);
    await page.click("#btn-scan");
    await page.waitForSelector("#screen-results:not([hidden])");

    const headlineCount = await page.textContent("#headline-count");
    assert.equal(headlineCount.trim(), `${expected.headline.leaksCount} margin leaks detected`);

    const headlineAmount = await page.textContent("#headline-amount");
    assert.ok(headlineAmount.includes(`${Math.round(expected.headline.knownMarginAtRisk)}`), `expected amount to mention ${expected.headline.knownMarginAtRisk}, got "${headlineAmount}"`);

    // Cost coverage is 90% here (margin analysis IS available) — the
    // "add product costs" banner must stay hidden, not just visually absent.
    assert.equal(expected.meta.marginAnalysisAvailable, true);
    assert.equal(await page.isHidden("#cogs-cta"), true, "cogs-cta banner should be hidden when margin analysis is available");

    const cardTitles = await page.$$eval(".leak-title", (els) => els.map((e) => e.textContent));
    assert.deepEqual(cardTitles, expected.leaks.map((l) => l.title));

    const firstCardSeverity = await page.getAttribute(".leak-card", "data-severity");
    assert.equal(firstCardSeverity, "CRITICAL");

    const firstCardMargin = await page.textContent(".leak-card .leak-margin");
    assert.ok(firstCardMargin.includes("81"), `expected the top card to show -€81, got "${firstCardMargin}"`);

    // Expand "How is this calculated?" on the top card and confirm it shows numbers.
    await page.click(".leak-card details summary");
    const calcText = await page.textContent(".leak-card details ol");
    assert.match(calcText, /1,485|1485/);
    assert.match(calcText, /1,566|1566/);

    await page.screenshot({ path: path.join(shotsDir, "04-results.png"), fullPage: true });

    console.log("E2E OK — screenshots written to e2e/screenshots/");
    console.log(`Leaks detected: ${expected.headline.leaksCount}, known margin at risk: ${expected.headline.knownMarginAtRisk}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error("E2E FAILED:", err);
  process.exit(1);
});
