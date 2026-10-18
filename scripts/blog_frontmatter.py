"""Canonical blog post frontmatter order and YAML dump (stdlib only)."""

from __future__ import annotations

import re
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from notes_content import yaml_quote, yaml_scalar

FB_INTRO_MAX = 200
X_INTRO_MAX = 280
COMMENT_CTA_TAIL_RE = re.compile(
    r"(?i)(?:in the (?:first )?comment|linked in comments|nine demos in the post)"
)

BLOG_FM_ORDER = (
    "title",
    "meta_title",
    "description",
    "social_media_intro",
    "social_media_intro_x",
    "slug",
    "date",
    "image",
    "image_prompt",
    "categories",
    "author",
    "tags",
    "related_notes",
    "level_depth",
    "aliases",
    "featured",
    "draft",
    "lastmod",
)

# Max Depth of Understanding rung the post reaches (Recognize→Create).
LEVEL_DEPTH_LABELS = {
    1: "Recognize",
    2: "Explain",
    3: "Use",
    4: "Connect",
    5: "Create",
}

BLOG_ALWAYS_QUOTE = frozenset(
    {
        "title",
        "meta_title",
        "description",
        "social_media_intro",
        "social_media_intro_x",
        "slug",
        "date",
        "image",
        "image_prompt",
        "author",
        "lastmod",
    }
)


def strip_fb_comment_cta(text: str) -> str:
    """Remove Facebook link-in-comments CTA; keep hook + payoff for X."""
    text = text.strip()
    if COMMENT_CTA_TAIL_RE.search(text):
        parts = text.rsplit(". ", 1)
        if len(parts) == 2:
            tail = parts[1]
            if COMMENT_CTA_TAIL_RE.search(tail) and not re.search(
                r"(?i)blog comments", tail
            ):
                text = parts[0]
    text = re.sub(
        r"(?i)[:\s-]+(?:article|checklist|recipe|write-up|post)(?:\s+in the comments)?\s*\.?\s*$",
        "",
        text,
    )
    text = text.rstrip(" .:;-\n")
    if text and text[-1] not in ".!?":
        text += "."
    return text


def derive_social_media_intro_x(smi: str, slug: str) -> str:
    """Facebook intro → X caption: same hook/payoff, URL inline, no comments CTA."""
    url = f" https://jorap.com/blog/{slug}/"
    body = strip_fb_comment_cta(smi)
    budget = X_INTRO_MAX - len(url)
    if len(body) > budget:
        body = body[: budget - 1].rsplit(" ", 1)[0].rstrip(".,;:-")
        if body and body[-1] not in ".!?":
            body += "."
    return body + url


def default_slug(path: Path) -> str:
    stem = path.stem
    return stem[2:] if stem.startswith("__") else stem


def normalize_date(value: Any) -> str:
    if isinstance(value, datetime):
        dt = value
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    if isinstance(value, date):
        return f"{value.isoformat()}T05:00:00Z"
    text = str(value).strip()
    if text.endswith("Z") or "+" in text:
        return text
    return f"{text}Z"


def blog_yaml_scalar(key: str, value: Any) -> str:
    if key in BLOG_ALWAYS_QUOTE and value is not None:
        return f"{key}: {yaml_quote(str(value))}"
    return yaml_scalar(key, value)


def dump_blog_frontmatter(fm: dict[str, Any]) -> str:
    lines: list[str] = []
    seen: set[str] = set()

    def emit(key: str, value: Any) -> None:
        if key in seen or value is None:
            return
        seen.add(key)
        if key in {"tags", "categories", "aliases"} and isinstance(value, list):
            if not value:
                return
            quoted = ", ".join(yaml_quote(str(item)) for item in value)
            lines.append(f"{key}: [{quoted}]")
            return
        if key == "related_notes" and isinstance(value, list):
            if not value:
                return
            lines.append("related_notes:")
            for item in value:
                lines.append(f"  - {item}")
            return
        if key == "date":
            lines.append(blog_yaml_scalar(key, normalize_date(value)))
            return
        if key == "lastmod":
            lines.append(blog_yaml_scalar(key, normalize_date(value)))
            return
        line = blog_yaml_scalar(key, value)
        if line:
            lines.append(line)

    for key in BLOG_FM_ORDER:
        if key in fm:
            emit(key, fm[key])
    for key in sorted(fm):
        if key not in seen:
            emit(key, fm[key])
    return "\n".join(lines)


def canonical_blog_fm(fm: dict[str, Any], path: Path) -> dict[str, Any]:
    out = dict(fm)
    if not out.get("slug"):
        out["slug"] = default_slug(path)
    if out.get("author") != "JoRap":
        out["author"] = "JoRap"
    if "date" in out:
        out["date"] = normalize_date(out["date"])
    if "lastmod" in out:
        out["lastmod"] = normalize_date(out["lastmod"])
    if isinstance(out.get("image"), str) and not out["image"].startswith("/"):
        out["image"] = f"/{out['image'].lstrip('/')}"
    if "level_depth" in out:
        out["level_depth"] = int(out["level_depth"])
    smi = out.get("social_media_intro")
    slug = out.get("slug") or default_slug(path)
    if smi and not out.get("social_media_intro_x"):
        out["social_media_intro_x"] = derive_social_media_intro_x(str(smi), str(slug))
    return out


def ordered_keys(fm: dict[str, Any]) -> list[str]:
    keys = list(fm.keys())
    expected = [k for k in BLOG_FM_ORDER if k in fm]
    if keys == expected:
        return keys
    return keys


def _self_check() -> None:
    sample = {
        "title": "Test",
        "meta_title": "Test",
        "description": "A post.",
        "social_media_intro": "Skipped the viral tote. Blue FRAKTA still wins - link in comments.",
        "social_media_intro_x": (
            "Skipped the viral tote. Blue FRAKTA still wins."
            " https://jorap.com/blog/test/"
        ),
        "slug": "test",
        "date": "2026-01-01T05:00:00Z",
        "image": "/images/x.jpg",
        "image_prompt": "Blue IKEA FRAKTA bag by a door, soft daylight, no text.",
        "categories": ["Tips"],
        "author": "JoRap",
        "tags": ["A"],
        "related_notes": ["capture"],
        "level_depth": 3,
        "featured": False,
        "draft": True,
    }
    text = dump_blog_frontmatter(sample)
    assert 'slug: "test"' in text
    assert 'social_media_intro:' in text
    assert 'social_media_intro_x:' in text
    derived = derive_social_media_intro_x(
        "May 8, 2020: ECQ birth story. Full birth story: article in the comments.",
        "miracle-isaiah-david",
    )
    assert "comment" not in derived.lower()
    assert "jorap.com/blog/miracle-isaiah-david/" in derived
    assert len(derived) <= X_INTRO_MAX
    assert 'image_prompt:' in text
    assert "related_notes:\n  - capture" in text
    assert "level_depth: 3" in text
    assert normalize_date("2026-05-03T23:00:00") == "2026-05-03T23:00:00Z"


if __name__ == "__main__":
    _self_check()
    print("blog_frontmatter self-check OK")
