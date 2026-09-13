# Margiqo

> "Your store is leaking money. We'll find where."

Self-service profit-leak diagnostic for ecommerce stores. Independent
project — no code, branding, models, or infrastructure shared with any
other product. Formerly developed under the working name "ProfitDoctor";
that name has been fully retired in favor of the definitive name **Margiqo**
(domain: margiqo.com).

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

## Phase 1.5: public, self-service validation

Phase 1 proved the diagnosis works. Phase 1.5 turns it into something you
can hand a merchant as a URL, with no call, demo, or onboarding from us:

```
landing → understand the value in seconds → try demo data OR upload real CSVs
        → scan → diagnosis ("I didn't know I was selling this at a loss")
        → optional: join early access for automatic monitoring
```

Additions on top of Phase 1: a rebuilt landing page (10-second value prop,
privacy-as-advantage messaging, SEO meta/OG/structured data), a one-click
**"Try with demo data"** path clearly marked `DEMO STORE — Sample data`
throughout, a hardened CSV parser (currency symbols, European decimal
commas, reordered columns, wrong-file-in-wrong-slot detection), a
plain-text **"Copy summary"** share action (no PDF, nothing persisted), and
a post-scan **early-access** email capture with a separate, optional
willingness-to-pay follow-up. See
[`docs/VALIDATION-CRITERIA.md`](docs/VALIDATION-CRITERIA.md) for what this
phase is actually trying to measure, and
[`docs/PRIVACY.md`](docs/PRIVACY.md) for exactly what does and doesn't
leave the browser.

## Running it

```bash
npm start          # serves the app at http://localhost:4173
npm test           # unit tests (node:test) for every detector + parser
npm run e2e        # drives a real Chromium browser through 4 flows + mobile
```

No build step, no dependencies to install for the app itself. The E2E
script uses the `playwright` package pre-installed globally in this
environment (symlinked into `node_modules/`); on another machine, run
`npm i -D playwright && npx playwright install chromium` first.

Try it with the demo dataset in `public/demo-data/` — see
[`docs/DEMO-SCENARIO.md`](docs/DEMO-SCENARIO.md) for what it contains and
what the scan should find — or click "Try with demo data" on the landing
page itself once it's running.

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
- [`docs/PRIVACY.md`](docs/PRIVACY.md) — the privacy model, checked
  against the actual code, not just asserted
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — how to put this on a real
  URL cheaply
- [`docs/PRICING.md`](docs/PRICING.md) — the unvalidated pricing
  hypothesis this phase is designed to test
- [`docs/VALIDATION-CRITERIA.md`](docs/VALIDATION-CRITERIA.md) — what
  "this is working" and "this isn't" actually look like

## Explicitly not in Phase 1 / 1.5

Shopify OAuth, Shopify App, billing/Stripe, user accounts, a persistent
database of stores, Returns Doctor, Shipping Doctor, Ads Doctor, external
APIs, LLM-generated recommendations, i18n. Recommendations are
deterministic rules (e.g. *"discount code causes negative known margin for
SKU → exclude SKU from that promotion"*). See `docs/LIMITATIONS.md` for
the full list, including what's not fully wired yet (real lead/analytics
backend — see below).

## Status

Phase 1.5 built and validated end to end against demo data and fixtures:
49 unit tests (`npm test`) and 5 browser-driven E2E flows (`npm run e2e`,
screenshots in `e2e/screenshots/`) covering the demo flow, a
reordered/quoted-real-format CSV fixture, missing-COGS graceful
degradation, invalid-CSV recovery, and a mobile viewport check.

**Not yet wired:** a real lead/analytics backend. The plan was a dedicated
Supabase project; the account's free-tier project limit was already used
by two unrelated existing projects, and creating a third — or pausing one
of those — needed the user's decision rather than being done
unilaterally. Early access + analytics currently fall back to per-browser
`localStorage` capture (fully functional and tested, just not aggregated
across visitors yet) — see `docs/PRIVACY.md` and `docs/DEPLOYMENT.md` for
exactly what to configure to unblock this.

**Not yet validated against a real merchant.** That's the next step —
see `docs/VALIDATION-CRITERIA.md` — not Shopify OAuth, not Phase 2.

## Repository / deployment status

Source lives at [github.com/MariCreu/Margiqo](https://github.com/MariCreu/Margiqo).
The static site is deployed via Cloudflare Pages, connected to this repo —
see `docs/DEPLOYMENT.md` for how the build is configured and how the
`margiqo.com` custom domain is attached.
