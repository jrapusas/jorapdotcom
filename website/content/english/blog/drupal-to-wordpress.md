---
title: "Why I Switched from Drupal to WordPress"
meta_title: "Why I Left Drupal for WordPress"
description: "I fell hard for Drupal's architecture and still couldn't find work with it. WordPress had familiar building blocks and a community big enough to pay the bills."
social_media_intro: "Fell for Drupal's content modeling. Job posts in my city said WordPress. What I liked, what it cost me, and when I finally switched: article in the comments."
social_media_intro_x: "Fell for Drupal's content modeling. Job posts in my city said WordPress. https://jorap.com/blog/drupal-to-wordpress/"
slug: "drupal-to-wordpress"
date: "2026-05-27T06:30:00Z"
image: "/images/drupal-to-wp.jpg"
image_prompt: "Moving boxes labeled only by color tape, old server rack diagram rolled in tube, new laptop open to block editor blur, career-pivot hallway light, no readable text, no logos, photorealistic"
categories: ["Technology", "Web Development", "Opinion"]
author: "JoRap"
tags: ["Drupal", "WordPress", "CMS", "Web Development", "Developer Life", "Open Source", "Gutenberg", "WordCamp"]
related_notes:
  - git-based-cms
level_depth: 4
featured: false
draft: false
---

## I went looking for the best open-source CMS

If you're picking a CMS for paid work, the clean architecture diagram matters less than whether clients and job posts exist in your city. I learned that the hard way - and I'm glad the market pushed me before I dug in deeper.

At some point I stopped treating "pick a CMS" as a weekend decision and actually went hunting. Joomla, WordPress, Drupal, a few smaller names I don't even remember now. I read docs. I set up local installs. I built the same small site three different ways to see which one I'd want to live in for years.

Drupal won that round. Not because it was easier. It wasn't. I liked the **architecture** - content types, fields, views, the way you could model a site before you wrote a line of theme code. It felt like a system built by people who thought about structure first. That appealed to me.

WordPress at the time felt like the popular kid who got by on charm. Drupal felt like the one you'd respect after you sat with it long enough.

---

## What I liked about Drupal (and what that cost me)

The modeling made sense. Need a landing page with repeatable sections? Paragraphs. Need filtered lists of content? Views. Need strict field types on everything? The Field API had you covered. Once you learned the vocabulary, you could build complicated sites without turning every page into a one-off template.

The problem was everything around that core.

**The community was small.** Helpful when you found the right person, but thin compared to WordPress. Fewer blog posts, fewer YouTube walkthroughs, fewer "someone already solved this exact thing" moments.

**I couldn't find a job for it.** That was the line in the sand for me. I wasn't doing Drupal as a hobby project on a VPS in the corner. I needed clients, contracts, something that paid. In my market, "Drupal developer" was a niche inside a niche. WordPress listings were everywhere.

**Updates were exhausting.** Major Drupal versions weren't a click-and-go affair. Migrations, deprecated modules, contrib lagging behind core - I'd block out a weekend for an upgrade and still find something broken on Monday. WordPress isn't perfect here either, but Drupal made me feel like I was maintaining infrastructure every time the version number ticked.

I still respect what Drupal is. I just couldn't keep betting my income on a smaller table.

---

## The switch felt familiar, not like starting over

Timing mattered. Gutenberg matured right around when I was ready to move. So did the block editor. **Advanced Custom Fields** gave me the structured data habits I'd built in Drupal. Field groups, repeatable layouts, sane admin screens for editors who shouldn't touch PHP.

Blocks felt like Paragraphs with better marketing. Custom post types and taxonomies were still there. A lot of my mental model transferred. I wasn't learning a new religion. I was learning a dialect.

That lowered the friction enough that the switch didn't sit in my backlog for another year.

---

## The plugin shelf is the real difference day to day

Drupal has modules. WordPress has **plugins**, and there are so many of them that the boring problems are usually already solved.

Forms. SEO basics. Caching helpers. Migration tools. E-commerce add-ons. Backup plugins. Stuff clients ask for on Tuesday afternoon. On WordPress I often install, configure, and move on. On Drupal I'd sometimes end up evaluating three contrib modules, checking issue queues, and wondering if any of them would survive the next core bump.

I'm not saying every WordPress plugin is good. Plenty are junk. But the **plugin shelf** is the thing that actually saves my week, and nobody puts that on a homepage. When you freelance or run small builds, that shelf saves weeks.

---

## A huge community, and then Manila

WordPress didn't just have more jobs on paper. It had more people - meetups, Facebook groups, random strangers who'd already fought your error message. You could stay stuck for an hour on Drupal and wonder if the thread from 2019 still applied. On WordPress, odds were better someone had posted the fix last month.

Then WordCamp Asia came to **Manila**, and Matt Mullenweg was there.

I can't pretend that was the reason I switched. I'd already moved by then. But sitting in a room with 1,400-ish people has a way of confirming you didn't take the cynical path. They all build on the same platform. In your city, that hits different.

{{< youtube_time id="LEm2NXwbZKc" start="1" end="240" >}}

Matt's closing Q&A wasn't a product keynote. He pulled up **old WordCamp photos from the Philippines**. One was WordCamp Davao 2008. He gave a talk from across a swimming pool because that was somehow the setup. Funny stories. Human ones. The kind that remind you this thing is held together by volunteers and stubborn optimism, not just market share.

That felt a long way from debugging a Drupal migration alone at midnight.

---

## Would I pick WordPress again?

For the work I do - client sites, structured content, plugins that ship fast, a community I can actually reach - yes.

Drupal still wins on paper for certain enterprise builds with dedicated teams and long timelines. I don't run in that lane often. I run in the lane where the client needs the thing live next month and the plugin exists already.

I don't regret learning Drupal. It made me picky about content modeling, and that carries over no matter the CMS. But I needed work, smoother updates, and a bigger bench of tools and people. WordPress gave me that. WordCamp in Manila just made the choice feel less lonely.

If you're stuck between the two: be honest about your market and your tolerance for upgrade weekends. Do you need a plugin shelf or a perfectly clean architecture diagram? I chose the shelf. Glad it's still in my kitchen.