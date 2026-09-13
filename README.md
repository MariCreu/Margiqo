# ProfitDoctor (provisional name)

Self-service profit-leak diagnostic for ecommerce stores. Independent project — no code, branding, models or infrastructure shared with any other product.

> "Your store is leaking money. We'll find where."

## Status

Phase 0 (product/data validation) in progress. No app code yet — see the
conversation history / project notes for the Shopify data-availability
research and detector comparison that gates what gets built in Phase 1.

Phase 1 target (not started until the first detector is confirmed):
a single-page, client-side-only tool — **upload → validation → scan →
diagnosis** — that reads a merchant's own Shopify CSV export(s) in the
browser and produces a diagnosis with every € figure traceable to its
inputs, explicitly labeled KNOWN / ESTIMATED / UNKNOWN. No OAuth, no
Shopify App, no backend, no accounts, no billing.

## Why this repo is not yet connected to GitHub

This session's GitHub access could not create a new repository under this
account (`403 Resource not accessible by integration`) — repo creation is
scoped to a pre-approved list per session. This is a local git repo only.

### To publish it, from your own machine or GitHub UI:

```bash
# 1. Create an empty repo named "profitdoctor" on GitHub (no README/license,
#    so it doesn't conflict with this history), then:
git remote add origin https://github.com/<your-github-username>/profitdoctor.git
git push -u origin main
```

If you'd rather have Claude push it in a future session, grant that session
access to a `profitdoctor` repo you create yourself first (Claude can push
to a repo it's been given access to, but cannot create the repo itself in
this environment).
