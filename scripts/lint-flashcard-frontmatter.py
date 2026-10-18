#!/usr/bin/env python3
"""Validate flashcard frontmatter on garden notes (2/4/6/8 cards by tier)."""

from __future__ import annotations

import re
import sys
from pathlib import Path
import sys
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
from site_paths import SITE_ROOT as ROOT

try:
    import yaml
except ImportError:
    sys.exit("pip install pyyaml required for lint-flashcard-frontmatter")

sys.path.insert(0, str(Path(__file__).resolve().parent))
from notes_content import (
    append_flashcard_hint_question,
    bible_verse_ref_in_text,
    front_has_clear_question,
    is_multiple_choice_front,
    split_frontmatter,
    yaml_quote,
)


NOTES_DIR = ROOT / "content/english/notes"

SKIP_STEMS = {
    "_index",
    "flashcards",
    "review",
    "graph",
    "issues",
    "random-duo",
    "create",
    "okf-export",
}
SKIP_KINDS = {"meta", "index"}
SKIP_LAYOUTS = {"graph", "cards", "review", "issues", "backlinks", "random-duo", "create"}
ALLOWED_COUNTS = {2, 4, 6, 8}
PRIMARY_SET = "Eternal Principles"
SECONDARY_SETS = {
    "Community",
    "Discipleship",
    "Ethics",
    "Faith",
    "Fruit",
    "Influence",
    "Jesus Prayers",
    "Jesus Rhythms",
    "Leadership",
    "Legacy",
    "Love",
    "Obedience",
    "Prayer",
    "Priorities",
    "Sanctification",
    "Scripture",
    "Stewardship",
}

CARD_ITEM_RE = re.compile(
    r'^\s+-\s+front:\s+("(?:[^"\\]|\\.)*"|[^\n]+)\s*\n\s+back:\s+("(?:[^"\\]|\\.)*"|[^\n]+)\s*$',
    re.M,
)
QUOTED_RE = re.compile(r'^"(?:[^"\\]|\\.)*"$')


def parse_bool(block: str, key: str) -> bool:
    match = re.search(rf"^{key}:\s*(true|false)\s*$", block, re.M)
    return match.group(1) == "true" if match else False


def parse_cards(block: str) -> list[tuple[str, str, str]]:
    if not re.search(r"^cards:\s*$", block, re.M):
        return []
    cards: list[tuple[str, str, str]] = []
    for match in CARD_ITEM_RE.finditer(block):
        cards.append((match.group(1).strip(), match.group(2).strip(), match.group(0)))
    return cards


def parse_card_sets(block: str) -> list[str]:
    match = re.search(r"^card_sets:\s*\[(.*)\]\s*$", block, re.M)
    if not match:
        return []
    return [item.strip() for item in match.group(1).split(",") if item.strip()]


def is_quoted(value: str) -> bool:
    return bool(QUOTED_RE.match(value))


def is_garden_note(block: str, stem: str) -> bool:
    if stem in SKIP_STEMS:
        return False
    kind = re.search(r'^note_kind:\s*"?(\w+)"?', block, re.M)
    if kind and kind.group(1) in SKIP_KINDS:
        return False
    layout = re.search(r'^layout:\s*"?(\w+)"?', block, re.M)
    if layout and layout.group(1) in SKIP_LAYOUTS:
        return False
    return True


def review_allowed(meta: dict) -> bool:
    cats = {str(c).lower() for c in (meta.get("categories") or [])}
    tags = {str(t).lower() for t in (meta.get("tags") or [])}
    return bool(cats & {"faith", "eternal principles"} or "eternal principles" in tags)


def lint_file(path: Path) -> list[str]:
    errors: list[str] = []
    rel = path.relative_to(ROOT)
    block, _ = split_frontmatter(path.read_text(encoding="utf-8"))
    if not block or not is_garden_note(block, path.stem):
        return errors

    meta = yaml.safe_load(block) or {}
    sets = parse_card_sets(block)
    cards = parse_cards(block)
    review = parse_bool(block, "review")

    # Opt-in only - Faith / Eternal Principles spine. Disabled notes keep cards in YAML.
    if not review:
        return errors
    if not review_allowed(meta):
        errors.append(
            f"{rel}: review:true only allowed on Faith / Eternal Principles notes "
            f"(categories={meta.get('categories')!r})"
        )
    if not sets:
        errors.append(f"{rel}: requires card_sets (inline list, quoted names)")
    set_names = {item[1:-1] if is_quoted(item) else item for item in sets}
    secondaries = set_names & SECONDARY_SETS
    if len(sets) != 2 or PRIMARY_SET not in set_names or len(secondaries) != 1:
        errors.append(
            f"{rel}: card_sets must contain Eternal Principles and one secondary set "
            f"(has {sorted(set_names)})"
        )
    if len(cards) < 2:
        errors.append(f"{rel}: requires at least 2 cards (has {len(cards)})")
    if len(cards) not in ALLOWED_COUNTS:
        errors.append(f"{rel}: card count must be 2, 4, 6, or 8 (has {len(cards)})")

    for item in sets:
        if not is_quoted(item):
            errors.append(f"{rel}: card_sets entry must be double-quoted: {item}")

    if re.search(r"^card_sets:\s*$", block, re.M):
        errors.append(f"{rel}: card_sets must use inline [...] format like categories/tags")

    for front, back, _ in cards:
        if not is_quoted(front):
            errors.append(f"{rel}: card front must be double-quoted: {front[:60]}")
        if not is_quoted(back):
            errors.append(f"{rel}: card back must be double-quoted: {back[:60]}")
        front_text = front[1:-1] if is_quoted(front) else front
        back_text = back[1:-1] if is_quoted(back) else back
        if len(front_text) <= len(back_text):
            errors.append(
                f"{rel}: card front must be longer than back "
                f"(front={len(front_text)}, back={len(back_text)}): {front_text[:40]}…"
            )
        if is_multiple_choice_front(front_text):
            errors.append(
                f"{rel}: card front must be cue-only, not multiple choice "
                f"(drop option lists like 'A or B?'): {front_text[:60]}…"
            )
        if not front_has_clear_question(front_text):
            errors.append(
                f"{rel}: card front needs a clear retrieval question "
                f"(cue + hint like 'What's the move?'): {front_text[:60]}…"
            )
        for side, text in (("front", front_text), ("back", back_text)):
            hit = bible_verse_ref_in_text(text)
            if hit:
                errors.append(f"{rel}: card {side} must not cite bible verses (found {hit!r}): {text[:60]}…")

    if re.search(r"^cards:\s*\[", block, re.M):
        errors.append(f"{rel}: cards must use block list format, not inline [...]")

    if re.search(r'meta_title:.*\|\s*JoRap Notes', block):
        errors.append(f"{rel}: remove | JoRap Notes from meta_title (appended automatically)")

    return errors


def fix_questions(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    block, body = split_frontmatter(text)
    if not block or not is_garden_note(block, path.stem):
        return 0
    if not parse_bool(block, "review"):
        return 0

    updated = 0
    for front, back, raw in parse_cards(block):
        if not is_quoted(front) or not is_quoted(back):
            continue
        front_text = front[1:-1]
        back_text = back[1:-1]
        new_front = append_flashcard_hint_question(front_text, back_text)
        if new_front == front_text:
            continue
        new_raw = (
            f'  - front: {yaml_quote(new_front)}\n    back: {back}'
        )
        block = block.replace(raw, new_raw, 1)
        updated += 1

    if not updated:
        return 0
    path.write_text(f"---\n{block}\n---{body}", encoding="utf-8")
    return updated


def main() -> int:
    errors: list[str] = []
    for path in sorted(NOTES_DIR.glob("*.md")):
        errors.extend(lint_file(path))

    if errors:
        print("Flashcard frontmatter errors:", file=sys.stderr)
        for err in errors:
            print(f"  {err}", file=sys.stderr)
        return 1

    print("Flashcard frontmatter OK")
    return 0


if __name__ == "__main__":
    if "--fix-questions" in sys.argv:
        total = sum(fix_questions(path) for path in sorted(NOTES_DIR.glob("*.md")))
        print(f"Added hint questions to {total} card(s)")
        sys.exit(0)
    sys.exit(main())
