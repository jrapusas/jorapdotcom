/**
 * Self-check: cursor-usage localStorage snapshot keeps all five fields.
 */

const STORAGE_KEYS = [
  "resetDate",
  "cursorPct",
  "otherPct",
  "grokResetDate",
  "grokPct",
];

function snapshotFromValues(values) {
  return {
    resetDate: values.resetDate || "",
    cursorPct: values.cursorPct != null ? String(values.cursorPct) : "",
    otherPct: values.otherPct != null ? String(values.otherPct) : "",
    grokResetDate: values.grokResetDate || "",
    grokPct: values.grokPct != null ? String(values.grokPct) : "",
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const full = snapshotFromValues({
  resetDate: "2026-09-19",
  cursorPct: 75,
  otherPct: 9,
  grokResetDate: "2026-09-17",
  grokPct: 10,
});
for (const key of STORAGE_KEYS) {
  assert(key in full, `missing key: ${key}`);
}

const monthlyEdit = snapshotFromValues({
  resetDate: "2026-10-01",
  cursorPct: 12,
  otherPct: 3,
  grokResetDate: full.grokResetDate,
  grokPct: full.grokPct,
});
assert(monthlyEdit.grokResetDate === "2026-09-17", "monthly edit keeps grok reset");
assert(monthlyEdit.grokPct === "10", "monthly edit keeps grok pct");

const grokEdit = snapshotFromValues({
  resetDate: full.resetDate,
  cursorPct: full.cursorPct,
  otherPct: full.otherPct,
  grokResetDate: "2026-10-03",
  grokPct: 0,
});
assert(grokEdit.grokPct === "0", "grok edit keeps 0%");
assert(grokEdit.cursorPct === "75", "grok edit keeps cursor pct");

const bookmarkletReplace = snapshotFromValues({
  resetDate: "2026-09-19",
  cursorPct: 80,
  otherPct: 11,
  grokResetDate: "",
  grokPct: "",
});
assert(bookmarkletReplace.grokPct === "", "bookmarklet replace clears grok");

console.log("cursor-usage-storage-check: ok");
