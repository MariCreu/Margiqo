import { parseOrdersCsv, parseProductsCsv } from "./lib/shopify.js";
import { diagnose } from "./lib/diagnose.js";
import { money, pct } from "./lib/format.js";
import { buildShareSummary } from "./lib/share.js";
import { submitEarlyAccess } from "./lib/leads.js";
import { track } from "./lib/analytics.js";
import { getStrings, getNumberLocale, getLocale } from "./lib/i18n.js";

const locale = getLocale();
const numberLocale = getNumberLocale(locale);
const t = getStrings(locale);

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
    setStatus(statusEl, t.app.fileStatus.ordersEmpty, "error");
  } else if (meta.looksLikeProductsFile) {
    state.ordersValid = false;
    setStatus(statusEl, t.app.fileStatus.ordersLooksLikeProducts, "error");
  } else if (meta.missingRequired.length > 0) {
    state.ordersValid = false;
    setStatus(statusEl, t.app.fileStatus.ordersMissingColumns(meta.missingRequired.join(", ")), "error");
  } else {
    state.ordersValid = true;
    const parts = [t.app.fileStatus.ordersOk(meta.lineItemsCount, meta.ordersCount)];
    if (!meta.hasDiscountData) parts.push(t.app.fileStatus.ordersNoDiscountColumn);
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
    setStatus(statusEl, t.app.fileStatus.productsEmpty, "warn");
    state.productsText = null;
    return;
  }
  if (meta.looksLikeOrdersFile) {
    setStatus(statusEl, t.app.fileStatus.productsLooksLikeOrders, "error");
    state.productsText = null;
    return;
  }
  if (!meta.hasSkuColumn) {
    setStatus(statusEl, t.app.fileStatus.productsNoSkuColumn, "warn");
    state.productsText = null;
    return;
  }
  if (!meta.hasCostColumn || meta.rowsWithCost === 0) {
    setStatus(statusEl, t.app.fileStatus.productsNoCostColumn, "warn");
    return;
  }
  setStatus(statusEl, `✓ ${t.app.fileStatus.productsOk(meta.rowsWithCost, meta.rowsWithSku)}`, "ok");
}

function renderKpis(discount, currency) {
  const el = document.getElementById("discount-kpis");
  el.innerHTML = "";
  const items = [
    [t.app.kpis.grossRevenue, money(discount.totalGrossRevenue, currency, numberLocale)],
    [t.app.kpis.totalDiscountGiven, money(discount.totalDiscount, currency, numberLocale)],
    [t.app.kpis.discountRate, pct(discount.discountRateGlobal)],
  ];
  for (const [label, value] of items) {
    const div = document.createElement("div");
    div.className = "kpi";
    div.innerHTML = `<div class="kpi-label">${label}</div><div class="kpi-value">${value}</div>`;
    el.appendChild(div);
  }
}

// The report states what it actually read, so a reader can judge the figures.
function renderScanBasis(meta) {
  const coverage = meta.costCoverage;
  const rows = [
    [t.app.scanBasis.orders, meta.ordersCount.toLocaleString(numberLocale)],
    [t.app.scanBasis.orderLines, meta.lineItemsCount.toLocaleString(numberLocale)],
    [t.app.scanBasis.productsWithCost, coverage.skusTotal > 0 ? `${coverage.skusWithCost} of ${coverage.skusTotal}` : t.app.scanBasis.noneProvided],
  ];
  document.getElementById("scan-basis").innerHTML = rows
    .map(([term, value]) => `<div class="basis-row"><dt>${term}</dt><dd>${value}</dd></div>`)
    .join("");
}

function renderTable(tableId, rows, labelFn, currency) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  tbody.innerHTML = "";
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="table-empty">${t.app.table.noMaterialConcentration}</td></tr>`;
    return;
  }
  for (const r of rows.slice(0, 6)) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${labelFn(r)}</td><td>${money(r.totalDiscount, currency, numberLocale)}</td><td>${pct(r.discountRate)}</td>`;
    tbody.appendChild(tr);
  }
}

function renderLeakCard(card, currency) {
  const tpl = document.getElementById("tpl-leak-card");
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.severity = card.severity;

  node.querySelector(".severity-badge").textContent = t.app.severity[card.severity] || card.severity;
  node.querySelector(".leak-title").textContent = card.title;
  const subtitleEl = node.querySelector(".leak-subtitle");
  if (card.subtitle) subtitleEl.textContent = card.subtitle;
  else subtitleEl.remove();

  const marginEl = node.querySelector(".leak-margin");
  if (card.knownProductMargin !== null) {
    marginEl.textContent = money(card.knownProductMargin, currency, numberLocale);
    marginEl.dataset.sign = card.knownProductMargin < 0 ? "negative" : "positive";
  } else {
    marginEl.textContent = t.app.marginUnknown;
    marginEl.dataset.sign = "unknown";
  }

  node.querySelector(".leak-found").textContent = card.whatWeFound;

  const evEl = node.querySelector(".leak-evidence");
  evEl.innerHTML = card.evidence.map((e) => `<span class="ev"><b class="ev-value">${e.value}</b><i class="ev-label">${e.label}</i></span>`).join("");

  if (card.notIncluded) {
    const block = node.querySelector(".leak-not-included");
    block.hidden = false;
    // Reads as one quiet sentence rather than a second panel competing with the figures.
    block.querySelector(".leak-excluded").textContent = card.notIncluded.map((n) => n.toLowerCase()).join(", ");
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
    errorEl.textContent = t.app.resultsError(report.missingRequired.join(", "));
    return;
  }

  state.lastReport = report;
  state.isDemo = isDemo;

  document.getElementById("demo-banner").hidden = !isDemo;

  document.getElementById("headline-count").textContent = t.app.headline.leaksDetected(report.headline.leaksCount);
  const amountEl = document.getElementById("headline-amount");
  if (report.headline.knownMarginAtRisk > 0) {
    amountEl.innerHTML = `<span class="fig"></span><span class="qual">${t.app.headline.atRiskQualifier}</span>`;
    amountEl.querySelector(".fig").textContent = money(report.headline.knownMarginAtRisk, report.currency, numberLocale);
  } else {
    amountEl.innerHTML = `<span class="fig-none">${t.app.headline.none}</span>`;
  }

  renderScanBasis(report.meta);

  const cta = document.getElementById("cogs-cta");
  cta.hidden = report.meta.marginAnalysisAvailable;

  if (report.discountOverview) {
    renderKpis(report.discountOverview, report.currency);
    renderTable("table-by-code", report.discountOverview.byCode, (r) => r.code || t.app.table.noCode, report.currency);
    renderTable("table-by-sku", report.discountOverview.bySku, (r) => r.name, report.currency);
    document.querySelector(".overview").hidden = false;
  } else {
    document.querySelector(".overview").hidden = true;
  }

  const cardsEl = document.getElementById("leak-cards");
  cardsEl.innerHTML = "";
  if (report.leaks.length === 0) {
    cardsEl.innerHTML = `<p style="color:var(--muted)">${t.app.noLeaksMatched}</p>`;
  } else {
    for (const card of report.leaks) cardsEl.appendChild(renderLeakCard(card, report.currency));
  }

  wireEarlyAccess(report, isDemo);

  track("scan_completed", { is_demo: isDemo, leaks_count: report.headline.leaksCount, margin_unlocked: report.meta.marginAnalysisAvailable });

  showScreen("screen-results");
}

async function runDemoScan() {
  track("demo_started");
  const [ordersRes, productsRes] = await Promise.all([fetch("/demo-data/orders.csv"), fetch("/demo-data/products.csv")]);
  const ordersCsvText = await ordersRes.text();
  const productsCsvText = await productsRes.text();
  const report = diagnose({ ordersCsvText, productsCsvText, locale });
  renderResults(report, true);
}

function copySummary() {
  if (!state.lastReport) return;
  const text = buildShareSummary(state.lastReport, { isDemo: state.isDemo, locale });
  const btn = document.getElementById("btn-copy-summary");
  navigator.clipboard
    .writeText(text)
    .then(() => {
      const original = btn.textContent;
      btn.textContent = t.app.copySummary.copied;
      setTimeout(() => (btn.textContent = original), 1500);
    })
    .catch(() => {
      btn.textContent = t.app.copySummary.couldNotCopy;
    });
}

function wire() {
  track("landing_viewed");

  document.querySelectorAll("[data-go-upload]").forEach((el) => el.addEventListener("click", () => showScreen("screen-upload")));
  document.getElementById("btn-try-demo").addEventListener("click", runDemoScan);
  document.getElementById("btn-back-landing").addEventListener("click", () => showScreen("screen-landing"));
  document.getElementById("btn-add-products").addEventListener("click", () => showScreen("screen-upload"));
  document.getElementById("file-orders").addEventListener("change", onOrdersFile);
  document.getElementById("file-products").addEventListener("change", onProductsFile);
  document.getElementById("btn-copy-summary").addEventListener("click", copySummary);

  document.getElementById("btn-scan").addEventListener("click", () => {
    track("real_scan_started");
    const report = diagnose({ ordersCsvText: state.ordersText, productsCsvText: state.productsText, locale });
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
