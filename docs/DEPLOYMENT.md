# Deployment

The whole app is static files — `index.html`, `styles.css`, `src/`,
`robots.txt`, `sitemap.xml`, plus `demo-data/*.csv` for the "Try with demo
data" flow. No build step, no server-side code, no database.

Target domain: **margiqo.com** (purchased on Cloudflare — DNS is already
there, which is why Cloudflare Pages is the natural host: attaching the
custom domain needs zero manual DNS records).

Source: [github.com/MariCreu/Margiqo](https://github.com/MariCreu/Margiqo).

## Any static host works. Cheapest options:

### Cloudflare Pages (recommended — free, no card required, chosen for this project)
- **Build command:** none
- **Output directory:** `/` (repo root)
- **Env vars:** none required
- Steps: Workers & Pages → Create → Pages → **Connect to Git** → authorize
  GitHub → select the `Margiqo` repo → framework preset "None" → Save and
  Deploy → then Pages project → **Custom domains** → **Add domain** →
  `margiqo.com` (auto-configures since the domain is already on Cloudflare
  DNS).

### Netlify
- **Build command:** none
- **Publish directory:** `.`
- Drag-and-drop the folder at app.netlify.com/drop also works for a first
  deploy with no git connection at all, then add `margiqo.com` under
  Domain settings.

### Vercel
- **Framework preset:** "Other"
- **Build command:** none
- **Output directory:** `.`
- Add `margiqo.com` under Project → Domains.

## Connecting margiqo.com

All three hosts above give either an `A`/`ALIAS`/`ANAME` record (apex
domain) or a `CNAME` (subdomain) to point at once the site is deployed —
the exact values are shown in that host's dashboard after adding the
domain, so there's nothing to pre-fill here. Whoever holds the registrar
login for margiqo.com needs to add that record. This wasn't done as part
of this build: it needs either registrar/DNS credentials or a hosting
account this session doesn't have access to.

## Before going live

1. Site metadata (canonical, OpenGraph, Twitter card, `robots.txt`,
   `sitemap.xml`) already points at `https://margiqo.com/` — nothing to
   change there once the domain is actually connected.
2. Decide on `src/config.js`:
   - `EARLY_ACCESS_FORM_ENDPOINT` — create a free Formspree form (or
     equivalent) and paste its endpoint. Without it, early-access signups
     are captured in each visitor's own browser `localStorage` only —
     fine for your own manual testing, useless for aggregating real leads
     across merchants.
   - `ANALYTICS_ENDPOINT` — optional. Leave blank to keep events
     console-only (see docs/PRIVACY.md for why this wasn't wired to a real
     backend yet).
3. Nothing else. There is no `.env`, no secrets, no API keys anywhere in
   this app — that's a direct consequence of "your data never leaves your
   browser."

## What's deliberately not here

A permanent server, a database, and Shopify OAuth are all explicitly out
of scope — see docs/LIMITATIONS.md. Adding real backend capacity (Supabase
or otherwise) is scoped, not built, yet — see "Known limitations" for
exactly what's blocked and why.
