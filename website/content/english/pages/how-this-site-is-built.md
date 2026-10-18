---
title: "How this site is built"
meta_title: "How this site is built"
description: "Hugo, Tailwind, semantic HTML, Git deploys, and performance work on jorap.com — plus where to find the public source snapshot."
draft: false
---

This page is for recruiters and technical reviewers who want the engineering story behind [jorap.com](https://www.jorap.com), not just the writing.

## Production stack

| Piece | Role |
| --- | --- |
| **Hugo Extended** | Static site generator; templates, partials, and content in Git |
| **Tailwind CSS v4** | Utility CSS compiled through Hugo's Tailwind pipeline |
| **Custom theme** | Vendored `jorap` theme; live overrides in `website/layouts/` |
| **Cloudflare Pages** | Git-triggered builds; same command as local prod: `pnpm run deploy` |

I own templates, design tokens, the asset pipeline, build scripts, and deploy config. This is not a hosted page-builder theme with a few color tweaks.

## What I optimize for

- **Semantic HTML** and accessible patterns in layout partials
- **Responsive CSS** with a token system (`website/data/theme.json`) instead of one-off hex values
- **Technical SEO** (metadata partials, structured content, sensible URLs)
- **Core Web Vitals** on a site I keep live: image partials, font vendoring, CSP, minimal JS by default

## Where the code lives

Public snapshot (same stack, safe to share):

**https://github.com/jrapusas/jorapdotcom**

Start with **[`docs/CODE_TOUR.md`](https://github.com/jrapusas/jorapdotcom/blob/main/docs/CODE_TOUR.md)** — a ten-minute map of layouts, tokens, and the deploy path.

High-signal paths:

- `website/layouts/` — page shells and section partials
- `website/data/theme.json` — colors and typography scale
- `scripts/deployBuild.mjs` — production build orchestration
- `website/static/_headers` — security and cache headers

## WordPress background

For years I shipped agency sites from Figma and Adobe XD into HTML, CSS, JavaScript, and WordPress (Gutenberg and ACF blocks). That work informs how I judge **what should move to static** and what should stay on WordPress. Client production URLs are under NDA; this repo is my own production Hugo site.

Questions welcome in a screen share: template resolution order, a homepage section, or a walk through `pnpm run deploy`.
