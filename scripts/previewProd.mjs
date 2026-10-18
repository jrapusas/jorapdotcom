#!/usr/bin/env node
/** Build then serve - no shell `&&` so macOS/Linux/Windows behave the same. */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runNodeScript } from "./spawnUtil.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

runNodeScript(join(__dirname, "deployBuild.mjs"));
runNodeScript(join(__dirname, "servePublic.mjs"));
