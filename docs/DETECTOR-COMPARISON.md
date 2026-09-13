# Why Margin Leak Doctor (discounts + margin), not Returns Doctor

The original Phase 0 hypothesis was Returns Doctor. Researching actual
Shopify data availability (DATA-AVAILABILITY.md) showed it was the weakest
candidate of five, so the first detector was changed before any product
code was written — the challenge gate the product spec required.

Scored A–G against the real, verified data availability, not assumptions:

| Criterion | Returns | **Discount leakage** | Low/neg margin orders | Shipping leakage | Payment anomalies |
|---|---|---|---|---|---|
| A. Native data availability | Low — only an order-level refunded total, no line item, SKU or reason | **High — one native file, line-item granular** | High (with products.csv) | Low — no carrier cost exported | Low — separate per-payout-date export |
| B. Defensible € quantification | Medium (aggregate only) | **High — zero estimation needed** | High if COGS known | Low without real cost data | Medium |
| C. Frequency | High | High | High | Medium-high | Medium |
| D. Economic potential | Medium-high | High | High | High but unverifiable | Low-medium |
| E. Merchant understandability | High | High | Very high (visceral) | Medium | Medium |
| F. Fully automatic | Medium (needs a 2nd data source to say anything useful) | **High** | High | Low | Low-medium |
| G. External integration needed | High, to be useful at all | **None** | None | High | Medium-high |

**Returns Doctor's blocker:** `Refunded Amount` in `orders.csv` is an
order-level total. It cannot say which SKU, how many units, or why — so it
cannot produce an actionable, evidenced diagnosis without the Return API or
a returns app (both out of scope for a zero-integration Phase 1). This
confirmed, with evidence, the risk raised before any code was written.

**Why the combination wins:** Discount Leakage and Low/Negative Product
Margin both run on the exact same two native files
(`orders.csv` + `products.csv`), degrade gracefully without COGS (see
KNOWN/ESTIMATED/UNKNOWN in the main README), and need no OAuth, no app,
and no second export. Returns Doctor is deferred to a future phase, once a
returns-API or returns-app integration is in scope.
