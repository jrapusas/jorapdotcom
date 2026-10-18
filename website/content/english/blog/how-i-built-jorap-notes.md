---
title: "How I Built JoRap Notes: After Losing PHP Hosting"
meta_title: "How I Built JoRap Notes - Hugo, GitHub, Cloudflare Pages"
description: "I lost my old PHP hosting and a chunk of my work. A weekend later I landed on Hugo + GitHub + Cloudflare Pages - faster and better than what I was paying for."
social_media_intro: "Lost PHP hosting and a chunk of my work. Hugo, GitHub, Cloudflare Pages - push Markdown, live in ninety seconds. Full migration write-up in the comments."
social_media_intro_x: "Lost PHP hosting and a chunk of my work. Hugo, GitHub, Cloudflare Pages - push Markdown, live in ninety seconds. https://jorap.com/blog/how-i-built-jorap-notes/"
slug: "how-i-built-jorap-notes"
date: "2024-06-14T05:00:00Z"
image: "/images/joraps-world.jpg"
image_prompt: "PHP hosting cancellation email printout crumpled near keyboard, Hugo deploy success terminal on laptop, notes markdown stack beside it, post-hosting-loss rebuild mood, warm desk lamp, no readable logos or text, no watermarks, photorealistic"
categories: ["Website", "Technology", "Tutorial"]
author: "JoRap"
tags: ["Hugo", "GitHub", "Cloudflare Pages", "Static Sites", "Website Building", "PHP", "Migration", "Digital Garden", "Self-Hosting"]
related_notes:
  - digital-garden
  - drafting-in-public
  - the-garage-concept
  - selling-static-sites
  - note-relationships
  - success-is-stewardship
level_depth: 5
featured: false
draft: false
lastmod: "2026-08-02T16:32:00Z"
---

Still paying shared hosting for a personal blog one person publishes? I was too, until the client who split the bill moved on and the math stopped making sense. Glad that bill forced the switch.

**As of August 2026:** the three-piece stack is the same. The repo shape is not. What follows is how I got online in 2024. For what this site runs now, skip to [Where this site is now](#where-this-site-is-now-august-2026). Or read [the jorap theme review](/blog/jorap-theme-review/). In-repo theme, `pnpm` build, pinned versions.

## The short backstory

I'd been hearing about static site generators and the whole "JAMstack" thing for a while but never had a reason to try them. Losing my hosting setup turned out to be exactly that reason. Sometimes you don't fix something until you have to.

## What I ended up using

Three pieces, all working together:

- **Hugo** generates the site.
- **GitHub** stores the code.
- **Cloudflare Pages** builds and serves it.

That's it. There's no database, no admin panel, no PHP, no cron jobs. When I want to publish, I write a Markdown file, push it to GitHub, and ninety seconds later it's live.

### Hugo, in plain English

Hugo takes a folder of Markdown files and a theme, and spits out a folder of plain HTML. That's the whole job. No database to back up, no server-side code to keep patched, nothing to break.

Coming from years of WordPress, the speed difference was the first thing I noticed. Pages don't *load* - they just appear. There's nothing to wait for.

Setup on Windows took me about thirty minutes from download to first running page. On a Mac it's basically one command. Either way, **write down your Hugo version number** the moment you install it. Cloudflare needs to match it exactly later, and a mismatch is the most boring possible reason to spend an hour debugging a deploy.

### Cloudflare Pages, the part that surprised me

Cloudflare Pages hosts static sites. It connects directly to GitHub, watches the branch you tell it to, and rebuilds the site every time you push.

Months in, the setup has been rock solid. I keep waiting for the catch. I haven't found one yet.

### GitHub, the place I sometimes forget to push to

Standard Git workflow. Commit, push, deployed. The bonus is that GitHub is also my backup. Every version of every post lives in the repo history. I can revert anything I've ever written.

---

## Is this setup actually right for you?

Be honest with yourself before you start.

**This is great for** personal sites, blogs, portfolios, project pages, small documentation sites. Anything that's mostly text and images, mostly written by you, where "publishing" can reasonably mean "running a Git command."

**This is a bad fit for** anything with user accounts, shopping carts, or real-time data. It's also a bad fit for a non-technical team that needs to update content without touching code. A marketing team is not going to learn Git to fix a typo. They shouldn't have to.

So: small personal stuff, yes. A company site with a non-technical team behind it, no. Pick something with an admin panel instead.

---

## Building the site, step by step (how I did it in 2024)

This is the path I actually walked that weekend. It still works as a starter. It is **not** a clone of [jorap.com](/) today - see the 2026 section below before you copy every command into production.

### Getting Hugo running

**On Windows**, the steps that worked for me:

1. Download Hugo Extended from the GitHub releases page.
2. Extract it to `C:\hugo\bin`.
3. Add that folder to your Windows PATH.
4. Open PowerShell and run `hugo version` to confirm - you want the Extended build.

**On Mac**:

```bash
brew install hugo
```

Either way, note your version number. You'll thank yourself later.

### Creating the site

```bash
hugo new site joraps-world
cd joraps-world
git init
```

That creates a basic skeleton. The two folders you'll actually care about are `content/` (your posts) and `themes/` (how it looks).

### Picking a theme (where I lost a Saturday)

I will not pretend I made a quick decision here. There are hundreds of Hugo themes, they all look beautiful in their screenshots, and you can lose half a weekend "evaluating" them.

I eventually settled on a Tailwind-based Hugo starter - modern, well-maintained, and - the thing that sold me - **Tailwind CSS v4** baked in. Most Hugo themes are still on older CSS approaches. I really didn't want to spend my time fighting a custom theme styling system every time I wanted to change a color.

What I got out of the box:

- Dark mode
- Multi-author support
- A working search
- Contact form integration
- Pre-configured SEO
- A bunch of ready-made pages (About, Contact, Blog, etc.)
- A responsive design that actually holds up on mobile

In 2024 I added the starter as a git submodule under `themes/`. That got me live. It stopped being a good fit once I started editing layouts every week - more on that below.

Then edit `hugo.toml` - the starter used TOML, not YAML. My first config looked roughly like this (example URL only):

```toml
baseURL = 'https://your-project.pages.dev'
languageCode = 'en-us'
title = "JoRap Notes"
theme = 'jorap'

[params]
  author = "JoRap"
  description = "My corner of the internet"
  logo = "/images/logo.png"
  logo_darkmode = "/images/logo-darkmode.png"
```

(Theme names are case-sensitive and must match the folder under `themes/`. I learned that the embarrassing way on Linux once the folder name and `theme` in config disagreed.)

### Writing content

Markdown is the whole interface:

- `# Big Heading`
- `## Smaller Heading`
- `**bold text**`
- `*italic text*`
- `[link text](https://example.com)`

To create a new post on a fresh Hugo site:

```bash
hugo new posts/my-post-name.md
```

On this site now, blog posts live under `content/english/blog/` - different layout, same Markdown habit.

### Previewing locally

```bash
hugo server -D
```

Opens at `http://localhost:1313`. The `-D` flag includes drafts.

---

## Putting it on the internet

### Push to GitHub

Create a new repo, then:

```bash
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/yoursite.com.git
git push -u origin main
```

I have forgotten the `git remote add origin` step more times than I'd like to admit. Git's error messages when this happens are not, let's say, beginner-friendly.

### Hook up Cloudflare Pages

1. Sign up at `pages.cloudflare.com`.
2. Connect your GitHub account.
3. Select the repo.
4. For a plain Hugo starter: build command `hugo`, output directory `public`, and set `HUGO_VERSION` to your exact local version.
5. For this site today: build command is `pnpm run deploy` (Cloudflare already runs `pnpm install`). Output is still `public`.

Hit deploy. About two minutes later, your site is live at some `something.pages.dev` URL.

---

## Where this site is now (August 2026)

Same three pieces. Different insides.

**Theme lives in-repo.** I pulled the starter out of the submodule and into `themes/jorap` as a normal folder. Day-to-day edits got easier. Borrowing upstream fixes got harder. I wrote that tradeoff up in [The jorap Theme: What Powers This Site](/blog/jorap-theme-review/). If you're cloning this repo, start from `themes/jorap` - don't submodule a third-party theme unless you plan to stay shallow.

**Build needs Node too.** Tailwind and a pile of site scripts mean local work is `pnpm install` then `pnpm dev`, not only `hugo server`. Production build is `pnpm run deploy`. Hugo version is pinned (currently Extended **0.163.3**) alongside Node and pnpm so Cloudflare and my laptop stop arguing.

**Content paths grew.** Blog, notes garden, and pages live under `content/english/`. The notes garden is the part that turned "personal blog" into JoRap Notes.

**Domain.** Live site is [www.jorap.com](https://www.jorap.com/). Set `baseURL` to the real URL you serve. Not the first `pages.dev` name forever.

If you're cloning *this* repo to learn from it, read the root README for the current toolchain. If you're building your own site from scratch, the 2024 steps above still get you a first page. Just don't assume my theme folder name or Cloudflare build command match a stock Hugo starter install.

---

## The things that broke (and how I fixed them)

This is the section I needed when I was starting out, so it's the longest one here.

**Site looks like raw HTML.** The theme isn't loading. Nine times out of ten, the theme name in `hugo.toml` doesn't match the folder name exactly - case included.

**Cloudflare build fails.** Almost always a Hugo version mismatch. Set `HUGO_VERSION` to whatever `hugo version` prints locally. On this site, also match Node/pnpm - a Tailwind bin that won't run is the other common failure.

**"Module not found" during the build.** If you still use a theme submodule, Cloudflare Pages isn't pulling it. Turn submodule cloning on in the Pages project settings. This site no longer uses a theme submodule, so that knob doesn't apply here.

**Site deploys but every link is broken.** Check `baseURL` in `hugo.toml`. It needs to match the actual URL you serve.

**Images won't show up.** Put them in `static/images/` and reference them in your Markdown as `/images/filename.jpg`. Not `static/images/...` - Hugo handles that.

**Can't push to GitHub.** GitHub no longer accepts passwords. You need a personal access token: Settings → Developer settings → Personal access tokens. Use the token as the password when Git prompts you. Or use SSH.

**`hugo server` says command not found.** Hugo isn't on your PATH. On Windows, add the `hugo.exe` folder to the PATH environment variable and restart your terminal.

**Changes don't show up in the browser.** Cache. Hard refresh, or run `hugo server --disableFastRender`.

---

## The day-to-day workflow

Once everything is set up, posting feels almost too simple. Starter shape:

```bash
hugo new posts/post-name.md
# write the post in Markdown
hugo server -D            # preview it
git add .
git commit -m "New post about whatever"
git push
```

On this site now it's closer to: edit under `content/english/`, run `pnpm dev` locally, push, and let Cloudflare run `pnpm run deploy`.

About two minutes after the push, the site updates. No logging in, no clicking "Publish," no waiting for the WordPress dashboard to load. It's the part I missed most about old-school static publishing and didn't realize until I had it again.

---

## Backups (you don't really have to think about it)

This is the quiet superpower of the whole setup:

- Everything I write lives in GitHub. That's already a backup.
- Every change is in Git history. I can roll anything back.
- Cloudflare keeps a copy of every build.

I also occasionally download a zip of the repo just to be doubly safe, and I keep my images on Google Drive as well. But honestly, with everything in Git, I worry about backups way less than I did when I was managing a WordPress database.

If my computer died tomorrow, I could clone the repo to a new machine and be writing again in five minutes.

---

## What it costs me

No monthly hosting bill - a big change from the old PHP plan I was splitting with a client.

The only thing I actually pay for is a custom domain, an annual renewal at my registrar. Hugo, GitHub, and Cloudflare Pages handle the rest, with SSL and a global CDN included.

If you want your own domain, point it at Cloudflare from your registrar (Namecheap, GoDaddy, etc.). Add it under Custom Domains in Cloudflare Pages. Wait for DNS to settle. Usually within a day.

The `*.pages.dev` URL works fine if you skip the custom domain.

---

## Why I'm sticking with it

Compared to the old PHP setup, this one is faster, more reliable, and simpler to update. The only thing I traded away is a built-in comments system, and I don't really miss it. If I ever wanted comments back, Disqus or a small Worker would do the job.

Block one evening. Install Hugo, write down the version number, push one page to Cloudflare Pages, and fix a typo live a minute later. That is the whole test - decide then if you miss the WordPress dashboard.

## A couple of useful links

- [Hugo Quick Start](https://gohugo.io/getting-started/quick-start/) - start here
- [Hugo Themes](https://themes.gohugo.io) - yes, you'll lose hours
- [jorap theme review](/blog/jorap-theme-review/) - shortcodes plus what changed after a year on this stack
- [Markdown Guide](https://www.markdownguide.org/basic-syntax/) - ten minutes and you know it
- [Git Handbook](https://guides.github.com/introduction/git-handbook/) - for when Git gets weird

You're reading the result right now - glad this stack still earns its keep every time I push a page.