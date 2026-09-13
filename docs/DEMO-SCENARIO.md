# Demo dataset

`demo-data/orders.csv` + `demo-data/products.csv`, generated deterministically
by `demo-data/generate.js` (`node demo-data/generate.js` regenerates them —
they are also committed so the scan works without a build step).

A fictional store, "Aurora Home & Living" (candles, mugs, throws, decor),
69 orders / 70 order lines, 10 SKUs, cost data for 9 of them. Designed so
the scan result exercises every state the product needs to prove:

| SKU | Story | Expected result |
|---|---|---|
| Summer Bundle Pack | 27 units at 20% off (`SUMMER20`); cost €58, sells at €68.75 | **CRITICAL** — known margin **−€81**, discount caused it (see FORMULAS.md worked example) |
| Reed Diffuser | 20 units at 50% off (`CLEAROUT50`); cost €10, sells at €30 | **No card.** A big discount, but margin stays healthy (33%) — proof that size alone never triggers a leak |
| Knit Throw Blanket | 40 units, full price, cost €41.50 vs €45 price | **WARNING** — known margin only €140 (7.8%) at real volume, no discount involved |
| Ceramic Vase | 15 units at 35% off (`VASEFLASH35`), concentrated and aggressive; cost never entered | **INFO** — confirmed discount concentration, margin explicitly **UNKNOWN** with a CTA, not guessed |
| Ceramic Vase (again) | Also sold under `VIP15` and at full price | Feeds the "by SKU"/"by code" breakdown tables without tripping any threshold on its own |
| Lavender / Vanilla Candle, Ceramic Mug | Small `VIP15` (15%) discount spread evenly across many SKUs | **No flag** — evenly spread, well under the aggressive-rate threshold; demonstrates "spread out ≠ leak" |
| Canvas Tote, Kraft Notebook, Soap Bar | Full-price, healthy-margin volume sellers | Pure noise/baseline, like a real store — no leaks |
| One multi-line order (Candle + Mug) | — | Exercises the real Shopify quirk where only the first row of an order carries order-level fields |

## Expected scan result

```
3 margin leaks detected
€221 in known margin at risk

CRITICAL  Summer Bundle Pack   -€81
WARNING   Knit Throw Blanket   €140
INFO      Discount code "VASEFLASH35"   UNKNOWN
```

Verified two ways: `test/diagnose.test.js` asserts the pure calculation,
and `e2e/run.mjs` drives a real Chromium browser through
upload → validation → scan → diagnosis and asserts the rendered page
matches the same numbers — see `e2e/screenshots/` for what it actually
looks like.
