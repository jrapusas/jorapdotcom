#!/usr/bin/env python3
"""Export opt-in note cards to an Anki-importable tab-separated file."""

from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path
import sys
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
from site_paths import SITE_ROOT as ROOT

sys.path.insert(0, str(Path(__file__).resolve().parent))
from notes_content import parse_bool, parse_scalar, split_frontmatter_parts as split_frontmatter


NOTES_DIR = ROOT / "content/english/notes"
HUGO_TOML = ROOT / "hugo.toml"
DEFAULT_EXPORT = ROOT / "static/exports/jorap-notes-anki.txt"
SKIP = {
    "_index",
    "graph",
    "flashcards",
    "review",
    "random-duo",
    "create",
    "getting-started",
    "maps-of-content",
}
REVIEW_TAG = "flashcard"
LEAD_RE = re.compile(r"^\*\*([^*]+)\*\*\s*(?:=\s*|-\s*|-\s*)(.+)$")
SHORTCODE_RE = re.compile(
    r'\{\{[%<]\s*card\s+front="([^"]+)"\s+back="([^"]+)"\s*>\}\}'
)
BASEURL_RE = re.compile(r'^baseURL\s*=\s*"([^"]+)"', re.M)


def parse_yaml_list(block: str, key: str) -> list[str]:
    match = re.search(rf"^{key}:\s*\[(.*)\]\s*$", block, re.M)
    if not match:
        return []
    return [item.strip().strip('"') for item in match.group(1).split(",") if item.strip()]


def parse_yaml_list_values(block: str, key: str) -> list[str]:
    """Inline `[a, b]` or block `- item` YAML lists."""
    inline = parse_yaml_list(block, key)
    if inline:
        return inline
    match = re.search(rf"^{key}:\s*\n((?:\s+-\s+.+\n)+)", block, re.M)
    if not match:
        return []
    items: list[str] = []
    for line in match.group(1).splitlines():
        item_match = re.match(r'\s+-\s+"?([^"\n]+)"?\s*$', line)
        if item_match:
            items.append(item_match.group(1).strip())
    return items


def anki_tags(inner: str, note_tags: list[str]) -> str:
    card_sets = parse_yaml_list_values(inner, "card_sets")
    labels = card_sets if card_sets else note_tags
    tag_field = "jorap-notes"
    if labels:
        tag_field += " " + " ".join(labels)
    return tag_field


def read_base_url() -> str:
    if not HUGO_TOML.exists():
        return "https://www.jorap.com/"
    text = HUGO_TOML.read_text(encoding="utf-8")
    match = BASEURL_RE.search(text)
    if not match:
        return "https://www.jorap.com/"
    return match.group(1).rstrip("/") + "/"


def note_url(base_url: str, slug: str) -> str:
    return f"{base_url}notes/{slug}/"


def is_review_note(inner: str, review_tag: str) -> bool:
    if parse_bool(inner, "review"):
        return True
    tags = parse_yaml_list(inner, "tags")
    return review_tag in tags


def extract_lead_card(body: str) -> tuple[str, str] | None:
    first_line = body.strip().split("\n", 1)[0].strip() if body.strip() else ""
    match = LEAD_RE.match(first_line)
    if not match:
        return None
    return match.group(1).strip(), match.group(2).strip()


def extract_shortcode_cards(body: str) -> list[tuple[str, str]]:
    return [(m.group(1).strip(), m.group(2).strip()) for m in SHORTCODE_RE.finditer(body)]


def parse_cards_list(block: str) -> list[tuple[str, str]]:
    """Parse frontmatter cards: list of {front, back} dicts."""
    cards: list[tuple[str, str]] = []
    if not re.search(r"^cards:\s*$", block, re.M):
        return cards

    for match in re.finditer(
        r'^\s+-\s+front:\s+"((?:[^"\\]|\\.)*)"\s*\n\s+back:\s+"((?:[^"\\]|\\.)*)"\s*$',
        block,
        re.M,
    ):
        front = match.group(1).strip()
        back = match.group(2).strip()
        if front and back:
            cards.append((front, back))
    return cards


def format_back(back: str, source_url: str, title: str) -> str:
    safe_back = html.escape(back)
    safe_title = html.escape(title)
    return (
        f"{safe_back}<br><br>"
        f'<a href="{html.escape(source_url)}">Read note: {safe_title}</a>'
    )


def collect_cards(review_tag: str) -> list[dict[str, str]]:
    cards: list[dict[str, str]] = []

    for path in sorted(NOTES_DIR.glob("*.md")):
        if path.stem in SKIP:
            continue

        text = path.read_text(encoding="utf-8")
        _, inner, body = split_frontmatter(text)
        if not inner:
            continue

        if parse_bool(inner, "draft"):
            continue

        layout = parse_scalar(inner, "layout")
        if layout in {"graph", "cards", "review", "random-duo", "create"}:
            continue

        slug = parse_scalar(inner, "slug") or path.stem
        title = parse_scalar(inner, "title") or path.stem.replace("-", " ").title()
        tags = parse_yaml_list(inner, "tags")
        tag_field = anki_tags(inner, tags)

        base = read_base_url()
        source = note_url(base, slug)

        if is_review_note(inner, review_tag):
            frontmatter_cards = parse_cards_list(inner)
            if frontmatter_cards:
                for front, back in frontmatter_cards:
                    cards.append(
                        {
                            "front": front,
                            "back": format_back(back, source, title),
                            "tags": tag_field,
                        }
                    )
            else:
                card_front = parse_scalar(inner, "card_front")
                card_back = parse_scalar(inner, "card_back")
                lead = extract_lead_card(body)
                if card_front and card_back:
                    front, back = card_front, card_back
                elif lead:
                    front, back = lead
                    if card_back:
                        back = card_back
                    if card_front:
                        front = card_front
                else:
                    front, back = "", ""

                if front and back:
                    cards.append(
                        {
                            "front": front,
                            "back": format_back(back, source, title),
                            "tags": tag_field,
                        }
                    )

        for front, back in extract_shortcode_cards(body):
            cards.append(
                {
                    "front": front,
                    "back": format_back(back, source, title),
                    "tags": tag_field,
                }
            )

    return cards


def write_export(cards: list[dict[str, str]], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "#separator:tab",
        "#html:true",
        "#columns:Front\tBack\tTags",
        "Front\tBack\tTags",
    ]
    for card in cards:
        front = card["front"].replace("\t", " ").replace("\n", " ")
        back = card["back"].replace("\t", " ")
        tags = card["tags"].replace("\t", " ")
        lines.append(f"{front}\t{back}\t{tags}")
    output.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Export JoRap note cards for Anki import.")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=DEFAULT_EXPORT,
        help=f"Output path (default: {DEFAULT_EXPORT.relative_to(ROOT)})",
    )
    parser.add_argument(
        "--review-tag",
        default=REVIEW_TAG,
        help=f"Tag that opts a note into auto card export (default: {REVIEW_TAG})",
    )
    args = parser.parse_args()

    cards = collect_cards(args.review_tag)
    write_export(cards, args.output)
    print(f"Wrote {len(cards)} cards to {args.output}")


if __name__ == "__main__":
    main()
