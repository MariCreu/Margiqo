# Deployment

Almost the whole app is static files, all under **`public/`** —
`public/index.html`, `public/styles.css`, `public/src/`, `public/robots.txt`,
`public/sitemap.xml`, plus `public/demo-data/*.csv` for the "Try with demo
data" flow. No build step for any of that. The one exception is
`src/worker.js` (repo root `src/`, not `public/src/`): a small Cloudflare
Worker that handles `POST`/`GET /api/early-access` against a KV namespace and
falls through to the static assets for everything else — see "Early-access
backend" below. `wrangler.jsonc` at the repo root wires both: `assets.directory`
is `public`, `main` is `src/worker.js`.

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
2. Set up the early-access backend once (see below) — after that,
   `public/src/config.js`'s `EARLY_ACCESS_FORM_ENDPOINT` is already correct
   (`/api/early-access`, same origin) and needs no per-environment change.
3. `ANALYTICS_ENDPOINT` in `public/src/config.js` — optional, still unset.
   Leave blank to keep funnel events console-only (see docs/PRIVACY.md for
   why this isn't wired to a real backend yet).
4. The only secret in this app is `ADMIN_TOKEN` (below), used solely to
   read back early-access leads. There is no `.env`, no database
   credentials, no API keys for anything CSV/order-related — that's a
   direct consequence of "your data never leaves your browser."

## Early-access backend (Cloudflare Worker + KV)

`src/worker.js` needs a KV namespace and an admin secret before it'll run.
Both are one-time setup, from the repo root, with `wrangler` authenticated
against the Cloudflare account that owns margiqo.com (`npx wrangler login`
if not already):

**The KV namespace already exists** — it was created once against the
account that owns margiqo.com, and its id is committed in `wrangler.jsonc`:

```
EARLY_ACCESS_KV = c56041dcc5e64fa0b252a92618e512fb
```

Nothing to do there. Only the secret is still per-account setup, and it is
the one thing that cannot live in the repo:

```bash
# Guards GET /api/early-access (reading leads back). Any long random string;
# it is never shown to a visitor and never sent to the browser.
npx wrangler secret put ADMIN_TOKEN
```

Deploys then happen automatically from `.github/workflows/deploy.yml` on a
push to `main`, after the unit and E2E suites pass. `npx wrangler deploy`
still works for a manual release.

To read leads back afterwards:

```bash
curl -H "Authorization: Bearer <ADMIN_TOKEN>" https://margiqo.com/api/early-access
```

Returns `{"ok":true,"leads":[...]}`, one object per email (the
willingness-to-pay follow-up merges into the same record — see
docs/LIMITATIONS.md). Free-tier KV allows 1,000 writes/day and 100,000
reads/day; each signup is one write (plus a rate-limit counter write), so
the expected 20-30 real scans are nowhere near the limit.

If `EARLY_ACCESS_KV`/`ADMIN_TOKEN` are ever misconfigured or the worker
fails for any reason, `submitEarlyAccess()` in `public/src/lib/leads.js`
falls back to `localStorage` automatically — the signup flow never breaks
for a visitor because of a backend issue.

## Local development

`server.js` (repo root) serves `public/` on `http://localhost:4173` via
`npm start` — it mirrors exactly what gets deployed, so testing locally
means testing the real thing. `test/` and `e2e/` live outside `public/`
since they're dev-only and never need to be deployed.

## What's deliberately not here

A permanent server, a general-purpose database, and Shopify OAuth are all
explicitly out of scope — see docs/LIMITATIONS.md. The Worker above is the
one deliberate exception, scoped to exactly the early-access allowlist.
Adding real backend capacity for anything else (Supabase or otherwise) is
scoped, not built, yet — see "Known limitations" for exactly what's
blocked and why.
