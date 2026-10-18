#!/usr/bin/env python3
"""Audit published blog posts for strict B1 bar (jorap-voice)."""

from __future__ import annotations

import re
import sys
from pathlib import Path
import sys
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
from site_paths import SITE_ROOT as ROOT, resolve_content_file


BLOG = ROOT / "content/english/blog"
SCRIPTS = _SCRIPTS
sys.path.insert(0, str(SCRIPTS))

import importlib.util

def _load(name: str):
    path = SCRIPTS / f"{name}.py"
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), path)
    mod = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod

_notes = _load("notes_content")
_slop = _load("slop-score")
split_frontmatter = _notes.split_frontmatter
analyze_text = _slop.analyze_text
sentences = _slop.sentences
word_count = _slop.word_count

FORMAL = re.compile(
    r"\b(however|therefore|nevertheless|furthermore|moreover|consequently|"
    r"subsequently|utilize|facilitate|functionality|optimization|delve|harness|tapestry)\b",
    re.I,
)
SUBORD = re.compile(
    r"\b(because|when|if|that|which|although|while|since|unless|until|whereas)\b",
    re.I,
)


def prose_lines(body: str) -> list[str]:
    """Lines that count for B1 sentence length (exclude shortcodes, tables, headings)."""
    out: list[str] = []
    for line in body.split("\n"):
        s = line.strip()
        if not s or s.startswith("#") or s.startswith("|") or s.startswith("{{"):
            continue
        if s.startswith("!") or s.startswith("<!--") or s.startswith("---"):
            continue
        # Recipe add lines: long ingredient dumps are OK per recipe-style
        if re.match(r"^(Add|Stir|Pour|Mix|Combine|Whisk|Season|Serve|Cover|Lock|Cancel|Press)\b", s, re.I):
            continue
        if re.match(r"^In a (large )?(bowl|measuring cup|small bowl)", s, re.I):
            continue
        out.append(s)
    return out


def prose_sentences(body: str) -> list[str]:
    text = "\n".join(prose_lines(body))
    return sentences(text)


def main() -> int:
    check_only = "--check" in sys.argv
    include_drafts = "--all" in sys.argv
    file_args = [a for a in sys.argv[1:] if not a.startswith("-")]
    published: list[Path] = []
    if file_args:
        for arg in file_args:
            p = resolve_content_file(arg)
            if p is None:
                print(f"audit-blog-b1: not a file: {arg}", file=sys.stderr)
                return 1
            published.append(p)
    for p in sorted(BLOG.glob("*.md")):
        if file_args:
            break
        if p.name.startswith("__") and not include_drafts:
            if p.name == "_index.md":
                continue
            continue
        if p.name == "_index.md":
            continue
        if p.name.startswith("__") and p.name in {
            "__interesting-facts-about-jorap.md",
            "__blog-template.md",
            "__modified-atk-recipe-style-guide-rules.md",
            "__how-to-create-a-blog-template.md",
        }:
            continue
        text = p.read_text(encoding="utf-8")
        fm, _ = split_frontmatter(text)
        if not include_drafts and "draft: true" in fm:
            continue
        if p.name.startswith("__"):
            published.append(p)
            continue
        if "draft: true" in fm:
            continue
        published.append(p)

    rows: list[dict] = []
    long_samples: list[tuple[str, int, str]] = []

    for p in published:
        text = p.read_text(encoding="utf-8")
        _, body = split_frontmatter(text)
        score = analyze_text(body)
        sents = prose_sentences(body)
        long25 = [s for s in sents if word_count(s) > 25]
        long20 = sum(1 for s in sents if word_count(s) > 20)
        formal = FORMAL.findall(body)
        multi_sub = 0
        for s in sents:
            if len(SUBORD.findall(s)) >= 3:
                multi_sub += 1
            wc = word_count(s)
            if wc > 25:
                long_samples.append((p.name, wc, s))

        rows.append(
            {
                "path": p.name,
                "words": score["words"],
                "per100w": score["total_per100w"],
                "long25": len(long25),
                "long20": long20,
                "sentences": score["sentences"],
                "formal": len(formal),
                "multi_sub": multi_sub,
            }
        )

    rows.sort(key=lambda r: (-r["long25"], -r["formal"], -r["per100w"]))
    print(f"Published blogs: {len(rows)}\n")
    print(f"{'file':<45} {'w':>5} {'>25':>4} {'>20':>4} {'formal':>6} {'3+sub':>5} {'per100w':>7}")
    print("-" * 85)
    flagged = 0
    for r in rows:
        if r["long25"] or r["formal"] or r["per100w"] > 2.0 or r["multi_sub"] > 2:
            flagged += 1
            print(
                f"{r['path']:<45} {r['words']:>5} {r['long25']:>4} {r['long20']:>4} "
                f"{r['formal']:>6} {r['multi_sub']:>5} {r['per100w']:>7.2f}"
            )
    print(f"\nFlagged: {flagged}/{len(rows)}")

    long_samples.sort(key=lambda x: -x[1])
    if long_samples:
        print("\n--- Long sentences (>25w) ---")
        limit = 40 if not check_only else 10
        for name, wc, s in long_samples[:limit]:
            print(f"\n[{name}] ({wc}w): {s[:160]}")
        if check_only:
            print(
                f"\nB1 audit failed: {sum(r['long25'] for r in rows)} long prose sentence(s) in {flagged} file(s)",
                file=sys.stderr,
            )
            return 1

    if check_only:
        print("B1 audit OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
