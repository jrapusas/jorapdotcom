#!/usr/bin/env node
/** Wikilink lint via Hugo build output (no shell rg pipe). */
import { runPreHugoInputs } from "./preHugo.mjs";
import { capture, siteRoot } from "./spawnUtil.mjs";

const WIKILINK_RE = /broken wikilink|unlinked mention/;

runPreHugoInputs();

const hugo = capture("hugo", ["--source", siteRoot, "--gc"]);
const output = `${hugo.stdout || ""}${hugo.stderr || ""}`;
for (const line of output.split("\n")) {
  if (WIKILINK_RE.test(line)) console.log(line);
}

// ponytail: report-only lint; always exit 0 (was shell `|| true`)
process.exit(0);
