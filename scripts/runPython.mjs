#!/usr/bin/env node
/**
 * Cross-platform python3 wrapper for package.json scripts (Windows: python / py -3).
 *
 * Usage: node scripts/runPython.mjs scripts/foo.py [-- args]
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { projectRoot, resolvePython, runPython } from "./spawnUtil.mjs";

const argv = process.argv.slice(2);
if (argv[0] === "--resolve") {
  const { bin, prefix } = resolvePython();
  console.log(prefix.length ? `${bin} ${prefix.join(" ")}` : bin);
  process.exit(0);
}

if (!argv.length) {
  console.error("Usage: node scripts/runPython.mjs <script.py> [args...]");
  process.exit(1);
}

const scriptArg = argv[0];
const args = argv.slice(1);
const scriptPath =
  scriptArg.startsWith("/") || /^[A-Za-z]:/.test(scriptArg)
    ? resolve(scriptArg)
    : resolve(projectRoot, scriptArg);

if (!existsSync(scriptPath)) {
  console.error(`[runPython] not found: ${scriptPath}`);
  process.exit(1);
}

runPython(scriptPath, args);
