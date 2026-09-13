# Known limitations (Phase 1)

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

## Validation status

This is a Phase 1 prototype meant to test one thing: whether a merchant
looking at their own real scan result reacts with "I didn't know I was
selling this at a loss." It has not yet been run against a real store's
export — only the demo dataset described in DEMO-SCENARIO.md. That is the
next step, before any decision to build Phase 2.
