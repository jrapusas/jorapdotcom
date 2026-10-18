#!/usr/bin/env python3
"""Verify atomic notes keep structured data in frontmatter, not body sections."""

from __future__ import annotations

import re
import sys
from pathlib import Path
import sys
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
from site_paths import SITE_ROOT as ROOT

import yaml

from notes_content import (
    LEVEL_KEYS,
    LEVEL_BULLET_RE,
    LEVEL_PREFIX_RE,
    is_complete_shareable_line,
    gets_point_across,
    shareable_lines_overlap,
    shareable_line_from_principle,
    key_concept_overlaps_description,
    split_frontmatter,
    parse_display_fields,
    relationship_frontmatter_errors,
    META_NOTE_LANG,
    DANGLING_THAT_START,
    CLAUSE_SO_START,
)


NOTES = ROOT / "content/english/notes"
SKIP = {"_index.md"}


def load_fm(raw_fm: str) -> dict:
    try:
        data = yaml.safe_load(raw_fm) or {}
    except yaml.YAMLError:
        data = {}
    return data if isinstance(data, dict) else {}


BIBLE_RE = re.compile(r"^\s*\{\{<\s*bible\b", re.I)
BULLET_RE = re.compile(r"^\s*-\s+")
TABLE_RE = re.compile(r"^\s*\|")

MAX_DESCRIPTION_WORDS = 20
MAX_SHAREABLE_LINE_CHARS = 130
SHAREABLE_LINE_COUNT = 4
TITLE_MAX_WORDS = 4
TITLE_FIVE_MIN_LEN = 30
# ponytail: phrase/scripture titles; lint cannot judge "better than best 4-word"
TITLE_PHRASE_EXEMPT = frozenset(
    {"Let Your Yes Be Yes", "There Is No Perfect Solution"}
)


def lint_title(path: Path, fm: dict) -> list[str]:
    if fm.get("note_kind", "note") in {"meta", "index"}:
        return []
    title = fm.get("title")
    if not isinstance(title, str) or not title.strip():
        return [f"FAIL missing title: {path.name}"]
    title = title.strip()
    words = len(title.split())
    if words <= TITLE_MAX_WORDS:
        return []
    if words > TITLE_MAX_WORDS + 1:
        return [f"FAIL title {words} words (max {TITLE_MAX_WORDS + 1}): {path.name}"]
    if title in TITLE_PHRASE_EXEMPT:
        return []
    if len(title) < TITLE_FIVE_MIN_LEN:
        return [
            f"FAIL title 5 words, {len(title)} chars "
            f"(need ≥{TITLE_FIVE_MIN_LEN} or trim to 4): {path.name}"
        ]
    return []


def lint_shareable_thought(path: Path, fm: dict) -> list[str]:
    if path.name in SKIP:
        return []
    lines = fm.get("shareable_thought")
    if not isinstance(lines, list) or len(lines) != SHAREABLE_LINE_COUNT:
        return [f"FAIL shareable_thought need {SHAREABLE_LINE_COUNT} items: {path.name}"]
    errs: list[str] = []
    for i, line in enumerate(lines):
        if not isinstance(line, str) or not line.strip():
            errs.append(f"FAIL shareable_thought[{i}] empty: {path.name}")
            continue
        if len(line) > MAX_SHAREABLE_LINE_CHARS:
            errs.append(f"FAIL shareable_thought[{i}] {len(line)} chars (max {MAX_SHAREABLE_LINE_CHARS}): {path.name}")
        if "[[" in line:
            errs.append(f"FAIL wikilink in shareable_thought[{i}]: {path.name}")
        if "Tension with" in line:
            errs.append(f"FAIL shareable_thought[{i}] relationship tension: {path.name}")
        if not gets_point_across(line):
            errs.append(f"FAIL shareable_thought[{i}] fragment: {path.name}")
        if not shareable_line_from_principle(line, fm):
            errs.append(f"FAIL shareable_thought[{i}] not from principle: {path.name}")
        if META_NOTE_LANG.search(line):
            errs.append(f"FAIL shareable_thought[{i}] meta note language: {path.name}")
        if DANGLING_THAT_START.match(line.strip()):
            errs.append(f"FAIL shareable_thought[{i}] dangling That's: {path.name}")
        if CLAUSE_SO_START.match(line.strip()):
            errs.append(f"FAIL shareable_thought[{i}] So-clause fragment: {path.name}")
        if re.match(r"^See [A-Z]", line.strip()):
            errs.append(f"FAIL shareable_thought[{i}] cross-note See pointer: {path.name}")
        for ex in fm.get("examples") or []:
            if not isinstance(ex, str):
                continue
            ex_head = ex.strip().split(" - ")[0][:45]
            if len(line) > 25 and line.startswith(ex_head):
                errs.append(f"FAIL shareable_thought[{i}] looks like example: {path.name}")
                break
    for i in range(len(lines)):
        for j in range(i + 1, len(lines)):
            if isinstance(lines[i], str) and isinstance(lines[j], str):
                if shareable_lines_overlap(lines[i], lines[j]):
                    errs.append(f"FAIL shareable_thought[{i}] overlaps [{j}]: {path.name}")
    return errs


def lint_key_concept_bullets(path: Path, fm: dict) -> list[str]:
    """key_concept prose must be bullets; bible shortcodes and tables stay bare."""
    if fm.get("note_kind", "note") in {"meta", "index"}:
        return []
    kc = fm.get("key_concept")
    if not isinstance(kc, str) or not kc.strip():
        return []
    for line in kc.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if BIBLE_RE.match(stripped) or TABLE_RE.match(stripped) or BULLET_RE.match(stripped):
            continue
        return [f"FAIL key_concept prose not bulleted: {path.name}"]
    return []


def lint_description_in_key_concept(path: Path, fm: dict) -> list[str]:
    """description must not repeat inside key_concept stack (levels may restate)."""
    if fm.get("note_kind", "note") in {"meta", "index"}:
        return []
    desc = fm.get("description")
    kc = fm.get("key_concept")
    if not isinstance(desc, str) or not isinstance(kc, str):
        return []
    hits = key_concept_overlaps_description(desc, kc)
    if not hits:
        return []
    preview = hits[0][:60] + ("…" if len(hits[0]) > 60 else "")
    return [f"FAIL description in key_concept ({preview}): {path.name}"]


def lint_key_concept_overlap(path: Path, fm: dict) -> list[str]:
    """key_concept bullets must not restate the same claim twice."""
    if fm.get("note_kind", "note") in {"meta", "index"}:
        return []
    kc = fm.get("key_concept")
    if not isinstance(kc, str) or not kc.strip():
        return []
    bullets: list[str] = []
    for line in kc.splitlines():
        stripped = line.strip()
        if not BULLET_RE.match(stripped):
            continue
        text = stripped.lstrip("- ").strip()
        if BIBLE_RE.match(text) or len(text) < 20:
            continue
        bullets.append(text)
    errs: list[str] = []
    for i in range(len(bullets)):
        for j in range(i + 1, len(bullets)):
            if shareable_lines_overlap(bullets[i], bullets[j]):
                errs.append(f"FAIL key_concept[{i}] overlaps [{j}]: {path.name}")
    return errs


def lint_levels(path: Path, fm: dict) -> list[str]:
    """Atomic notes need level_1..level_5 (no Level N: prefix in the value)."""
    if fm.get("note_kind", "note") in {"meta", "index"}:
        return []
    errs: list[str] = []
    kc = fm.get("key_concept")
    if isinstance(kc, str):
        for line in kc.splitlines():
            if LEVEL_BULLET_RE.match(line):
                errs.append(f"FAIL Level bullet still in key_concept: {path.name}")
                break
    for key in LEVEL_KEYS:
        val = fm.get(key)
        if not isinstance(val, str) or not val.strip():
            errs.append(f"FAIL missing {key}: {path.name}")
            continue
        if LEVEL_PREFIX_RE.match(val.strip()):
            errs.append(f"FAIL {key} still has Level prefix: {path.name}")
    return errs


def lint_description(path: Path, fm: dict) -> list[str]:
    """description = memorable one-breath definition; no wikilinks, <=20 words."""
    if fm.get("note_kind", "note") in {"meta", "index"}:
        return []
    desc = fm.get("description")
    if not isinstance(desc, str) or not desc.strip():
        return [f"FAIL missing description: {path.name}"]
    desc = desc.strip()
    errs: list[str] = []
    if "[[" in desc:
        errs.append(f"FAIL wikilink in description: {path.name}")
    words = len(desc.split())
    if words > MAX_DESCRIPTION_WORDS:
        errs.append(f"FAIL description {words} words (max {MAX_DESCRIPTION_WORDS}): {path.name}")
    return errs


def lint_relationships(path: Path, raw_fm: str, fm: dict) -> list[str]:
    """Each relationships row needs type, [[wikilink]], and reason (export path)."""
    if fm.get("note_kind", "note") in {"meta", "index"}:
        return []
    display_fm = parse_display_fields(raw_fm)
    if not display_fm.get("relationships"):
        return []
    errs: list[str] = []
    for msg in relationship_frontmatter_errors(display_fm):
        errs.append(f"FAIL {msg}: {path.name}")
    return errs


def verify() -> int:
    bad = 0
    for path in sorted(NOTES.glob("*.md")):
        if path.name in SKIP:
            continue
        text = path.read_text(encoding="utf-8")
        raw_fm, body = split_frontmatter(text)
        fm = load_fm(raw_fm)
        for heading in ("Key Concept", "Examples", "Note Relationships", "See also"):
            if re.match(rf"^## {re.escape(heading)}\s*$", body, re.M):
                print(f"FAIL body still has ## {heading}: {path.name}")
                bad += 1
        if not fm.get("key_concept") and fm.get("note_kind", "note") not in {"meta", "index"}:
            print(f"FAIL missing key_concept: {path.name}")
            bad += 1
        if body.strip() and fm.get("note_kind", "note") not in {"meta", "index"}:
            print(f"FAIL non-empty body on atomic note: {path.name}")
            bad += 1
        for msg in lint_title(path, fm):
            print(msg)
            bad += 1
        for msg in lint_description(path, fm):
            print(msg)
            bad += 1
        for msg in lint_description_in_key_concept(path, fm):
            print(msg)
            bad += 1
        for msg in lint_key_concept_bullets(path, fm):
            print(msg)
            bad += 1
        for msg in lint_key_concept_overlap(path, fm):
            print(msg)
            bad += 1
        for msg in lint_levels(path, fm):
            print(msg)
            bad += 1
        for msg in lint_shareable_thought(path, fm):
            print(msg)
            bad += 1
        for msg in lint_relationships(path, raw_fm, fm):
            print(msg)
            bad += 1
    return bad


def _self_check() -> None:
    assert not lint_title(Path("x.md"), {"title": "Golden Rule at Work"})
    assert not lint_title(Path("x.md"), {"title": "Let Your Yes Be Yes"})
    assert lint_title(Path("x.md"), {"title": "The Golden Rule at Work"})
    assert lint_title(Path("x.md"), {"title": "One Two Three Four Five Six"})
    assert not lint_title(Path("x.md"), {"title": "Integrity Without an Audience"})
    assert not lint_title(Path("x.md"), {"title": "There Is No Perfect Solution"})


def main() -> int:
    if "--self-check" in sys.argv:
        _self_check()
        print("lint-notes-frontmatter self-check OK")
        return 0

    bad = verify()
    if bad:
        print(f"\n{bad} note(s) failed frontmatter lint")
        return 1
    print("Note frontmatter lint OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
