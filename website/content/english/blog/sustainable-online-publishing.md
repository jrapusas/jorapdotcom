---
title: "Sustainable Online Publishing"
meta_title: "Sustainable Online Publishing - The Habit Side"
description: "I already decided to own my site. This is how I keep publishing without treating social as my archive - domain, Git, push, share."
social_media_intro: "Real copy lives in Git now. Social is the megaphone, not the vault - how I keep publishing after losing PHP hosting once: article in the comments."
social_media_intro_x: "Real copy lives in Git now. https://jorap.com/blog/sustainable-online-publishing/"
slug: "sustainable-online-publishing"
date: "2026-06-12T14:58:00Z"
image: "/images/sustainable-publishing.jpg"
image_prompt: "Desk plant thriving beside domain registrar envelope and markdown notebook, social phone buried under books, ownership-over-feed mood, evening golden hour, no readable UI, no logos, photorealistic"
categories: ["Website", "Ideas", "Technology"]
author: "JoRap"
tags: ["Publishing", "Self-Hosting", "Hugo", "Cloudflare Pages", "Content Ownership", "Platform Risk", "Blogging", "Digital Garden"]
related_notes:
  - digital-garden
  - drafting-in-public
  - the-garage-concept
  - note-relationships
  - commonplace-book
  - success-is-stewardship
level_depth: 3
featured: false
draft: false
---

If you're still stuck on *why* own a site at all, start with [why I still run my own website](/blog/why-run-your-own-website/). Glad that argument still holds - this post is the habit.

This one assumes you're already sold - or close enough - and just need the **habit**: write it on your domain first, then share the link.

Signing up on Facebook takes five minutes. The audience is already there. You don't have to think about hosting or Git pushes or why your build failed at 11pm. The stack I use is free. The part that actually matters is the publishing rhythm.

---

## What I actually mean by owning the files

**Domain** - cheap annual rent on a name people can remember (`jorap.com`). Buy something you won't cringe at in five years.

**Hosting** - where the files actually live. Classic hosting bills monthly. My stack is Hugo, GitHub, and Cloudflare Pages on the free tier - same as [how I built this site](/blog/how-i-built-jorap-notes/). No database, no admin panel, no PHP cron jobs to babysit.

I lost old PHP hosting once and a chunk of my work with it. Now the real copy lives in Git.

---

## What I don't mean by "sustainable"

I'm not saying quit social. I still post links there.

I'm not saying build everything custom to prove you're serious. My stack is boring on purpose - Hugo, Git, Cloudflare Pages - because I didn't want another rented-hosting surprise.

And free hosting doesn't mean zero work. You trade a monthly bill for Git pushes, broken YAML at 11pm, and the occasional "why did this build fail" evening. I'd still rather that than discovering export is paywalled.

What I mean is simpler: **the real copy lives somewhere you control.** Social is the megaphone. Not the vault.

---

## What I'd do if I were starting today

1. Buy a domain you won't hate in five years
2. Pick a static generator you can live with (Hugo worked for me; write down the version number the day you install it)
3. Put content in Git from day one - that's your backup whether you think you need it yet or not
4. Hook up Cloudflare Pages (or Netlify) so it rebuilds when you push
5. Share links on social - don't write only in the social text box

Step 2 is where I lost an evening. One bad indent in a YAML file broke the build and Hugo's error pointed at the wrong line. Fixed it the same night, and it still counted as progress.

My first push was one page and a broken favicon. I owned the URL before I owned the design.

You don't need the full stack on day one. Domain, Git, static hosting is enough.

Buy the domain first. Push one page to Git before you polish the design. Share the link on Facebook instead of writing the essay in the text box. That is the whole habit, and I'm glad it's still the one I keep.