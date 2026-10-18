#!/usr/bin/env node
/** Local hugo server with pinned Hugo check and Go on PATH (modules). */
import { spawn } from "node:child_process";
import { ensureHugo } from "./ensureHugo.mjs";
import { ensureGo } from "./ensureGo.mjs";
import { projectRoot } from "./spawnUtil.mjs";

ensureGo();
const hugoBin = ensureHugo();
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/hugoServer.mjs server [hugo flags...]");
  process.exit(1);
}

const child = spawn(hugoBin, args, {
  stdio: "inherit",
  cwd: projectRoot,
  env: process.env,
});

child.on("error", (err) => {
  console.error("[hugo]", err.message);
  process.exit(1);
});

child.on("close", (code) => process.exit(code ?? 1));
