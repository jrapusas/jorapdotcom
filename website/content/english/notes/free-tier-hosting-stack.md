---
title: "Free Tier Hosting Stack"
meta_title: "Free Tier Hosting Stack - Hugo, GitHub, Cloudflare Pages"
description: "Hugo, GitHub, and Cloudflare Pages ship static sites for $0 - until build caps, queues, or account limits bite."
key_concept: |
  - Hard caps on Cloudflare free: about 500 builds per month per account, one concurrent build, 20,000 files per deployment, and a 20-minute build timeout.
  - Static bandwidth is unmetered - the traps are build count, queue time, and fat repos.
  - Flow: Hugo turns markdown into HTML, GitHub holds source, Cloudflare Pages builds on push and serves over CDN.
  - Full walkthrough: [How I Built JoRap Notes](/blog/how-i-built-jorap-notes/) - same pipeline for [[Selling Static Sites]] and the [[Digital Garden]].
  - No database, no admin panel - which is why [[Static Site Client Scope]] matters.
  - One account hosting many clients who push often burns the 500-build budget fast; pin `HUGO_VERSION` on every project.
level_1: "Cloudflare free tier caps builds at about five hundred per month per account, one concurrent build, twenty thousand files, and a twenty-minute timeout."
level_2: "Like a shared metered hose - bandwidth looks unlimited, but build count and queue time drain the budget first."
level_3: "Batch commits, pin HUGO_VERSION, and count builds before you add another client who pushes daily."
level_4: "Fat repos and frequent pushes burn the budget faster than bandwidth - one account hosting many clients burns fast."
level_5: "Design a shared hosting policy that budgets builds per client, batches pushes, pins Hugo, and names when a site must leave the free account."
examples:
  - "Glad Hugo was pinned after the build failed - that failure still counted against the cap when twelve client sites hit five hundred builds mid-month."
  - "Build failed until Hugo was pinned - env var on every new project template now, and that failure still counted against the cap."
shareable_thought:
  - "Hugo, GitHub, and Cloudflare Pages ship static sites for $0."
  - "Until build caps, queues, or account limits bite."
  - "Static bandwidth is unmetered - the traps are build count, queue time, and fat repos."
  - "No database, no admin panel."
relationships:
  - type: contradicts
    wikilink: "[[Building a Personal API]]"
    reason: "when the site needs a live API and database, not static HTML"
  - type: contradicts
    wikilink: "[[Local-first Software]]"
    reason: "when the workflow needs sync apps, not git-push-to-deploy"
  - type: extends
    wikilink: "[[Digital Garden]]"
    reason: "Same Hugo-plus-git publish lane I use for the notes garden"
  - type: extends
    wikilink: "[[Future-Proofing Knowledge]]"
    reason: "Markdown in git survives; hosting vendor is swappable"
  - type: extends
    wikilink: "[[Getting Started]]"
    reason: "Same markdown-first workflow as garden notes"
  - type: extends
    wikilink: "[[Selling Static Sites]]"
    reason: "Default host for client static sites until limits force upgrade"
  - type: extends
    wikilink: "[[Static Site Client Scope]]"
    reason: "Stack limits define what jobs fit"
  - type: extends
    wikilink: "[[Success is Stewardship]]"
    reason: "Steward the build budget on borrowed infra"
  - type: implements
    wikilink: "[[Rollback Principle]]"
    reason: "Git revert and previous Cloudflare deploy are the rollback lane"
  - type: implements
    wikilink: "[[Staged Rollout]]"
    reason: "PR preview deploy before Pages merges to main"
slug: "free-tier-hosting-stack"
date: "2026-06-29 10:05:00+00:00"
image: "/images/note.jpg"
categories: ["Productivity"]
author: "JoRap"
tags: ["Website Building", "Static Site Generator", "Hugo", "GitHub", "Cloudflare Pages", "Free Hosting", "DevOps"]
aliases: ["github cloudflare stack", "free static hosting"]
featured: false
review: false
card_sets: ["Focus", "Review"]
cards:
  - front: "500 builds per month sounds huge until twelve clients deploy weekly. What's the move?"
    back: "Client-owned Cloudflare account or Pages Pro before month-end crunch"
  - front: "Build failed until Hugo was pinned. What's the move?"
    back: "Env var on every new project template now"
  - front: "Deploy script worked once - skipped the env var checklist. What's the move?"
    back: "Pin Hugo on every new project - template now."
  - front: "Free tier fine for demo - tempted to stack twelve clients on my account. What's the move?"
    back: "Client-owned account before go-live."
  - front: "Build failed - gut says ditch Cloudflare. First fix?"
    back: "Fix the pin - stack still works."
  - front: "Client wants unlimited rebuilds on my free quota. What's the move?"
    back: "Their account or Pro - not my meter."
draft: false
---
