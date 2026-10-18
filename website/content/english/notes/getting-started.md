---
note_kind: "index"
title: "Getting Started"
meta_title: "Getting Started - Notes Garden"
description: "I keep one clear claim per note page and let wikilinks plus /notes/ do the browsing."
key_concept: |
  - Public when `draft: false`; hidden while `draft: true`.
  - Each note opens with a definition I can quote in one breath - the graph and backlinks do the organizing.
  - Start at [[Maps of Content]] or walk through the steps below.
  - Paid client sites use the same Hugo-plus-git lane - hub: [[Selling Static Sites]].
  - Faith parallel: [[Childlike Faith]] - first-day posture; receive the guide, do not perform expertise on day one.
level_1: "Getting started in the garden means one clear claim per note page - public when `draft: false`, hidden while `draft: true`."
level_2: "Draft status is like a shop shutter - `draft: false` opens the window to strangers; `draft: true` keeps work inside while you shape it."
level_3: "Set draft false only when the note is ready for strangers to read - flipping draft is the publish move, not a separate deploy button."
level_4: "Each note opens with a definition you can quote in one breath - the graph and backlinks do the organizing."
level_5: "Create one publishable garden note with a clear claim, five depths of understanding, and useful links, then extend the path through [[Maps of Content]]."
shareable_thought:
  - "I keep one clear claim per note page and let wikilinks plus /notes/ do the browsing."
  - "Each note opens with a definition I can quote in one breath."
  - "The graph and backlinks do the organizing."
  - "Public when draft: false; hidden while draft: true."
relationships:
  - type: contradicts
    wikilink: "[[Maps of Content]]"
    reason: "when jumping into a hub beats reading onboarding first"
  - type: extends
    wikilink: "[[Depth of Understanding]]"
    reason: "Five level bullets in key_concept map recognize-to-create depth on each claim"
  - type: extends
    wikilink: "[[Note Relationships]]"
    reason: "Getting started teaches the garden rules that note relationships formalize with typed links"
  - type: extends
    wikilink: "[[Reading the Garden]]"
    reason: "After garden rules - how to learn from what you read"
  - type: extends
    wikilink: "[[Selling Static Sites]]"
    reason: "Same markdown-first Hugo workflow for paid client sites"
slug: "getting-started"
date: "2026-06-18 08:00:00+00:00"
image: "/images/note.jpg"
categories: ["Productivity"]
author: "JoRap"
tags: ["Notes", "Meta", "PKM", "Digital Garden", "Note Taking", "Hugo", "Website Building"]
aliases: ["start"]
featured: true
draft: false
---
## Atomic rule

**One note = one claim** I'd cite in conversation. Put the definition in `description`, the angle in `key_concept`, two scenes in `examples`, and typed links in `relationships` frontmatter - not body `##` sections. Hub/MOC and utility pages may keep prose sections in the body. See [[Atomic Notes]] and [[Note Relationships]].

**Description** - one breath, the single claim I'd quote in conversation.

**Key concept** - not a second definition. First paragraph: one sentence (the angle). Next paragraph: stakes, distinctions, wikilinks.

**Examples** - exactly two plain bullets in frontmatter from different fields. Mid-action scenes I might hit this week: jeepney, clinic, group chat, bedtime, inbox. See [[Signature Move]] for why two unrelated scenes prove one principle.

**Relationships** - `extends` and `contradicts` minimum; optional `implements` and `alternative`. Sorted relationship a-z then wikilink a-z; each target once.

## Create a note

```bash
hugo new notes/my-idea.md
```

Or add a `.md` file under `content/english/notes/`. Atomic notes use `description`, `key_concept`, `examples`, and `relationships` in frontmatter plus the usual blog fields (`title`, `meta_title`, `slug`, `date`, `image`, `categories`, `author`, `tags`, `featured`, `draft`).

Created and updated timestamps come from the file itself at build time (`scripts/noteFileDates.js`) - no manual date fields to maintain.

## Link between notes

Use wikilinks in the body:

- `[[Atomic Notes]]` - link by title
- `[[atom]]` - works via the `aliases` frontmatter field

What this site gives you:

- **Wikilinks** - `[[Note Title]]` in note bodies (no pipe labels)
- **Aliases** - alternate link targets in frontmatter (`aliases: ["PARA"]` on [[PARA Method]])
- **Outgoing links** - listed below each note's body
- **Backlinks** - with context snippets when another note links here
- **Graph** - map view; filter by high, low, no body links, and orphans at [/notes/graph/](/notes/graph/)
- **Issues** - broken wikilinks, pipe wikilinks, and unlinked mentions at [/notes/issues/](/notes/issues/); also shown on each note
- **See also** - tag-related notes generated at build time (not static in markdown)
- **Hover previews** - pause on a wikilink to peek at the target note
- **Maps of Content** - hub index at [[Maps of Content]]
- **Resurfacing** - featured random note and [Random Duo](/notes/random-duo/) on [/notes/](/notes/)
- **Create Note** - topic → AI prompt for one lint-ready atomic note at [/notes/create/](/notes/create/)
- **Copy MD** - on every note page: copies Hugo source for ChatGPT or your editor
- **Copy hub cluster** - on hub/MOC pages (`note_kind: index`): hub + all direct wikilink targets in one paste
- **Copy catalog** - on [OKF Export](/notes/okf-export/): full garden index for ChatGPT project context
- **Copy issues** - on [Issues](/notes/issues/): structured link/structure report for maintenance sprints
- **Agent copy** - OKF export markdown per note (resolved links), upper right beside Copy MD
- **OKF export** - full bundle at [/notes/okf-export/](/notes/okf-export/) and [/exports/okf/](/exports/okf/)
- **Flashcards** - ~12 habit spine notes (~20%) with `review: true` carry six scenario `cards:` in frontmatter plus `card_sets:` for Review grouping; habit prompts I drill at [/notes/review/](/notes/review/)

## Page kinds

| `note_kind` | What it is | Relationships table | Link from content notes? |
|-------------|------------|---------------------|--------------------------|
| `note` (default) | Atomic garden claim | Required (extends + contradicts minimum) | Yes - `[[wikilink]]` |
| `index` | Hub / MOC ([[Maps of Content]], [[Eternal Principles]], this page) | Optional | Yes |
| `meta` | Tool surface (Graph, Issues, Review, etc.) | Skip | No - URL only |

## Utility surfaces (don't wikilink)

These pages are **meta tools** (`note_kind: meta`), not garden ideas: [Graph](/notes/graph/), [Issues](/notes/issues/), [Flashcards](/notes/flashcards/), [Review](/notes/review/), [Backlinks](/notes/backlinks/), [Random Duo](/notes/random-duo/), [Create Note](/notes/create/), [OKF Export](/notes/okf-export/). They are excluded from the graph node set, random pickers, and flashcard sources. **No `## Note Relationships` table** on utility pages - link by URL when pointing readers at a tool. **Don't `[[wikilink]]` to them** from content notes. `npm run lint:utility-links` catches violations.

## Learn from notes

[[Reading the Garden]] - two lanes: read for understanding (`description` → `key_concept` → `examples` → links), drill spine cards at [/notes/review/](/notes/review/). Faith track starts at [[Eternal Principles]].

## Explore

- **Outgoing links** and **backlinks** (with snippets) show below each note.
- **See also** suggests tag-related notes you haven't linked yet.
- **Graph** at [/notes/graph/](/notes/graph/) maps connections - filter high, low, no body links, and orphans.
- **Issues** at [/notes/issues/](/notes/issues/) lists broken wikilinks and unlinked note mentions; warnings also show on each affected note.
- `npm run lint:notes` catches broken wikilinks and unlinked mentions in assembled note content at build time (frontmatter fields are included - use note titles freely in `cards:`).

## Publish to the blog

When a note is ready for a longer-form post, I distill it into `content/english/blog/` with the same frontmatter shape and set `draft: false`.
