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
**"See a sample scan"** path clearly marked `DEMO STORE — Sample data`
throughout, a hardened CSV parser (currency symbols, European decimal
commas, reordered columns, wrong-file-in-wrong-slot detection), a
plain-text **"Copy summary"** share action (no PDF, nothing persisted), and
a post-scan **early-access** email capture with a separate, optional
willingness-to-pay follow-up. See
[`docs/VALIDATION-CRITERIA.md`](docs/VALIDATION-CRITERIA.md) for what this
phase is actually trying to measure, and
[`docs/PRIVACY.md`](docs/PRIVACY.md) for exactly what does and doesn't
leave the browser.

## Design

The UI is deliberately shaped like a financial document rather than a
dashboard: dark ink bands for the hero, the report masthead and the
early-access panel, paper below, and rules and aligned figures instead of
floating cards. Same reasoning as the rest of the product — a tool that
asks a merchant to trust a € figure should look like something that shows
its work.

- **Type:** IBM Plex Sans (variable, 400–700), **self-hosted** in
  `public/fonts/`. A font CDN would hand every visitor's IP to a third
  party, directly under a landing page promising the opposite — see
  `docs/PRIVACY.md`. Latin + latin-ext subsets only, ~84 KB. Figures use
  `font-variant-numeric: tabular-nums`, so currency columns align without
  being dressed up in a monospace face.
- **Tokens:** `public/styles.css` runs entirely off CSS custom properties
  — `--band-*` for the dark bands, `--paper`/`--surface`/`--rule` for the
  light surfaces, `--signal`/`--alarm`/`--brass`/`--note` for semantics. A
  full `prefers-color-scheme: dark` palette redefines the same names; no
  component hard-codes a colour.
- **The landing closes on the funnel, not a second form.** One ask on that
  page — upload the CSV. A `Now` / `Next` pair states that the free scan is
  the front door of the monitoring product, with no price attached, because
  the willingness-to-pay question (`docs/PRICING.md`) is still what decides
  that number.
- **Print styles** exist because the results screen is a report someone
  will want to send to a supplier or a co-founder.
- No build step, no CSS framework, no JS for layout.

## Running it

```bash
npm start          # serves the app at http://localhost:4173
npm test           # unit tests (node:test) for every detector + parser
npm run e2e        # drives a real Chromium browser through 4 flows + mobile
```

No build step and no dependencies to install for the app itself — `npm start`
and `npm test` both work on a clean checkout.

`npm run e2e` is the exception: it drives a real browser, so it needs the
`playwright` devDependency plus a one-off Chromium download:

```bash
npm i -D playwright && npx playwright install chromium
```

The PNGs in `e2e/screenshots/` are overwritten on every run, so they always
show the UI as of the last suite run.

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

**Re-verified after the redesign:** all 49 unit tests and all 5 E2E flows
pass against the redesigned markup, and `e2e/screenshots/` was regenerated
from it. Checked by hand on top of the suite, which does not cover them: the
`prefers-color-scheme: dark` palette, both landing CTAs, and the
willingness-to-pay follow-up.

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
**Live at [margiqo.com](https://margiqo.com).** The site is a Worker serving
`public/` as static assets (`wrangler.jsonc` → `assets.directory`), not a
Pages site, and `workers_dev` is off so the `*.workers.dev` subdomain does
not publish a second crawlable copy.

**Deploys are manual — pushing to `main` does not ship anything.** The
Cloudflare↔GitHub integration described in `docs/DEPLOYMENT.md` is not
connected: a push to `main` was observed leaving the live site untouched for
10 minutes, with new asset paths still 404ing. Until that is wired up:

```bash
npx wrangler deploy      # uploads public/ and publishes
```

`public/_headers` carries the security headers and the immutable cache policy
for `/fonts/*`; Cloudflare reads it at deploy time. Note that its
`connect-src` is deliberately left open to `https:` so that setting
`EARLY_ACCESS_FORM_ENDPOINT` later does not get silently blocked by CSP.
