# Troubleshooting

Common deploy, redirect, and build issues for JoRap Notes on Cloudflare Pages.

**Canonical URL:** [https://www.jorap.com](https://www.jorap.com) - apex `jorap.com` should 301 to `www` (see [Redirects](#redirects-apex--www)).

---

## Redirects (apex → www)

### Symptom

`https://jorap.com` returns 404, or deep paths like `https://jorap.com/notes/` 404 while the root redirects.

### How JoRap actually does it

Apex DNS is **not** on Cloudflare Pages. `jorap.com` still resolves to the SuperCP / LiteSpeed host (`ns*.supercp.com`); only `www.jorap.com` CNAMEs to Pages (`jorapdotcom.pages.dev`).

Cloudflare Pages `_redirects` **cannot** fix this:

- Domain-level / absolute sources (`https://jorap.com/*`) are rejected.
- The `301!` force suffix is Netlify-only; Pages accepts bare `301`.
- Apex traffic never reaches the Pages project, so repo rules never run for it.

Apex → www is a **hosting-panel redirect** on SuperCP (cPanel → Redirects):

| Field | Value |
| --- | --- |
| Type | Permanent (301) |
| Domain | `jorap.com` |
| Redirects to | `https://www.jorap.com` |
| www. redirection | Do Not Redirect www. |
| Wild Card Redirect | **checked** (required so HTTPS deep paths redirect, not 404) |

`website/static/_redirects` only holds **same-site** path aliases (flashcards, renamed notes/posts). See comments in that file.

### Checks

```bash
# Apex (SuperCP) - all should 301 → www with path preserved
curl -sI https://jorap.com/ | head -5
curl -sI https://jorap.com/notes/ | head -5

# www (Pages)
curl -sI https://www.jorap.com/ | head -5
curl -sI https://www.jorap.com/notes/cards/ | head -5   # → /notes/flashcards/
```

### Fix

1. SuperCP → Redirects → edit/create the `jorap.com` rule with **Wild Card Redirect** enabled.
2. If HTTPS deep paths still 404 after that, put this in the apex site `.htaccess` (above WordPress rules):

```apache
RewriteEngine On
RewriteCond %{HTTP_HOST} ^jorap\.com$ [NC]
RewriteRule ^ https://www.jorap.com%{REQUEST_URI} [R=301,L,NE]
```

Long-term option: move authoritative DNS to Cloudflare, attach apex as a Pages custom domain, then use a Redirect Rule / Bulk Redirect. Until then, keep the SuperCP wildcard redirect.

---

## Build failures

### Hugo version mismatch

Cloudflare may not have Hugo on PATH. This repo pins via [`scripts/deploy-versions.json`](../scripts/deploy-versions.json) and installs with [`scripts/ensureHugo.mjs`](../scripts/ensureHugo.mjs) inside `pnpm run deploy`.

### Tailwind / CSS errors

Dev uses `pnpm dev` (Tailwind watch + Hugo). Production runs the same pipeline in `scripts/deployBuild.mjs`. Run `pnpm run deploy` locally to reproduce CI failures.

**`binary "tailwindcss" is not a Node.js script` (common on Windows + pnpm):** run `node scripts/fix-tailwind-bin.js` after `pnpm install`. On Windows, Hugo parses `tailwindcss.cmd` and requires a `\..\@tailwindcss\cli\dist\index.mjs` path (slash before `..`); the postinstall shim writes that wrapper and removes the extensionless `.bin` stub.

**`js.Build failed: Could not resolve "@pixi/…"` (common on Windows):** pnpm’s default nested `node_modules` layout breaks Hugo’s esbuild for PixiJS. This repo sets `nodeLinker: hoisted` in [`pnpm-workspace.yaml`](../pnpm-workspace.yaml) (pnpm 11+ no longer reads `node-linker` from `.npmrc`). Delete `node_modules` and run `pnpm install` after pulling; reinstall if errors persist.

### CSP header missing in production

Cloudflare Pages drops header values over ~2 KB. `scripts/cspHashes.mjs` rewrites `website/public/_headers` after build. See comments in [`website/static/_headers`](../website/static/_headers).

---

## Local dev

| Issue | Fix |
| --- | --- |
| Port in use | Dev: Hugo `1313`; local deploy: wrangler `8788` (`PORT` / `HOST` env vars) |
| Styles missing | Ensure Tailwind watch is running (`pnpm dev`, not bare `hugo`) |

### Local production preview (Windows, Linux, macOS)

Same pipeline as Cloudflare Pages — use this before pushing, not `pnpm dev`:

```bash
pnpm local              # build + serve at http://127.0.0.1:8788
# or: pnpm run deploy && pnpm run serve
```

`pnpm dev` and `pnpm preview` pass `--buildDrafts` and `--buildFuture` to Hugo, so drafts and future-dated posts appear locally but not on the live site.

**Toolchain:** Hugo Extended, Node 22+, pnpm, Go (mise + [`.mise.toml`](../.mise.toml)), Python 3.8+ for OKF export and garden lint scripts (`node scripts/runPython.mjs` resolves `python` / `python3` / `py -3` on Windows). Run in PowerShell or Git Bash.

### Cross-platform filename checks

Filename safety lint is pure Node — no Python or shell required:

```bash
pnpm test:filenames   # self-check (works without git)
pnpm lint:filenames   # scan git-tracked paths (needs git)
```

`node scripts/lint-filenames.mjs --walk` scans the working tree including untracked files (skips `node_modules`, `public`, `.cache`).

---

## Still stuck

1. Retry latest deployment in Pages dashboard.
2. Compare build log with local `pnpm run deploy`.
3. Test `.pages.dev` preview URL to isolate DNS vs app issues.
4. Check [Cloudflare status](https://www.cloudflarestatus.com/).
5. **JA2B / agent context missing:** symlink `.context/project` to your JA2B `01-Projects/jorap.com` checkout (see README); optional `AGENTS.md` if present.
