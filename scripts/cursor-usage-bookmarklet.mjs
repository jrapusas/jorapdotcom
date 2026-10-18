#!/usr/bin/env node
/**
 * Build bookmarklet href → website/assets/js/cursor-usage-bookmarklet-href.js
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteRoot = path.join(root, "website");
const srcPath = path.join(siteRoot, "assets/js/cursor-usage-bookmarklet.js");
const outPath = path.join(siteRoot, "assets/js/cursor-usage-bookmarklet-href.js");

function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

/** ponytail: hand minify only — no esbuild; keep bookmark href under browser limits. */
function minify(code) {
  return stripComments(code)
    .replace(/\s+/g, " ")
    .replace(/\s*([{}();,:=+\-*/<>?&|![\]])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
}

function buildHref(code) {
  return "javascript:" + encodeURIComponent(minify(code));
}

function selfCheck() {
  const samples = [
    {
      text: "Cursor Models 12% Other Models 0% limits reset Sep 19 25 days left",
      reset: "2026-09-19",
      cursor: 12,
      other: 0,
    },
    {
      text:
        "Usage limits reset on Sep 19 (5 days left) Included in Pro Cursor Models 75% used Additional usage beyond limits consumes Other Models quota or on-demand spend. Other Models 9% used Grok Bot Weekly usage 10% used Resets Sep 17 (3 days left)",
      reset: "2026-09-19",
      cursor: 75,
      other: 9,
      grokReset: "2026-09-17",
      grok: 10,
    },
    {
      text:
        "Grok Bot Weekly usage 10% used Resets Sep 17 (3 days left) CURRENT PLAN Pro $20/mo Usage limits reset on Sep 19 (5 days left) Included in Pro Cursor Models 75% used Other Models 9% used",
      reset: "2026-09-19",
      cursor: 75,
      other: 9,
      grokReset: "2026-09-17",
      grok: 10,
    },
    {
      text:
        "Grok Bot On-Demand Usage Spending Current Plan Pro $20/mo Usage limits reset on Sep 19 (2 days left) Included in Pro Cursor Models Includes Cursor Grok and Composer 97% used Other Models 19% used Grok Bot Included in Pro Weekly usage 13% used Resets Sep 24 (7 days left)",
      reset: "2026-09-19",
      cursor: 97,
      other: 19,
      grokReset: "2026-09-24",
      grok: 13,
    },
  ];

  function pctCursor(text) {
    const idx = text.toLowerCase().indexOf("cursor models");
    if (idx < 0) return null;
    const m = text.slice(idx, idx + 80).match(/(\d+(?:\.\d+)?)\s*%/);
    return m ? Math.ceil(parseFloat(m[1])) : null;
  }

  function pctOther(text) {
    const idx = text.toLowerCase().lastIndexOf("other models");
    if (idx < 0) return null;
    const m = text.slice(idx, idx + 80).match(/(\d+(?:\.\d+)?)\s*%/);
    return m ? Math.ceil(parseFloat(m[1])) : null;
  }

  function weeklyChunk(text) {
    const weeklyIdx = text.toLowerCase().indexOf("weekly usage");
    return weeklyIdx < 0 ? "" : text.slice(weeklyIdx, weeklyIdx + 120);
  }

  function pctGrok(text) {
    const chunk = weeklyChunk(text);
    if (!chunk) return null;
    const m = chunk.match(/(\d+(?:\.\d+)?)\s*%/);
    return m ? Math.ceil(parseFloat(m[1])) : null;
  }

  function monIdx(n) {
    const i = "janfebmaraprmayjunjulaugsepoctnovdec".indexOf(
      (n || "").slice(0, 3).toLowerCase(),
    );
    return i < 0 ? null : i / 3;
  }

  function dateFrom(mon, day) {
    const m = monIdx(mon);
    if (m == null || !day) return null;
    const y = 2026;
    const mo = m + 1;
    return `${y}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function parseReset(text) {
    const body = text.replace(/\s+/g, " ").trim();
    let m = body.match(/reset[s]?(?:\s+on)?\s+([a-z]{3,9})\s+(\d{1,2})/i);
    if (m) return dateFrom(m[1], parseInt(m[2], 10));
    m = body.match(/(\d+)\s+days?\s+left/i);
    return m ? "legacy-days" : null;
  }

  function monthlyReset(text) {
    const body = text.replace(/\s+/g, " ").trim();
    let m = body.match(/usage limits reset on\s+([a-z]{3,9})\s+(\d{1,2})/i);
    if (m) return dateFrom(m[1], parseInt(m[2], 10));
    const g = body.toLowerCase().indexOf("grok bot");
    const legacy = parseReset(g >= 0 ? body.slice(0, g) : body);
    return legacy === "legacy-days" ? null : legacy;
  }

  for (const s of samples) {
    if (pctCursor(s.text) !== s.cursor) {
      throw new Error("self-check: cursor pct");
    }
    if (pctOther(s.text) !== s.other) {
      throw new Error("self-check: other pct");
    }
    if (s.reset && monthlyReset(s.text) !== s.reset) {
      throw new Error("self-check: reset date");
    }
    if (s.grok != null && pctGrok(s.text) !== s.grok) {
      throw new Error("self-check: grok pct");
    }
    if (s.grokReset) {
      if (parseReset(weeklyChunk(s.text)) !== s.grokReset) {
        throw new Error("self-check: grok reset");
      }
    }
  }

  console.log("cursor-usage-bookmarklet: self-check ok");
}

const args = new Set(process.argv.slice(2));
if (args.has("--self-check")) {
  selfCheck();
  process.exit(0);
}

const src = fs.readFileSync(srcPath, "utf8");
const href = buildHref(src);
const HREF_LIMIT = 8000;
if (href.length > HREF_LIMIT) {
  console.error(
    "cursor-usage-bookmarklet: href is",
    href.length,
    "chars (limit",
    HREF_LIMIT,
    ") — shrink source or use remote loader",
  );
  process.exit(1);
}

const out =
  "/* Generated by scripts/cursor-usage-bookmarklet.mjs — do not edit */\n" +
  "globalThis.JORAP_CURSOR_USAGE_BOOKMARKLET_HREF=" +
  JSON.stringify(href) +
  ";\n";

fs.writeFileSync(outPath, out);
console.log("Wrote", path.relative(root, outPath), "(" + href.length + " chars)");
