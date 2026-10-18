#!/usr/bin/env node
/**
 * Runnable checks for site search: searchindex.json validity + match/rank logic.
 *
 * Usage:
 *   node scripts/test-search.mjs          # use existing public/ output
 *   node scripts/test-search.mjs --build  # regenerate public/ first (theme + hugo)
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ensureHugo } from "./ensureHugo.mjs";
import { runPreHugoInputs } from "./preHugo.mjs";
import {
  DEFAULT_SEARCH_OPTS,
  filterAndSortSearchResults,
  groupByConfiguredSections,
  matchesSearch,
  searchIndex,
  slugify,
} from "../website/assets/js/search-core.js";
import { projectRoot, siteRoot, run } from "./spawnUtil.mjs";

const INDEX_PATH = join(siteRoot, "public", "searchindex.json");
const HOME_HTML = join(siteRoot, "public", "index.html");
const INDEX_TEMPLATE_PATH = join(
  siteRoot,
  "layouts",
  "_default",
  "list.searchindex.json",
);
const INCLUDE_SECTIONS = ["blog", "notes"];
const REQUIRED_KEYS = [
  "section",
  "slug",
  "title",
  "description",
  "date",
  "image",
  "imageSM",
  "searchKeyword",
  "categories",
  "tags",
  "keyConcept",
  "shareableThought",
  "relationships",
  "content",
];

let failed = 0;

function fail(message) {
  failed += 1;
  console.error(`  FAIL ${message}`);
}

function ok(message) {
  console.log(`  ok ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
  else ok(message);
}

function loadIndex() {
  const raw = readFileSync(INDEX_PATH, "utf8");
  return { raw, data: JSON.parse(raw) };
}

function maybeBuild() {
  if (!process.argv.includes("--build")) return;
  const hugoBin = ensureHugo();
  runPreHugoInputs();
  run(hugoBin, ["--source", siteRoot, "--gc", "--minify", "--buildFuture"], {
    cwd: projectRoot,
  });
}

function testIndexFile() {
  console.log("\nsearchindex.json");
  assert(existsSync(INDEX_PATH), "public/searchindex.json exists");

  let raw;
  let data;
  try {
    ({ raw, data } = loadIndex());
    assert(true, "parses as JSON");
  } catch (err) {
    fail(`parses as JSON (${err.message})`);
    return null;
  }

  assert(raw.length > 2, "is not empty");
  assert(Array.isArray(data), "root value is an array");
  assert(data.length > 0, `indexes ${data.length} pages`);

  // Regression: literal control chars inside quoted strings break fetch().json().
  try {
    const roundTrip = JSON.stringify(data);
    JSON.parse(roundTrip);
    assert(true, "round-trips through JSON.stringify");
  } catch (err) {
    fail(`round-trips through JSON.stringify (${err.message})`);
  }

  for (const [i, item] of data.entries()) {
    for (const key of REQUIRED_KEYS) {
      if (!(key in item)) {
        fail(`item ${i} (${item.slug ?? "?"}) missing key "${key}"`);
      }
    }
    if (typeof item.slug !== "string" || !item.slug.startsWith("/")) {
      fail(`item ${i} has invalid slug ${JSON.stringify(item.slug)}`);
    }
    for (const key of [
      "title",
      "description",
      "content",
      "searchKeyword",
      "keyConcept",
      "shareableThought",
      "relationships",
    ]) {
      if (item[key] != null && typeof item[key] !== "string") {
        fail(`item ${i} field "${key}" is not a string`);
      }
    }
  }
  assert(true, "every item has required string fields");

  const sections = new Set(data.map((item) => slugify(item.section)));
  for (const section of sections) {
    assert(
      INCLUDE_SECTIONS.includes(section),
      `section "${section}" is in configured include list`,
    );
  }

  const issues = data.find((item) => item.slug === "/notes/issues/");
  assert(issues != null, 'includes /notes/issues/ (multiline description regression)');
  if (issues) {
    assert(
      issues.description.includes("\n"),
      "issues description keeps paragraph break when parsed",
    );
  }

  return data;
}

function testSearchLogic(index) {
  console.log("\nmatch and rank logic");

  const titleHit = index.find((item) =>
    matchesSearch(item, item.title.slice(0, 4).toLowerCase()),
  );
  assert(titleHit != null, "finds a title match in live index");

  const notes = index.filter((item) => slugify(item.section) === "notes");
  const missedExactTitles = notes.filter((item) => {
    const topFive = filterAndSortSearchResults(notes, item.title).slice(0, 5);
    return !topFive.some((result) => result.slug === item.slug);
  });
  assert(
    missedExactTitles.length === 0,
    `exact note titles rank their note in top five${
      missedExactTitles.length
        ? ` (${missedExactTitles.map((item) => item.slug).join(", ")})`
        : ""
    }`,
  );

  const contentOnly = index.find(
    (item) =>
      item.content.length > 40 &&
      !item.title.toLowerCase().includes("zzznomatch") &&
      matchesSearch(item, "the"),
  );
  assert(contentOnly != null, "finds a body match in live index");

  const synthetic = [
    {
      section: "Notes",
      slug: "/notes/a/",
      title: "Alpha Topic",
      description: "",
      searchKeyword: "",
      tags: "",
      categories: "",
      content: "mentions beta keyword in body only",
    },
    {
      section: "Notes",
      slug: "/notes/b/",
      title: "Beta Topic",
      description: "",
      searchKeyword: "",
      tags: "",
      categories: "",
      content: "unrelated body",
    },
  ];
  const ranked = filterAndSortSearchResults(synthetic, "beta");
  assert(
    ranked.length === 2 && ranked[0].slug === "/notes/b/",
    "title match ranks above body-only match",
  );

  const tagged = {
    section: "Blog",
    slug: "/blog/tagged/",
    title: "Tagged Post",
    description: "",
    searchKeyword: "",
    tags: "Hugo, Search",
    categories: "Dev",
    content: "plain body",
  };
  assert(
    matchesSearch(tagged, "hugo", DEFAULT_SEARCH_OPTS),
    "matches configured tags",
  );
  assert(
    matchesSearch(tagged, "dev", DEFAULT_SEARCH_OPTS),
    "matches configured categories",
  );
  assert(
    matchesSearch(
      { ...tagged, searchKeyword: "custom-query" },
      "custom-query",
      DEFAULT_SEARCH_OPTS,
    ),
    "matches searchKeyword",
  );
  assert(
    matchesSearch(tagged, "plain", DEFAULT_SEARCH_OPTS),
    "matches description/body toggle path via content",
  );
  assert(
    !matchesSearch(tagged, "hugo", {
      ...DEFAULT_SEARCH_OPTS,
      tags: false,
    }),
    "honours tags toggle off",
  );

  const grouped = groupByConfiguredSections(index, INCLUDE_SECTIONS);
  assert(grouped.length === INCLUDE_SECTIONS.length, "groups index by configured sections");
  assert(
    grouped.every((group) => group.data.length > 0),
    "both configured sections have indexed pages",
  );

  const results = searchIndex(index, INCLUDE_SECTIONS, "issues");
  assert(results.length > 0, "section-scoped search returns groups");
  assert(
    results.some((group) =>
      group.data.some((item) => item.slug === "/notes/issues/"),
    ),
    'query "issues" finds Issues note',
  );

  const judgmentSeat = index.find(
    (item) => item.slug === "/notes/judgment-seat/",
  );
  assert(judgmentSeat != null, "indexes judgment seat note");
  if (judgmentSeat) {
    assert(
      matchesSearch(judgmentSeat, "bema"),
      'query "bema" matches key_concept on judgment seat',
    );
  }
}

function testIndexTemplate() {
  console.log("\nindex template");
  const template = readFileSync(INDEX_TEMPLATE_PATH, "utf8");
  const ignoreFilter = template.indexOf('"Params.ignoreSearch" "ne" true');
  const pageCount = template.indexOf("len $searchablePages");
  assert(
    ignoreFilter >= 0 && ignoreFilter < pageCount,
    "filters ignoreSearch pages before counting JSON entries",
  );
}

function testBuiltHtml() {
  console.log("\nbuilt HTML wiring");
  if (!existsSync(HOME_HTML)) {
    fail("public/index.html missing (run pnpm build or pass --build)");
    return;
  }

  const html = readFileSync(HOME_HTML, "utf8");
  assert(
    /let indexURL\s*=/.test(html) && html.includes("searchindex.json"),
    "homepage defines same-origin searchindex URL",
  );
  assert(
    /includeSectionsInSearch\s*=/.test(html),
    "homepage defines includeSectionsInSearch",
  );
  assert(
    html.includes('"blog"') && html.includes('"notes"'),
    "homepage search sections include blog and notes",
  );
  assert(
    /\bclass=["']?search-modal\b/.test(html),
    "homepage renders search modal",
  );
  assert(html.includes("data-search-input"), "homepage renders search input");
  assert(
    /\bdata-target=["']?search-modal(?:["']|[\s>])/.test(html),
    "homepage exposes search open trigger",
  );

  const jsDir = join(siteRoot, "public", "js");
  const jsFiles = existsSync(jsDir) ? readdirSync(jsDir) : [];
  const hasSearchBundle =
    jsFiles.some((name) => name === "search.js" || name === "script.js") ||
    jsFiles.some((name) => name.includes("search") && name.endsWith(".js"));
  assert(hasSearchBundle, "built JS bundle includes search script");
}

function main() {
  console.log("test-search");
  maybeBuild();

  if (!existsSync(INDEX_PATH) && !process.argv.includes("--build")) {
    console.error(
      "\npublic/searchindex.json not found. Run `pnpm build` or `node scripts/test-search.mjs --build`.",
    );
    process.exit(1);
  }

  const index = testIndexFile();
  if (index) testSearchLogic(index);
  testIndexTemplate();
  testBuiltHtml();

  console.log(`\n${failed === 0 ? "all passed" : `${failed} failed`}`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
