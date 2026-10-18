#!/usr/bin/env python3
"""Import Markdown notes from an Obsidian vault into content/english/notes/."""

from __future__ import annotations

import argparse
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
import sys
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
from site_paths import SITE_ROOT as ROOT

sys.path.insert(0, str(Path(__file__).resolve().parent))
from notes_content import split_frontmatter_parts as split_frontmatter


DEFAULT_DEST = ROOT / "content/english/notes"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("vault", type=Path, help="Path to Obsidian vault or notes folder")
    parser.add_argument(
        "--dest",
        type=Path,
        default=DEFAULT_DEST,
        help=f"Destination notes directory (default: {DEFAULT_DEST.relative_to(ROOT)})",
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing files")
    parser.add_argument("--force", action="store_true", help="Overwrite existing destination files")
    parser.add_argument(
        "--exclude",
        action="append",
        default=[".obsidian", "templates", "attachments"],
        help="Directory names to skip (repeatable)",
    )
    return parser.parse_args()


def slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "note"


def parse_yaml_list(block: str, key: str) -> list[str]:
    match = re.search(rf"^{key}:\s*\[(.*)\]\s*$", block, re.M)
    if not match:
        return []
    return [item.strip().strip('"') for item in match.group(1).split(",") if item.strip()]


def yaml_list(values: list[str]) -> str:
    if not values:
        return "tags: []"
    quoted = ", ".join(f'"{v}"' for v in values)
    return f"tags: [{quoted}]"


def parse_inline_tags(body: str) -> tuple[str, list[str]]:
    tags: set[str] = set()
    for match in re.finditer(r"(?<!\w)#([a-zA-Z][\w/-]*)", body):
        tags.add(match.group(1).replace("/", " "))
    cleaned = re.sub(r"(?<!\w)#[a-zA-Z][\w/-]*", "", body)
    return cleaned, sorted(tags)


def convert_obsidian_body(body: str) -> str:
    body = re.sub(r"%%.*?%%", "", body, flags=re.S)
    body = re.sub(r"^>\s?\[!(\w+)\][^\n]*\n(?:>[^\n]*\n)*", "", body, flags=re.M)
    body = re.sub(r"!\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]", r"See [[\1]].", body)
    body = re.sub(
        r"\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]",
        lambda m: f"[[{m.group(1)}|{m.group(3)}]]" if m.group(3) else f"[[{m.group(1)}]]",
        body,
    )
    return body.strip()


def merge_tags(existing: list[str], inline: list[str]) -> list[str]:
    merged = list(existing)
    seen = {t.lower() for t in merged}
    for tag in inline:
        if tag.lower() not in seen:
            merged.append(tag)
            seen.add(tag.lower())
    return merged


def build_output(src: Path, raw: str) -> str:
    _, inner, body = split_frontmatter(raw)
    converted = convert_obsidian_body(body if inner else raw)
    converted, inline_tags = parse_inline_tags(converted)

    title = src.stem.replace("-", " ").title()
    slug = slugify(src.stem)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    if inner:
        if "slug:" not in inner:
            inner = inner.rstrip() + f'\nslug: "{slug}"'
        if "draft:" not in inner:
            inner = inner.rstrip() + "\ndraft: true"
        tags = parse_yaml_list(inner, "tags")
        if inline_tags:
            inner = re.sub(r"^tags:\s*\[.*\]\s*$", yaml_list(merge_tags(tags, inline_tags)), inner, flags=re.M)
            if "tags:" not in inner:
                inner = inner.rstrip() + "\n" + yaml_list(inline_tags)
        return f"---\n{inner.strip()}\n---\n\n{converted}\n"

    tags_line = yaml_list(inline_tags)
    return f"""---
title: "{title}"
meta_title: ""
description: ""
slug: "{slug}"
date: {now}
image: "/images/note.jpg"
categories: []
author: "JoRap"
{tags_line}
aliases: []
featured: false
draft: true
---

{converted}
"""


def should_skip(path: Path, exclude: list[str]) -> bool:
    return any(part in exclude for part in path.parts)


def import_note(src: Path, dest_dir: Path, dry_run: bool, force: bool) -> str | None:
    dest_name = slugify(src.stem) + ".md"
    dest = dest_dir / dest_name

    if dest.exists() and not force:
        return f"skip (exists): {dest_name}"

    raw = src.read_text(encoding="utf-8")
    output = build_output(src, raw)

    if dry_run:
        return f"would write: {dest_name}"

    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(output, encoding="utf-8")
    return f"imported: {dest_name}"


def main() -> None:
    args = parse_args()
    vault = args.vault.expanduser().resolve()
    dest = args.dest.expanduser().resolve()

    if not vault.is_dir():
        raise SystemExit(f"Vault not found: {vault}")

    results: list[str] = []
    for src in sorted(vault.rglob("*.md")):
        if should_skip(src, args.exclude):
            continue
        if src.name.startswith("."):
            continue
        msg = import_note(src, dest, args.dry_run, args.force)
        if msg:
            results.append(msg)
            print(msg)

    print(f"\nDone: {len(results)} file(s) processed → {dest.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
