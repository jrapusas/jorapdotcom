"""Expand Hugo bible shortcodes to readable markdown for OKF export."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
import sys
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
from site_paths import SITE_ROOT as ROOT

from blog_shortcodes import parse_attrs


SCRIPTURE_PATH = ROOT / "data" / "scripture-nasb1995.json"
JESUS_WORDS_PATH = ROOT / "data" / "jesus-words.yaml"
GOSPELS = frozenset({"Matthew", "Mark", "Luke", "John"})
TRANSLATION = "nasb1995"
CITE_TAG = "NASB1995"

BIBLE_SC_RE = re.compile(r"\{\{[%<]\s*bible\b([^>%]*?)[>%]\}\}", re.I)


def _split_ref(ref: str) -> tuple[str, str]:
    parts = ref.strip().split()
    if len(parts) < 2:
        return "", ref.strip()
    return " ".join(parts[:-1]), parts[-1]


def _loc_keys(book: str, loc: str) -> list[str]:
    if not book or not loc:
        return []
    if "-" in loc:
        left, right = loc.split("-", 1)
        if ":" not in left:
            return []
        chapter, start = left.split(":", 1)
        end = right.split(":", 1)[-1] if ":" in right else right
        try:
            v_start, v_end = int(start), int(end)
        except ValueError:
            return []
        return [f"{book} {chapter}:{v}" for v in range(v_start, v_end + 1)]
    return [f"{book} {loc}"]


def _verse_keys(ref: str) -> list[str]:
    ref = ref.strip()
    if not ref:
        return []
    segments = [s.strip() for s in ref.split(",")] if "," in ref else [ref]
    book = ""
    chapter = ""
    keys: list[str] = []
    for seg in segments:
        parts = seg.split()
        if len(parts) < 2:
            continue
        loc = parts[-1]
        seg_book = " ".join(parts[:-1])
        if seg_book:
            book = seg_book
        if ":" not in loc and chapter:
            loc = f"{chapter}:{loc}"
        keys.extend(_loc_keys(book, loc))
        if ":" in loc:
            chapter = loc.split(":", 1)[0]
    return keys


def _emphasis_keys(book: str, chapter: str, emphasize: str) -> set[str]:
    keys: set[str] = set()
    for token in emphasize.split(","):
        token = token.strip()
        if not token:
            continue
        if " " in token:
            keys.add(token)
        elif ":" in token:
            keys.add(f"{book} {token}")
        elif chapter:
            keys.add(f"{book} {chapter}:{token}")
    return keys


@lru_cache(maxsize=1)
def _scripture_db() -> dict:
    return json.loads(SCRIPTURE_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _jesus_db() -> dict:
    try:
        import yaml  # type: ignore
    except ImportError:
        return {}
    if not JESUS_WORDS_PATH.is_file():
        return {}
    return yaml.safe_load(JESUS_WORDS_PATH.read_text(encoding="utf-8")) or {}


def _verse_text(key: str) -> str:
    jesus = _jesus_db().get("verses", {}).get(key, {})
    entry = jesus.get(TRANSLATION) if isinstance(jesus, dict) else None
    if not entry:
        scripture = _scripture_db().get("verses", {}).get(key, {})
        entry = scripture.get(TRANSLATION) if isinstance(scripture, dict) else None
    if not isinstance(entry, dict):
        return ""
    return str(entry.get("verse") or "").strip()


def _render_bible(attrs: dict[str, str]) -> str:
    ref = (attrs.get("ref") or attrs.get("type") or attrs.get("id") or "").strip().strip('"')
    if not ref:
        return ""
    label = (attrs.get("label") or ref).strip()
    show_cite = attrs.get("cite", "true").lower() != "false"
    keys = _verse_keys(ref)
    if not keys:
        return ""
    book, loc = _split_ref(ref.split(",", 1)[0].strip())
    chapter = loc.split(":", 1)[0] if ":" in loc else ""
    emph = _emphasis_keys(book, chapter, attrs.get("emphasize", ""))
    parts: list[str] = []
    for key in keys:
        text = _verse_text(key)
        if not text:
            continue
        if key in emph:
            text = f"**{text}**"
        parts.append(text)
    if not parts:
        return ""
    body = " ".join(parts)
    cite = f" *({label} {CITE_TAG})*" if show_cite else ""
    return f"> {body}{cite}"


def expand_bible_shortcodes(body: str) -> str:
    def repl(match: re.Match[str]) -> str:
        rendered = _render_bible(parse_attrs(match.group(1)))
        return rendered if rendered else match.group(0)

    return BIBLE_SC_RE.sub(repl, body)


def _self_check() -> None:
    sample = (
        'Lead\n\n{{< bible ref="John 3:16" emphasize="16" >}}\n\n'
        '- bullet\n\n{{< bible "Romans 12:1" >}}'
    )
    out = expand_bible_shortcodes(sample)
    assert out.startswith("Lead")
    assert "For God so loved the world" in out
    assert "**" in out and "For God so loved the world" in out
    assert "(John 3:16 NASB1995)" in out
    assert "present your bodies" in out.lower() or "bodies" in out.lower()
    assert "{{< bible" not in out
    samson = expand_bible_shortcodes('{{< bible ref="Judges 16:1, 16:15-31" >}}')
    assert "Samson" in samson
    assert "(Judges 16:1, 16:15-31 NASB1995)" in samson


if __name__ == "__main__":
    _self_check()
    print("bible_shortcode self-check OK")
