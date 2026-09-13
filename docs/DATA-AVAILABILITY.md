# Shopify export data availability

Researched against Shopify's own documentation and community/vendor sources
(Shopify's own help/dev domains were unreachable from this environment's
network egress at research time; findings are cross-checked across multiple
independent secondary sources rather than a single one). This is what
decided the Phase 1 detector choice — see DETECTOR-COMPARISON.md.

## Orders export (`orders.csv`, native, no app needed)

| Field | Status | Notes |
|---|---|---|
| Order id/name, email, dates, financial/fulfillment status | AVAILABLE | |
| `Lineitem sku` / `name` / `quantity` / `price` | AVAILABLE | |
| `Discount Code`, `Discount Amount` | AVAILABLE | **Order-level only** — appears once per order |
| `Lineitem discount` | AVAILABLE | Already allocated per line item — this is what Phase 1 uses |
| `Shipping` (order-level total) | AVAILABLE | This is what the **customer paid**, not the merchant's carrier cost |
| `Taxes` (+ up to 5 `Tax N Name`/`Tax N Value` pairs) | AVAILABLE | Aggregate, not reliably per line item |
| `Refunded Amount` | AVAILABLE | **Order-level only** — does not say which line item, SKU, or quantity was refunded |
| `Payment Method`, `Payment ID` | AVAILABLE | Identifies the method, not its cost |
| A quirk that matters for parsing: on a multi-line order, only the **first** row carries order-level fields (Discount Code, Discount Amount, Currency, dates, ...); continuation rows leave them blank. `public/src/lib/shopify.js` forward-fills these. | — | Confirmed against real export samples |

## Products export (`products.csv`, native, separate file)

| Field | Status | Notes |
|---|---|---|
| `Cost per item` | SOMETIMES AVAILABLE | Optional field — many merchants never fill it in. Phase 1 never estimates it: missing ⇒ UNKNOWN for that SKU. |
| `Variant SKU`, `Title`, `Vendor` | AVAILABLE | |

## Returns / return reason / restock status

**NOT AVAILABLE** in any native CSV export. Only exposed via the Admin
GraphQL API (`Return`, `ReturnLineItem`, `RefundLineItem` objects), which
requires an app/OAuth — explicitly out of scope for Phase 1. Shopify's
native Analytics has "Returns" and "Product order and returns" reports,
exportable without an app, but confirmed to carry very limited detail and
not available on every plan. This is the core reason Returns Doctor was
**not** chosen as the first detector (see DETECTOR-COMPARISON.md).

## Payment/gateway fees

**NOT AVAILABLE** in `orders.csv`. Lives in a separate Shopify Payments
"Payouts" export, downloadable one payout date at a time (not by date
range), which makes reconciling fees back to individual orders at scale
high-friction. Not used in Phase 1.

## Actual shipping cost (what the merchant pays a carrier)

**NOT AVAILABLE** in any native export. Only the amount charged to the
customer is exported; carrier cost lives in Shopify Shipping's label
purchase history or third-party shipping apps. Not used in Phase 1.

## What this means for Phase 1

Discount Leakage and Low/Negative Product Margin are the only two detectors
that run entirely on data Shopify natively and reliably exports, with zero
external integrations and zero estimated inputs. Everything else
(returns, shipping cost, payment fees, ad spend) is explicitly labeled
UNKNOWN and listed under "Not included" on every result — never guessed.
