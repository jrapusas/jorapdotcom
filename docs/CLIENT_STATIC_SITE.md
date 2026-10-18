# Client static site template (Hugo + GitHub + Cloudflare Pages)

JoRap.com is the reference implementation. Clone this pattern for freelance client sites: one GitHub repo, one Cloudflare Pages project, client-owned accounts at scale.

## New client checklist

### 1. GitHub

- [ ] Create repo (private is fine on GitHub free).
- [ ] Copy or generate site from this repo (see [`docs/CLIENT_STATIC_SITE.md`](./CLIENT_STATIC_SITE.md)).
- [ ] If theme is a submodule: **Settings → enable submodules** in Cloudflare later.

### 2. Cloudflare Pages

- [ ] **Workers & Pages → Create → Connect to Git** → pick the repo.
- [ ] Production branch: `master` (or your default; JoRap uses `master`).
- [ ] Build command: `pnpm run deploy` (or `npm run deploy` if no pnpm).
- [ ] Build output directory: `website/public` (JoRap pattern) or `public` if Hugo lives at repo root.
- [ ] **Settings → Build → Variables** - set `NODE_VERSION` only (not `GO_VERSION` — unused on deploy). These are *build-time* vars; `wrangler.toml [vars]` are runtime-only and won't apply at build. Hugo version is handled in-repo by `scripts/ensureHugo.mjs`.
- [ ] **Settings → Build → Build cache → Enable** (one-time; or `curl` the API - see below).
- [ ] **Settings → Git → Submodule cloning → Enable** (if theme is a submodule).

Enable build cache without the dashboard:

```bash
curl https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/pages/projects/$PROJECT_NAME \
  -X PATCH -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"build_config":{"build_caching":true}}'
```

### 3. `wrangler.toml` (committed in repo)

Copy committed [`wrangler.toml`](../wrangler.toml) as the reference. For a new client repo, set:

| Field | Source |
|-------|--------|
| `name` | Cloudflare Pages project name |
| `pages_build_output_dir` | `website/public` (JoRap) or `public` (Hugo-at-root) |

Tool versions are pinned once in [`scripts/deploy-versions.json`](../scripts/deploy-versions.json) (the single source of truth `ensureHugo.mjs` reads). Don't duplicate them into `wrangler.toml`.

### 4. Build pipeline (minimum)

```
edit markdown → git push → Cloudflare builds → live on CDN
```

Production build must run Hugo with a cache dir so Cloudflare can reuse `.cache` between builds:

- JoRap pattern: `scripts/deployBuild.mjs` runs `hugo --minify --cacheDir .cache` plus any pre-steps (Tailwind, CSP, etc.).
- Point `[caches.images]` / `[caches.assets]` at `:cacheDir/...` in `hugo.toml` (not `resources/_gen`). Cloudflare only restores `.cache`; otherwise every deploy re-encodes all image variants.
- Simple Hugo-only sites: `hugo --minify --cacheDir=$PWD/.cache`

Pin tool versions. Version drift between laptop and Cloudflare is the most common deploy failure.

### 5. DNS and apex → www

**Preferred (Cloudflare-managed DNS):**

- [ ] Add the domain as a Cloudflare zone; point registrar nameservers to Cloudflare.
- [ ] Attach **both** apex and `www` as Pages custom domains.
- [ ] Pick **www** or apex as canonical; redirect the other with a Cloudflare Redirect Rule or Bulk Redirect (not Netlify-style `301!` in `_redirects` — Pages rejects `!` and absolute/domain-level sources).

**JoRap today (apex still on SuperCP):**

- [ ] `www` CNAME → `<project>.pages.dev` (Pages custom domain).
- [ ] Apex A record stays on the old host; configure a **Permanent (301) wildcard** redirect there to `https://www.example.com` (cPanel → Redirects → Wild Card Redirect checked).
- [ ] Use `website/static/_redirects` (or your site's `static/_redirects`) only for **same-site** path aliases. Do not put apex → www rules there — they never run for apex traffic and Pages logs them as invalid.

See [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md#redirects-apex--www).

### 6. pass-off doc (one page)

Give the client:

- GitHub org/repo URL
- Cloudflare account login (their account, not yours)
- Domain registrar login
- Build command + env vars list
- Who to email when the site is down

## Free tier headroom

Re-read [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/) before quoting clients:

| Limit | Typical brochure site |
|-------|------------------------|
| ~500 builds/month (per CF account) | Fine if you batch commits |
| 20,000 files per deploy | Trim theme image bloat |
| 1 concurrent build | Stagger multi-client deploys |
| Unlimited bandwidth | Don't over-optimize bandwidth |

**Scale rule:** pilot on your account; move production to **client-owned Cloudflare + GitHub** before you host many clients on one account.

## Save builds

- Batch content edits into one commit before `git push`.
- Use `[skip ci]` in commit messages for commits that do not change the site (internal docs-only batches).

## Astro / 11ty on the same rails

| SSG | Output dir | Build command | CF caches |
|-----|------------|---------------|-----------|
| Hugo | `website/public` (JoRap) or `public` | `pnpm run deploy` or `hugo --source website --minify --cacheDir=$PWD/.cache` | `.cache` |
| Astro | `dist` | `npm run build` | `node_modules/.astro` |
| 11ty | `_site` | `npx @11ty/eleventy` | `.cache` |

Same GitHub → Cloudflare flow; only output directory and build command change.

## Files to copy from JoRap.com

| File | Purpose |
|------|---------|
| `wrangler.toml` | Pages project config (name, output dir) |
| `scripts/deploy-versions.json` | Single source of truth for tool pins |
| `scripts/deployBuild.mjs` | Canonical build (adapt pre-steps per site) |
| `scripts/ensureHugo.mjs` | CI Hugo install when PATH is wrong |
| `website/static/_headers` | Security headers + long-cache fingerprinted assets |
| `website/static/_redirects` | Path aliases + legacy paths |

Strip JoRap-specific pieces (notes garden, OKF export) unless the client needs them.

## Related

- Garden note: [Free Tier Hosting Stack](/notes/free-tier-hosting-stack/)
- Blog walkthrough: [How I Built JoRap Notes](/blog/how-i-built-jorap-notes/)
- Troubleshooting: [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md)
