#!/usr/bin/env node
/** Fast Node-only repository gates (no Hugo, no Python). */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runNodeScript } from "./spawnUtil.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const steps = [
  ["lint-filenames.mjs"],
  ["lint-filenames.mjs", "--self-check"],
  ["blog-voice-lint.mjs", "--self-check"],
];

for (const args of steps) {
  runNodeScript(join(__dirname, args[0]), args.slice(1));
}

console.log("check OK");
