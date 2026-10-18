const fs = require("fs");
const path = require("path");

const SITE_ROOT = path.join(__dirname, "../website");
const NOTES_DIR = path.join(SITE_ROOT, "content/english/notes");
const OUT = path.join(SITE_ROOT, "data/noteFileDates.json");

function collectMarkdownFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectMarkdownFiles(abs, files);
    } else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "_index.md") {
      files.push(abs);
    }
  }
  return files;
}

function generate() {
  const dates = {};
  for (const abs of collectMarkdownFiles(NOTES_DIR)) {
    const stat = fs.statSync(abs);
    const rel = path.relative(path.join(SITE_ROOT, "content/english"), abs).replace(/\\/g, "/");
    dates[rel] = {
      created: stat.birthtime.toISOString(),
      updated: stat.mtime.toISOString(),
    };
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(dates, null, 2) + "\n", "utf8");
  console.log(`✅ Note file dates written: ${OUT} (${Object.keys(dates).length} notes)`);
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

if (process.argv.includes("--watch")) {
  const regen = debounce(generate, 150);
  generate();
  fs.watch(NOTES_DIR, { recursive: true }, regen);
  console.log(`Watching ${NOTES_DIR} for note file date changes…`);
} else {
  generate();
}
