/** Fail fast when Go is missing (Hugo modules need it on PATH). */
import { capture } from "./spawnUtil.mjs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function readPinnedGoVersion() {
  return JSON.parse(
    readFileSync(join(__dirname, "deploy-versions.json"), "utf8"),
  ).go;
}

export function ensureGo() {
  const pinned = readPinnedGoVersion();
  const result = capture("go", ["version"]);
  if (result.status !== 0 || !result.stdout) {
    console.error(`[hugo] Go ${pinned}+ required for Hugo modules.`);
    console.error("[hugo] Install: mise use go@" + pinned + "  (or brew install go)");
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  ensureGo();
  const result = capture("go", ["version"]);
  console.log("ensureGo OK:", result.stdout.trim());
}
