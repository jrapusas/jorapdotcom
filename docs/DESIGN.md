---
name: JoRap Notes
description: Warm neutral editorial surface for a professional personal brand, Hugo + Tailwind.
colors:
  surface: "#f5f3f0"
  elevated: "#eeebe6"
  accent: "#181614"
  ink: "#161412"
  ink-muted: "#3d3a37"
  ink-faint: "#6b6762"
  divider: "#e5e2dd"
  deep: "#121110"
typography:
  display:
    fontFamily: '"Source Sans 3", sans-serif'
    fontSize: "3.81rem"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  headline:
    fontFamily: '"Source Sans 3", sans-serif'
    fontSize: "3.05rem"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  title:
    fontFamily: '"Source Sans 3", sans-serif'
    fontSize: "2.44rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  code:
    fontFamily: '"JetBrains Mono", monospace'
    fontSize: "0.875em"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "2px"
  md: "4px"
  lg: "8px"
  xl: "12px"
  "2xl": "16px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-primary-sm:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "6px 16px"
  button-outline-primary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  blog-card:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.xl}"
    padding: "20px 24px 24px"
---

# Design System: JoRap Notes

## Overview

**Creative North Star: "The Quiet Study"**

This system behaves like **daylight on good paper**: warm off-white fields, charcoal ink for authority, and almost no chromatic noise. Density is **editorial**, not dashboard. The interface is there to make long reads and portfolio judgment feel **calm and legible** under real client skims (laptop, bright office, short attention).

The experience **rejects performative tech theater**: no neon accents, no interchangeable SaaS hero metrics, no visual chaos that reads as "creator energy" instead of **hireable clarity**. That line comes straight from **PRODUCT.md** (anti-references: performative nerd energy, generic SaaS sameness, chaotic personal brand).

**Key Characteristics:**

- **Restrained palette:** Tinted warm neutrals plus a single **charcoal** accent role (fills, key actions). Color carries meaning through **tone and contrast**, not rainbow UI chrome.
- **Three-role typography:** **Source Sans 3** for headings, **Inter** for body and UI chrome, **JetBrains Mono** for code. Hierarchy leans on **scale + weight + tracking** within each role.
- **Flat-first depth:** Surfaces are mostly **flat**; shadows are **small and rare**, used for dropdowns, floating controls, and card lift on hover, not for fake 3D marketing stacks.
- **Motion is polite:** Short **ease-out** transitions (often 200 to 300ms). **Scroll behavior respects `prefers-reduced-motion`** at the document level.
- **Layout rhythm:** Content lives in a **1320px max-width** container with **16px** horizontal padding. Sections use **56px / 80px** vertical padding (`py-14` / `md:py-20`). The notes garden reuses the same tokens and card language as the blog; tool surfaces (graph, flashcards) stay within the warm-neutral system.

### Style positioning

**Label:** **Restrained editorial** - not stark minimalism, not SaaS product UI.

| Reads as | Does not read as |
| --- | --- |
| Daylight on good paper, hireable clarity | Sterile white-box minimal |
| Professional personal brand | Dev-bro / creator chaos |
| Calm long-form reading | Dashboard or marketing template |

**Minimal in discipline** (one accent, three fixed type roles, flat-first). **Not minimal in look** (warm tints, cards, notes tools, tactile hovers). See **PRODUCT.md** for voice and anti-references.

### Alternative directions (exploration only)

Shortlist if the brand needs a sharper pivot later - prototype on one surface before a site-wide retheme:

1. **Document / institutional** - memo/briefing layout; rules and columns; highest client-safe trust.
2. **Typographic authority** - stronger humanist-sans display hierarchy over the current sans body; extend toward a magazine feel only if PRODUCT asks.
3. **Committed color** - one saturated hue carries 30–60% of surface; everything else quiet.
4. **Monochrome instrument** - cool neutrals, tighter grid; notes tools feel native.

Do not mix directions on one page without narrative reason. Identity-preservation wins: variants should extend **The Quiet Study**, not replace it silently.

## Colors

The palette is **warm paper and charcoal ink**: low chroma, slightly cream body, dusted borders, and a near-black accent that inverts cleanly in dark mode via the same semantic token names (`bg-primary` / `dark:bg-darkmode-primary`).

### Primary

- **Charcoal Fill** (`#181614`): Primary button fills, social icon tiles, TOC and pagination active states, and other **high-commitment** actions. In dark mode the token swaps to **warm cream** (`#f2efe9`) on dark surfaces so the same "accent" role reads as **light ink on charcoal**, not a second hue.

### Secondary

- Not used as a separate hue. **Secondary actions** use **outline** treatments (border + transparent fill) or **muted ink** links instead of a second brand color.

### Tertiary

- Omitted. The system does not introduce a third accent color.

### Neutral

- **Warm Paper** (`#f5f3f0`): Default page background (`body` / `surface`).
- **Shell** (`#eeebe6`): Elevated panels, cards, inputs, blockquote backgrounds (`elevated` / `light`).
- **Strong Ink** (`#161412`): Headings and highest-contrast text (`text-dark` / semantic `ink`).
- **Body Ink** (`#3d3a37`): Paragraph and default reading color (`text` / `ink-muted`).
- **Quiet Ink** (`#6b6762`): Meta lines, placeholders, de-emphasized UI (`text-light` / `ink-faint`).
- **Dust Border** (`#e5e2dd`): Rules, card edges, table frames (`border` / `divider`).
- **Deep Ground** (`#121110`): Deepest dark theme backdrop and small UI anchors where the theme uses `dark` as a solid (for example theme switcher track).

Dark mode mirrors these roles with **`darkmode-*` CSS variables** (see `website/data/theme.json` and `tailwind-plugin/tw-theme.js`): surfaces darken, ink lightens, borders deepen, and the **accent fill inverts** so contrast ratios stay in family.

### Functional (status & tools)

Reserved for **feedback and data visualization**, not brand decoration. Each has light and dark variants in `website/data/theme.json`.

- **Warning** (`#b45309` / dark `#fbbf24`): Caution banners, dev-only notices.
- **Error** (`#991b1b` ink on `#fef2f2` surface): Broken links, validation failures.
- **Success** (`#15803d` / dark `#4ade80`): Positive confirmation states.
- **Graph weak link** (`#c27803`): Low-weight edges in the notes graph canvas.

### Named Rules

**The One Accent Rule.** The charcoal / cream accent is the **only** strong contrast pair for chrome and CTAs. Do not introduce a second saturated hue for decoration.

**The Gray-on-Color Rule.** Do not park **cool gray** text on tinted surfaces; use the **semantic ink** steps (`ink`, `ink-muted`, `ink-faint`) so text always shares the **warmth of the background**.

## Typography

**Heading font:** Source Sans 3 (with `sans-serif` fallback) — `font-secondary` / `font-serif`  
**Body / UI font:** Inter (with `sans-serif` fallback) — `font-primary` / `font-sans`  
**Code font:** JetBrains Mono (with `monospace` fallback) — `font-mono`

All three families are **vendored in the repo** (`website/assets/fonts/`, `website/assets/css/fonts.css`) and fingerprinted at build time (see `website/layouts/_partials/essentials/self-hosted-fonts.html` and `pnpm vendor:fonts`). Browsers load fonts from the same origin only.

**Character:** Humanist sans for titles (warmer than Inter, less “template default”), neutral Inter for reading and chrome, dedicated mono for code. Stays **office-safe** — no decorative display face.

### Hierarchy

- **Display** (Source Sans 3, 700, `3.81rem` / `clamp` via `text-h1` and breakpoints, line-height ~1.12, tight negative tracking): Reserved for **top-level marketing or page titles** when the full scale ladder applies (`h1` / `.h1`).
- **Headline** (Source Sans 3, 700, `3.05rem` with responsive `-sm` variants, line-height ~1.12): Section headings (`h2`), large list titles.
- **Title** (Source Sans 3, 700, `2.44rem` down through `1.25rem` for `h3`–`h6`): Subheads, card titles, component headings. `h3` uses **bold**; `h4`–`h6` stay **semibold** for ladder contrast. Blog cards also use **`text-2xl`** with **`font-secondary`** for card titles in templates.
- **Body** (Inter, 400, `16px` base with `0.8×` on small viewports via `text-base-sm`, line-height relaxed): Article body, descriptions, nav, buttons, forms. Prose is capped at **`max-w-[70ch]`** in `.content` for comfortable line length.
- **Label** (Inter, 600, inherited sizes on `nav-link` and buttons, semibold): Navigation, buttons, and emphasis. Buttons use **capitalize** in `.btn` (know that convention if you add new buttons).
- **Code** (JetBrains Mono, 400, `0.875em` inline / inherited in `pre`, line-height ~1.5): Inline `code`, `pre`, and keyboard literals via `font-mono`.

### Named Rules

**The Three-Role Rule.** Headings use **Source Sans 3 only**; body and UI chrome use **Inter only**; code uses **JetBrains Mono only**. Do not add a fourth family or swap roles without a **PRODUCT.md** change.

**The Article Title Rule.** Blog post titles use `.article-title`: real `h1` with **Source Sans 3** and a **tighter ramp** (`text-h2-sm` through `text-h1`) so long titles stay dignified on small screens.

## Elevation

The system is **flat at rest**. Depth is **tonal** (surface vs elevated) first; **shadow** second.

Shadows appear where something **floats above** the page: **dropdown panels** (`shadow-lg`), **back-to-top** control (`shadow-lg`), and **blog cards** (`shadow-sm`, **`shadow-md` on hover**). Cards use **border + subtle shadow** together so lift reads as **tactile**, not neon.

Atmospheric **page headers** may use a **soft vertical gradient** (`from-surface to-elevated` or the `bg-gradient` utility) for a **sheet lift**, not glassmorphism.

### Shadow Vocabulary

- **Card rest** (`shadow-sm`, Tailwind default): Blog cards and light containers at rest.
- **Card hover** (`shadow-md`): Slightly deeper lift on `.component--blog-card` hover, paired with **unchanged border color** so motion is restrained.
- **Overlay / menu** (`shadow-lg`): Dropdown panels and floating FAB-style controls.

### Named Rules

**The Flat-by-Default Rule.** Do not stack **shadow + heavy border + gradient** on the same block unless one role is clearly primary; default to **flat elevated surface**.

## Components

### Buttons

- **Shape:** Default radius **`rounded`** (`4px` / `--radius` default in Tailwind), small variant **`rounded-sm`** (`2px`).
- **Primary:** `bg-primary` / `text-white`, semibold, **`px-5 py-2`**, `border-transparent`, **capitalized** label style in `.btn`.
- **Outline primary:** Transparent fill, **`border-dark`** / `text-text-dark` in light mode; **`dark:border-darkmode-primary`** with light text; hover fills toward primary in both themes per `.btn-outline-primary`.
- **Hover / Focus:** Generic **`transition`** on `.btn`; focus rings on **navigation** use **`focus-visible:ring-2 ring-accent`** with **offset** (see nav), not on every button class by default. Prefer **visible `:focus-visible`** for keyboard users.

### Chips

- **Taxonomy / tags** in widgets use **small rounded pills** (`rounded`, `px-3 py-1`) with **`bg-white`** on elevated panels; not a formal chip system. Keep **one** visual pattern for tags site-wide.

### Cards / Containers

- **Blog card (`component--blog-card`):** **`rounded-xl` (`12px`)**, **`border-divider`**, **`bg-elevated`**, **`shadow-sm`**, **hover `shadow-md`**, **300ms ease-out** on shadow and border. Internal padding **`px-6 pt-5 pb-6`**.
- **Widgets** (categories, tags, author): **`rounded`** or **`rounded-lg`** on **`bg-light` / `dark:bg-darkmode-light`** panels with generous padding (`p-6`–`p-8`).

### Inputs / Fields

- **`form-input` utility:** Full width, **`rounded`**, **`bg-elevated`**, **`px-6 py-4`**, **`text-ink`**, placeholder **`ink-faint`**, **focus border** to **`primary`** / `dark:focus:border-accent`, **transparent ring** (no glow stack).

### Navigation

- **Header:** **`border-b`**, **`bg-surface`**, vertical rhythm **`py-5`**. Brand line uses **`text-2xl` / `xl:text-3xl`** for the site title.
- **Links:** **`font-semibold`**, **`text-ink`**, **`hover:text-accent`**, **200ms ease-out** color transitions. Dropdown **panels** are **`rounded-lg`**, **`border`**, **`shadow-lg`**, **`bg-elevated`**, **padding `p-4`**, **min-width ~180px**.
- **Mobile:** Checkbox hack **`#nav-toggle`**; ensure **keyboard and screen reader** behavior stays aligned when editing (triggers already use **`aria-*`** on dropdowns).

### Signature: Prose long-form

- **`.content` prose** applies typography plugin styling: **headings** use **Source Sans 3** and token-linked colors, **body** stays **Inter**, **blockquotes** are **large, rounded, bordered** with **tinted background** (editorial pull-quote feel), **inline code and `pre`** use **JetBrains Mono**, **links** underline and **hover to primary**.

### Notes garden

The notes section is a **second product surface** on the same system: no second palette, no dev-tool dark chrome. Cards, filters, and graph controls inherit blog-card language.

- **Note card (`notes-card`):** Same **`rounded-xl` (`12px`)**, **`border-divider`**, **`bg-elevated`**, **`shadow-sm`** as blog cards. Title uses **accent** with a **subtle underline** that strengthens on hover/focus. Hover lifts with **accent border** and a **soft ink-tinted shadow** (`0 4px 16px` at 8% ink). Tags are **surface pills** with accent border; hover inverts to **accent fill**.
- **Toolbar / filters:** Reuses **`.btn` / `.btn-sm`** primary and outline variants. Active filter = **filled accent**; inactive = **outline**. Count suffixes use muted ink (`notes-filter__count`).
- **Graph view:** Canvas sits on **`bg-elevated`** with **`border-divider`** frame. Controls are **44px touch targets**, **`rounded-md` (`6px`)**, surface fill, divider border; pressed/hover states tint toward **accent** (8% mix on surface). Tooltip is a small elevated panel, not a floating neon HUD.
- **Flashcards:** **`rounded-lg` (`8px`)**, **`min-height 10–12rem`**, front on **surface**, back on **elevated**. Flip uses **350ms ease**; reduced motion **crossfades** faces instead of 3D rotate.
- **Backlinks / stats:** Stat tiles are **surface** on **elevated** panel, **`rounded-lg`**, divider border. Large values use **700 weight, −0.02em tracking**; labels are **13px muted ink**. Jump pills are **full-radius** (`999px`) surface chips.

## Do's and Don'ts

### Do:

- **Do** keep **body copy** inside **~65–70ch** using existing `.content` / `max-w-[70ch]` patterns.
- **Do** use **semantic tokens** (`surface`, `elevated`, `ink`, `accent`, `divider`) so light and dark stay paired.
- **Do** use **short ease-out motion** (roughly **150–300ms**) for hovers and shadows, and **respect reduced motion** for scroll behavior (already on `html`).
- **Do** treat **charcoal / cream inversion** as the **single accent story** for CTAs and key navigation emphasis.

### Don't:

- **Don't** lean on **performative nerd / dev-bro** visuals: rainbow syntax themes in chrome, meme density, or **gaming-stream** layout tropes on the **marketing shell** (per **PRODUCT.md** anti-references).
- **Don't** ship **generic SaaS landing sameness**: interchangeable hero **big-number metrics**, stock **three-icon feature rows**, or **template thought-leader** filler blocks that could be any startup (per **PRODUCT.md**).
- **Don't** use **chaotic personal brand** layouts: ironic clutter, random type scales, or **visual noise** that reads as **hard to work with** (per **PRODUCT.md**).
- **Don't** use **gradient text** (`background-clip: text`) for headings; emphasis is **weight and size**, not decorative fill.
- **Don't** use **thick side-stripe borders** as the main callout pattern; use **full border**, **background tint**, or **icon/number lead** instead (site-wide craft rule).
- **Don't** hard-code **pure `#000` / `#fff`** for large fields; stay on **tinted** neutrals from **`theme.json`** except where third-party embeds require it.
