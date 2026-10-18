#!/usr/bin/env node
/**
 * Fail fast when webfonts are not fully self-hosted.
 * Run: node scripts/verify-webfonts.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../website");
const themePath = path.join(siteRoot, "data/theme.json");
const cssPath = path.join(siteRoot, "assets/css/fonts.css");
const fontsDir = path.join(siteRoot, "assets/fonts");
const criticalPath = path.join(siteRoot, "data/critical-fonts.json");

function familyNamesFromTheme(theme) {
  const ff = theme.fonts?.font_family ?? {};
  const names = [];
  for (const key of ["primary", "secondary", "mono"]) {
    const value = ff[key];
    if (!value) continue;
    names.push(value.replace(/\+/g, " ").replace(/:.*/, ""));
  }
  return [...new Set(names)];
}

function fail(message) {
  console.error(`❌ verify-webfonts: ${message}`);
  process.exit(1);
}

function main() {
  if (!fs.existsSync(cssPath)) {
    fail("assets/css/fonts.css missing — run: pnpm vendor:fonts");
  }

  const css = fs.readFileSync(cssPath, "utf8");

  if (/https?:\/\//.test(css)) {
    fail("fonts.css still references remote URLs — run: pnpm vendor:fonts");
  }

  if (!/font-display:\s*swap/.test(css)) {
    fail("fonts.css has no font-display: swap rules");
  }

  const refs = [...css.matchAll(/url\(\.\.\/fonts\/([^)]+)\)/g)].map((m) => m[1]);
  if (!refs.length) {
    fail("fonts.css has no ../fonts/ references");
  }

  const missing = refs.filter((name) => !fs.existsSync(path.join(fontsDir, name)));
  if (missing.length) {
    fail(`missing woff2 binaries: ${missing.join(", ")} — run: pnpm vendor:fonts`);
  }

  const theme = JSON.parse(fs.readFileSync(themePath, "utf8"));
  for (const name of familyNamesFromTheme(theme)) {
    if (!css.includes(`'${name}'`)) {
      fail(`fonts.css missing @font-face for ${name} (declared in data/theme.json)`);
    }
  }

  if (!fs.existsSync(criticalPath)) {
    fail("data/critical-fonts.json missing — run: pnpm vendor:fonts");
  }

  const critical = JSON.parse(fs.readFileSync(criticalPath, "utf8"));
  for (const name of critical.preload ?? []) {
    if (!refs.includes(name)) {
      fail(`critical preload ${name} not referenced in fonts.css`);
    }
    if (!fs.existsSync(path.join(fontsDir, name))) {
      fail(`critical preload binary missing: ${name}`);
    }
  }

  console.log(
    `✅ Webfonts self-hosted: ${refs.length} @font-face src(s), ${new Set(refs).size} unique woff2 file(s), ${(critical.preload ?? []).length} critical preload(s)`,
  );
}

main();
