"""Repo layout: Hugo site lives under website/."""
from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SITE_ROOT = REPO_ROOT / "website"


def resolve_content_file(arg: str | Path) -> Path | None:
    """Resolve a Hugo content file from cwd, site-relative, or repo-relative paths.

    Accepts ``content/english/blog/foo.md`` (under ``website/``) and
    ``website/content/english/blog/foo.md`` (from repo root).
    """
    raw = Path(arg)
    if raw.is_absolute():
        try:
            resolved = raw.resolve()
        except OSError:
            return None
        return resolved if resolved.is_file() else None

    posix = raw.as_posix().lstrip("./")
    candidates: list[Path] = [
        Path.cwd() / raw,
        SITE_ROOT / raw,
        REPO_ROOT / raw,
    ]
    if posix.startswith("website/"):
        candidates.append(SITE_ROOT / posix.removeprefix("website/"))

    seen: set[Path] = set()
    for candidate in candidates:
        try:
            resolved = candidate.resolve()
        except OSError:
            continue
        if resolved in seen:
            continue
        seen.add(resolved)
        if resolved.is_file():
            return resolved
    return None


def _selfcheck_resolve_content_file() -> None:
    blog_dir = SITE_ROOT / "content/english/blog"
    if not blog_dir.is_dir():
        raise SystemExit("site_paths self-check: missing blog dir")
    samples = [p for p in blog_dir.glob("*.md") if not p.name.startswith("_")]
    if not samples:
        samples = list(blog_dir.glob("*.md"))
    if not samples:
        raise SystemExit("site_paths self-check: no blog markdown samples")
    name = samples[0].name
    for rel in (
        f"content/english/blog/{name}",
        f"website/content/english/blog/{name}",
    ):
        got = resolve_content_file(rel)
        if got is None or got.name != name:
            raise SystemExit(f"site_paths self-check failed: {rel}")


if __name__ == "__main__":
    _selfcheck_resolve_content_file()
    print("site_paths resolve_content_file OK")
