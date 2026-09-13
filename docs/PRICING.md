# Pricing hypothesis (not implemented, not validated)

No billing exists in this phase. This is the hypothesis the early-access
willingness-to-pay question is designed to test — nothing here is a
commitment or a public price.

## Proposed structure

**FREE — one-off scan**
The product exactly as it exists today: upload, scan, diagnosis, in the
browser, no account. Stays free indefinitely as the top-of-funnel/SEO
surface — this is what gets shared and what ranks.

**MONITOR — €19–39/month (range, not a decided number)**
The thing the early-access CTA describes: automatic recurring Shopify
monitoring (via OAuth, out of scope until Phase 2) that re-runs this same
diagnosis on a schedule and alerts when a product/discount/promotion
starts destroying margin. Positioned as "stop exporting CSVs."

Why a range and not a number yet: the willingness-to-pay buckets
(none/€9/€19/€39/€79+) are exactly how this gets narrowed down — with 0
real answers so far, picking a single number would be inventing data, the
same discipline this whole product is built around not doing to merchants.

## What would change this

- If most respondents cluster at €9 or "wouldn't pay": the FREE scan may
  be the whole product for longer than planned, and monetization should
  look elsewhere (e.g. lead-gen to agencies, not a subscription).
- If several respondents pick €39+ or say so unprompted in the email body:
  that's the strongest signal in this phase (see
  docs/VALIDATION-CRITERIA.md) and justifies scoping Phase 2 (Shopify
  OAuth + recurring monitoring) sooner rather than later.
- Real Shopify billing (Shopify Billing API, not generic Stripe) is the
  right mechanism once there's a paid tier, since the buyer is already a
  Shopify merchant — but that's a Phase 2+ decision, not this one.
