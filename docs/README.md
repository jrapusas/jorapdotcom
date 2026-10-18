# Docs

Long-form documentation for the JoRap Notes project. The repo [`README.md`](../README.md) covers quick start; everything below is reference material for humans.

**Layout:** Hugo site lives under [`website/`](../website/) (`--source website`). Repo root holds `scripts/`, `docs/`, and [`wrangler.toml`](../wrangler.toml) for Cloudflare Pages.

## Index

| File | What it covers |
| --- | --- |
| [`CODE_TOUR.md`](./CODE_TOUR.md) | Ten-minute path for reviewers: layouts, tokens, deploy, SSG highlights. Start here if you are skimming the GitHub repo. |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Repo layout, ownership map, generated files, build path. Start here for *how the code is organized*. |
| [`SPEC.md`](./SPEC.md) | Complete platform specification: users, requirements, notes garden, success criteria. Start here for *what the system is*. |
| [`PRODUCT.md`](./PRODUCT.md) | Audience, voice, anti-references, design principles. Start here for *why*. |
| [`DESIGN.md`](./DESIGN.md) | Visual system: north star, tokens, typography, components, notes garden. Start here for *how it looks*. |
| [`DESIGN.json`](./DESIGN.json) | Machine-readable design sidecar (palette meta, components, narrative) for tooling. |
| [`CLIENT_STATIC_SITE.md`](./CLIENT_STATIC_SITE.md) | Client checklist: Hugo + GitHub + Cloudflare Pages (reference: root `wrangler.toml`). |
| [`DUAL_SITE.md`](./DUAL_SITE.md) | Planned dual-stack: Hugo (jorap.com) + Astro (astro.jorap.com) in one repo. |
| [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) | Deploy, redirects, and build gotchas. |
| [`TODO.md`](./TODO.md) | Working backlog (shipped vs open). |

## Canonical URLs

- **Live site:** [https://www.jorap.com](https://www.jorap.com)
- **Apex redirect:** `jorap.com` → `www.jorap.com` via SuperCP cPanel wildcard 301 (apex DNS is still on SuperCP; Pages only serves `www`). Details: [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md#redirects-apex--www). Path aliases live in [`website/static/_redirects`](../website/static/_redirects).

## Token sources (code)

| Source | Role |
| --- | --- |
| [`website/data/theme.json`](../website/data/theme.json) | Authoritative color and font scale; edit here first. |
| [`website/themes/jorap/assets/css/generated-theme.css`](../website/themes/jorap/assets/css/generated-theme.css) | Auto-generated Tailwind `@theme` vars (`node scripts/themeGenerator.js`). |
| [`website/themes/jorap/assets/css/semantic-tokens.css`](../website/themes/jorap/assets/css/semantic-tokens.css) | Semantic aliases (`surface`, `elevated`, `ink`, `accent`, …) with dark swaps. |

When adding a new doc, drop it in this folder and link it from the table above.
