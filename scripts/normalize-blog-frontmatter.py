#!/usr/bin/env python3
"""Normalize blog post frontmatter field order and formatting."""

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

from blog_frontmatter import (
    BLOG_FM_ORDER,
    LEVEL_DEPTH_LABELS,
    canonical_blog_fm,
    dump_blog_frontmatter,
    ordered_keys,
)


BLOG_DIR = ROOT / "content" / "english" / "blog"


def split_frontmatter(text: str) -> tuple[dict, str]:
    match = re.match(r"^---\n(.*?)\n---\n?", text, re.DOTALL)
    if not match:
        raise ValueError("missing frontmatter")
    fm = yaml.safe_load(match.group(1)) or {}
    body = text[match.end() :]
    return fm, body


def normalize_file(path: Path, write: bool) -> bool:
    text = path.read_text(encoding="utf-8")
    fm, body = split_frontmatter(text)
    canon = canonical_blog_fm(fm, path)
    dumped = dump_blog_frontmatter(canon)
    new_text = f"---\n{dumped}\n---\n\n{body.lstrip(chr(10))}"
    changed = new_text != text
    if write and changed:
        path.write_text(new_text, encoding="utf-8")
    return changed


def verify_file(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    fm, _ = split_frontmatter(text)
    errors: list[str] = []
    keys = list(fm.keys())
    expected = [k for k in BLOG_FM_ORDER if k in fm]
    if keys != expected:
        errors.append(f"key order {keys} != {expected}")
    if not fm.get("slug"):
        errors.append("missing slug")
    if fm.get("author") != "JoRap":
        errors.append(f"author must be JoRap, got {fm.get('author')!r}")
    if "level_depth" not in fm:
        errors.append("missing level_depth")
    else:
        depth = fm["level_depth"]
        if not isinstance(depth, int) or depth not in LEVEL_DEPTH_LABELS:
            errors.append(f"level_depth must be integer 1-5, got {depth!r}")
    for field in ("date", "lastmod"):
        if field in fm and "Z" not in str(fm[field]) and "+" not in str(fm[field]):
            errors.append(f"{field} missing timezone")
    return errors


def main() -> int:
    write = "--write" in sys.argv
    verify = "--verify" in sys.argv
    paths = sorted(p for p in BLOG_DIR.glob("*.md") if p.name != "_index.md")

    if verify:
        bad = [(p, verify_file(p)) for p in paths]
        bad = [(p, errs) for p, errs in bad if errs]
        if bad:
            print("Blog frontmatter errors:", file=sys.stderr)
            for path, errs in bad:
                for err in errs:
                    print(f"  {path.relative_to(ROOT)}: {err}", file=sys.stderr)
            return 1
        print("Blog frontmatter OK")
        return 0

    changed = sum(normalize_file(p, write=write) for p in paths)
    if write:
        print(f"Normalized {changed} blog post(s)")
    else:
        print(f"{changed} blog post(s) would change (pass --write)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
