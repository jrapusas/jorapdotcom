#!/usr/bin/env node
/** One-shot blog voice audit. Shared rules: scripts/blog-voice-lint.mjs */

import fs from "node:fs";
import path from "node:path";
import {
  BLOG,
  auditBlogFile,
  listBlogFiles,
} from "./blog-voice-lint.mjs";

const files = listBlogFiles();
const rows = files.map((name) => {
  const raw = fs.readFileSync(path.join(BLOG, name), "utf8");
  const { draft, fails, warns } = auditBlogFile(name, raw);
  const issues = [...fails, ...warns.map((w) => `WARN:${w}`)];
  const words = raw
    .replace(/^---[\s\S]*?---\r?\n?/, "")
    .replace(/```[\s\S]*?```/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return { name, draft, words, issues };
});

const flagged = rows.filter((r) => r.issues.length);
const published = flagged.filter((r) => !r.draft);
const drafts = flagged.filter((r) => r.draft);

console.log(`Blog voice audit — ${files.length} files, ${flagged.length} with flags\n`);
console.log(`Published with flags: ${published.length}`);
for (const r of published.sort((a, b) => b.issues.length - a.issues.length)) {
  console.log(`  ${r.name} (${r.words}w): ${r.issues.join(", ")}`);
}
console.log(`\nDrafts with flags: ${drafts.length}`);
for (const r of drafts.sort((a, b) => b.issues.length - a.issues.length)) {
  console.log(`  ${r.name} (${r.words}w): ${r.issues.join(", ")}`);
}
console.log(`\nClean (no flags): ${files.length - flagged.length}`);
