#!/usr/bin/env node
/**
 * Vendor webfonts from data/theme.json into assets/fonts/ + assets/css/fonts.css.
 * Hugo serves these locally only (no runtime or build-time Google Fonts fetch).
 *
 * Run when font families or weights change: pnpm vendor:fonts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../website");
const themePath = path.join(siteRoot, "data/theme.json");
const fontsDir = path.join(siteRoot, "assets/fonts");
const cssPath = path.join(siteRoot, "assets/css/fonts.css");

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

function familiesFromTheme(theme) {
  const ff = theme.fonts?.font_family ?? {};
  const out = [];
  for (const key of ["primary", "secondary", "mono"]) {
    const value = ff[key];
    if (value && !out.includes(value)) out.push(value);
  }
  if (!out.length) {
    throw new Error("theme.json fonts.font_family has no primary/secondary/mono entries");
  }
  return out;
}

/** Latin subset files to preload (body + hero heading). */
function criticalPreloadFiles(css, theme) {
  const ff = theme.fonts?.font_family ?? {};
  const bodyFamily = ff.primary?.replace(/\+/g, " ").replace(/:.*/, "");
  const headingFamily = (ff.secondary ?? ff.primary)
    ?.replace(/\+/g, " ")
    .replace(/:.*/, "");
  if (!bodyFamily || !headingFamily) {
    throw new Error("theme.json fonts.font_family missing primary/secondary");
  }

  const targets = [
    { family: bodyFamily, weight: 400 },
    { family: headingFamily, weight: 700 },
  ];
  const latinFaces = [
    ...css.matchAll(/\/\* latin \*\/\s*@font-face\s*\{([^}]+)\}/g),
  ].map((match) => match[1]);
  const files = [];

  for (const { family, weight } of targets) {
    const block = latinFaces.find(
      (part) =>
        part.includes(`font-family: '${family}'`) &&
        part.includes(`font-weight: ${weight}`),
    );
    const match = block?.match(/url\(\.\.\/fonts\/([^)]+)\)/);
    if (!match) {
      throw new Error(`Could not find latin ${family} ${weight} in vendored CSS`);
    }
    files.push(match[1]);
  }

  return [...new Set(files)];
}

async function main() {
  const theme = JSON.parse(fs.readFileSync(themePath, "utf8"));
  const url = `https://fonts.googleapis.com/css2?family=${familiesFromTheme(theme).join("&family=")}&display=swap`;

  const cssRes = await fetch(url, { headers: { "User-Agent": UA } });
  if (!cssRes.ok) {
    throw new Error(`Google Fonts CSS fetch failed (${cssRes.status}): ${url}`);
  }

  let css = await cssRes.text();
  const remotes = [
    ...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)\s]+/g) ?? []),
  ];
  if (!remotes.length) {
    throw new Error("No fonts.gstatic.com URLs in CSS response — check theme.json family names");
  }

  fs.mkdirSync(fontsDir, { recursive: true });
  const keep = new Set();

  for (const remote of remotes) {
    const localName = path.basename(remote.split("?")[0]);
    if (!localName.endsWith(".woff2")) {
      throw new Error(`Unexpected font URL (expected .woff2): ${remote}`);
    }
    keep.add(localName);
    const dest = path.join(fontsDir, localName);
    const binRes = await fetch(remote);
    if (!binRes.ok) {
      throw new Error(`woff2 fetch failed (${binRes.status}): ${remote}`);
    }
    fs.writeFileSync(dest, Buffer.from(await binRes.arrayBuffer()));
    css = css.replaceAll(remote, `../fonts/${localName}`);
  }

  for (const name of fs.readdirSync(fontsDir)) {
    if (name.endsWith(".woff2") && !keep.has(name)) {
      fs.unlinkSync(path.join(fontsDir, name));
    }
  }

  fs.mkdirSync(path.dirname(cssPath), { recursive: true });
  const banner =
    "/* Vendored webfonts — DO NOT EDIT. Regenerate: pnpm vendor:fonts */\n\n";
  fs.writeFileSync(cssPath, banner + css);

  const criticalPath = path.join(siteRoot, "data/critical-fonts.json");
  const preload = criticalPreloadFiles(css, theme);
  fs.writeFileSync(
    criticalPath,
    `${JSON.stringify({ preload }, null, 2)}\n`,
  );

  const families = [...css.matchAll(/font-family:\s*'([^']+)'/g)].map((m) => m[1]);
  console.log(`✅ Vendored ${remotes.length} woff2 files → assets/fonts/`);
  console.log(`✅ Wrote assets/css/fonts.css (${families.join(", ")})`);
  console.log(`✅ Wrote data/critical-fonts.json (${preload.length} preload candidates)`);
}

main().catch((err) => {
  console.error("❌ vendor-webfonts:", err.message);
  process.exit(1);
});
