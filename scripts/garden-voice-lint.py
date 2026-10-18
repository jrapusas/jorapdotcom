#!/usr/bin/env python3
"""Lint notes garden frontmatter against garden-voice rules."""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path
import sys
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
from site_paths import SITE_ROOT as ROOT

try:
    import yaml
except ImportError:
    sys.exit("pip install pyyaml required for garden-voice-lint")

from notes_content import bible_verse_ref_in_text


NOTES = ROOT / "content/english/notes"
FM = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)
WIKILINK = re.compile(r"\[\[")
# 's only on contraction bases (what's/it's) - not possessives (Christ's, week's)
CONTRACTION = re.compile(
    r"\b(?:I|you|we|they|he|she|it|who|what|that|there|here|let|do|does|did|is|are|was|were|"
    r"have|has|had|will|would|could|should|can|cannot|won|don|doesn|didn|isn|aren|wasn|weren|"
    r"haven|hasn|hadn|wouldn|couldn|shouldn|mustn|needn|mightn|shan|ain't)"
    r"(?:'t|'re|'ve|'ll|'d|'m|'s)\b",
    re.I,
)
DESC_FIRST_PERSON = re.compile(r"\b(I|me|my)\b", re.I)
BIBLE = re.compile(
    r"\{\{<\s*bible|NASB|Matthew|Mark|Luke|John \d|Romans|Ephesians|Galatians|"
    r"Corinthians|Peter|James|Hebrews|Psalm|Proverbs|Colossians|Philippians|"
    r"Timothy|Titus|Revelation|Isaiah|Jeremiah",
    re.I,
)
BIBLE_SHORTCODE = re.compile(r"\{\{<\s*bible\b", re.I)
FAITH_TAGS = frozenset(
    {"faith", "eternal principles", "christianity", "theology", "gospel", "jesus", "bible"}
)
WORKPLACE_TAGS = frozenset({"workplace"})
TITLE_PHRASE_EXEMPT = frozenset(
    {
        "let your yes be yes",
        "there is no perfect solution",
    }
)
FRONTMATTER_FIELDS = ("description", "key_concept", "examples", "shareable_thought")
SKIP_KINDS = frozenset({"meta", "index"})
SKIP_FILES = frozenset({"_index.md"})


@dataclass(frozen=True)
class Issue:
    path: str
    field: str
    rule: str
    detail: str = ""


def is_faith(meta: dict) -> bool:
    tags = {str(t).lower() for t in (meta.get("tags") or [])}
    cats = {str(c).lower() for c in (meta.get("categories") or [])}
    return bool(tags & FAITH_TAGS or cats & {"faith", "eternal principles"})


def is_workplace_lane(meta: dict) -> bool:
    tags = {str(t).lower() for t in (meta.get("tags") or [])}
    return bool(tags & WORKPLACE_TAGS)


def first_key_concept_line(key_concept: str) -> str | None:
    for raw in key_concept.splitlines():
        line = raw.strip()
        if not line or line.startswith("{{"):
            continue
        if line.startswith("- "):
            return line[2:].strip()
        return line
    return None


def scan_note(path: Path) -> list[Issue]:
    if path.name in SKIP_FILES:
        return []
    rel = str(path.relative_to(ROOT))
    text = path.read_text(encoding="utf-8")
    match = FM.match(text)
    if not match:
        return []
    meta = yaml.safe_load(match.group(1)) or {}
    if meta.get("draft") or meta.get("note_kind", "note") in SKIP_KINDS:
        return []

    issues: list[Issue] = []

    title = (meta.get("title") or "").strip()
    title_words = title.split()
    title_lower = title.lower()
    if len(title_words) > 5:
        issues.append(Issue(rel, "title", "title>5", title))
    elif (
        len(title_words) == 5
        and len(title) < 30
        and title_lower not in TITLE_PHRASE_EXEMPT
    ):
        issues.append(Issue(rel, "title", "title5<30", title))

    desc = meta.get("description") or ""
    if isinstance(desc, str) and desc.strip():
        if WIKILINK.search(desc):
            issues.append(Issue(rel, "description", "wikilink", desc[:80]))
        if len(desc.split()) > 20:
            issues.append(Issue(rel, "description", "words>20", str(len(desc.split()))))
        if DESC_FIRST_PERSON.search(desc):
            issues.append(Issue(rel, "description", "first-person", desc[:80]))

    kc = meta.get("key_concept") or ""
    if isinstance(kc, str) and kc.strip():
        first = first_key_concept_line(kc)
        if first and WIKILINK.search(first):
            issues.append(Issue(rel, "key_concept", "line1-wikilink", first[:80]))
        if is_workplace_lane(meta) and (
            BIBLE_SHORTCODE.search(kc) or bible_verse_ref_in_text(kc)
        ):
            issues.append(Issue(rel, "key_concept", "workplace-has-bible", path.stem))
        elif is_faith(meta) and not is_workplace_lane(meta) and not BIBLE.search(kc):
            issues.append(Issue(rel, "key_concept", "faith-no-verse", path.stem))

    examples = meta.get("examples") or []
    if len(examples) != 2:
        issues.append(Issue(rel, "examples", f"count={len(examples)}"))
    else:
        for i, ex in enumerate(examples):
            if isinstance(ex, str) and len(re.findall(r"[.!?]", ex)) > 1:
                issues.append(Issue(rel, f"examples[{i}]", "multi-sentence", ex[:80]))

    shareable = meta.get("shareable_thought") or []
    if len(shareable) != 4:
        issues.append(Issue(rel, "shareable_thought", f"count={len(shareable)}"))
    else:
        for i, item in enumerate(shareable):
            if isinstance(item, str) and len(item.strip().split()) < 4:
                issues.append(Issue(rel, f"shareable[{i}]", "fragment", item))

    for field in FRONTMATTER_FIELDS:
        val = meta.get(field)
        texts: list[str]
        if isinstance(val, list):
            texts = [t for t in val if isinstance(t, str)]
        elif isinstance(val, str):
            texts = [val]
        else:
            continue
        for text_chunk in texts:
            hit = CONTRACTION.search(text_chunk)
            if hit:
                issues.append(Issue(rel, field, "contraction", hit.group(0)))

    for row in meta.get("relationships") or []:
        if not isinstance(row, dict):
            continue
        reason = row.get("reason")
        if isinstance(reason, str) and CONTRACTION.search(reason):
            issues.append(Issue(rel, "relationships.reason", "contraction", CONTRACTION.search(reason).group(0)))
        if isinstance(reason, str):
            hit = bible_verse_ref_in_text(reason)
            if hit:
                issues.append(Issue(rel, "relationships.reason", "bible-verse", hit))

    return issues


def _self_check() -> None:
    assert first_key_concept_line("- [[Foo]] bar\n- next") == "[[Foo]] bar"
    assert first_key_concept_line("{{< bible >}}\n- plain claim") == "plain claim"
    assert CONTRACTION.search("what's underneath")
    assert CONTRACTION.search("there's no audience")
    assert CONTRACTION.search("it's the same")
    assert CONTRACTION.search("isn't a single")
    assert not CONTRACTION.search("Christ's finished work")
    assert not CONTRACTION.search("everyone else's urgency")
    assert DESC_FIRST_PERSON.search("not my week's score")
    assert DESC_FIRST_PERSON.search("God declared me righteous")
    assert not DESC_FIRST_PERSON.search("God declares the believer righteous")


def main() -> int:
    if "--self-check" in sys.argv:
        _self_check()
        print("garden-voice-lint self-check OK")
        return 0

    paths = sorted(NOTES.glob("*.md")) if NOTES.is_dir() else []
    issues: list[Issue] = []
    for path in paths:
        issues.extend(scan_note(path))

    if "--summary" in sys.argv:
        from collections import Counter

        by_rule = Counter(i.rule for i in issues)
        print(f"Garden voice - {len(paths)} files, {len(issues)} issues")
        for rule, count in by_rule.most_common():
            print(f"  {rule}: {count}")
        return 0

    if not issues:
        print("Garden voice lint OK")
        return 0

    print("Garden voice lint:", file=sys.stderr)
    for issue in issues:
        detail = f" ({issue.detail})" if issue.detail else ""
        print(f"  {issue.path}: {issue.field}: {issue.rule}{detail}", file=sys.stderr)
    return 1 if "--check" in sys.argv else 0


if __name__ == "__main__":
    sys.exit(main())
