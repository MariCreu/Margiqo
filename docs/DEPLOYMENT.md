# Deployment

The whole app is static files — `index.html`, `styles.css`, `src/`,
`robots.txt`, `sitemap.xml`, plus `demo-data/*.csv` for the "Try with demo
data" flow. No build step, no server-side code, no database.

## Any static host works. Cheapest options:

### Cloudflare Pages (recommended — free, no card required)
- **Build command:** none
- **Output directory:** `/` (repo root)
- **Env vars:** none required
- Steps: connect the GitHub repo → framework preset "None" → deploy. Every
  push to `main` redeploys automatically.

### Netlify
- **Build command:** none
- **Publish directory:** `.`
- Drag-and-drop the folder at app.netlify.com/drop also works for a first
  deploy with no git connection at all.

### Vercel
- **Framework preset:** "Other"
- **Build command:** none
- **Output directory:** `.`

## Before going live

1. Replace the placeholder domain (`https://your-domain-here.example/`) in
   `index.html` (canonical, OpenGraph, Twitter card), `robots.txt`, and
   `sitemap.xml` with the real deployed URL.
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
of scope for Phase 1.5 — see docs/LIMITATIONS.md. Adding real backend
capacity (Supabase or otherwise) is scoped, not built, in this phase — see
"Known limitations" for exactly what's blocked and why.
