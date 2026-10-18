#!/usr/bin/env node
/**
 * Blog voice lint (jorap-voice checks not covered by slop-lint).
 * Slop handles: wiki footer, placeholder image, body length, third-person advice, bottom line.
 *
 * Usage:
 *   node scripts/blog-voice-lint.mjs --check     # CI gate on published posts
 *   node scripts/blog-voice-lint.mjs --summary   # counts only
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../website");
export const BLOG = path.join(SITE_ROOT, "content/english/blog");

export const SKIP = new Set([
  "_index.md",
  "__interesting-facts-about-jorap.md",
  "__blog-template.md",
  "__modified-atk-recipe-style-guide-rules.md",
  "__how-to-create-a-blog-template.md",
]);

export const FB_INTRO_MAX = 200;
export const X_INTRO_MAX = 280;
export const GRAT =
  /\b(glad|grateful|thank|thanks|thankful|appreciate|fortunate|relieved|blessed|earned its keep)\b/i;
const OPINION_CATS = /Opinion|Faith|Family|Games|Sports/;
const CURRENCY = /\$\s?\d/;

/** @returns {{ fm: string, body: string }} */
export function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { fm: "", body: raw };
  return { fm: m[1], body: raw.slice(m.index + m[0].length).trim() };
}

export function isDraft(fm) {
  return /^draft:\s*true\s*$/m.test(fm);
}

function proseParas(body) {
  const normalized = body.replace(/\r\n/g, "\n");
  return normalized
    .split(/\n\n+/)
    .filter(
      (x) =>
        x.trim() &&
        !x.startsWith("#") &&
        !x.startsWith("---") &&
        !x.startsWith("!") &&
        !x.startsWith("|") &&
        !x.startsWith("{{") &&
        !x.startsWith("<!--"),
    );
}

/**
 * Voice checks unique to jorap-voice (slop-lint owns structural slop).
 * @returns {{ name: string, draft: boolean, fails: string[], warns: string[] }}
 */
export function auditBlogFile(name, raw) {
  const { fm, body } = parseFrontmatter(raw);
  const draft = isDraft(fm);
  const fails = [];
  const warns = [];

  if (!/^social_media_intro:/m.test(fm)) {
    (draft ? warns : fails).push("missing-social_media_intro");
  }
  if (!/^social_media_intro_x:/m.test(fm)) {
    (draft ? warns : fails).push("missing-social_media_intro_x");
  }
  if (!/^level_depth:/m.test(fm)) {
    (draft ? warns : fails).push("missing-level_depth");
  }
  if (!/^image_prompt:/m.test(fm)) {
    (draft ? warns : fails).push("missing-image_prompt");
  }

  const smi = fm.match(/^social_media_intro:\s*"((?:\\.|[^"\\])*)"/m);
  if (smi) {
    if (smi[1].length > FB_INTRO_MAX) fails.push(`social_media_intro-too-long (${smi[1].length})`);
    if (!/comment/i.test(smi[1])) fails.push("social_media_intro-no-comments-CTA");
    if (/^(Here'?s an article|I wrote a post|New article)/i.test(smi[1])) {
      fails.push("social_media_intro-article-first");
    }
  }

  const smix = fm.match(/^social_media_intro_x:\s*"((?:\\.|[^"\\])*)"/m);
  if (smix) {
    if (smix[1].length > X_INTRO_MAX) fails.push(`social_media_intro_x-too-long (${smix[1].length})`);
    if (!/jorap\.com\/blog\//i.test(smix[1])) {
      fails.push("social_media_intro_x-missing-url");
    }
    if (/in the (?:first )?comment|linked in comments/i.test(smix[1])) {
      fails.push("social_media_intro_x-comments-CTA");
    }
    if (/^(Here'?s an article|I wrote a post|New article)/i.test(smix[1])) {
      fails.push("social_media_intro_x-article-first");
    }
  }

  if (CURRENCY.test(body)) fails.push("blog-currency-amount");

  const cats = fm.match(/^categories:\s*\n((?:\s+-\s+.*\n)+)/m)?.[1] ?? "";
  const paras = proseParas(body);
  const open = (paras[0] ?? "").slice(0, 600);
  const close = (paras.at(-1) ?? "").slice(-600);

  if (!draft && OPINION_CATS.test(cats) && !/\b(I|I'm|I've|my|My)\b/.test(open)) {
    fails.push("opinion-no-first-person-opener");
  }
  if (!GRAT.test(open)) warns.push("weak-gratitude-opener");
  if (!GRAT.test(close)) warns.push("weak-gratitude-close");

  return { name, draft, fails, warns };
}

export function listBlogFiles() {
  return fs
    .readdirSync(BLOG)
    .filter((f) => f.endsWith(".md") && !SKIP.has(f));
}

function runSelfCheck() {
  const raw = `---
draft: true
social_media_intro: "Draft intro with comment below."
social_media_intro_x: "https://www.jorap.com/blog/test/"
level_depth: 1
image_prompt: "test"
categories:
  - Opinion
---
I think this is a test opener with enough words.

Closing paragraph with thanks for reading.
`;
  const row = auditBlogFile("__self-check.md", raw);
  if (!row.draft || row.fails.length) {
    console.error("blog-voice-lint self-check failed:", row);
    process.exit(1);
  }
  if (!GRAT.test("thanks for reading")) {
    console.error("GRAT self-check failed");
    process.exit(1);
  }
  console.log("blog-voice-lint self-check OK");
}

function main() {
  if (process.argv.includes("--self-check")) {
    runSelfCheck();
    return;
  }

  const check = process.argv.includes("--check");
  const summary = process.argv.includes("--summary");

  const rows = listBlogFiles().map((name) => {
    const raw = fs.readFileSync(path.join(BLOG, name), "utf8");
    return auditBlogFile(name, raw);
  });

  const publishedFails = rows.filter((r) => !r.draft && r.fails.length);
  const publishedWarns = rows.filter((r) => !r.draft && r.warns.length);

  if (summary) {
    console.log(
      `Blog voice lint — ${rows.length} files, ${publishedFails.length} published fail, ${publishedWarns.length} published warn`,
    );
    process.exit(0);
  }

  for (const r of publishedFails) {
    for (const issue of r.fails) {
      console.error(`  ${r.name}: ${issue}`);
    }
  }
  if (check && publishedFails.length) {
    console.error(`\nBlog voice lint: ${publishedFails.length} published post(s) failed`);
    process.exit(1);
  }

  for (const r of publishedWarns) {
    for (const issue of r.warns) {
      console.error(`  WARN ${r.name}: ${issue}`);
    }
  }

  if (publishedWarns.length) {
    console.log(`Blog voice lint OK (${publishedWarns.length} published warn(s))`);
  } else {
    console.log("Blog voice lint OK");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
