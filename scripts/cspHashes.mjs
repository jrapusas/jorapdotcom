#!/usr/bin/env node
/*
 * Post-build CSP hardener.
 *
 * Two passes over every HTML file under `public/`:
 *
 *   Pass 1 - Rewrite inline `onerror="…this.src='X'…"` attributes that some
 *   third-party Hugo modules (logo, gallery-slider) emit on <img> elements
 *   into `data-fallback-src="X"`. A single delegated `error` listener in
 *   themes/jorap/layouts/_partials/essentials/style.html performs the swap
 *   in JS. Without this rewrite, the inline handlers would force
 *   `script-src-attr 'unsafe-hashes'` plus N per-URL hashes.
 *
 *   Pass 2 - Extract the body of every inline <script> block (no `src=`,
 *   JS-executable type) and SHA-256 hash it. Then rewrite
 *   `public/_headers` so the Content-Security-Policy `script-src` and
 *   `script-src-elem` directives
 *     1. no longer carry `'unsafe-inline'`, and
 *     2. allow exactly the inline scripts Hugo emitted, by their hashes.
 *
 * Run automatically at the end of `pnpm build`; safe to re-run (the
 * rewrite is idempotent and duplicate hashes are not appended twice).
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../website");
const PUBLIC_DIR = join(siteRoot, "public");
const HEADERS_FILE = join(PUBLIC_DIR, "_headers");

// Directives we manage. We only set `script-src`; modern browsers fall back
// from `script-src-elem` to `script-src` when the former is absent. Keeping a
// single directive (vs. two duplicate ones) is what brings the rewritten CSP
// under Cloudflare Pages's hard ~2,000-char per-header-value limit. If you
// reintroduce `script-src-elem` to `static/_headers` you must add it here too,
// AND verify the resulting CSP value still fits under 2 KB or it will be
// silently dropped at the edge.
const TARGET_DIRECTIVES = ["script-src"];

// Only rewrite the CSP for these path-block patterns from _headers. Other
// blocks with a dedicated CSP in static/_headers (e.g. /exports/okf/*) are left
// untouched and keep their original CSP.
const PATH_BLOCKS_TO_REWRITE = new Set(["/*"]);

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const JS_TYPE_RE = /^(?:text\/javascript|application\/javascript|module)$/i;

// Matches an `onerror="…"` or `onerror='…'` attribute as a whole. We use
// two alternatives so the inner attribute body may legally contain the
// other quote character (which Hugo's minifier exploits, emitting
// onerror='this.onerror="null",this.src="/foo.jpg"').
const ONERROR_ATTR_RE =
  /\s+onerror\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

// Extracts the URL from `this.src="…"` (or single-quoted) inside the body.
const THIS_SRC_RE = /this\.src\s*=\s*(?:"([^"]+)"|'([^']+)')/i;

async function walk(dir, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return out;
    throw err;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (e.isFile() && p.endsWith(".html")) out.push(p);
  }
  return out;
}

function extractInlineScripts(html) {
  const results = [];
  let m;
  SCRIPT_RE.lastIndex = 0;
  while ((m = SCRIPT_RE.exec(html))) {
    const attrs = m[1] || "";
    const body = m[2] || "";
    if (/\bsrc\s*=/.test(attrs)) continue;
    const typeM = attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i);
    // No type ⇒ classic script (executes). Otherwise must be a JS type;
    // skip JSON-LD, importmaps, speculation rules, etc. (CSP doesn't apply).
    if (typeM && !JS_TYPE_RE.test(typeM[1])) continue;
    if (!body.trim()) continue;
    results.push(body);
  }
  return results;
}

function sha256B64(s) {
  return createHash("sha256").update(s, "utf8").digest("base64");
}

function injectHashesIntoDirective(policy, directive, hashTokens) {
  // Match `<directive> <values> [;|end]`. Values are everything up to the
  // next `;` or end-of-string.
  const re = new RegExp(`(\\b${directive}\\s+)([^;]+)`, "i");
  const m = policy.match(re);
  if (!m) return policy; // Directive not present - nothing to do.

  let value = m[2];

  // Strip 'unsafe-inline' so the hashes are actually enforced (CSP2
  // browsers honor 'unsafe-inline' over hashes when both are present).
  value = value
    .replace(/\s*'unsafe-inline'/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Append unique hashes.
  for (const h of hashTokens) {
    if (!value.includes(h)) value = `${value} ${h}`;
  }

  return policy.replace(re, `$1${value}`);
}

async function main() {
  const files = await walk(PUBLIC_DIR);
  if (files.length === 0) {
    console.error(
      `[cspHashes] No HTML files found in ${PUBLIC_DIR}; did Hugo run?`,
    );
    process.exitCode = 1;
    return;
  }

  const hashes = new Set();
  let scriptCount = 0;
  let rewriteCount = 0;
  let filesRewritten = 0;
  for (const f of files) {
    const original = await readFile(f, "utf8");

    // Pass 1: onerror="…" → data-fallback-src="…".
    let mutated = original;
    ONERROR_ATTR_RE.lastIndex = 0;
    mutated = mutated.replace(ONERROR_ATTR_RE, (match, dq, sq) => {
      const body = dq !== undefined ? dq : sq;
      const urlMatch = body.match(THIS_SRC_RE);
      if (!urlMatch) return match; // Not a fallback-src pattern - leave alone.
      const url = urlMatch[1] || urlMatch[2];
      rewriteCount++;
      // HTML-safe: URLs from Hugo's RelPermalink are URL-encoded already,
      // but escape any stray `"` and `&` defensively.
      const safe = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
      return ` data-fallback-src="${safe}"`;
    });
    if (mutated !== original) {
      await writeFile(f, mutated);
      filesRewritten++;
    }

    // Pass 2: hash remaining inline <script> bodies.
    for (const body of extractInlineScripts(mutated)) {
      scriptCount++;
      hashes.add(`'sha256-${sha256B64(body)}'`);
    }
  }

  let headers;
  try {
    headers = await readFile(HEADERS_FILE, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(
        `[cspHashes] ${HEADERS_FILE} not found; expected Hugo to copy it from static/_headers.`,
      );
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  if (hashes.size === 0) {
    console.log("[cspHashes] No inline scripts found; leaving _headers as-is.");
    return;
  }

  const tokens = [...hashes].sort();

  // _headers groups headers under path-pattern lines (lines starting at
  // column 0). Header lines under a path block are indented. Track the
  // current block so we only rewrite the CSP for the path patterns we
  // explicitly opted into via PATH_BLOCKS_TO_REWRITE.
  let currentBlock = null;
  const updated = headers
    .split("\n")
    .map((line) => {
      // Comment or blank line - keep state, don't change.
      if (line === "" || line.startsWith("#")) return line;

      // Path-pattern line (no leading whitespace).
      if (!/^\s/.test(line)) {
        currentBlock = line.trim();
        return line;
      }

      const m = line.match(/^(\s*Content-Security-Policy:\s*)(.*)$/);
      if (!m) return line;

      if (!PATH_BLOCKS_TO_REWRITE.has(currentBlock)) return line;

      let policy = m[2];
      for (const d of TARGET_DIRECTIVES) {
        policy = injectHashesIntoDirective(policy, d, tokens);
      }
      return m[1] + policy;
    })
    .join("\n");

  if (updated !== headers) {
    await writeFile(HEADERS_FILE, updated);
  }

  console.log(
    `[cspHashes] Rewrote ${rewriteCount} inline onerror= attribute(s) in ${filesRewritten} file(s).`,
  );
  console.log(
    `[cspHashes] Hashed ${scriptCount} inline <script> block(s) → ${hashes.size} unique hash(es); injected into ${HEADERS_FILE}.`,
  );
}

main().catch((err) => {
  console.error("[cspHashes] Failed:", err);
  process.exitCode = 1;
});
