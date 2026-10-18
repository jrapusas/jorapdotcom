# TODO - JoRap Notes

Working backlog. Shipped items stay listed for context; open items are what to pick up next.

**Last reviewed:** 2026-10-03

---

## Shipped (reference)

Recent work already live or documented - no action unless regressing:

- Marketing shell uses **Jonathan Rapusas** in header/copyright; **JoRap Notes** title suffix on `/notes/` only
- Skip-to-content link, nav keyboard nav, theme-switcher a11y (live region + search sr-only label)
- Graph link-rank filters under **Link rank** disclosure (top/middle/bottom off primary row)
- Git `commit-msg` hook rejects vague subjects (`Update`, `Fix`, etc.)
- Changelog catch-up through **2026-09-11** (`CHANGELOG.md`)
- Draft `__inter-font.md` removed (obsolete Inter-only typography claim)
- 44px touch targets and `focus-visible` rings (nav, filters, buttons, footer)
- Hugo site relocated to `website/` subdirectory (repo root = tooling, docs, agent config, client template)
- `pnpm check` fast gates; `aislop` scripts for opt-in code-slop scan (`.aislop/config.yml`)
- JA2B project context via local symlink → `.context/project/` (not in git; see README)
- Semantic warning/error/success/graph tokens (`website/data/theme.json`)
- Notes graph (PixiJS), flashcards, expanded list filters, backlinks panel
- `prefers-reduced-motion` on flashcards, scroll, progress ring
- Security headers + build-time CSP hashes (`website/static/_headers`, `cspHashes.mjs`)
- Vendored webfonts in `website/assets/fonts/` (Inter, Source Sans 3, JetBrains Mono) with `font-display: swap`; `pnpm vendor:fonts` to refresh
- Related posts on blog and notes
- Breadcrumbs on page headers
- Back-to-top control with progress ring
- Apex → www redirects (SuperCP wildcard 301; path aliases in `website/static/_redirects`)
- Design system docs (`docs/DESIGN.md`, `docs/DESIGN.json`, `.impeccable/design.json`)
- `[skip ci]` git hook for non-deploy commits

---

## Open - high value

- [ ] **Site-wide voice pass** - spot-check published blog + notes; keep `pnpm lint:blog`, `pnpm lint:voice`, and `pnpm garden:health` green
- [ ] **Critical CSS / above-the-fold CSS** - inline or early-load key shell styles to improve FCP on slow networks
- [ ] **Core Web Vitals pass** - Lighthouse mobile baseline (2026-09-11): home **93** (LCP 3.2s), notes list **94** (LCP 2.6s), blog sample **73** (LCP 6.5s on `how-i-built-jorap-notes`) — CLS **0** on all three; investigate blog hero/LCP before guessing fixes
- [ ] **Image audit** - WebP/AVIF where missing; explicit dimensions on content images to prevent CLS
- [ ] **Privacy policy refresh** - align with GTM, Cloudflare Web Analytics, Disqus embeds actually in use

---

## Open - medium

- [ ] **Reading progress bar** on long blog posts (optional; must respect reduced motion)
- [ ] **Archive by date** page for blog (if SEO/discovery warrants it)
- [ ] **Newsletter signup** - only if there is a sending workflow behind it
- [ ] **Structured data audit** - Article/Person/BreadcrumbList JSON-LD consistency
- [ ] **ESLint for `website/assets/js`** - catch regressions in graph/flashcard modules

---

## Open - low / exploratory

- [ ] **Service worker / offline** - PWA module exists upstream; evaluate cost vs benefit on Cloudflare free tier
- [ ] **Design direction prototype** - pick one page to try an alternative from `DESIGN.md` (institutional, typographic, committed color)
- [ ] **Component extraction** - only if a third surface repeats the same markup; avoid premature abstraction

---

## Not pursuing (by design)

- Generic SaaS landing patterns (hero metrics, three-icon rows)
- Fourth webfont family or second brand accent color without explicit PRODUCT.md change
- Performative dev-bro chrome on the marketing shell

---

*Review monthly. Move shipped items down; delete ideas that aged out.*
