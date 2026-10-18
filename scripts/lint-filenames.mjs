#!/usr/bin/env node
/**
 * Cross-platform filename safety lint (.cursor/rules/safe-filenames.mdc).
 *
 * Usage:
 *   node scripts/lint-filenames.mjs            # git-tracked paths (default)
 *   node scripts/lint-filenames.mjs --self-check
 *   node scripts/lint-filenames.mjs --walk       # working tree (incl. untracked)
 */
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { projectRoot } from "./spawnUtil.mjs";

const FORBIDDEN = new Set('<>:"|?*\\/');
const RESERVED = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`),
]);

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "public",
  "resources",
  ".pnpm-store",
  ".cache",
]);

/** @returns {string[]} */
export function checkFilenameComponent(name) {
  const issues = [];
  if (!name) {
    issues.push("empty name");
    return issues;
  }
  if (name !== name.trim()) issues.push("leading/trailing whitespace");
  if (name.endsWith(" ") || name.endsWith(".")) {
    issues.push("trailing space or dot");
  }
  for (const c of name) {
    if (FORBIDDEN.has(c)) {
      issues.push(`forbidden char: ${JSON.stringify(c)}`);
      break;
    }
    if (c.charCodeAt(0) < 32) {
      issues.push("control character");
      break;
    }
  }
  if (name.includes("\0")) issues.push("null byte");

  let stem = name;
  if (name.includes(".") && !name.startsWith(".")) {
    stem = name.slice(0, name.lastIndexOf("."));
  } else if (name.startsWith(".") && name.includes(".", 1)) {
    stem = name.slice(1, name.lastIndexOf("."));
  }
  if (RESERVED.has(stem.toUpperCase())) {
    issues.push(`Windows reserved name: ${stem.toUpperCase()}`);
  }

  if (new TextEncoder().encode(name).length > 200) {
    issues.push("name too long (>200 bytes)");
  }
  return issues;
}

const KEBAB_CONTENT_PREFIXES = [
  "website/content/english/notes/",
  "website/content/english/blog/",
];

/** @returns {string[]} warn-only kebab-case issues for content paths */
export function checkKebabCase(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  if (!KEBAB_CONTENT_PREFIXES.some((p) => norm.startsWith(p))) return [];
  const base = norm.split("/").pop() ?? "";
  if (!base.endsWith(".md")) return [];
  if (base === "_index.md" || base.startsWith("__")) return [];
  const stem = base.slice(0, -3);
  const warns = [];
  if (/[A-Z]/.test(stem)) warns.push("uppercase in filename (prefer kebab-case)");
  if (/\s/.test(stem)) warns.push("space in filename");
  if (stem.includes("_") && stem !== stem.replace(/_/g, "-")) {
    /* underscore alone is allowed per safe-filenames.mdc */
  }
  if (/[^a-z0-9._-]/.test(stem)) warns.push("non-ASCII or unexpected chars in filename");
  return warns;
}

/** @returns {string[]} */
export function checkAlias(alias) {
  const trimmed = alias.trim();
  if (!trimmed) return ["empty alias"];
  const segments = trimmed.replace(/^\/+|\/+$/g, "").split("/");
  const issues = [];
  for (const segment of segments) {
    if (!segment) continue;
    for (const issue of checkFilenameComponent(segment)) {
      issues.push(`${segment}: ${issue}`);
    }
  }
  return issues;
}

const ALIAS_CONTENT_DIRS = [
  "website/content/english/notes",
  "website/content/english/blog",
];

function parseAliasesFromFile(relPath) {
  const content = readFileSync(join(projectRoot, relPath), "utf8");
  const match = content.match(/^aliases:\s*(.+)$/m);
  if (!match) return [];
  const line = match[1].trim();
  const quoted = line.match(/"([^"]*)"/g);
  if (!quoted) return [];
  return quoted.map((s) => s.slice(1, -1));
}

function lintAliases() {
  const hits = [];
  let scanned = 0;
  for (const dir of ALIAS_CONTENT_DIRS) {
    const abs = join(projectRoot, dir);
    if (!statSync(abs).isDirectory()) continue;
    for (const entry of readdirSync(abs)) {
      if (!entry.endsWith(".md")) continue;
      scanned += 1;
      const rel = `${dir}/${entry}`;
      for (const alias of parseAliasesFromFile(rel)) {
        const issues = checkAlias(alias);
        if (issues.length) hits.push({ path: rel, component: alias, issues });
      }
    }
  }
  return { hits, scanned };
}

function gitTrackedFiles() {
  const result = spawnSync("git", ["ls-files", "-z"], {
    cwd: projectRoot,
    encoding: "buffer",
  });
  if (result.status !== 0) {
    console.error("git ls-files failed — run from the repo root with git installed.");
    process.exit(1);
  }
  return result.stdout.toString("utf8").split("\0").filter(Boolean);
}

function walkTree(dir, hits) {
  let scanned = 0;
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry) || entry.startsWith(".specstory")) continue;
    scanned += 1;
    const full = join(dir, entry);
    const rel = full.slice(projectRoot.length + 1).replace(/\\/g, "/");
    const st = statSync(full);
    const issues = checkFilenameComponent(entry);
    if (issues.length) hits.push({ path: rel, component: entry, issues });
    if (st.isDirectory()) scanned += walkTree(full, hits);
  }
  return scanned;
}

function runSelfCheck() {
  const cases = [
    ["good-file.md", []],
    ["my-note-title.md", []],
    ["con.md", ["Windows reserved name: CON"]],
    ["COM1.json", ["Windows reserved name: COM1"]],
    ["report:2026.md", ['forbidden char: ":"']],
    ["post ", ["leading/trailing whitespace", "trailing space or dot"]],
    ["draft.", ["trailing space or dot"]],
    ["bad|name.txt", ['forbidden char: "|"']],
    ["a".repeat(201) + ".md", ["name too long (>200 bytes)"]],
  ];

  const aliasCases = [
    ["living sacrifice", []],
    ["/notes/cards/", []],
    ["Romans 12:1", ['Romans 12:1: forbidden char: ":"']],
    ["80/20", []],
  ];

  const kebabCases = [
    ["website/content/english/notes/capture.md", []],
    ["website/content/english/blog/My Post.md", ["uppercase in filename (prefer kebab-case)", "space in filename", "non-ASCII or unexpected chars in filename"]],
    ["website/content/english/blog/__draft.md", []],
  ];

  let failed = 0;
  for (const [name, expected] of cases) {
    const got = checkFilenameComponent(name);
    const ok =
      got.length === expected.length &&
      expected.every((issue) => got.includes(issue));
    if (!ok) {
      failed += 1;
      console.error(
        `  FAIL ${JSON.stringify(name)} expected ${JSON.stringify(expected)} got ${JSON.stringify(got)}`,
      );
    }
  }
  for (const [alias, expected] of aliasCases) {
    const got = checkAlias(alias);
    const ok =
      got.length === expected.length &&
      expected.every((issue) => got.includes(issue));
    if (!ok) {
      failed += 1;
      console.error(
        `  FAIL alias ${JSON.stringify(alias)} expected ${JSON.stringify(expected)} got ${JSON.stringify(got)}`,
      );
    }
  }
  for (const [path, expected] of kebabCases) {
    const got = checkKebabCase(path);
    const ok =
      got.length === expected.length &&
      expected.every((issue) => got.includes(issue));
    if (!ok) {
      failed += 1;
      console.error(
        `  FAIL kebab ${JSON.stringify(path)} expected ${JSON.stringify(expected)} got ${JSON.stringify(got)}`,
      );
    }
  }
  if (failed) {
    console.error(`\n${failed} self-check assertion(s) failed`);
    process.exit(1);
  }
  console.log(
    `lint-filenames self-check OK (${cases.length + aliasCases.length + kebabCases.length} cases)`,
  );
}

function lintPathsFromHits(hits, label, scanned, kind = "path component") {
  const plural = kind === "alias" ? "aliases" : `${kind}s`;
  console.log(`${label}: scanned ${scanned} path(s)`);
  if (!hits.length) {
    console.log(`No cross-platform unsafe ${plural} found.`);
    return 0;
  }
  for (const { path, component, issues } of hits) {
    console.error(`${path}  [${component}]`);
    for (const issue of issues) console.error(`  - ${issue}`);
  }
  console.error(`\n${hits.length} unsafe ${plural}`);
  return 1;
}

function lintKebabWarnings(paths) {
  const hits = [];
  for (const rel of paths) {
    const warns = checkKebabCase(rel);
    if (warns.length) hits.push({ path: rel, issues: warns });
  }
  if (!hits.length) return 0;
  console.error("Kebab-case warnings (website/content/english):");
  for (const { path, issues } of hits) {
    console.error(`  ${path}`);
    for (const issue of issues) console.error(`    - ${issue}`);
  }
  console.error(`\n${hits.length} path(s) with kebab-case warnings`);
  return process.argv.includes("--strict") ? 1 : 0;
}

function main() {
  if (process.argv.includes("--self-check")) {
    runSelfCheck();
    return;
  }

  if (process.argv.includes("--walk")) {
    const hits = [];
    const scanned = walkTree(projectRoot, hits);
    process.exit(lintPathsFromHits(hits, "Working tree", scanned));
  }

  const pathHits = [];
  const paths = gitTrackedFiles();
  for (const rel of paths) {
    const parts = rel.replace(/\\/g, "/").split("/");
    for (const part of parts) {
      const issues = checkFilenameComponent(part);
      if (issues.length) pathHits.push({ path: rel, component: part, issues });
    }
  }
  const pathCode = lintPathsFromHits(pathHits, "Git tracked", paths.length);

  const { hits: aliasHits, scanned: aliasScanned } = lintAliases();
  const aliasCode = lintPathsFromHits(
    aliasHits,
    "Frontmatter aliases",
    aliasScanned,
    "alias",
  );

  const kebabCode = lintKebabWarnings(paths);

  process.exit(pathCode || aliasCode || kebabCode);
}

main();
