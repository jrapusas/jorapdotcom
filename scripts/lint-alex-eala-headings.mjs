#!/usr/bin/env node
/**
 * Freeze H2 headings on alex-eala-pro-career-tracker.md (alex-eala-tracker-update skill).
 *
 * Usage:
 *   node scripts/lint-alex-eala-headings.mjs
 *   node scripts/lint-alex-eala-headings.mjs --self-check
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { siteRoot } from "./spawnUtil.mjs";

const TRACKER = join(
  siteRoot,
  "content/english/blog/alex-eala-pro-career-tracker.md",
);

/** Canonical H2 list — update only when the skill workflow intentionally renames sections. */
export const ALLOWED_H2 = [
  "At a glance",
  "Player Profile",
  "WTA Rankings",
  "Grand Slam Main Draw Results",
  "Best Performances in WTA Tournaments",
  "Matches Against Grand Slam Champions",
  "Matches Against Other Top 20 Players",
  "Matches to Watch Out For",
  "Top Alex Eala Videos on YouTube",
  "Image Credits",
];

/** @returns {string[]} */
export function extractH2Headings(markdown) {
  return markdown
    .split("\n")
    .filter((line) => /^## /.test(line))
    .map((line) => line.slice(3).trim());
}

/** @returns {string[]} */
export function diffHeadings(found) {
  const allowed = new Set(ALLOWED_H2);
  const foundSet = new Set(found);
  const errors = [];
  for (const h of found) {
    if (!allowed.has(h)) errors.push(`unexpected H2: ${JSON.stringify(h)}`);
  }
  for (const h of ALLOWED_H2) {
    if (!foundSet.has(h)) errors.push(`missing H2: ${JSON.stringify(h)}`);
  }
  return errors;
}

function runSelfCheck() {
  const sample = `## At a glance\n\n## Player Profile\n`;
  const h2 = extractH2Headings(sample);
  if (h2.length !== 2 || h2[0] !== "At a glance") {
    console.error("extractH2Headings self-check failed");
    process.exit(1);
  }
  const bad = diffHeadings(["## wrong"].map((l) => l.slice(3)));
  if (!bad.some((e) => e.startsWith("unexpected"))) {
    console.error("diffHeadings self-check failed");
    process.exit(1);
  }
  console.log("lint-alex-eala-headings self-check OK");
}

function main() {
  if (process.argv.includes("--self-check")) {
    runSelfCheck();
    return;
  }

  const text = readFileSync(TRACKER, "utf8");
  const found = extractH2Headings(text);
  const errors = diffHeadings(found);

  if (!errors.length) {
    console.log(`Alex Eala H2 lint OK (${found.length} headings)`);
    return;
  }

  console.error("Alex Eala H2 lint errors:");
  for (const err of errors) console.error(`  ${err}`);
  console.error(
    "\nUpdate ALLOWED_H2 in scripts/lint-alex-eala-headings.mjs only when the tracker skill renames sections.",
  );
  process.exit(1);
}

main();
