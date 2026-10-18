#!/usr/bin/env python3
"""Replace or lint em/en dashes in note files (jorap-voice: no em dashes)."""

from __future__ import annotations

import re
import sys
from pathlib import Path
import sys
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
from site_paths import SITE_ROOT as ROOT


CONTENT_ROOT = ROOT / "content/english"
DASH_RE = re.compile(r"[\u2013\u2014]")


def sanitize(text: str) -> str:
    return text.replace("\u2014", "-").replace("\u2013", "-")


def lint_file(path: Path) -> list[str]:
    rel = path.relative_to(ROOT)
    hits = [m.start() for m in DASH_RE.finditer(path.read_text(encoding="utf-8"))]
    if not hits:
        return []
    return [f"{rel}: em/en dash found ({len(hits)}); use hyphen, comma, or parentheses (jorap-voice)"]


def main() -> int:
    check_only = "--check" in sys.argv
    errors: list[str] = []
    updated = 0

    paths = sorted(CONTENT_ROOT.rglob("*.md")) if CONTENT_ROOT.is_dir() else []
    for path in paths:
        if check_only:
            errors.extend(lint_file(path))
            continue
        raw = path.read_text(encoding="utf-8")
        fixed = sanitize(raw)
        if fixed != raw:
            path.write_text(fixed, encoding="utf-8")
            updated += 1
            print(f"  sanitized {path.relative_to(ROOT)}")

    if check_only:
        if errors:
            print("Voice dash errors:", file=sys.stderr)
            for err in errors:
                print(f"  {err}", file=sys.stderr)
            return 1
        print("Voice dash lint OK")
        return 0

    print(f"\nDone: {updated} files updated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
