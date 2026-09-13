import { parseOrdersCsv, parseProductsCsv } from "./lib/shopify.js";
import { diagnose } from "./lib/diagnose.js";
import { money, pct } from "./lib/format.js";
import { buildShareSummary } from "./lib/share.js";
import { submitEarlyAccess } from "./lib/leads.js";
import { track } from "./lib/analytics.js";

const state = { ordersText: null, productsText: null, ordersValid: false, lastReport: null, isDemo: false };

function showScreen(id) {
  document.querySelectorAll("[data-screen]").forEach((el) => {
    el.hidden = el.id !== id;
  });
  window.scrollTo(0, 0);
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function setStatus(el, text, cls) {
  el.textContent = text;
  el.className = `file-status ${cls}`;
}

function refreshScanButton() {
  document.getElementById("btn-scan").disabled = !state.ordersValid;
}

async function onOrdersFile(e) {
  const file = e.target.files[0];
  const statusEl = document.getElementById("orders-status");
  const errorEl = document.getElementById("upload-error");
  errorEl.hidden = true;
  if (!file) return;

  state.ordersText = await readFileAsText(file);
  const { meta } = parseOrdersCsv(state.ordersText);

  if (meta.isEmpty) {
    state.ordersValid = false;
    setStatus(statusEl, "This file looks empty — export orders again from Shopify Admin → Orders → Export.", "error");
  } else if (meta.looksLikeProductsFile) {
    state.ordersValid = false;
    setStatus(statusEl, "This looks like a Products export — upload it in the Products field instead.", "error");
  } else if (meta.missingRequired.length > 0) {
    state.ordersValid = false;
    setStatus(statusEl, `Missing required column(s): ${meta.missingRequired.join(", ")}. Make sure this is an unmodified Shopify orders export.`, "error");
  } else {
    state.ordersValid = true;
    const parts = [`${meta.lineItemsCount} order lines across ${meta.ordersCount} orders detected`];
    if (!meta.hasDiscountData) parts.push("no discount column found — discount analysis will be skipped");
    setStatus(statusEl, `✓ ${parts.join(" — ")}`, meta.hasDiscountData ? "ok" : "warn");
  }
  refreshScanButton();
}

async function onProductsFile(e) {
  const file = e.target.files[0];
  const statusEl = document.getElementById("products-status");
  if (!file) return;

  state.productsText = await readFileAsText(file);
  const { meta } = parseProductsCsv(state.productsText);

  if (meta.isEmpty) {
    setStatus(statusEl, "This file looks empty — margin analysis will stay UNKNOWN.", "warn");
    state.productsText = null;
    return;
  }
  if (meta.looksLikeOrdersFile) {
    setStatus(statusEl, "This looks like an Orders export — upload it in the Orders field instead.", "error");
    state.productsText = null;
    return;
  }
  if (!meta.hasSkuColumn) {
    setStatus(statusEl, "Could not find a 'Variant SKU' column — margin analysis will stay UNKNOWN", "warn");
    state.productsText = null;
    return;
  }
  if (!meta.hasCostColumn || meta.rowsWithCost === 0) {
    setStatus(statusEl, "No 'Cost per item' data found — margin analysis will stay UNKNOWN", "warn");
    return;
  }
  setStatus(statusEl, `✓ Cost data found for ${meta.rowsWithCost} of ${meta.rowsWithSku} SKUs`, "ok");
}

function renderKpis(discount, currency) {
  const el = document.getElementById("discount-kpis");
  el.innerHTML = "";
  const items = [
    ["Gross revenue", money(discount.totalGrossRevenue, currency)],
    ["Total discount given", money(discount.totalDiscount, currency)],
    ["Discount rate", pct(discount.discountRateGlobal)],
  ];
  for (const [label, value] of items) {
    const div = document.createElement("div");
    div.className = "kpi";
    div.innerHTML = `<div class="kpi-label">${label}</div><div class="kpi-value">${value}</div>`;
    el.appendChild(div);
  }
}

function renderTable(tableId, rows, labelFn, currency) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  tbody.innerHTML = "";
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="color:var(--muted)">No material discount concentration found</td></tr>`;
    return;
  }
  for (const r of rows.slice(0, 6)) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${labelFn(r)}</td><td>${money(r.totalDiscount, currency)}</td><td>${pct(r.discountRate)}</td>`;
    tbody.appendChild(tr);
  }
}

function renderLeakCard(card, currency) {
  const tpl = document.getElementById("tpl-leak-card");
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.severity = card.severity;

  node.querySelector(".severity-badge").textContent = card.severity;
  node.querySelector(".leak-title").textContent = card.title;
  const subtitleEl = node.querySelector(".leak-subtitle");
  if (card.subtitle) subtitleEl.textContent = card.subtitle;
  else subtitleEl.remove();

  const marginEl = node.querySelector(".leak-margin");
  if (card.knownProductMargin !== null) {
    marginEl.textContent = money(card.knownProductMargin, currency);
    marginEl.style.color = card.knownProductMargin < 0 ? "var(--critical)" : "var(--ink)";
  } else {
    marginEl.textContent = "UNKNOWN";
    marginEl.style.color = "var(--info)";
  }

  node.querySelector(".leak-found").textContent = card.whatWeFound;

  const evEl = node.querySelector(".leak-evidence");
  evEl.innerHTML = card.evidence.map((e) => `<span><b>${e.value}</b> ${e.label}</span>`).join("");

  if (card.notIncluded) {
    const block = node.querySelector(".leak-not-included");
    block.hidden = false;
    block.querySelector("ul").innerHTML = card.notIncluded.map((n) => `<li>${n}</li>`).join("");
  }
  if (card.marginUnknown) {
    const block = node.querySelector(".leak-margin-unknown");
    block.hidden = false;
    block.textContent = "MARGIN IMPACT: UNKNOWN — add product costs to calculate.";
  }

  node.querySelector(".leak-todo").textContent = card.whatToDo;
  node.querySelector(".leak-calc ol").innerHTML = card.calculation.map((line) => `<li>${line}</li>`).join("");

  const details = node.querySelector(".leak-calc");
  let opened = false;
  details.addEventListener("toggle", () => {
    if (details.open && !opened) {
      opened = true;
      track("leak_detail_opened", { severity: card.severity });
    }
  });

  return node;
}

function refererHostname() {
  try {
    return document.referrer ? new URL(document.referrer).hostname : null;
  } catch {
    return null;
  }
}

function wireEarlyAccess(report, isDemo) {
  const form = document.getElementById("form-early-access");
  const success = document.getElementById("early-access-success");
  const willingnessBlock = document.getElementById("willingness-question");
  const willingnessThanks = document.getElementById("willingness-thanks");

  form.hidden = false;
  success.hidden = true;
  willingnessThanks.hidden = true;
  willingnessBlock.querySelectorAll(".btn-choice").forEach((b) => (b.disabled = false));

  const context = {
    source: refererHostname(),
    usedDemo: isDemo,
    leaksCount: report.headline.leaksCount,
    marginUnlocked: report.meta.marginAnalysisAvailable,
  };

  track("early_access_viewed", { is_demo: isDemo, leaks_count: report.headline.leaksCount, margin_unlocked: report.meta.marginAnalysisAvailable });

  let submittedEmail = null;

  form.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("input-email").value.trim();
    if (!email) return;
    submittedEmail = email;
    await submitEarlyAccess({ email, ...context });
    track("early_access_submitted", { is_demo: isDemo, leaks_count: report.headline.leaksCount, margin_unlocked: report.meta.marginAnalysisAvailable });
    form.hidden = true;
    success.hidden = false;
  };

  willingnessBlock.querySelectorAll(".btn-choice").forEach((btn) => {
    btn.onclick = async () => {
      willingnessBlock.querySelectorAll(".btn-choice").forEach((b) => (b.disabled = true));
      await submitEarlyAccess({ email: submittedEmail, ...context, willingnessToPay: btn.dataset.value });
      willingnessThanks.hidden = false;
    };
  });
}

function renderResults(report, isDemo) {
  if (!report.ok) {
    const errorEl = document.getElementById("upload-error");
    errorEl.hidden = false;
    errorEl.textContent = `Could not run the scan: missing required column(s) (${report.missingRequired.join(", ")}). Make sure this is an unmodified Shopify orders export.`;
    return;
  }

  state.lastReport = report;
  state.isDemo = isDemo;

  document.getElementById("demo-banner").hidden = !isDemo;

  document.getElementById("headline-count").textContent = `${report.headline.leaksCount} potential margin leak${report.headline.leaksCount === 1 ? "" : "s"} detected`;
  document.getElementById("headline-amount").textContent =
    report.headline.knownMarginAtRisk > 0 ? `${money(report.headline.knownMarginAtRisk, report.currency)} known product margin at risk` : "No known margin at risk found";

  const cta = document.getElementById("cogs-cta");
  cta.hidden = report.meta.marginAnalysisAvailable;

  if (report.discountOverview) {
    renderKpis(report.discountOverview, report.currency);
    renderTable("table-by-code", report.discountOverview.byCode, (r) => r.code || "(no code)", report.currency);
    renderTable("table-by-sku", report.discountOverview.bySku, (r) => r.name, report.currency);
    document.querySelector(".overview").hidden = false;
  } else {
    document.querySelector(".overview").hidden = true;
  }

  const cardsEl = document.getElementById("leak-cards");
  cardsEl.innerHTML = "";
  if (report.leaks.length === 0) {
    cardsEl.innerHTML = `<p style="color:var(--muted)">No leaks matched our detection thresholds in this data.</p>`;
  } else {
    for (const card of report.leaks) cardsEl.appendChild(renderLeakCard(card, report.currency));
  }

  wireEarlyAccess(report, isDemo);

  track("scan_completed", { is_demo: isDemo, leaks_count: report.headline.leaksCount, margin_unlocked: report.meta.marginAnalysisAvailable });

  showScreen("screen-results");
}

async function runDemoScan() {
  track("demo_started");
  const [ordersRes, productsRes] = await Promise.all([fetch("demo-data/orders.csv"), fetch("demo-data/products.csv")]);
  const ordersCsvText = await ordersRes.text();
  const productsCsvText = await productsRes.text();
  const report = diagnose({ ordersCsvText, productsCsvText });
  renderResults(report, true);
}

function copySummary() {
  if (!state.lastReport) return;
  const text = buildShareSummary(state.lastReport, { isDemo: state.isDemo });
  const btn = document.getElementById("btn-copy-summary");
  navigator.clipboard
    .writeText(text)
    .then(() => {
      const original = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = original), 1500);
    })
    .catch(() => {
      btn.textContent = "Could not copy";
    });
}

function wire() {
  track("landing_viewed");

  document.getElementById("btn-start").addEventListener("click", () => showScreen("screen-upload"));
  document.getElementById("btn-try-demo").addEventListener("click", runDemoScan);
  document.getElementById("btn-back-landing").addEventListener("click", () => showScreen("screen-landing"));
  document.getElementById("btn-add-products").addEventListener("click", () => showScreen("screen-upload"));
  document.getElementById("file-orders").addEventListener("change", onOrdersFile);
  document.getElementById("file-products").addEventListener("change", onProductsFile);
  document.getElementById("btn-copy-summary").addEventListener("click", copySummary);

  document.getElementById("btn-scan").addEventListener("click", () => {
    track("real_scan_started");
    const report = diagnose({ ordersCsvText: state.ordersText, productsCsvText: state.productsText });
    renderResults(report, false);
  });

  document.getElementById("btn-restart").addEventListener("click", () => {
    state.ordersText = null;
    state.productsText = null;
    state.ordersValid = false;
    document.getElementById("file-orders").value = "";
    document.getElementById("file-products").value = "";
    document.getElementById("orders-status").textContent = "";
    document.getElementById("products-status").textContent = "";
    refreshScanButton();
    showScreen("screen-landing");
  });
}

wire();
