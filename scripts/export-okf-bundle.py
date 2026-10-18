#!/usr/bin/env python3
"""Export the published notes garden to an OKF v0.2 bundle."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from bible_shortcode import expand_bible_shortcodes
from notes_content import (
    assemble_markdown,
    parse_bool,
    parse_display_fields,
    parse_scalar,
    relationship_frontmatter_errors,
    split_frontmatter_parts as split_frontmatter,
)
from okf_bundle import (
    OKF_VERSION,
    ROOT,
    clear_bundle_dir,
    read_base_url,
    validate_bundle,
    write_update_log,
    yaml_frontmatter,
)

NOTES_DIR = ROOT / "content/english/notes"
DEFAULT_OUT = ROOT / "static/exports/okf"
GENERATED_BY = "process:export-okf-bundle"
SKIP_STEMS = {"_index"}
UTILITY_LAYOUTS = frozenset(
    {"graph", "cards", "review", "issues", "random-duo", "create", "backlinks"}
)
WIKILINK_RE = re.compile(r"\[\[([^\]|#]+)(?:#([^\]|]+))?\]\]")


@dataclass(frozen=True)
class NoteRecord:
    path: Path
    slug: str
    title: str
    description: str
    tags: list[str]
    note_kind: str
    draft: bool
    utility: bool
    timestamp: str
    resource: str


def parse_yaml_list(block: str, key: str) -> list[str]:
    match = re.search(rf"^{key}:\s*\[(.*)\]\s*$", block, re.M)
    if not match:
        return []
    return [item.strip().strip('"') for item in match.group(1).split(",") if item.strip()]


def slugify(value: str) -> str:
    value = value.casefold().strip()
    value = re.sub(r"[^a-z0-9\s-]", "", value)
    value = re.sub(r"\s+", "-", value)
    return re.sub(r"-+", "-", value).strip("-")


def is_utility(block: str) -> bool:
    if parse_scalar(block, "note_kind") == "meta":
        return True
    return parse_scalar(block, "layout") in UTILITY_LAYOUTS


def note_timestamp(inner: str, path: Path) -> str:
    raw = parse_scalar(inner, "date")
    if raw:
        try:
            if raw.endswith("Z"):
                dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            else:
                dt = datetime.fromisoformat(raw)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            pass
    mtime = path.stat().st_mtime
    return datetime.fromtimestamp(mtime, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def body_without_see_also(body: str) -> str:
    if "## See also" not in body:
        return body
    return body.split("## See also", 1)[0].rstrip() + "\n"


def load_notes(base_url: str) -> tuple[list[NoteRecord], dict[str, NoteRecord]]:
    records: list[NoteRecord] = []
    by_key: dict[str, NoteRecord] = {}

    for path in sorted(NOTES_DIR.glob("*.md")):
        if path.stem in SKIP_STEMS:
            continue

        text = path.read_text(encoding="utf-8")
        _, inner, _ = split_frontmatter(text)
        if not inner:
            continue

        slug = parse_scalar(inner, "slug") or path.stem
        title = parse_scalar(inner, "title") or slug.replace("-", " ").title()
        record = NoteRecord(
            path=path,
            slug=slug,
            title=title,
            description=parse_scalar(inner, "description"),
            tags=parse_yaml_list(inner, "tags"),
            note_kind=parse_scalar(inner, "note_kind") or "note",
            draft=parse_bool(inner, "draft"),
            utility=is_utility(inner),
            timestamp=note_timestamp(inner, path),
            resource=f"{base_url}notes/{slug}/",
        )
        records.append(record)

        keys = {title, slug, path.stem}
        keys.update(parse_yaml_list(inner, "aliases"))
        for key in keys:
            if key:
                by_key[key.casefold()] = record

    return records, by_key


def okf_link_path(record: NoteRecord) -> str:
    if record.note_kind == "index":
        return f"/hubs/{record.slug}/index.md"
    return f"/concepts/{record.slug}.md"


def resolve_target(target: str, by_key: dict[str, NoteRecord]) -> NoteRecord | None:
    return by_key.get(target.strip().casefold())


def protect_code_regions(body: str) -> tuple[str, list[tuple[str, str]]]:
    replacements: list[tuple[str, str]] = []
    counter = 0

    def shield(match: re.Match[str]) -> str:
        nonlocal counter
        token = f"@@OKF{counter}@@"
        replacements.append((token, match.group(0)))
        counter += 1
        return token

    protected = body
    for pattern in (r"```[\s\S]*?```", r"`[^`\n]+`"):
        protected = re.sub(pattern, shield, protected)
    return protected, replacements


def restore_code_regions(body: str, replacements: list[tuple[str, str]]) -> str:
    for token, original in reversed(replacements):
        body = body.replace(token, original)
    return body


def rewrite_wikilinks(body: str, by_key: dict[str, NoteRecord], base_url: str) -> str:
    protected, replacements = protect_code_regions(body)

    def repl(match: re.Match[str]) -> str:
        target = match.group(1).strip()
        anchor = (match.group(2) or "").strip()
        suffix = f"#{anchor}" if anchor else ""
        hit = resolve_target(target, by_key)
        if hit and hit.utility:
            return f"[{hit.title}]({hit.resource})"
        if hit:
            return f"[{hit.title}]({okf_link_path(hit)}{suffix})"
        if " " in target or (target[:1].isupper() if target else False):
            return f"[{target}](/concepts/{slugify(target)}.md{suffix})"
        return match.group(0)

    rewritten = WIKILINK_RE.sub(repl, protected)
    return restore_code_regions(rewritten, replacements)


def write_concept(record: NoteRecord, body: str, out_dir: Path) -> None:
    dest = out_dir / "concepts" / f"{record.slug}.md"
    dest.parent.mkdir(parents=True, exist_ok=True)
    fm = yaml_frontmatter(
        {
            "type": "Concept",
            "title": record.title,
            "description": record.description,
            "resource": record.resource,
            "tags": record.tags,
            "generated": {"by": GENERATED_BY, "at": record.timestamp},
        }
    )
    dest.write_text(fm + body, encoding="utf-8")


def write_hub_index(record: NoteRecord, body: str, out_dir: Path) -> None:
    dest = out_dir / "hubs" / record.slug / "index.md"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(body, encoding="utf-8")


def write_root_index(records: list[NoteRecord], out_dir: Path) -> None:
    concepts = sorted(
        (r for r in records if not r.draft and not r.utility and r.note_kind != "index"),
        key=lambda r: r.title.casefold(),
    )
    hubs = sorted(
        (r for r in records if not r.draft and not r.utility and r.note_kind == "index"),
        key=lambda r: r.title.casefold(),
    )

    lines = [
        "---",
        f'okf_version: "{OKF_VERSION}"',
        "---",
        "",
        "# JoRap Notes",
        "",
        "OKF export of the JoRap notes garden - atomic concepts and hub indexes.",
        "",
        "# Concepts",
        "",
    ]
    for record in concepts:
        desc = record.description or record.title
        lines.append(f"* [{record.title}](/concepts/{record.slug}.md) - {desc}")

    lines.extend(["", "# Hubs", ""])
    for record in hubs:
        desc = record.description or record.title
        lines.append(f"* [{record.title}](/hubs/{record.slug}/index.md) - {desc}")

    (out_dir / "index.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def export_bundle(out_dir: Path) -> tuple[int, int, dict[str, int]]:
    base_url = read_base_url()
    records, by_key = load_notes(base_url)

    clear_bundle_dir(out_dir)

    concept_count = 0
    hub_count = 0

    for record in records:
        if record.draft or record.utility:
            continue

        text = record.path.read_text(encoding="utf-8")
        _, inner, body = split_frontmatter(text)
        fm = parse_display_fields(inner)
        rel_errors = relationship_frontmatter_errors(fm)
        if rel_errors:
            for err in rel_errors:
                print(f"FAIL {err}: {record.path.name}", file=sys.stderr)
            raise RuntimeError(f"invalid relationships in {record.path.name}")
        body = body_without_see_also(assemble_markdown(fm, body))
        body = expand_bible_shortcodes(body)
        body = rewrite_wikilinks(body, by_key, base_url)

        if record.note_kind == "index":
            write_hub_index(record, body, out_dir)
            hub_count += 1
        else:
            write_concept(record, body, out_dir)
            concept_count += 1

    write_root_index(records, out_dir)
    write_update_log(
        out_dir,
        git_subpath="website/content/english/notes/",
        export_message="Generated OKF v0.2 bundle from the Hugo notes garden.",
    )

    viz_stats = generate_okf_viz(out_dir)
    return concept_count, hub_count, viz_stats


def generate_okf_viz(out_dir: Path) -> dict[str, int]:
    script = Path(__file__).resolve().parent / "okf-viz/generate.py"
    out_path = out_dir / "viz.html"
    proc = subprocess.run(
        [sys.executable, str(script), str(out_dir), "-o", str(out_path)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    if proc.returncode != 0:
        print(proc.stderr or proc.stdout, file=sys.stderr)
        raise RuntimeError("OKF viz generation failed")
    match = re.search(
        r"Wrote (\d+) concept\(s\), (\d+) edge\(s\), (\d+) bytes",
        proc.stdout,
    )
    if match:
        return {
            "concepts": int(match.group(1)),
            "edges": int(match.group(2)),
            "bytes": int(match.group(3)),
        }
    return {"concepts": 0, "edges": 0, "bytes": 0}


def main() -> None:
    parser = argparse.ArgumentParser(description="Export JoRap notes garden as an OKF v0.2 bundle.")
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
                print(f"OKF validation error: {err}", file=sys.stderr)
            sys.exit(1)
        print(f"OKF bundle valid: {args.output}")
        return

    concepts, hubs, viz_stats = export_bundle(args.output)
    errors = validate_bundle(args.output)
    if errors:
        for err in errors:
            print(f"OKF validation error: {err}", file=sys.stderr)
        sys.exit(1)

    print(
        f"Wrote OKF bundle to {args.output} ({concepts} concepts, {hubs} hubs, "
        f"{viz_stats['edges']} graph edges → viz.html)"
    )


if __name__ == "__main__":
    main()
