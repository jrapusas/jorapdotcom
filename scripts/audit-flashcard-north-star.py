#!/usr/bin/env python3
"""Audit flashcards against the north-star litmus test (cue → move)."""

from __future__ import annotations

import re
import sys
from pathlib import Path
import sys
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
from site_paths import SITE_ROOT as ROOT

sys.path.insert(0, str(Path(__file__).resolve().parent))
from notes_content import split_frontmatter


NOTES_DIR = ROOT / "content/english/notes"
SKIP_STEMS = {"flashcards", "review", "_index"}

CARD_RE = re.compile(
    r'^\s+-\s+front:\s+("(?:[^"\\]|\\.)*")\s*\n\s+back:\s+("(?:[^"\\]|\\.)*")\s*$',
    re.M,
)
TRUNC_BACK = re.compile(
    r"\b(the|and|in|on|at|from|to|a|an|my|your|that|what|so|as|if|or|for|with|of|is|are|was|were|make|get|not)\.$",
    re.I,
)
NARRATIVE_FRONT = re.compile(
    r"^(I do the same with|Our |The |We |A teammate|A friend at|The head |The little |"
    r"The new hire|We drill |The contractor |The shop |The warehouse |Rain canceled|"
    r"The jeepney |The condo |The gym)",
    re.I,
)
GENERIC_DEF_BACK = re.compile(r"^review facts on a schedule before I forget$", re.I)
FRAGMENT_BACK = re.compile(r"^(same |forget|five reps|half-finished|room for|building a )", re.I)
TELEGRAPH_FRONT = re.compile(
    r"(what is |define |says what\?|one active rule|Matthew \d|verse \d)",
    re.I,
)


def parse_examples(block: str) -> list[str]:
    match = re.search(r"^examples:\s*\n((?:\s+-\s+.*\n)+)", block, re.M)
    if not match:
        return []
    return [
        re.sub(r"^\s+-\s+", "", line).strip().strip('"')
        for line in match.group(1).strip().split("\n")
    ]


def audit_card(stem: str, front: str, back: str, examples: list[str]) -> list[str]:
    issues: list[str] = []
    title = stem.replace("-", " ").title()

    for ex in examples:
        if ex.lower().startswith(front.lower()[: min(35, len(front))]):
            issues.append("example-split")
            break

    if TRUNC_BACK.search(back):
        issues.append("truncated-back")
    if NARRATIVE_FRONT.match(front):
        issues.append("narrative-front")
    if GENERIC_DEF_BACK.match(back):
        issues.append("generic-definition-back")
    if FRAGMENT_BACK.match(back.lower()):
        issues.append("fragment-back")
    if title in back:
        issues.append("note-title-on-back")
    if TELEGRAPH_FRONT.search(front):
        issues.append("telegraphy-front")

    return issues


def main() -> int:
    errors: list[str] = []
    for path in sorted(NOTES_DIR.glob("*.md")):
        if path.stem in SKIP_STEMS:
            continue
        block, _ = split_frontmatter(path.read_text(encoding="utf-8"))
        if not block or not re.search(r"^review:\s*true", block, re.M):
            continue
        if not re.search(r"^cards:\s*$", block, re.M):
            continue

        examples = parse_examples(block)
        for match in CARD_RE.finditer(block):
            front = match.group(1)[1:-1]
            back = match.group(2)[1:-1]
            for issue in audit_card(path.stem, front, back, examples):
                errors.append(
                    f"{path.relative_to(ROOT)} [{issue}] front={front[:55]}… back={back[:40]}…"
                )

    if errors:
        print("Flashcard north-star audit issues:", file=sys.stderr)
        for err in errors:
            print(f"  {err}", file=sys.stderr)
        print(f"\n{len(errors)} issue(s) in garden flashcards", file=sys.stderr)
        return 1

    print("Flashcard north-star audit OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
