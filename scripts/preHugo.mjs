#!/usr/bin/env node
/**
 * Shared pre-Hugo generators: theme tokens + note file dates.
 * Call before any bare `hugo` that depends on generated CSS or data.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runNodeScript } from "./spawnUtil.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @param {{ quiet?: boolean }} [opts] */
export function runPreHugoInputs(opts = {}) {
  runNodeScript(join(__dirname, "themeGenerator.js"));
  runNodeScript(join(__dirname, "noteFileDates.js"));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runPreHugoInputs();
}
