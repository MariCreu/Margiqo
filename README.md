# ProfitDoctor (provisional name)

> "Your store is leaking money. We'll find where."

Self-service profit-leak diagnostic for ecommerce stores. Independent
project — no code, branding, models, or infrastructure shared with any
other product.

## Phase 1: Margin Leak Doctor

A single-page, **entirely client-side** tool. A merchant uploads their own
Shopify `orders.csv` (+ optionally `products.csv`), and gets a diagnosis in
the browser — nothing is ever sent to a server.

```
landing → upload orders.csv (+ products.csv) → validation → scan → diagnosis
```

It runs two detectors, chosen over the original Returns Doctor hypothesis
after researching what Shopify's exports actually contain — see
[`docs/DETECTOR-COMPARISON.md`](docs/DETECTOR-COMPARISON.md):

1. **Discount Leakage** — which discount codes/products absorb
   disproportionate discount, backed by evidence (concentration + rate),
   never flagged for size alone.
2. **Low / Negative Product Margin** — sales priced below product cost
   after discount, and thin-margin products at real volume. Only runs for
   SKUs with known cost data; never estimates a missing cost.

### The one rule that matters more than any feature

**"Known product margin" is never called "profit."** It's
`revenue after discount − product cost`, nothing else. Payment fees,
advertising, fulfillment, actual shipping cost, and returns are not
included — every card says so explicitly, and every € figure expands into
the exact formula and inputs behind it ("How is this calculated?"). See
[`docs/FORMULAS.md`](docs/FORMULAS.md).

### KNOWN / ESTIMATED / UNKNOWN

Preference order: **KNOWN > ESTIMATED > UNKNOWN**. Phase 1 deliberately has
no ESTIMATED values — everything is either computed directly from the data
you provided (KNOWN) or explicitly missing (UNKNOWN, with a CTA to fix it).
Nothing is ever defaulted or guessed: no invented COGS, shipping cost,
payment fee, or ad spend. ESTIMATED is reserved for a future phase with a
defensible, disclosed estimation method.

## Running it

```bash
npm start          # serves the app at http://localhost:4173
npm test           # unit tests (node:test) for every detector + parser
npm run e2e        # drives a real Chromium browser through the full flow
```

No build step, no dependencies to install for the app itself. The E2E
script uses the `playwright` package pre-installed globally in this
environment (symlinked into `node_modules/`); on another machine, run
`npm i -D playwright && npx playwright install chromium` first.

Try it with the demo dataset in `demo-data/` — see
[`docs/DEMO-SCENARIO.md`](docs/DEMO-SCENARIO.md) for what it contains and
what the scan should find.

## Docs

- [`docs/DATA-AVAILABILITY.md`](docs/DATA-AVAILABILITY.md) — what Shopify's
  native exports actually contain (researched, not assumed)
- [`docs/DETECTOR-COMPARISON.md`](docs/DETECTOR-COMPARISON.md) — why this
  detector pair replaced the original Returns Doctor hypothesis
- [`docs/FORMULAS.md`](docs/FORMULAS.md) — every formula and threshold,
  with a worked example
- [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md) — what this deliberately
  does not do yet
- [`docs/DEMO-SCENARIO.md`](docs/DEMO-SCENARIO.md) — the demo dataset and
  expected scan result

## Explicitly not in Phase 1

Shopify OAuth, Shopify App, billing, user accounts, any database, Returns
Doctor, Shipping Doctor, Ads Doctor, external APIs, LLM-generated
recommendations. Recommendations are deterministic rules (e.g. *"discount
code causes negative known margin for SKU → exclude SKU from that
promotion"*). See `docs/LIMITATIONS.md` for the full list.

## Status

Phase 1 built and validated against a demo dataset (unit tests + a real
browser E2E run — see `e2e/screenshots/`). **Not yet validated against a
real store's export.** That's the next step before any decision on Phase 2.

## Why this repo is not yet connected to GitHub

This session's GitHub access could not create a new repository under this
account (`403 Resource not accessible by integration`) — repo creation is
scoped to a pre-approved list per session. This is a local git repo only.

### To publish it, from your own machine or GitHub UI:

```bash
# 1. Create an empty repo named "profitdoctor" on GitHub (no README/license,
#    so it doesn't conflict with this history), then:
git remote add origin https://github.com/<your-github-username>/profitdoctor.git
git push -u origin main
```

If you'd rather have Claude push it in a future session, grant that session
access to a `profitdoctor` repo you create yourself first (Claude can push
to a repo it's been given access to, but cannot create the repo itself in
this environment).
