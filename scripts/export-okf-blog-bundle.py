#!/usr/bin/env python3
"""Export published blog posts to a separate OKF v0.2 bundle (not in the notes graph)."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from blog_frontmatter import default_slug, normalize_date
from blog_shortcodes import shortcodes_to_html
from notes_content import parse_bool, parse_scalar, split_frontmatter_parts as split_frontmatter
from okf_bundle import (
    OKF_VERSION,
    ROOT,
    clear_bundle_dir,
    read_base_url,
    validate_bundle,
    write_update_log,
    yaml_frontmatter,
)

BLOG_DIR = ROOT / "content/english/blog"
NOTES_DIR = ROOT / "content/english/notes"
DEFAULT_OUT = ROOT / "static/exports/okf-blog"
SKIP_STEMS = {"_index"}
GENERATED_BY = "process:export-okf-blog-bundle"


@dataclass(frozen=True)
class PostRecord:
    path: Path
    slug: str
    title: str
    description: str
    tags: list[str]
    categories: list[str]
    draft: bool
    timestamp: str
    resource: str
    related_notes: list[str]


def parse_inline_list(block: str, key: str) -> list[str]:
    match = re.search(rf"^{key}:\s*\[(.*)\]\s*$", block, re.M)
    if not match:
        return []
    return [item.strip().strip('"') for item in match.group(1).split(",") if item.strip()]


def parse_dash_list(block: str, key: str) -> list[str]:
    match = re.search(rf"^{key}:\s*\n((?:  - .+\n?)+)", block, re.M)
    if not match:
        return []
    items: list[str] = []
    for line in match.group(1).splitlines():
        line = line.strip()
        if line.startswith("- "):
            items.append(line[2:].strip().strip('"'))
    return items


def parse_list_field(block: str, key: str) -> list[str]:
    inline = parse_inline_list(block, key)
    if inline:
        return inline
    return parse_dash_list(block, key)


def post_timestamp(inner: str, path: Path) -> str:
    for field in ("lastmod", "date"):
        raw = parse_scalar(inner, field)
        if raw:
            try:
                return normalize_date(raw)
            except (ValueError, TypeError):
                pass
    mtime = path.stat().st_mtime
    return datetime.fromtimestamp(mtime, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_note_titles() -> dict[str, str]:
    titles: dict[str, str] = {}
    for path in NOTES_DIR.glob("*.md"):
        if path.stem in SKIP_STEMS:
            continue
        text = path.read_text(encoding="utf-8")
        _, inner, _ = split_frontmatter(text)
        if not inner:
            continue
        slug = parse_scalar(inner, "slug") or path.stem
        title = parse_scalar(inner, "title") or slug.replace("-", " ").title()
        titles[slug] = title
        titles[path.stem] = title
    return titles


def load_posts(base_url: str) -> list[PostRecord]:
    records: list[PostRecord] = []
    for path in sorted(BLOG_DIR.glob("*.md")):
        if path.stem in SKIP_STEMS:
            continue
        text = path.read_text(encoding="utf-8")
        _, inner, _ = split_frontmatter(text)
        if not inner:
            continue
        slug = parse_scalar(inner, "slug") or default_slug(path)
        title = parse_scalar(inner, "title") or slug.replace("-", " ").title()
        records.append(
            PostRecord(
                path=path,
                slug=slug,
                title=title,
                description=parse_scalar(inner, "description") or "",
                tags=parse_list_field(inner, "tags"),
                categories=parse_list_field(inner, "categories"),
                draft=parse_bool(inner, "draft"),
                timestamp=post_timestamp(inner, path),
                resource=f"{base_url}blog/{slug}/",
                related_notes=parse_list_field(inner, "related_notes"),
            )
        )
    return records


def rewrite_blog_links(body: str) -> str:
    return re.sub(r"\]\(/blog/([^)/]+)/?\)", r"](/articles/\1.md)", body)


def related_notes_section(slugs: list[str], note_titles: dict[str, str], base_url: str) -> str:
    if not slugs:
        return ""
    lines = ["## Related garden notes", ""]
    for slug in slugs:
        title = note_titles.get(slug, slug.replace("-", " ").title())
        lines.append(f"* [{title}]({base_url}notes/{slug}/)")
    lines.append("")
    return "\n\n" + "\n".join(lines)


def write_article(record: PostRecord, body: str, out_dir: Path) -> None:
    dest = out_dir / "articles" / f"{record.slug}.md"
    dest.parent.mkdir(parents=True, exist_ok=True)
    fm = yaml_frontmatter(
        {
            "type": "Blog Post",
            "title": record.title,
            "description": record.description,
            "resource": record.resource,
            "tags": record.tags,
            "generated": {"by": GENERATED_BY, "at": record.timestamp},
        }
    )
    dest.write_text(fm + body, encoding="utf-8")


def write_root_index(records: list[PostRecord], out_dir: Path) -> None:
    articles = sorted((r for r in records if not r.draft), key=lambda r: r.title.casefold())
    lines = [
        "---",
        f'okf_version: "{OKF_VERSION}"',
        "---",
        "",
        "# JoRap Blog",
        "",
        "OKF export of published blog posts. Separate from the notes garden bundle at `/exports/okf/`.",
        "",
        "# Articles",
        "",
    ]
    for record in articles:
        desc = record.description or record.title
        lines.append(f"* [{record.title}](/articles/{record.slug}.md) - {desc}")
    (out_dir / "index.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def export_bundle(out_dir: Path) -> int:
    base_url = read_base_url()
    records = load_posts(base_url)
    note_titles = load_note_titles()
    clear_bundle_dir(out_dir)

    count = 0
    for record in records:
        if record.draft:
            continue
        _, _, body = split_frontmatter(record.path.read_text(encoding="utf-8"))
        body = shortcodes_to_html(body, base_url)
        body = rewrite_blog_links(body)
        body = body.rstrip() + related_notes_section(record.related_notes, note_titles, base_url)
        write_article(record, body, out_dir)
        count += 1

    write_root_index(records, out_dir)
    write_update_log(
        out_dir,
        git_subpath="website/content/english/blog/",
        export_message="Generated OKF v0.2 blog bundle from Hugo blog posts.",
    )
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description="Export JoRap blog posts as an OKF v0.2 bundle.")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=DEFAULT_OUT,
        help=f"Output directory (default: {DEFAULT_OUT.relative_to(ROOT)})",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Validate an existing bundle without exporting.",
    )
    args = parser.parse_args()

    if args.validate_only:
        errors = validate_bundle(args.output)
        if errors:
            for err in errors:
                print(f"OKF blog validation error: {err}", file=sys.stderr)
            sys.exit(1)
        print(f"OKF blog bundle valid: {args.output}")
        return

    count = export_bundle(args.output)
    errors = validate_bundle(args.output)
    if errors:
        for err in errors:
            print(f"OKF blog validation error: {err}", file=sys.stderr)
        sys.exit(1)

    print(f"Wrote OKF blog bundle to {args.output} ({count} articles)")


if __name__ == "__main__":
    main()
