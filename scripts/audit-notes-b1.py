#!/usr/bin/env python3
"""Audit notes garden for strict CEFR B1 (garden-voice sentence length)."""

from __future__ import annotations

import importlib.util
import re
import sys
from pathlib import Path
import sys
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
from site_paths import SITE_ROOT as ROOT, resolve_content_file

try:
    import yaml
except ImportError:
    sys.exit("pip install pyyaml required for audit-notes-b1")


NOTES = ROOT / "content/english/notes"
SCRIPTS = _SCRIPTS
sys.path.insert(0, str(SCRIPTS))

FM = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)
SKIP_KINDS = frozenset({"meta", "index"})
SKIP_FILES = frozenset({"_index.md"})

FORMAL = re.compile(
    r"\b(however|therefore|nevertheless|furthermore|moreover|consequently|"
    r"subsequently|utilize|facilitate|functionality|optimization|delve|harness|tapestry)\b",
    re.I,
)
SUBORD = re.compile(
    r"\b(because|when|if|that|which|although|while|since|unless|until|whereas)\b",
    re.I,
)

FRONTMATTER_FIELDS = frozenset(
    {
        "description",
        "key_concept",
        "level_1",
        "level_2",
        "level_3",
        "level_4",
        "level_5",
        "examples[0]",
        "examples[1]",
        "shareable_thought[0]",
        "shareable_thought[1]",
        "shareable_thought[2]",
        "shareable_thought[3]",
        "relationships.reason",
    }
)


def _load(name: str):
    path = SCRIPTS / f"{name}.py"
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), path)
    mod = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


_slop = _load("slop-score")
_notes = _load("notes_content")
sentences = _slop.sentences
word_count = _slop.word_count
note_prose_chunks = _notes.note_prose_chunks


def prose_lines(text: str) -> list[str]:
    out: list[str] = []
    for line in text.split("\n"):
        s = line.strip()
        if not s or s.startswith("{{") or s.startswith("|"):
            continue
        if s.startswith("- "):
            s = s[2:].strip()
        if s:
            out.append(s)
    return out


def field_sentences(text: str) -> list[str]:
    return sentences("\n".join(prose_lines(text)))


def cap_for(field: str) -> int:
    base = field.split("[", 1)[0]
    if base in FRONTMATTER_FIELDS or field.startswith("level_"):
        return 25
    if field.startswith("cards") or field == "body":
        return 25
    return 25


def aim_for(field: str) -> int:
    base = field.split("[", 1)[0]
    if base in FRONTMATTER_FIELDS or field.startswith("level_"):
        return 18
    return 20


def scan_note(path: Path) -> tuple[list[dict], list[tuple[str, str, int, str]]]:
    if path.name in SKIP_FILES:
        return [], []
    text = path.read_text(encoding="utf-8")
    match = FM.match(text)
    if not match:
        return [], []
    meta = yaml.safe_load(match.group(1)) or {}
    if meta.get("draft") or meta.get("note_kind", "note") in SKIP_KINDS:
        return [], []

    _, body = _notes.split_frontmatter(text)
    rel = path.name
    rows: list[dict] = []
    long_samples: list[tuple[str, str, int, str]] = []
    long25 = 0
    long_aim = 0
    formal = 0
    multi_sub = 0

    for field, chunk in note_prose_chunks(meta, body):
        sents = field_sentences(chunk)
        hard = cap_for(field)
        aim = aim_for(field)
        for s in sents:
            wc = word_count(s)
            if wc > hard:
                long25 += 1
                long_samples.append((rel, field, wc, s))
            elif wc > aim:
                long_aim += 1
            if len(SUBORD.findall(s)) >= 3:
                multi_sub += 1
        formal += len(FORMAL.findall(chunk))

    if long25 or formal or multi_sub > 2:
        rows.append(
            {
                "path": rel,
                "long25": long25,
                "long_aim": long_aim,
                "formal": formal,
                "multi_sub": multi_sub,
            }
        )
    return rows, long_samples


def main() -> int:
    check_only = "--check" in sys.argv
    file_args = [a for a in sys.argv[1:] if not a.startswith("-")]
    if file_args:
        paths = []
        for arg in file_args:
            p = resolve_content_file(arg)
            if p is None:
                print(f"audit-notes-b1: not a file: {arg}", file=sys.stderr)
                return 1
            paths.append(p)
    else:
        paths = sorted(NOTES.glob("*.md")) if NOTES.is_dir() else []
    all_rows: list[dict] = []
    all_long: list[tuple[str, str, int, str]] = []

    for path in paths:
        rows, longs = scan_note(path)
        all_rows.extend(rows)
        all_long.extend(longs)

    scanned = sum(1 for p in paths if p.name not in SKIP_FILES)
    all_rows.sort(key=lambda r: (-r["long25"], -r["formal"], -r["multi_sub"]))
    print(f"Notes scanned: {scanned}\n")
    print(f"{'file':<40} {'>25':>4} {'>aim':>5} {'formal':>6} {'3+sub':>5}")
    print("-" * 70)
    for r in all_rows[:50]:
        print(
            f"{r['path']:<40} {r['long25']:>4} {r['long_aim']:>5} "
            f"{r['formal']:>6} {r['multi_sub']:>5}"
        )
    print(f"\nFlagged: {len(all_rows)}/{scanned}")
    print(f"Total >25w sentences: {sum(r['long25'] for r in all_rows)}")

    if all_long:
        all_long.sort(key=lambda x: -x[2])
        print("\n--- Long sentences (>25w) ---")
        limit = 30 if not check_only else 8
        for rel, field, wc, s in all_long[:limit]:
            print(f"\n[{rel}] {field} ({wc}w): {s[:140]}")

    if check_only:
        total_long = sum(r["long25"] for r in all_rows)
        if total_long:
            print(
                f"\nB1 audit failed: {total_long} long sentence(s) in "
                f"{sum(1 for r in all_rows if r['long25'])} note(s)",
                file=sys.stderr,
            )
            return 1
        print("B1 audit OK")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
