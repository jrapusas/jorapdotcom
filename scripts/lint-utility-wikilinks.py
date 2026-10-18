#!/usr/bin/env python3
"""Error when evergreen note bodies wikilink to garden utility/meta surfaces."""

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

from notes_content import assemble_markdown, parse_scalar, split_frontmatter


NOTES_DIR = ROOT / "content/english/notes"

UTILITY_LAYOUTS = frozenset({"graph", "cards", "review", "issues", "random-duo", "create"})

WIKILINK_RE = re.compile(
    r"\[\[([^\]|#]+)(?:#[^\]|]+)?\]\]"
)


def parse_aliases(block: str) -> list[str]:
    match = re.search(r"^aliases:\s*\[(.*)\]\s*$", block, re.M)
    if not match:
        return []
    return [item.strip().strip('"') for item in match.group(1).split(",") if item.strip()]


def is_utility(block: str) -> bool:
    if parse_scalar(block, "note_kind") == "meta":
        return True
    return parse_scalar(block, "layout") in UTILITY_LAYOUTS


def utility_targets() -> dict[str, Path]:
    """Map wikilink target strings (lower) to utility note path."""
    targets: dict[str, Path] = {}
    for path in sorted(NOTES_DIR.glob("*.md")):
        block, _ = split_frontmatter(path.read_text(encoding="utf-8"))
        if not block or not is_utility(block):
            continue
        keys = {parse_scalar(block, "title"), parse_scalar(block, "slug"), path.stem}
        keys.update(parse_aliases(block))
        for key in keys:
            if key:
                targets[key.casefold()] = path
    return targets


def lint_file(path: Path, targets: dict[str, Path]) -> list[str]:
    text = path.read_text(encoding="utf-8")
    raw_fm, body = split_frontmatter(text)
    if is_utility(raw_fm):
        return []

    fm = yaml.safe_load(raw_fm) or {}
    if not isinstance(fm, dict):
        fm = {}
    content = assemble_markdown(fm, body)

    rel = path.relative_to(ROOT)
    errors: list[str] = []

    for match in WIKILINK_RE.finditer(content):
        target = (match.group(1) or "").strip()
        hit = targets.get(target.casefold())
        if hit:
            errors.append(
                f"{rel}: wikilink to utility page [[{target}]] "
                f"(use URL e.g. /notes/{hit.stem}/ - utility pages are not garden notes)"
            )
    return errors


def main() -> int:
    targets = utility_targets()
    errors: list[str] = []
    for path in sorted(NOTES_DIR.glob("*.md")):
        errors.extend(lint_file(path, targets))

    if errors:
        print("Utility wikilink errors:", file=sys.stderr)
        for err in errors:
            print(f"  {err}", file=sys.stderr)
        return 1

    print("Utility wikilinks OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
