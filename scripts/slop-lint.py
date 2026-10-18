#!/usr/bin/env python3
"""Lint structural AI-slop in blog posts and notes garden frontmatter."""

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
    sys.exit("pip install pyyaml required for slop-lint")

import importlib.util

from notes_content import note_prose_chunks


CONTENT = ROOT / "content/english"
BLOG = CONTENT / "blog"
NOTES = CONTENT / "notes"
RULES_PATH = ROOT / "data/slop-rules.yaml"
FRONTMATTER = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)
HTTP_LINK = re.compile(r"https?://")
FIRST_PERSON = re.compile(r"\b(I|my|I've|I'm|we|our)\b", re.I)
SKIP_NOTE_KINDS = frozenset({"meta", "index"})
SKIP_NOTE_FILES = frozenset({"_index.md"})
SKIP_BLOG_FILES = frozenset({"_index.md", "__blog-template.md"})
NOTE_FIELDS = (
    "description",
    "key_concept",
    "examples",
    "shareable_thought",
    "relationships.reason",
    "cards.front",
    "cards.back",
    "body",
)
DICTIONARY_OPENER = re.compile(
    r"^(?:This|It) is (?:a|an|the) (?:way|method|framework|process|approach|practice|system|tool)\b",
    re.I,
)

_MECHANICAL_KINDS = frozenset(
    {
        "mechanical_nominalization",
        "mechanical_passive",
        "mechanical_phrasal",
        "mechanical_long_sentences",
    }
)


def _load_slop_score():
    path = _SCRIPTS / "slop-score.py"
    spec = importlib.util.spec_from_file_location("slop_score", path)
    if spec is None or spec.loader is None:
        raise ImportError(path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def apply_mechanical_hits(
    hits: list[Hit],
    *,
    rel: str,
    field: str,
    text: str,
    rules: list[dict],
    severity: str,
) -> None:
    if not text.strip():
        return
    slop_score = _load_slop_score()
    result = slop_score.analyze_text(text)
    flags = {rid: detail for rid, detail in slop_score.mechanical_flags(result)}
    for rule in rules:
        kind = rule.get("kind")
        if kind not in _MECHANICAL_KINDS:
            continue
        rid = rule["id"]
        if rid not in flags:
            continue
        detail = flags[rid] or rule.get("detail", "")
        hits.append(Hit(rel, field, rid, severity, detail))


@dataclass(frozen=True)
class Hit:
    path: str
    field: str
    rule: str
    severity: str  # fail | warn
    detail: str = ""


def load_rules() -> dict:
    return yaml.safe_load(RULES_PATH.read_text(encoding="utf-8")) or {}


def load_md(path: Path) -> tuple[dict, str]:
    text = path.read_text(encoding="utf-8")
    match = FRONTMATTER.match(text)
    if not match:
        return {}, text
    meta = yaml.safe_load(match.group(1)) or {}
    return meta, text[match.end() :]


def word_count(text: str) -> int:
    return len(re.findall(r"\b\w+\b", text))


def first_key_concept_line(key_concept: str) -> str | None:
    for raw in key_concept.splitlines():
        line = raw.strip()
        if not line or line.startswith("{{"):
            continue
        if line.startswith("- "):
            return line[2:].strip()
        return line
    return None


# ponytail: only flag bullet drones, not reference tables or template code
SLOP_PARALLEL_WORDS = frozenset(
    {
        "always",
        "allows",
        "consider",
        "delivers",
        "enables",
        "ensures",
        "helps",
        "make",
        "offers",
        "provides",
        "supports",
        "use",
        "you",
    }
)


def parallel_bullet_runs(text: str, min_run: int = 3) -> bool:
    first_words: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped.startswith("- "):
            continue
        words = stripped[2:].split()
        if not words:
            continue
        first = words[0].lower().rstrip(":")
        # ponytail: recipe amounts (1 cup, 2-3 tbsp) aren't parallelism disease
        if first[0].isdigit() or first.startswith("**"):
            continue
        first_words.append(first)
    for i in range(len(first_words) - min_run + 1):
        window = first_words[i : i + min_run]
        if len(set(window)) == 1 and window[0] in SLOP_PARALLEL_WORDS:
            return True
    return False


def empty_section_headings(body: str) -> list[str]:
    lines = body.splitlines()
    hits: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line.startswith("## "):
            i += 1
            continue
        heading = line[3:].strip()
        j = i + 1
        while j < len(lines) and not lines[j].strip():
            j += 1
        if j >= len(lines):
            break
        nxt = lines[j].strip()
        if nxt.startswith("## ") or nxt == "---":
            hits.append(heading)
        i += 1
    return hits


def section_block(body: str, section_pattern: str) -> str | None:
    pat = re.compile(section_pattern, re.I | re.M)
    match = pat.search(body)
    if not match:
        return None
    start = match.end()
    rest = body[start:]
    end_match = re.search(r"^## \S", rest, re.M)
    return rest[: end_match.start()] if end_match else rest


def apply_pattern_hits(
    hits: list[Hit],
    *,
    rel: str,
    field: str,
    text: str,
    rules: list[dict],
    severity: str,
) -> None:
    for rule in rules:
        rid = rule["id"]
        kind = rule.get("kind")
        if kind == "parallel_bullets":
            if parallel_bullet_runs(text):
                hits.append(Hit(rel, field, rid, severity, rule.get("detail", "")))
            continue
        if kind == "dictionary_opener" and field == "key_concept":
            first = first_key_concept_line(text)
            if first and DICTIONARY_OPENER.search(first):
                hits.append(Hit(rel, field, rid, severity, rule.get("detail", "")))
            continue
        pattern = rule.get("pattern")
        if pattern and re.search(pattern, text, re.I | re.M):
            hits.append(Hit(rel, field, rid, severity, rule.get("detail", "")))

    apply_mechanical_hits(hits, rel=rel, field=field, text=text, rules=rules, severity=severity)


def scan_blog(path: Path, rules: dict) -> list[Hit]:
    if path.name in SKIP_BLOG_FILES:
        return []
    rel = str(path.relative_to(ROOT))
    meta, body = load_md(path)
    published = not meta.get("draft") and not path.name.startswith("__")
    hits: list[Hit] = []

    for rule in rules.get("publish_fail", []):
        rid = rule["id"]
        detail = rule.get("detail", "")
        if rule.get("frontmatter") == "image":
            if published and meta.get("image") == rule.get("equals"):
                hits.append(Hit(rel, "image", rid, "fail", detail))
            elif not published and meta.get("image") == rule.get("equals"):
                hits.append(Hit(rel, "image", rid, "warn", detail))
            continue
        if rule.get("min_body_words"):
            if published and word_count(body) < int(rule["min_body_words"]):
                hits.append(Hit(rel, "body", rid, "fail", detail))
            continue
        pattern = rule.get("pattern")
        if pattern and re.search(pattern, body, re.I):
            sev = "fail" if published else "warn"
            hits.append(Hit(rel, "body", rid, sev, detail))

    warn_rules = rules.get("warn", [])
    apply_pattern_hits(hits, rel=rel, field="body", text=body, rules=warn_rules, severity="warn")

    for rule in warn_rules:
        if rule.get("kind") == "empty_section":
            for heading in empty_section_headings(body):
                hits.append(
                    Hit(rel, "body", rule["id"], "warn", f"{rule.get('detail', '')}: {heading}")
                )
        if rule.get("kind") == "blog_no_first_person_opener" and published:
            cats = {str(c) for c in (meta.get("categories") or [])}
            if cats & set(rule.get("categories", [])):
                opener = body[:400]
                if opener.strip() and not FIRST_PERSON.search(opener):
                    hits.append(Hit(rel, "body", rule["id"], "warn", rule.get("detail", "")))
        section = rule.get("section")
        if section:
            block = section_block(body, section)
            if block and len(HTTP_LINK.findall(block)) >= int(rule.get("min_http_links", 3)):
                hits.append(Hit(rel, "body", rule["id"], "warn", rule.get("detail", "")))

    return hits


def scan_note(path: Path, rules: dict) -> list[Hit]:
    if path.name in SKIP_NOTE_FILES:
        return []
    rel = str(path.relative_to(ROOT))
    meta, body = load_md(path)
    if meta.get("draft") or meta.get("note_kind", "note") in SKIP_NOTE_KINDS:
        return []

    hits: list[Hit] = []
    for field, text in note_prose_chunks(meta, body):
        apply_pattern_hits(hits, rel=rel, field=field, text=text, rules=rules.get("fail", []), severity="fail")
        apply_pattern_hits(hits, rel=rel, field=field, text=text, rules=rules.get("warn", []), severity="warn")
    return hits


def print_summary(hits: list[Hit], blog_count: int, note_count: int) -> None:
    fails = [h for h in hits if h.severity == "fail"]
    warns = [h for h in hits if h.severity == "warn"]
    print(f"Slop scan - {blog_count} blog, {note_count} notes, {len(fails)} fail, {len(warns)} warn")
    print(f"Rules: {RULES_PATH.relative_to(ROOT)}")
    print()

    def _group(items: list[Hit]) -> dict[str, list[Hit]]:
        grouped: dict[str, list[Hit]] = defaultdict(list)
        for item in items:
            grouped[item.rule].append(item)
        return dict(sorted(grouped.items(), key=lambda kv: (-len(kv[1]), kv[0])))

    if fails:
        print("Fail (lint:slop exits 1 on these)")
        for rule, group in _group(fails).items():
            detail = next((h.detail for h in group if h.detail), "")
            print(f"  {rule} ({len(group)})" + (f" - {detail}" if detail else ""))
            for h in sorted(group, key=lambda x: (x.path, x.field)):
                print(f"    {h.path} · {h.field}")
        print()

    if warns:
        print("Warn (fix before publish)")
        for rule, group in _group(warns).items():
            detail = next((h.detail for h in group if h.detail), "")
            print(f"  {rule} ({len(group)})" + (f" - {detail}" if detail else ""))
            for h in sorted(group, key=lambda x: (x.path, x.field))[:8]:
                print(f"    {h.path} · {h.field}")
            if len(group) > 8:
                print(f"    … and {len(group) - 8} more")
        print()

    if not hits:
        print("No slop flags.")
    else:
        print("pnpm lint:slop - fail CI on publish blockers")


def _self_check() -> None:
    assert parallel_bullet_runs("- Ensures a\n- Ensures b\n- Ensures c")
    assert not parallel_bullet_runs("- One\n- Two\n- Three")
    assert DICTIONARY_OPENER.search("This is a framework for better habits")
    assert first_key_concept_line("- First line\n- Second") == "First line"
    body = "## Intro\n\n## Next\n"
    assert empty_section_headings(body) == ["Intro"]


def main() -> int:
    if "--self-check" in sys.argv:
        _self_check()
        print("slop-lint self-check OK")
        return 0

    rules = load_rules()
    blog_only = "--blog-only" in sys.argv
    notes_only = "--notes-only" in sys.argv
    blog_paths = sorted(BLOG.glob("*.md")) if BLOG.is_dir() and not notes_only else []
    note_paths = sorted(NOTES.glob("*.md")) if NOTES.is_dir() and not blog_only else []

    hits: list[Hit] = []
    for path in blog_paths:
        hits.extend(scan_blog(path, rules.get("blog", {})))
    for path in note_paths:
        hits.extend(scan_note(path, rules.get("notes", {})))

    if "--summary" in sys.argv:
        print_summary(hits, len(blog_paths), len(note_paths))
        return 0

    fails = [h for h in hits if h.severity == "fail"]
    if not fails:
        print("Slop lint OK")
        return 0

    print("Slop lint:", file=sys.stderr)
    for hit in fails:
        detail = f" - {hit.detail}" if hit.detail else ""
        print(f"  {hit.path}: {hit.field}: {hit.rule}{detail}", file=sys.stderr)
    return 1 if "--check" in sys.argv else 0


if __name__ == "__main__":
    sys.exit(main())
