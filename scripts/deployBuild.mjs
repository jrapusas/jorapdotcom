#!/usr/bin/env node
/**
 * Canonical production build for local CI and all deployment targets.
 * Runs theme generation, note dates, Hugo, and CSP hashing - never bare `hugo`.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureHugo } from "./ensureHugo.mjs";
import { projectRoot, siteRoot, run, runNodeScript, runParallel, resolvePython } from "./spawnUtil.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

process.env.HUGO_ENV ||= "production";
process.env.NODE_ENV ||= "production";

require("./fix-tailwind-bin.js");

runNodeScript(join(__dirname, "check.mjs"));

const hugoBin = ensureHugo();
const { bin: pythonBin, prefix: pythonPrefix } = resolvePython();
const pythonEnv = { ...process.env, PYTHONIOENCODING: "utf-8" };

await runParallel([
  { cmd: process.execPath, args: [join(__dirname, "themeGenerator.js")] },
  { cmd: process.execPath, args: [join(__dirname, "noteFileDates.js")] },
]);

await runParallel([
  { cmd: process.execPath, args: [join(__dirname, "verify-webfonts.mjs")] },
  { cmd: process.execPath, args: [join(__dirname, "cursor-usage-bookmarklet.mjs")] },
  {
    cmd: pythonBin,
    args: [...pythonPrefix, join(__dirname, "export-okf-bundle.py")],
    opts: { cwd: siteRoot, env: pythonEnv },
  },
  {
    cmd: pythonBin,
    args: [...pythonPrefix, join(__dirname, "export-okf-blog-bundle.py")],
    opts: { cwd: siteRoot, env: pythonEnv },
  },
]);

const hugoCacheDir = join(projectRoot, ".cache");
run(
  hugoBin,
  [
    "--source",
    siteRoot,
    "--gc",
    "--minify",
    "--forceSyncStatic",
    "--buildFuture",
    "--cacheDir",
    hugoCacheDir,
  ],
  { cwd: projectRoot },
);
runNodeScript(join(__dirname, "cspHashes.mjs"));
runNodeScript(join(__dirname, "test-search.mjs"));
