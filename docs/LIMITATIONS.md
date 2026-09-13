# Known limitations (Phase 1 + 1.5)

Stated up front, on purpose — the product's credibility depends on never
overclaiming.

## Scope

- **Not implemented at all:** Shopify OAuth/App, billing, user accounts,
  any database, Returns Doctor, Shipping Doctor, Ads Doctor, any external
  API, any LLM. This is a static, client-side, single-session tool.
- **Only two detectors:** Discount Leakage and Low/Negative Product Margin.
  Every other cost (payment fees, advertising, fulfillment, actual shipping
  cost, returns) is out of scope and explicitly listed as "Not included" on
  every card that shows a margin figure.

## Data handling

- **Cancelled and refunded orders are not excluded.** Phase 1 treats every
  order line in `orders.csv` as a completed sale for margin purposes. A
  store with many cancellations/refunds may see leak amounts slightly
  overstated — that reconciliation is exactly what a future Returns Doctor
  would own, not this tool.
- **One discount code per order.** The classic Shopify order export has a
  single `Discount Code` column. Orders with multiple stacked discount
  codes will show only the first against that order's lines. `Lineitem
  discount` (the actual € amount) is still summed correctly regardless.
- **Currency is read from the first row that has one** and applied to the
  whole scan. A file mixing multiple currencies (e.g. a multi-currency
  Shopify Markets export) is not split out.
- **COGS is never invented.** A SKU absent from `products.csv`, or present
  with a blank `Cost per item`, is UNKNOWN for that SKU only — it does not
  block the scan, and it is never defaulted to a margin percentage.

## Thresholds

The concentration/aggressiveness/thin-margin thresholds in
`discountLeakage.js` and `marginLeak.js` (materiality floor, concentration
ratio, aggressive rate, thin-margin rate and revenue floor) are reasoned
starting points, not statistically fitted. They are constants at the top of
each file specifically so they're easy to find and adjust once this is
tested against real merchant data.

## Phase 1.5 additions

- **No backend is actually live yet.** The plan was a dedicated Supabase
  project; the account hit its 2-project free-tier limit on existing,
  unrelated projects, and creating a third wasn't done without the user's
  say-so (see the conversation record). Early access + analytics fall back
  to per-browser `localStorage` capture until `src/config.js` points at a
  real endpoint. This means **no cross-visitor lead/analytics aggregation
  exists yet** — see docs/PRIVACY.md and docs/DEPLOYMENT.md for exactly
  what's blocked and how to unblock it (free up a Supabase slot, or wire
  Formspree + any events sink).
- **File encoding.** `FileReader.readAsText()` assumes UTF-8. A CSV saved
  in a legacy Windows-1252/Latin-1 encoding (older Excel exports, mainly
  on Windows) may show mojibake in accented product names. Not detected or
  auto-corrected.
- **Duplicate rows are not deduplicated.** If the same order/line item
  appears twice in an export (e.g. two exports concatenated by hand), both
  copies are counted. Not handled, because a legitimate duplicate line
  (split shipment, same SKU/qty/price twice) is indistinguishable from an
  accidental one without guessing.
- **The willingness-to-pay follow-up is a second, separately-sent record**
  (same email, added `willingnessToPay` field), not an update to the first
  — there's no database to update in place. Fine for reading manually or
  in a spreadsheet import; would need a real backend with an upsert to
  merge cleanly.
- **SEO scaffolding uses a placeholder domain** (`your-domain-here.example`)
  in canonical/OpenGraph tags, `robots.txt`, and `sitemap.xml` — must be
  replaced before going live (see docs/DEPLOYMENT.md). No Open Graph image
  was designed — a text-only preview card is what will render when shared,
  which is an acceptable placeholder, not a finished asset.
- **English only.** No i18n was added — out of scope by design for this
  phase, not an oversight.

## Validation status

This is a Phase 1 prototype meant to test one thing: whether a merchant
looking at their own real scan result reacts with "I didn't know I was
selling this at a loss," and Phase 1.5 makes that testable by real
merchants without any call or onboarding from us. It has not yet been run
against a real store's export or a real merchant — only the demo dataset
described in DEMO-SCENARIO.md and the fixtures in `e2e/fixtures/`. Running
it with real merchants, per docs/VALIDATION-CRITERIA.md, is the next step —
not Shopify OAuth, not Phase 2.
