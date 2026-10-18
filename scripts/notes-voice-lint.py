#!/usr/bin/env python3
"""Lint JoRap voice: AI-tells and plain-word swap candidates in site prose."""

from __future__ import annotations

import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
import sys
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
from site_paths import SITE_ROOT as ROOT

try:
    import yaml
except ImportError:
    sys.exit("pip install pyyaml required for notes-voice-lint")


CONTENT_ROOT = ROOT / "content/english"
VOICE_WORDS = ROOT / "data/voice-words.yaml"
FRONTMATTER = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)

NOTE_FIELDS = ("title", "meta_title", "description", "key_concept")
SKIP_NOTE_KINDS = {"meta", "index"}
GLOSS_FIELDS = frozenset(
    {
        "description",
        "key_concept",
        "examples",
        "cards",
        "relationships.reason",
        "body",
    }
)
GLOSS_OK = ("earned", "gift", "deserved", "didn't earn", "never earned")


@dataclass(frozen=True)
class Hit:
    path: str
    field: str
    kind: str  # word | phrase | review | gloss
    match: str
    hint: str = ""


@dataclass
class VoiceRules:
    words: dict[str, re.Pattern[str]]
    word_hints: dict[str, str]
    phrases: list[tuple[re.Pattern[str], str]]
    review: dict[str, re.Pattern[str]]
    review_hints: dict[str, str]
    gloss: dict[str, re.Pattern[str]]
    gloss_hints: dict[str, str]


def load_rules() -> VoiceRules:
    raw = yaml.safe_load(VOICE_WORDS.read_text(encoding="utf-8")) or {}
    words_raw = raw.get("words") or {}
    review_raw = raw.get("review") or {}
    gloss_raw = raw.get("gloss") or {}
    phrases_raw = raw.get("phrases") or []

    words = {w: re.compile(rf"\b{re.escape(w)}\b", re.I) for w in words_raw}
    review = {w: re.compile(rf"\b{re.escape(w)}\b", re.I) for w in review_raw}
    gloss = {w: re.compile(rf"\b{re.escape(w)}\b", re.I) for w in gloss_raw}
    phrases = [(re.compile(p, re.I), p) for p in phrases_raw]

    return VoiceRules(
        words=words,
        word_hints={str(k): str(v) for k, v in words_raw.items()},
        phrases=phrases,
        review=review,
        review_hints={str(k): str(v) for k, v in review_raw.items()},
        gloss=gloss,
        gloss_hints={str(k): str(v) for k, v in gloss_raw.items()},
    )


def content_paths() -> list[Path]:
    return sorted(CONTENT_ROOT.rglob("*.md")) if CONTENT_ROOT.is_dir() else []


def load_md(path: Path) -> tuple[dict, str]:
    text = path.read_text(encoding="utf-8")
    match = FRONTMATTER.match(text)
    if not match:
        return {}, text
    meta = yaml.safe_load(match.group(1)) or {}
    return meta, text[match.end() :]


def prose_chunks(meta: dict, body: str, *, notes: bool) -> list[tuple[str, str]]:
    chunks: list[tuple[str, str]] = []
    if notes:
        for key in NOTE_FIELDS:
            val = meta.get(key)
            if isinstance(val, str) and val.strip():
                chunks.append((key, val))
        for key in ("examples", "aliases"):
            val = meta.get(key)
            if isinstance(val, list):
                for i, item in enumerate(val):
                    if isinstance(item, str) and item.strip():
                        if key == "aliases" and item.startswith("/"):
                            continue  # ponytail: URL redirects keep old slugs; not prose
                        chunks.append((f"{key}[{i}]", item))
        for i, card in enumerate(meta.get("cards") or []):
            if not isinstance(card, dict):
                continue
            for side in ("front", "back"):
                val = card.get(side)
                if isinstance(val, str) and val.strip():
                    chunks.append((f"cards[{i}].{side}", val))
        for row in meta.get("relationships") or []:
            if isinstance(row, dict):
                reason = row.get("reason")
                if isinstance(reason, str) and reason.strip():
                    chunks.append(("relationships.reason", reason))
    else:
        for key in ("title", "meta_title", "description", "summary"):
            val = meta.get(key)
            if isinstance(val, str) and val.strip():
                chunks.append((key, val))
        if body.strip():
            chunks.append(("body", body))
    return chunks


def _glossed(text: str, start: int, end: int) -> bool:
    window = text[max(0, start - 50) : min(len(text), end + 80)].lower()
    return any(token in window for token in GLOSS_OK)


def scan_text(field: str, text: str, rules: VoiceRules, *, include_review: bool) -> list[Hit]:
    hits: list[Hit] = []
    for word, pattern in rules.words.items():
        for match in pattern.finditer(text):
            hint = rules.word_hints.get(word, "")
            hits.append(Hit("", field, "word", match.group(0), hint))

    for pattern, label in rules.phrases:
        if pattern.search(text):
            hits.append(Hit("", field, "phrase", label))

    if include_review:
        for word, pattern in rules.review.items():
            for match in pattern.finditer(text):
                hint = rules.review_hints.get(word, "")
                hits.append(Hit("", field, "review", match.group(0), hint))

    base = field.split("[", 1)[0]
    if base in GLOSS_FIELDS or field.startswith("examples[") or field.startswith("cards["):
        for word, pattern in rules.gloss.items():
            for match in pattern.finditer(text):
                if _glossed(text, match.start(), match.end()):
                    continue
                hint = rules.gloss_hints.get(word, "")
                hits.append(Hit("", field, "gloss", match.group(0), hint))

    return hits


def scan_file(path: Path, rules: VoiceRules, *, include_review: bool) -> list[Hit]:
    rel = str(path.relative_to(ROOT))
    meta, body = load_md(path)
    notes = path.parent.name == "notes"
    if notes:
        if meta.get("draft"):
            return []
        if meta.get("note_kind", "note") in SKIP_NOTE_KINDS:
            return []
    elif meta.get("draft"):
        return []

    hits: list[Hit] = []
    for field, text in prose_chunks(meta, body, notes=notes):
        for hit in scan_text(field, text, rules, include_review=include_review):
            hits.append(Hit(rel, hit.field, hit.kind, hit.match, hit.hint))
    return hits


def hit_message(hit: Hit) -> str:
    if hit.kind == "phrase":
        return f"{hit.field}: AI-slop phrase"
    if hit.kind == "gloss":
        gloss = hit.hint or "add plain gloss"
        return f"{hit.field}: `{hit.match}` - {gloss}"
    if hit.kind == "review":
        say = f" - try: {hit.hint}" if hit.hint else ""
        return f"{hit.field}: review `{hit.match}`{say}"
    say = f" - try: {hit.hint}" if hit.hint else ""
    return f"{hit.field}: AI-tell word `{hit.match}`{say}"


def is_strict(hit: Hit) -> bool:
    return hit.kind in {"word", "phrase", "gloss"}


def print_summary(hits: list[Hit], file_count: int) -> None:
    strict = [h for h in hits if is_strict(h)]
    review = [h for h in hits if h.kind == "review"]
    print(f"Voice scan - {file_count} files, {len(strict)} strict, {len(review)} review-only")
    print(f"Word list: {VOICE_WORDS.relative_to(ROOT)}")
    print()

    def _group(items: list[Hit]) -> dict[str, list[Hit]]:
        grouped: dict[str, list[Hit]] = defaultdict(list)
        for item in items:
            grouped[item.match.lower()].append(item)
        return dict(sorted(grouped.items(), key=lambda kv: (-len(kv[1]), kv[0])))

    if strict:
        print("Strict (lint:voice fails on these)")
        for key, group in _group(strict).items():
            hint = next((h.hint for h in group if h.hint), "")
            print(f"  {group[0].match} ({len(group)})" + (f" → {hint}" if hint else ""))
            for h in sorted(group, key=lambda x: (x.path, x.field)):
                print(f"    {h.path} · {h.field}")
        print()

    if review:
        print("Review-only (edit data/voice-words.yaml review: to tune)")
        for key, group in _group(review).items():
            hint = next((h.hint for h in group if h.hint), "")
            print(f"  {group[0].match} ({len(group)})" + (f" → {hint}" if hint else ""))
            for h in sorted(group, key=lambda x: (x.path, x.field)):
                print(f"    {h.path} · {h.field}")
        print()

    if not hits:
        print("No voice flags. Plain words only.")
    else:
        print("pnpm lint:voice - fail CI on strict hits")


def _self_check() -> None:
    rules = load_rules()
    assert rules.words["delve"].search("delve into the topic")
    assert any(p.search("Let's dive in") for p, _ in rules.phrases)
    assert not scan_text("t", "plain words only", rules, include_review=False)


def main() -> int:
    if "--self-check" in sys.argv:
        _self_check()
        print("notes-voice-lint self-check OK")
        return 0

    rules = load_rules()
    paths = content_paths()
    summary = "--summary" in sys.argv
    check_only = "--check" in sys.argv
    include_review = summary or "--review" in sys.argv

    hits: list[Hit] = []
    for path in paths:
        hits.extend(scan_file(path, rules, include_review=include_review))

    if summary:
        print_summary(hits, len(paths))
        return 0

    strict = [h for h in hits if is_strict(h)]
    if not strict:
        print("Voice lint OK")
        return 0

    label = "Voice lint warnings" if check_only else "Voice lint"
    print(f"{label}:", file=sys.stderr)
    for hit in strict:
        print(f"  {hit.path}: {hit_message(hit)}", file=sys.stderr)
    return 1 if check_only else 0


if __name__ == "__main__":
    sys.exit(main())
