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

## No third-party requests at all

The page loads nothing from any domain but its own — no CDN, no analytics
vendor, no embedded widget. That includes the typefaces: IBM Plex Sans is
served from `public/fonts/` instead of a font CDN, because a CDN receives
every visitor's IP address and `User-Agent` on page load. That is a real
third-party disclosure, and it would be sitting directly underneath a
landing page promising that nothing leaves the browser. Same reasoning as
rejecting an analytics vendor above, applied to the kind of dependency
that is easy not to notice.

## Early-access leads: same-origin, not a third party

`EARLY_ACCESS_FORM_ENDPOINT` (`public/src/config.js`) points at
`/api/early-access` — same origin, handled by `src/worker.js`, the Worker
that also serves the static site. No request ever leaves margiqo.com for
this.

The worker re-validates and re-sanitizes on the server, independently of
`leads.js`'s client-side `sanitize()`: `src/lib/earlyAccess.js` rebuilds
the payload from the same fixed allowlist (`email`, `source`, `usedDemo`,
`leaksCount`, `marginUnlocked`, `willingnessToPay`) and rejects anything
that doesn't pass basic shape/type checks (valid email, `willingnessToPay`
restricted to the five button values in `index.html`, sizes and counts
bounded). A client-side bug or a hand-crafted request can't get an
unexpected field into storage — the server enforces the same allowlist the
client does, from scratch.

Storage is a single Cloudflare KV namespace (`EARLY_ACCESS_KV`), scoped to
exactly these lead records — nothing else in the app reads or writes it,
and it never receives CSV/order data (the worker's only route is
`/api/early-access`; every other request falls straight through to the
static assets). Reading the leads back requires `GET /api/early-access`
with the `ADMIN_TOKEN` secret as a bearer token — see docs/DEPLOYMENT.md.

The endpoint has basic abuse resistance (a request-size cap and a per-IP
rate limit, both in `src/worker.js`) but no CAPTCHA/Turnstile yet. Revisit
if spam shows up in the KV data — Cloudflare Turnstile is free and same
Cloudflare account, so it's a small addition when it's actually needed.

## Known gap: no cross-visitor analytics aggregation yet

Without `ANALYTICS_ENDPOINT` configured (see docs/DEPLOYMENT.md), funnel
events are still captured per-browser only — there is currently no way to
see, across real visitors, how many people reached each funnel step. Leads
no longer have this gap (see above); analytics does, and it's the next
thing to wire up before running this with real merchants at any scale
beyond manual spot-checks.
