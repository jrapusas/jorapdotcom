#!/usr/bin/env python3
"""Mark NASB1995 gospel verses: Jesus words in <span class="jesus-words">, narrative plain."""

from __future__ import annotations

import difflib
import json
import re
import sys
from pathlib import Path
import sys
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
from site_paths import SITE_ROOT as ROOT


JESUS = ROOT / "data" / "jesus-words.yaml"
SCRIPTURE = ROOT / "data" / "scripture-nasb1995.json"
OUT = ROOT / "data" / "bible-red-letter-nasb1995.json"
GOSPELS = {"Matthew", "Mark", "Luke", "John"}


def segments(words: str) -> list[str]:
    parts = re.split(r'(?<=[\?"\.])\s+(?=[“"])', words)
    if len(parts) == 1:
        parts = re.split(r'\s+(?=[“"][A-Z])', words)
    return [p.strip() for p in parts if p.strip()]


def fuzzy_span(verse: str, seg: str) -> tuple[str, int] | None:
    if seg in verse:
        return seg, verse.index(seg)
    anchor = seg[: min(20, len(seg))]
    i = verse.find(anchor)
    if i < 0:
        return None
    j = 0
    while j < len(seg) and i + j < len(verse) and verse[i + j] == seg[j]:
        j += 1
    while i + j < len(verse) and verse[i + j] in ".'\"'”’":
        j += 1
    return verse[i : i + j], i


def mark_tokens(verse: str, words: str) -> str:
    vtok, wtok = verse.split(), words.split()
    sm = difflib.SequenceMatcher(None, vtok, wtok)
    out: list[str] = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        chunk = " ".join(vtok[i1:i2])
        if tag == "equal" and j2 > j1:
            out.append(f'<span class="jesus-words">{chunk}</span>')
        elif tag != "delete":
            out.append(chunk)
    return " ".join(out)


def mark_verse(verse: str, words: str, is_full: bool) -> str:
    if is_full:
        return f'<span class="jesus-words">{verse}</span>'
    if not words:
        return verse
    if words in verse:
        i = verse.index(words)
        return (
            verse[:i]
            + f'<span class="jesus-words">{words}</span>'
            + verse[i + len(words) :]
        )
    segs = segments(words)
    if len(segs) > 1:
        matches: list[tuple[int, int, str]] = []
        for seg in segs:
            found = fuzzy_span(verse, seg)
            if found:
                matched, i = found
                matches.append((i, i + len(matched), matched))
        if matches:
            matches.sort()
            out, pos = [], 0
            for i, end, matched in matches:
                out.append(verse[pos:i])
                out.append(f'<span class="jesus-words">{matched}</span>')
                pos = end
            out.append(verse[pos:])
            return "".join(out)
    found = fuzzy_span(verse, words)
    if found:
        matched, i = found
        return (
            verse[:i]
            + f'<span class="jesus-words">{matched}</span>'
            + verse[i + len(matched) :]
        )
    return mark_tokens(verse, words)


def load_yaml(path: Path) -> dict:
    try:
        import yaml  # type: ignore
    except ImportError:
        sys.exit("pyyaml required: pip install pyyaml")
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def collect_entries() -> dict[str, dict]:
    entries: dict[str, dict] = {}
    if JESUS.exists():
        for ref, trans in load_yaml(JESUS).get("verses", {}).items():
            if n := trans.get("nasb1995"):
                entries[ref] = n
    if SCRIPTURE.exists():
        with SCRIPTURE.open(encoding="utf-8") as f:
            for ref, trans in json.load(f).get("verses", {}).items():
                book = ref.split(" ", 1)[0]
                if book in GOSPELS and ref not in entries:
                    if n := trans.get("nasb1995"):
                        entries[ref] = n
    return entries


def main() -> None:
    marks: dict[str, str] = {}
    for ref, n in collect_entries().items():
        book = ref.split(" ", 1)[0]
        if book not in GOSPELS:
            continue
        verse = n.get("verse", "")
        words = n.get("words", "")
        is_full = bool(n.get("full"))
        if not verse:
            continue
        marks[ref] = mark_verse(verse, words, is_full)

    # ponytail: one runnable check - partial verses must emit at least one red span
    partial = [
        (r, n)
        for r, n in collect_entries().items()
        if r.split(" ", 1)[0] in GOSPELS
        and not n.get("full")
        and n.get("words")
    ]
    bad = [r for r, n in partial if "jesus-words" not in marks[r]]
    assert not bad, f"unmarked partial verses: {bad[:5]}"

    OUT.write_text(
        json.dumps({"verses": marks}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"wrote {len(marks)} marked verses to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
