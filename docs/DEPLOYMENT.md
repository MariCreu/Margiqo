# Deployment

The whole app is static files, all under **`public/`** — `public/index.html`,
`public/styles.css`, `public/src/`, `public/robots.txt`, `public/sitemap.xml`,
plus `public/demo-data/*.csv` for the "Try with demo data" flow. No build
step, no server-side code, no database. `wrangler.jsonc` at the repo root
tells Cloudflare exactly that: `assets.directory` is `public`.

Target domain: **margiqo.com** (purchased on Cloudflare — DNS is already
there, which is why Cloudflare Pages/Workers is the natural host: attaching
the custom domain needs zero manual DNS records).

Source: [github.com/MariCreu/Margiqo](https://github.com/MariCreu/Margiqo).

## Why `public/` and `wrangler.jsonc` exist

The first deploy attempt failed with `Asset too large` on a 148 MiB
`node_modules/workerd/bin/workerd` file. Cause: Cloudflare's current
Pages→Git flow runs `npx wrangler deploy` under the hood, and with no
`wrangler.jsonc` in the repo it auto-scaffolds one, installs `wrangler`
itself as a project dependency, and — since nothing told it otherwise —
treats the **entire repo root** (now including the freshly-installed
`node_modules/`) as the asset directory to upload.

Fix: keep the actual static site in a dedicated `public/` folder that
`node_modules` can never end up inside, and commit a `wrangler.jsonc` that
points `assets.directory` at it — so Cloudflare's deploy step has a real
config to read instead of auto-generating a broken one.

## Cloudflare (this project's host)

- **Connect to Git** → authorize GitHub → select the `Margiqo` repo →
  framework preset "None" → deploy command stays `npx wrangler deploy`
  (default) → **Save and Deploy**.
- Once deployed: project → **Custom domains** → **Add domain** →
  `margiqo.com` (auto-configures since the domain is already on Cloudflare
  DNS — no manual record to copy).
- Repo must be reachable by Cloudflare's GitHub App (public repo, or
  private with the app explicitly granted access to it).

## Any other static host also works, if `public/` is pointed at directly

### Netlify
- **Build command:** none — **Publish directory:** `public`

### Vercel
- **Framework preset:** "Other" — **Output directory:** `public`

## Before going live

1. Site metadata (canonical, OpenGraph, Twitter card, `robots.txt`,
   `sitemap.xml`, all under `public/`) already points at
   `https://margiqo.com/` — nothing to change once the domain is attached.
2. Decide on `public/src/config.js`:
   - `EARLY_ACCESS_FORM_ENDPOINT` — create a free Formspree form (or
     equivalent) and paste its endpoint. Without it, early-access signups
     are captured in each visitor's own browser `localStorage` only —
     fine for manual testing, useless for aggregating real leads across
     merchants.
   - `ANALYTICS_ENDPOINT` — optional. Leave blank to keep events
     console-only (see docs/PRIVACY.md for why this wasn't wired to a real
     backend yet).
3. Nothing else. There is no `.env`, no secrets, no API keys anywhere in
   this app — that's a direct consequence of "your data never leaves your
   browser."

## Local development

`server.js` (repo root) serves `public/` on `http://localhost:4173` via
`npm start` — it mirrors exactly what gets deployed, so testing locally
means testing the real thing. `test/` and `e2e/` live outside `public/`
since they're dev-only and never need to be deployed.

## What's deliberately not here

A permanent server, a database, and Shopify OAuth are all explicitly out
of scope — see docs/LIMITATIONS.md. Adding real backend capacity (Supabase
or otherwise) is scoped, not built, yet — see "Known limitations" for
exactly what's blocked and why.
