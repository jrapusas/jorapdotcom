# Code tour (technical reviewers)

Public source snapshot of the stack behind [jorap.com](https://www.jorap.com). If you only have ten minutes, read this file and skim the paths below.

**Live site:** https://www.jorap.com  
**This repo:** https://github.com/jrapusas/jorapdotcom

## Stack at a glance

| Layer | What we use |
| --- | --- |
| SSG | Hugo **Extended** (pinned in [`scripts/deploy-versions.json`](../scripts/deploy-versions.json)) |
| CSS | Tailwind CSS v4 via Hugo `css.TailwindCSS` + token pipeline |
| JS | Minimal, mostly `js.Build` bundles where needed (notes graph, motion) |
| Deploy | `pnpm run deploy` → Cloudflare Pages ([`wrangler.toml`](../wrangler.toml)) |
| Edge | CSP hashes, `_headers`, `_redirects` |

Production builds always go through [`scripts/deployBuild.mjs`](../scripts/deployBuild.mjs), not bare `hugo`.

## Where to look first (frontend / SSG)

| Goal | Start here |
| --- | --- |
| **Page shells and overrides** | [`website/layouts/`](../website/layouts/) (wins over theme) |
| **Homepage sections** | [`website/layouts/_partials/sections/home-*.html`](../website/layouts/_partials/sections/) |
| **Shared partials (SEO, assets, images)** | [`website/layouts/_partials/essentials/`](../website/layouts/_partials/essentials/) |
| **Design tokens (colors, type scale)** | [`website/data/theme.json`](../website/data/theme.json) → [`scripts/themeGenerator.js`](../scripts/themeGenerator.js) |
| **Semantic CSS aliases** | [`website/themes/jorap/assets/css/semantic-tokens.css`](../website/themes/jorap/assets/css/semantic-tokens.css) |
| **Responsive images** | [`website/layouts/_partials/image.html`](../website/layouts/_partials/image.html) (partial `image`) |
| **Blog templates** | [`website/layouts/blog/`](../website/layouts/blog/) |
| **Notes garden (large bounded domain)** | [`website/layouts/_partials/notes/`](../website/layouts/_partials/notes/) |
| **Site config, menus, homepage copy** | [`website/config/_default/`](../website/config/_default/) |
| **Redirects and security headers** | [`website/static/_redirects`](../website/static/_redirects), [`website/static/_headers`](../website/static/_headers) |

Theme fork under [`website/themes/jorap/`](../website/themes/jorap/) is mostly upstream sync + generated Tailwind theme CSS. When debugging templates, start at `website/layouts/`.

## Build and quality gates

```bash
pnpm install
pnpm check          # fast repo gates
pnpm run deploy     # full production build → website/public/
pnpm local          # deploy + wrangler (Cloudflare parity)
```

| Command | Why it matters |
| --- | --- |
| `pnpm run deploy` | Same path as CI: generators → Hugo → CSP hash pass |
| `pnpm lint:filenames` | Cross-platform safe paths in git |
| `pnpm lint:blog` | Published post frontmatter and voice |
| `pnpm garden:health` | Notes garden Hugo + link checks |

Deep ownership map: [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Design and product intent

- Visual system: [`DESIGN.md`](./DESIGN.md)
- Audience and principles: [`PRODUCT.md`](./PRODUCT.md)
- Client static-site checklist (how I ship similar sites): [`CLIENT_STATIC_SITE.md`](./CLIENT_STATIC_SITE.md)

## WordPress → static context

Agency background is WordPress (Gutenberg/ACF themes, design handoff, launch QA). This repo is the **production Hugo side**: templates, perf, SEO, and Git deploys. Content is edited in Markdown in the repo (no in-browser CMS in this snapshot).

## Questions in an interview

Happy to walk through: template override order, token pipeline, deploy script stages, CSP approach, a typical design-to-HTML section, and how I test responsive layout before production.
