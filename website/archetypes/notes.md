---
title: "{{ replace .Name "-" " " | title }}"
meta_title: "{{ replace .Name "-" " " | title }}"
description: "One memorable definition - what this concept is or does, in one breath you could recall cold."
slug: "{{ .Name }}"
date: {{ .Date }}
image: "/images/note.jpg"
categories: []
author: "JoRap"
tags: []
aliases: []
review: false
featured: false
draft: true
key_concept: |
  - One sentence - the claim you'd argue, not a second definition.
  - Optional post-level stack: stakes, distinctions, [[wikilinks]].
level_1: "Definition - name the concept in one sentence."
level_2: "Explanation - meaning and relationships; analogy OK."
level_3: "Application - a practical situation or decision."
level_4: "Systems - tradeoffs, limits, larger context."
level_5: "Generative - build or extend from the concept; wikilinks OK."
examples:
  - "Mid-action scene where this principle fires - not a definition restated."
  - "Second scene from a different field - jeepney, clinic, inbox, bedtime."
shareable_thought:
  - "Core claim in one standalone line."
  - "Operating move in one standalone line."
  - "Boundary or contrast that sharpens the principle."
  - "Test or consequence that shows why it matters."
relationships:
  - type: extends
    wikilink: "[[Related Note]]"
    reason: "what this note builds on"
  - type: contradicts
    wikilink: "[[Tension Note]]"
    reason: "when …"
---

For habit spine notes (`review: true`), copy the frontmatter pattern from [/notes/flashcards/](/notes/flashcards/) or run `hugo new content/english/notes/my-note.md --kind notes-review`. Rules: double-quote every `front`, `back`, and set name; inline `card_sets: ["Set"]`; block list for `cards`; put `draft` last; do not add `| JoRap Notes` to `meta_title`. Don't `[[wikilink]]` utility pages (Graph, Issues, Flashcards, Review, Random Duo) - use URLs; see [[Getting Started]].
