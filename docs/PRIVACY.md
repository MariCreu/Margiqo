# Privacy model

Privacy is treated as a commercial advantage, not a compliance checkbox —
so every claim below is checked against the actual code, not just stated.

## What's true, and how it's enforced

| Claim | How it's actually true |
|---|---|
| "Files are processed locally" | `public/src/app.js` reads uploads with `FileReader.readAsText()` and passes the text straight into `public/src/lib/diagnose.js` — a pure function with no `fetch`/`XMLHttpRequest` inside it or anything it calls (`shopify.js`, `discountLeakage.js`, `marginLeak.js`, `csv.js`). Grep the repo: the only `fetch()` calls in the whole app are (a) loading the two demo CSVs for "Try with demo data", and (b) `public/src/lib/leads.js` / `public/src/lib/analytics.js`, and neither of those two ever receives CSV content — see below. |
| "No customer data uploaded" | Follows directly from the above: nothing derived from the CSVs is ever passed to `leads.js` or `analytics.js`. |
| "No account required" | There is no login, no signup, no session, anywhere in the app. |
| "Files discarded when the page closes/refreshes" | Uploaded text lives only in an in-memory JS variable (`state.ordersText`/`state.productsText` in `app.js`). Nothing about the file content is written to `localStorage`, `indexedDB`, or a cookie. (The only thing `localStorage` is used for is the early-access fallback capture — see below — which never contains file content.) |

## What data does leave the browser, and where

Exactly two things, both opt-in, both structurally scoped to a fixed
allowlist of scalar fields:

1. **Early-access signup** (`public/src/lib/leads.js`) — only sent when a visitor
   submits the email form. Fields: `email`, `source` (referrer hostname
   only, never a full URL/query string), `usedDemo` (bool), `leaksCount`
   (int), `marginUnlocked` (bool), `willingnessToPay` (one of a fixed set
   of strings), `timestamp`. The `sanitize()` function rebuilds the
   payload key-by-key from this allowlist — anything else passed in
   (accidentally or not) is dropped, not just "not currently used". See
   `test/leads.test.js` for the adversarial test that proves this.
2. **Funnel events** (`public/src/lib/analytics.js`) — `event` name, `ts`, and up
   to four allowed scalar props (`is_demo`, `leaks_count`,
   `margin_unlocked`, `severity`). Same allowlist enforcement, same test
   discipline (`test/analytics.test.js`).

Neither path can carry a SKU, a revenue figure, a customer email, a
filename, or raw CSV content — not because we promise not to send it, but
because the functions that build these payloads only know how to read a
fixed set of named scalar arguments.

## No third-party analytics vendor (a deliberate choice, not an oversight)

Plausible/GA/etc. were considered and rejected for this phase: with an
expected 20–30 real scans, a vendor is unjustified infrastructure for the
volume involved, and every extra script is one more thing to audit for
privacy. Events are logged to the browser console and an in-memory buffer
by default; `ANALYTICS_ENDPOINT` in `public/src/config.js` is there for later,
once real usage justifies it.

## Known gap: no cross-visitor analytics aggregation yet

Without `ANALYTICS_ENDPOINT`/`EARLY_ACCESS_FORM_ENDPOINT` configured (see
docs/DEPLOYMENT.md), funnel events and leads are captured per-browser only
— there is currently no way to see, across real visitors, how many people
reached each funnel step. This is a direct consequence of the Supabase
project-limit blocker recorded in the Phase 1.5 report; it is not a
privacy feature, it's unfinished plumbing, and it's the first thing to
wire up before running this with real merchants at any scale beyond
manual spot-checks.
