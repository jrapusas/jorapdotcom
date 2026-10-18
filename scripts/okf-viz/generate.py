#!/usr/bin/env python3
"""Generate a self-contained OKF bundle graph viewer (viz.html).

Adapted from Google Cloud knowledge-catalog reference_agent viewer; supports
OKF absolute bundle-relative links (/concepts/foo.md) and hub index.md pages.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
SITE_ROOT = REPO_ROOT / "website"
ASSETS = Path(__file__).resolve().parent
_LINK_RE = re.compile(r"\]\(([^)\s]+\.md)(?:#[A-Za-z0-9_\-]*)?\)")
_SKIP_FILES = {"index.md", "log.md"}
_TYPE_PALETTE = {
    "Concept": "#3b82f6",
    "Index": "#8b5cf6",
    "BigQuery Dataset": "#8b5cf6",
    "BigQuery Table": "#3b82f6",
    "Reference": "#10b981",
}
_DEFAULT_NODE_COLOR = "#94a3b8"


@dataclass
class Concept:
    id: str
    type: str
    title: str
    description: str
    resource: str
    tags: list[str]
    body: str
    links_to: list[str] = field(default_factory=list)

    def to_node(self) -> dict[str, Any]:
        color = _TYPE_PALETTE.get(self.type, _DEFAULT_NODE_COLOR)
        return {
            "data": {
                "id": self.id,
                "label": self.title or self.id,
                "type": self.type,
                "description": self.description,
                "resource": self.resource,
                "tags": self.tags,
                "color": color,
                "size": 30 + min(60, len(self.body) // 200),
            }
        }


def split_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    inner = text[3:end].strip()
    body = text[end + 4 :].lstrip("\n")
    fm: dict[str, Any] = {}
    for line in inner.splitlines():
        if ":" not in line:
            continue
        key, raw = line.split(":", 1)
        key = key.strip()
        raw = raw.strip().strip('"')
        if key == "tags" and raw.startswith("["):
            fm[key] = [
                item.strip().strip('"')
                for item in raw.strip("[]").split(",")
                if item.strip()
            ]
        else:
            fm[key] = raw
    return fm, body


def parse_scalar(fm: dict[str, Any], key: str) -> str:
    value = fm.get(key, "")
    return str(value).strip() if value is not None else ""


def concept_id_for_path(md_path: Path, bundle_root: Path) -> str:
    rel = md_path.relative_to(bundle_root).with_suffix("")
    return "/".join(rel.parts)


def link_target_to_id(target: str, doc_dir: Path, bundle_root: Path) -> str | None:
    if "://" in target:
        return None
    bundle_root_resolved = bundle_root.resolve()
    try:
        if target.startswith("/"):
            resolved = (bundle_root / target.lstrip("/")).resolve()
        else:
            resolved = (doc_dir / target).resolve()
        rel = resolved.relative_to(bundle_root_resolved)
    except ValueError:
        return None
    rel_posix = rel.as_posix()
    if rel_posix.endswith(".md"):
        rel_posix = rel_posix[:-3]
    return rel_posix or None


def extract_links(body: str, doc_dir: Path, bundle_root: Path) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for match in _LINK_RE.finditer(body):
        concept_id = link_target_to_id(match.group(1), doc_dir, bundle_root)
        if concept_id and concept_id not in seen:
            seen.add(concept_id)
            out.append(concept_id)
    return out


def title_from_body(body: str, fallback: str) -> str:
    for line in body.splitlines():
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()
        if line.startswith("**") and line.endswith("**"):
            return line.strip("*").strip()
    return fallback


def description_from_body(body: str) -> str:
    for line in body.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("|"):
            continue
        return line.strip("*").strip()[:240]
    return ""


def walk_concepts(bundle_root: Path) -> list[Concept]:
    concepts: list[Concept] = []
    bundle_root = bundle_root.resolve()

    for md_path in sorted(bundle_root.rglob("*.md")):
        rel = md_path.relative_to(bundle_root).as_posix()
        if md_path.name in _SKIP_FILES and rel in {"index.md", "log.md"}:
            continue
        if md_path.name == "index.md" and rel == "index.md":
            continue

        concept_id = concept_id_for_path(md_path, bundle_root)
        text = md_path.read_text(encoding="utf-8")
        fm, body = split_frontmatter(text)

        if md_path.name == "index.md":
            concept_type = "Index"
            fallback_title = md_path.parent.name.replace("-", " ").title()
            title = title_from_body(body, fallback_title)
            description = description_from_body(body)
            resource = ""
            tags: list[str] = ["Hub"]
        else:
            concept_type = parse_scalar(fm, "type") or "Concept"
            title = parse_scalar(fm, "title") or title_from_body(body, concept_id.rsplit("/", 1)[-1])
            description = parse_scalar(fm, "description") or description_from_body(body)
            resource = parse_scalar(fm, "resource")
            raw_tags = fm.get("tags", [])
            tags = [str(t) for t in raw_tags] if isinstance(raw_tags, list) else []

        concepts.append(
            Concept(
                id=concept_id,
                type=concept_type,
                title=title,
                description=description,
                resource=resource,
                tags=tags,
                body=body,
                links_to=extract_links(body, md_path.parent, bundle_root),
            )
        )
    return concepts


def build_graph(concepts: list[Concept]) -> dict[str, Any]:
    ids = {c.id for c in concepts}
    nodes = [c.to_node() for c in concepts]
    edges: list[dict[str, Any]] = []
    seen_edges: set[tuple[str, str]] = set()
    for concept in concepts:
        for target in concept.links_to:
            if target == concept.id or target not in ids:
                continue
            key = (concept.id, target)
            if key in seen_edges:
                continue
            seen_edges.add(key)
            edges.append(
                {
                    "data": {
                        "id": f"{concept.id}__{target}",
                        "source": concept.id,
                        "target": target,
                    }
                }
            )
    return {
        "nodes": nodes,
        "edges": edges,
        "bodies": {c.id: c.body for c in concepts},
        "types": sorted({c.type for c in concepts}),
        "palette": _TYPE_PALETTE,
    }


def generate_visualization(
    bundle_root: Path,
    out_path: Path,
    *,
    bundle_name: str = "JoRap Notes",
) -> dict[str, int]:
    bundle_root = Path(bundle_root)
    out_path = Path(out_path)
    if not bundle_root.is_dir():
        raise FileNotFoundError(f"Bundle directory not found: {bundle_root}")

    concepts = walk_concepts(bundle_root)
    graph = build_graph(concepts)
    out_dir = out_path.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    template = (ASSETS / "viz.html").read_text(encoding="utf-8")
    html = (
        template.replace("__BUNDLE_NAME__", json.dumps(bundle_name))
        .replace("__BUNDLE_DATA__", json.dumps(graph))
    )
    out_path.write_text(html, encoding="utf-8")
    (out_dir / "graph.json").write_text(json.dumps(graph), encoding="utf-8")
    (out_dir / "viz.js").write_text((ASSETS / "viz.js").read_text(encoding="utf-8"), encoding="utf-8")
    (out_dir / "viz.css").write_text((ASSETS / "viz.css").read_text(encoding="utf-8"), encoding="utf-8")

    total_bytes = sum(
        p.stat().st_size
        for p in (out_path, out_dir / "graph.json", out_dir / "viz.js", out_dir / "viz.css")
    )
    return {
        "concepts": len(concepts),
        "edges": len(graph["edges"]),
        "bytes": total_bytes,
    }


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Render an OKF bundle as viz.html")
    parser.add_argument(
        "bundle",
        nargs="?",
        type=Path,
        default=SITE_ROOT / "static/exports/okf",
        help="OKF bundle root (default: static/exports/okf)",
    )
    parser.add_argument(
        "-o",
        "--out",
        type=Path,
        default=None,
        help="Output HTML (default: <bundle>/viz.html)",
    )
    parser.add_argument("--name", default="JoRap Notes", help="Header title")
    args = parser.parse_args()
    out = args.out or (args.bundle / "viz.html")
    stats = generate_visualization(args.bundle, out, bundle_name=args.name)
    print(
        f"Wrote {stats['concepts']} concept(s), {stats['edges']} edge(s), "
        f"{stats['bytes']} bytes -> {out}"
    )


if __name__ == "__main__":
    main()
