#!/usr/bin/env node
/**
 * Lint ponytail: comment shape (ceiling + upgrade path).
 *
 * Usage:
 *   node scripts/lint-ponytail.mjs
 *   node scripts/lint-ponytail.mjs --self-check
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { projectRoot } from "./spawnUtil.mjs";

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "public",
  "resources",
  ".pnpm-store",
  ".cache",
  ".specstory",
  "themes",
]);

const CODE_EXT = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".py",
  ".go",
  ".css",
  ".html",
]);

const MARKER_RE = /(?:\/\/|#)\s*ponytail:\s*(.+)$/gm;

/** @returns {string | null} */
export function ponytailIssue(body) {
  const text = body.trim();
  if (!text) return "empty ponytail comment";
  if (!/[,;]| — | - /.test(text)) {
    return "no-trigger (missing ceiling/upgrade separator: use comma, —, or - )";
  }
  return null;
}

/** @returns {{ line: number, body: string, issue: string | null }[]} */
export function scanPonytailComments(text) {
  const hits = [];
  let match;
  while ((match = MARKER_RE.exec(text)) !== null) {
    const body = match[1].trim();
    const line = text.slice(0, match.index).split("\n").length;
    hits.push({ line, body, issue: ponytailIssue(body) });
  }
  return hits;
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, files);
      continue;
    }
    const ext = entry.includes(".") ? entry.slice(entry.lastIndexOf(".")) : "";
    if (!CODE_EXT.has(ext)) continue;
    files.push(full);
  }
  return files;
}

function runSelfCheck() {
  const good = scanPonytailComments("// ponytail: O(n) scan, upgrade to index\n");
  const dash = scanPonytailComments("// ponytail: naive scan — upgrade to index\n");
  const bad = scanPonytailComments(`// ${"ponytail"}: naive heuristic only\n`);
  if (good[0]?.issue || dash[0]?.issue || !bad[0]?.issue) {
    console.error("lint-ponytail self-check failed");
    process.exit(1);
  }
  console.log("lint-ponytail self-check OK");
}

function main() {
  if (process.argv.includes("--self-check")) {
    runSelfCheck();
    return;
  }

  const warnOnly = !process.argv.includes("--check");
  const files = walk(projectRoot);
  const problems = [];

  for (const file of files) {
    const rel = file.slice(projectRoot.length + 1).replace(/\\/g, "/");
    const text = readFileSync(file, "utf8");
    for (const hit of scanPonytailComments(text)) {
      if (hit.issue) problems.push({ rel, ...hit });
    }
  }

  if (!problems.length) {
    console.log(`Ponytail lint OK (${files.length} code files scanned)`);
    return;
  }

  for (const p of problems) {
    console.error(`  ${p.rel}:${p.line}: ${p.issue} — ${p.body}`);
  }
  console.error(`\n${problems.length} ponytail marker(s) need ceiling + upgrade path`);
  if (warnOnly) {
    console.log("Ponytail lint finished (warn only; pass --check to fail CI)");
    return;
  }
  process.exit(1);
}

main();
