# Formulas

Every number Margin Leak Doctor shows is computed by one of the formulas
below, straight from `orders.csv` (+ optionally `products.csv`). Nothing is
estimated, inferred, or defaulted. Source: `public/src/lib/*.js`.

## Terms

| Term | Comes from |
|---|---|
| `unitPrice`, `quantity` | orders.csv: `Lineitem price`, `Lineitem quantity` |
| `lineDiscount` | orders.csv: `Lineitem discount` (0 if the column is present but blank; the whole discount analysis is skipped if the column doesn't exist at all — see LIMITATIONS.md) |
| `unitCost` | products.csv: `Cost per item`, joined by `Variant SKU` ⇄ `Lineitem sku`. Missing for a SKU ⇒ that SKU's cost stays **UNKNOWN**, never assumed. |

## Per line item

```
grossRevenue        = unitPrice * quantity
revenueAfterDiscount = grossRevenue - lineDiscount
COGS                 = unitCost * quantity              (only if unitCost is known)
knownProductMargin   = revenueAfterDiscount - COGS       (only if COGS is known)
marginWithoutDiscount = grossRevenue - COGS              (only if COGS is known; used to tell
                                                           "this discount caused the loss" apart
                                                           from "this SKU was already unprofitable")
```

**"Known product margin" is not profit.** It excludes payment processing
fees, advertising, fulfillment labor/packaging, the actual cost of shipping,
and returns — none of which Shopify's standard exports expose per line item
(see DATA-AVAILABILITY.md). Every card that shows a known-margin figure
lists this exclusion explicitly.

## Detector 1 — Discount Leakage (`public/src/lib/discountLeakage.js`)

Aggregates line items by `Discount Code` and by `sku`:

```
totalDiscount(group)   = Σ lineDiscount
grossRevenue(group)    = Σ grossRevenue
discountRate(group)    = totalDiscount(group) / grossRevenue(group)
revenueShare(group)    = grossRevenue(group) / totalGrossRevenue
discountShare(group)   = totalDiscount(group) / totalDiscount(all)
concentrationRatio     = discountShare(group) / revenueShare(group)
```

A group is flagged as a **discount concentration** leak only when ALL of the
following hold (see `THRESHOLDS` in the source for exact values):

1. `totalDiscount(group) ≥ €30` — big enough in absolute terms to matter.
2. `discountShare(group) ≥ 2%` — moves a material share of total discount spend.
3. `concentrationRatio ≥ 1.5×` — this code/SKU takes a disproportionate share
   of discounts relative to its share of revenue (the actual evidence of
   "leakage", not just size).
4. `discountRate(group) ≥ 25%` — the discount itself is aggressive, not routine.

A large discount that is spread evenly across the catalog (concentration
ratio ≈ 1) is **not** flagged — size alone is never treated as evidence.

## Detector 2 — Low / Negative Product Margin (`public/src/lib/marginLeak.js`)

Only runs when at least one line item has a known cost. Groups line items by
`(sku, discountCode)` and by `sku` alone:

- **Negative known margin** — `knownProductMargin < 0` for a (sku, code)
  group. If `marginWithoutDiscount > 0` for the same group, the card says
  the discount *caused* the loss; otherwise the product was already
  unprofitable on cost alone, and the recommendation targets pricing/cost
  instead of the discount.
- **Thin margin, high volume** — `0 ≤ knownMarginRate < 8%` AND
  `revenueAfterDiscount ≥ €150`. A single low-margin sale isn't surfaced;
  a low margin sustained across real revenue is, because a small cost or
  price change would erase the entire buffer.

Priority is always by absolute € impact (`|knownProductMargin|`), never by
percentage alone — a large SKU at −2% margin outranks a tiny SKU at −40%.

## Worked example (also the CRITICAL card in the demo dataset)

Summer Bundle Pack, 27 units, listed at €68.75, code `SUMMER20` (20% off),
cost €58/unit:

```
grossRevenue         = 68.75 × 27            = €1,856.25
lineDiscount          = 1,856.25 × 0.20       = €371.25
revenueAfterDiscount  = 1,856.25 − 371.25     = €1,485.00
COGS                  = 58 × 27               = €1,566.00
knownProductMargin    = 1,485.00 − 1,566.00   = −€81.00
marginWithoutDiscount = 1,856.25 − 1,566.00   = €290.25  (> 0 → the discount caused the loss)
```
