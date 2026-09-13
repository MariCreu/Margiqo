# Validation criteria

The question this phase exists to answer: **after discovering margin leaks
with their own data, does a merchant want ProfitDoctor to monitor their
store automatically?** Not "can we build a Shopify App" — that's already
known to be possible.

## Target

~20–30 real scans (real merchant CSVs, not demo data) before drawing any
conclusion. Below that, any percentage is noise.

## Positive signals, weakest to strongest

1. A merchant completes the scan (uploads both files, reaches the results
   screen) without asking us anything.
2. The scan surfaces a leak they say they didn't know about — the "I
   didn't know I was selling this at a loss" reaction the whole UX is
   built around.
3. They open a leak's "How is this calculated?" detail (tracked as
   `leak_detail_opened`) — a sign the transparency mechanism is actually
   being used, not just trusted blindly (or ignored).
4. They submit their email for early access.
5. **Strongest signal:** unprompted expressed intent to pay — either
   picking €19+ on the willingness question, or saying so in their own
   words (a reply email, a comment). This outweighs any aggregate
   percentage from the funnel.

## Demo vs. real — never conflated

Every event and every lead record carries `usedDemo`/`is_demo`. Demo scans
prove the mechanics work; only real-scan numbers count toward the 20–30
target or toward any conversion percentage reported externally. Reporting
"N signups" without splitting demo from real would be exactly the kind of
"número mágico" this product exists to prevent merchants from doing to
themselves — so we don't do it to ourselves either.

## What would mean "this isn't working"

- Merchants complete the scan but treat the result as expected/uninteresting
  (no "I didn't know" reaction, no detail-opening, no early-access
  signups) — suggests discount/margin leakage isn't the emotionally
  resonant leak Returns Doctor's promise was aiming for, and the detector
  choice (not just the UX) needs revisiting.
- Merchants can't get through validation (CSV export confusion, wrong file
  in the wrong slot, missing COGS) at a meaningfully higher rate than a
  handful of one-off hiccups — suggests the self-service bar (no
  onboarding, no call) isn't actually met yet.
