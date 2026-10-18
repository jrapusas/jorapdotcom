#!/usr/bin/env python3
"""Shared note body/frontmatter helpers for garden notes."""

from __future__ import annotations

import difflib
import re
from typing import Any

_BIBLE_BOOKS = (
    r"(?:1|2|3)?\s*(?:Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|"
    r"Ephesians|Philippians|Colossians|James|Peter|Hebrews|Proverbs|Psalms?|"
    r"Isaiah|Jeremiah|Deuteronomy)"
)
BIBLE_VERSE_REF_RE = re.compile(
    rf"(?:"
    rf"\b{_BIBLE_BOOKS}\b\s*(?:\d+\s*:\s*\d+(?:\s*[-–]\d+)?|\d+\s+lane|\d+(?:\s*[-–]\d+)?(?=\s+(?:fruit|cluster|names)))"
    rf"|\b{_BIBLE_BOOKS}\b\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)"
    rf"(?:\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve))?(?!\w)"
    rf"|\b(?:the\s+)?{_BIBLE_BOOKS}\b\s+quote\b"
    rf"|\bverse\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)\b"
    rf"|\bbefore\s+{_BIBLE_BOOKS}\b"
    rf"|\b(?:quotes?|says)\s+{_BIBLE_BOOKS}\b"
    rf"|\b{_BIBLE_BOOKS}\b\s+(?:would|says)\b"
    rf")",
    re.I,
)


def bible_verse_ref_in_text(text: str) -> str | None:
    """Return first bible verse locator in text, or None. Skips 'mark three' verb false positives."""
    for match in BIBLE_VERSE_REF_RE.finditer(text):
        if re.match(r"^mark\s+three\b", match.group(0), re.I):
            continue
        return match.group(0)
    return None


BIBLE_VERSE_RANGE_RE = re.compile(
    rf"\b({_BIBLE_BOOKS})\s+(\d+)\s*:\s*(\d+)(?:\s*[-–]\s*(\d+))?\b",
    re.I,
)
BIBLE_CHAPTER_ONLY_RE = re.compile(
    rf"\b({_BIBLE_BOOKS})\s+(\d+)\b(?!\s*:\s*\d)",
    re.I,
)
BIBLE_SHORTCODE_REF_RE = re.compile(
    r'\{\{<\s*bible\b[^>]*\bref="([^"]+)"',
    re.I,
)
# anti-slop: John 17:11-23 OK; John 17:1-26 is a whole-chapter dump; John 13:1-17 foot-washing block OK
BIBLE_MAX_VERSE_SPAN = 16


def _chapter_only_false_positive(match: re.Match[str], text: str) -> bool:
    snippet = match.group(0)
    if re.match(r"^mark\s+three\b", snippet, re.I):
        return True
    tail = text[match.end() : match.end() + 24]
    if re.match(r"\s+(?:lane|cluster|names|fruit)\b", tail, re.I):
        return True
    return False


def bible_ref_scope_issues(
    text: str, *, max_span: int = BIBLE_MAX_VERSE_SPAN
) -> list[str]:
    """Flag chapter-only refs and wide verse ranges in prose (not bible shortcodes)."""
    if not text.strip():
        return []
    issues: list[str] = []
    seen: set[str] = set()

    def add(issue: str) -> None:
        if issue not in seen:
            seen.add(issue)
            issues.append(issue)

    stripped = BIBLE_SHORTCODE_REF_RE.sub("", text)
    stripped = re.sub(r"\{\{<\s*bible\b[^>]*\}\}", "", stripped, flags=re.I)

    for match in BIBLE_VERSE_RANGE_RE.finditer(stripped):
        start = int(match.group(3))
        end = int(match.group(4)) if match.group(4) else start
        if end - start > max_span:
            add(f"wide verse range {match.group(0).strip()} (>{max_span} verses)")

    for match in BIBLE_CHAPTER_ONLY_RE.finditer(stripped):
        if _chapter_only_false_positive(match, stripped):
            continue
        add(f"chapter-only ref {match.group(0).strip()}")

    return issues


MC_COMMA_OR_RE = re.compile(r",\s*[^,\n]+,\s*or\s+", re.I)
MC_FORK_OR_RE = re.compile(r"\bor\b[^.?!\n]*\?", re.I)
MC_PICK_RE = re.compile(r"\b(pick one|choose between|one of)\b", re.I)


def is_multiple_choice_front(front: str) -> bool:
    if MC_PICK_RE.search(front):
        return True
    if MC_COMMA_OR_RE.search(front):
        return True
    if MC_FORK_OR_RE.search(front):
        return True
    return False


def front_has_clear_question(front: str) -> bool:
    """True when front ends with an open retrieval question after a life cue."""
    text = front.strip()
    if not text.endswith("?"):
        return False
    if len(text) < 15:
        return False
    return not is_multiple_choice_front(text)


def append_flashcard_hint_question(front: str, back: str) -> str:
    """Add a subtle hint question so the front nudges retrieval without telegraphy."""
    if front_has_clear_question(front):
        return front
    base = front.rstrip(". ")
    fl, bl = base.lower(), back.lower()
    if any(w in fl for w in ("wrong order", "mixing", "confus", "same order", " versus")):
        hint = "Wrong order?"
    elif any(w in fl for w in ("missing", "zero ", "none ", "without ")):
        hint = "What's missing?"
    elif any(
        w in bl for w in ("first", "before inbox", "before the", "before i", "scripture before")
    ):
        hint = "What comes first?"
    elif any(
        w in fl for w in ("lead with", "one sentence", "how to be saved", "asks why", "asks how")
    ):
        hint = "One sentence back?"
    elif any(w in fl for w in ("fix", "broken", "outage", "failed", "shut down", "won't load")):
        hint = "First fix?"
    elif any(w in fl for w in ("stop", "boundary", "where", " sit", "goes")):
        hint = "Where do I stop?"
    elif any(w in bl for w in ("reframe", "not a ", "not the ")):
        hint = "What's the reframe?"
    elif "?" in back:
        hint = "One check?"
    else:
        hint = "What's the move?"
    updated = f"{base}. {hint}"
    if len(updated) <= len(back):
        updated = f"{base}. What's the move right now?"
    return updated


LEVEL_KEYS = ("level_1", "level_2", "level_3", "level_4", "level_5")
LEVEL_LABELS = ("Recognize", "Explain", "Use", "Connect", "Create")
LEVEL_BULLET_RE = re.compile(r"^(\s*)-\s*Level\s+([1-5]):\s*(.*)$", re.I)
LEVEL_PREFIX_RE = re.compile(r"^Level\s+[1-5]:\s*", re.I)

FM_ORDER = (
    "note_kind",
    "layout",
    "title",
    "meta_title",
    "description",
    "key_concept",
    *LEVEL_KEYS,
    "examples",
    "shareable_thought",
    "relationships",
    "slug",
    "date",
    "image",
    "categories",
    "author",
    "tags",
    "aliases",
    "featured",
    "review",
    "card_sets",
    "cards",
    "draft",
)

ALWAYS_QUOTE = {
    "note_kind",
    "layout",
    "title",
    "meta_title",
    "description",
    *LEVEL_KEYS,
    "slug",
    "author",
    "image",
    "date",
}


def split_frontmatter(text: str) -> tuple[str, str]:
    if not text.startswith("---"):
        return "", text
    end = text.find("\n---", 3)
    if end == -1:
        return "", text
    return text[3:end].strip(), text[end + 4 :]


def strip_level_prefix(text: str, n: int | None = None) -> str:
    """Drop a leading Level N: label from a level field value."""
    text = text.strip()
    if n is not None:
        return re.sub(rf"^Level\s+{n}:\s*", "", text, flags=re.I).strip()
    return LEVEL_PREFIX_RE.sub("", text).strip()


def extract_levels_from_key_concept(kc: str) -> tuple[str, dict[str, str]]:
    """Pull Level 1-5 bullets out of key_concept into level_* fields."""
    levels: dict[str, str] = {}
    kept: list[str] = []
    for raw in kc.splitlines():
        match = LEVEL_BULLET_RE.match(raw)
        if match:
            key = f"level_{match.group(2)}"
            if key not in levels:
                levels[key] = match.group(3).strip()
            continue
        kept.append(raw)
    text = re.sub(r"\n{3,}", "\n\n", "\n".join(kept)).strip("\n")
    return text, levels


def append_level_headings(kc: str, level_blocks: list[str]) -> str:
    """Append Level 1-5 H3 sections at the end of key_concept markdown."""
    if not level_blocks:
        return kc.strip()
    levels_md = "\n\n".join(level_blocks)
    kc_text = kc.strip()
    if not kc_text:
        return levels_md
    return f"{kc_text}\n\n{levels_md}"


def format_key_concept_section(fm: dict[str, Any]) -> str:
    """Build Key Concept markdown from key_concept + level_1..level_5."""
    kc = fm.get("key_concept")
    kc_text = kc.strip() if isinstance(kc, str) else ""
    level_blocks: list[str] = []
    has_fields = False
    for i, key in enumerate(LEVEL_KEYS, start=1):
        val = fm.get(key)
        if isinstance(val, str) and val.strip():
            has_fields = True
            label = LEVEL_LABELS[i - 1]
            level_blocks.append(
                f"### Level {i} - {label}\n\n{strip_level_prefix(val, i)}"
            )
    if has_fields:
        kc_text, _ = extract_levels_from_key_concept(kc_text)
        return append_level_headings(kc_text, level_blocks)
    return kc_text


def note_prose_chunks(meta: dict[str, Any], body: str = "") -> list[tuple[str, str]]:
    """Named prose slices from a garden note for slop lint/score."""
    chunks: list[tuple[str, str]] = []
    for key in ("description", "key_concept", *LEVEL_KEYS):
        val = meta.get(key)
        if isinstance(val, str) and val.strip():
            chunks.append((key, val))
    for key in ("examples", "shareable_thought"):
        val = meta.get(key)
        if isinstance(val, list):
            for i, item in enumerate(val):
                if isinstance(item, str) and item.strip():
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
    if body.strip():
        chunks.append(("body", body))
    return chunks


def note_prose_text(meta: dict[str, Any], body: str = "") -> str:
    return "\n\n".join(text for _, text in note_prose_chunks(meta, body))


def split_frontmatter_parts(text: str) -> tuple[str, str, str]:
    """Full --- block, inner YAML, body (for export/import scripts)."""
    if not text.startswith("---"):
        return "", text, text
    end = text.find("\n---", 3)
    if end == -1:
        return "", text, text
    return text[: end + 4], text[3:end].strip(), text[end + 4 :].lstrip("\n")


def parse_scalar(block: str, key: str) -> str:
    return _parse_scalar(block, key)


def parse_bool(block: str, key: str) -> bool:
    match = re.search(rf"^{key}:\s*(true|false)\s*$", block, re.M)
    return match.group(1) == "true" if match else False


def _parse_scalar(block: str, key: str) -> str:
    match = re.search(rf'^{key}:\s*"?([^"\n]+)"?\s*$', block, re.M)
    return match.group(1).strip() if match else ""


def _parse_block_scalar(block: str, key: str) -> str:
    match = re.search(rf"^{key}:\s*\|\s*\n((?:  .*\n?)*)", block, re.M)
    if not match:
        return _parse_scalar(block, key)
    lines: list[str] = []
    for line in match.group(1).splitlines():
        lines.append(line[2:] if line.startswith("  ") else line)
    return "\n".join(lines).rstrip("\n")


def _parse_string_list(block: str, key: str) -> list[str]:
    inline = re.search(rf"^{key}:\s*\[(.*)\]\s*$", block, re.M)
    if inline:
        return [
            item.strip().strip('"').strip("'")
            for item in inline.group(1).split(",")
            if item.strip()
        ]
    match = re.search(rf"^{key}:\s*\n((?:  - .*\n?)*)", block, re.M)
    if not match:
        return []
    items: list[str] = []
    for line in match.group(1).splitlines():
        item_match = re.match(r'  - "?(.+?)"?\s*$', line)
        if item_match:
            items.append(item_match.group(1))
    return items


def _parse_relationships(block: str) -> list[dict[str, str]]:
    match = re.search(
        r"^relationships:\s*\n((?:  - .*\n(?:    .*\n?)*)*)", block, re.M
    )
    if not match:
        return []
    rows: list[dict[str, str]] = []
    current: dict[str, str] = {}
    for line in match.group(1).splitlines():
        if line.startswith("  - "):
            if current:
                rows.append(current)
            current = {}
            rest = line[4:].strip()
            if rest.startswith("type:"):
                current["type"] = rest.split(":", 1)[1].strip()
        elif line.startswith("    "):
            key, _, val = line.strip().partition(":")
            current[key.strip()] = val.strip().strip('"')
    if current:
        rows.append(current)
    return rows


RELATIONSHIP_ROW_KEYS = ("type", "wikilink", "reason")


def relationship_row_errors(row: object, index: int) -> list[str]:
    """Return human-readable errors for one relationships[] row."""
    if not isinstance(row, dict):
        return [f"relationships[{index}] not a dict"]
    errs: list[str] = []
    for key in RELATIONSHIP_ROW_KEYS:
        val = row.get(key)
        if not isinstance(val, str) or not val.strip():
            errs.append(f"relationships[{index}] missing {key}")
    wikilink = row.get("wikilink")
    if isinstance(wikilink, str) and wikilink.strip():
        text = wikilink.strip()
        if not (text.startswith("[[") and text.endswith("]]")):
            errs.append(f"relationships[{index}] wikilink must be [[Title]]")
    return errs


def relationship_frontmatter_errors(fm: dict[str, Any]) -> list[str]:
    """Validate relationships rows the same way OKF export assembles markdown."""
    rels = fm.get("relationships")
    if not isinstance(rels, list):
        return []
    errs: list[str] = []
    for index, row in enumerate(rels):
        errs.extend(relationship_row_errors(row, index))
    return errs


def parse_display_fields(raw_fm: str) -> dict[str, Any]:
    """Parse frontmatter fields needed by assemble_markdown (stdlib only)."""
    fm: dict[str, Any] = {}
    for key in ("description", "summary"):
        val = _parse_scalar(raw_fm, key)
        if val:
            fm[key] = val
    key_concept = _parse_block_scalar(raw_fm, "key_concept")
    if key_concept:
        fm["key_concept"] = key_concept
    for key in LEVEL_KEYS:
        val = _parse_block_scalar(raw_fm, key) or _parse_scalar(raw_fm, key)
        if val:
            fm[key] = val
    examples = _parse_string_list(raw_fm, "examples")
    if examples:
        fm["examples"] = examples
    relationships = _parse_relationships(raw_fm)
    if relationships:
        fm["relationships"] = relationships
    return fm


def relationships_table(rows: list[dict[str, str]]) -> str:
    lines = [
        "## Note Relationships",
        "",
        "| Relationship | Wikilink | Reason |",
        "|--------------|----------|--------|",
    ]
    for row in rows:
        lines.append(f"| {row['type']} | {row['wikilink']} | {row['reason']} |")
    return "\n".join(lines)


def assemble_markdown(fm: dict[str, Any], body: str = "") -> str:
    """Rebuild display markdown from frontmatter fields + optional body."""
    parts: list[str] = []
    description = fm.get("description") or fm.get("summary")
    if isinstance(description, str) and description.strip():
        parts.append(description.strip())

    key_concept = format_key_concept_section(fm)
    if key_concept:
        parts.append(f"## Key Concept\n\n{key_concept}")

    examples = fm.get("examples")
    if isinstance(examples, list) and examples:
        bullets = "\n".join(f"- {ex}" for ex in examples if isinstance(ex, str) and ex.strip())
        if bullets:
            parts.append(f"## Examples\n\n{bullets}")

    relationships = fm.get("relationships")
    if isinstance(relationships, list) and relationships:
        rows = [r for r in relationships if isinstance(r, dict)]
        if rows:
            parts.append(relationships_table(rows))

    body = body.strip()
    if body:
        parts.append(body)
    return "\n\n".join(parts) + ("\n" if parts else "")


def yaml_quote(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def yaml_scalar(key: str, value: Any) -> str:
    if isinstance(value, bool):
        return f"{key}: {'true' if value else 'false'}"
    if value is None:
        return ""
    if isinstance(value, (int, float)):
        return f"{key}: {value}"
    text = str(value)
    # key_concept is markdown bullets / shortcodes - always a block scalar so a
    # single "- …" line never becomes invalid YAML (`key_concept: - …`).
    if key == "key_concept" or "\n" in text:
        block = text.rstrip("\n").replace("\n", "\n  ")
        return f"{key}: |\n  {block}"
    if key in ALWAYS_QUOTE or re.search(r'[:#\[\]{}&,*!|>\'"%@`]', text) or text in {
        "true",
        "false",
        "null",
        "yes",
        "no",
        "",
    }:
        return f"{key}: {yaml_quote(text)}"
    return f"{key}: {text}"


def dump_frontmatter(fm: dict[str, Any]) -> str:
    lines: list[str] = []
    seen: set[str] = set()

    def emit(key: str, value: Any) -> None:
        if key in seen or value is None:
            return
        seen.add(key)
        if key == "relationships" and isinstance(value, list):
            if not value:
                return
            lines.append("relationships:")
            for row in value:
                if not isinstance(row, dict):
                    continue
                lines.append(f"  - type: {row.get('type', '')}")
                lines.append(f"    wikilink: {yaml_quote(str(row.get('wikilink', '')))}")
                lines.append(f"    reason: {yaml_quote(str(row.get('reason', '')))}")
            return
        if key == "cards" and isinstance(value, list):
            if not value:
                return
            lines.append("cards:")
            for card in value:
                if not isinstance(card, dict):
                    continue
                lines.append(f'  - front: {yaml_quote(str(card.get("front", "")))}')
                lines.append(f'    back: {yaml_quote(str(card.get("back", "")))}')
            return
        if key in {"tags", "categories", "aliases", "card_sets", "outputs"} and isinstance(
            value, list
        ):
            if not value:
                return
            quoted = ", ".join(yaml_quote(str(item)) for item in value)
            lines.append(f"{key}: [{quoted}]")
            return
        if key == "examples" and isinstance(value, list):
            if not value:
                return
            lines.append("examples:")
            for ex in value:
                if isinstance(ex, str) and ex.strip():
                    lines.append(f"  - {yaml_quote(ex.strip())}")
            return
        if key == "shareable_thought" and isinstance(value, list):
            if not value:
                return
            lines.append("shareable_thought:")
            for line in value:
                if isinstance(line, str) and line.strip():
                    lines.append(f"  - {yaml_quote(line.strip())}")
            return
        line = yaml_scalar(key, value)
        if line:
            lines.append(line)

    for key in FM_ORDER:
        if key in fm:
            emit(key, fm[key])
    for key in sorted(fm):
        if key not in seen:
            emit(key, fm[key])
    return "\n".join(lines)


WIKILINK_PLAIN = re.compile(r"\[\[([^\]|#]+)(?:#[^\]]+)?\]\]")
# Sentence end, spaced dash, or semicolon. The dash class must stay hyphen-first:
# writing it as [--–] is a range from "-" to "–" that swallows letters and digits,
# so "to a blank page" would split at " a ".
CLAUSE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+|\s[-–—]\s|;\s+")


def normalize_shareable_line(text: str) -> str:
    text = WIKILINK_PLAIN.sub(r"\1", text)
    text = " ".join(text.replace("`", "").replace("*", "").split()).lower().rstrip(".,;:-- ")
    if text.endswith("…"):
        text = text[:-1].rstrip(".,;:-- ")
    return text


def shareable_lines_exact_overlap(a: str, b: str) -> bool:
    """True when one line is the same claim or an obvious fragment of the other."""
    na, nb = normalize_shareable_line(a), normalize_shareable_line(b)
    if not na or not nb:
        return na == nb
    if na == nb:
        return True
    shorter, longer = (na, nb) if len(na) <= len(nb) else (nb, na)
    if len(shorter) < 10:
        return False
    if longer.startswith(shorter) or longer.endswith(shorter):
        return True
    if shorter.endswith("…"):
        stem = shorter[:-1].rstrip(".,;:-- ")
        if stem and (longer.startswith(stem) or stem in longer):
            return True
    return False


def shareable_lines_overlap(a: str, b: str) -> bool:
    """True when one line is the same claim or an obvious paraphrase of the other."""
    if shareable_lines_exact_overlap(a, b):
        return True
    na, nb = normalize_shareable_line(a), normalize_shareable_line(b)
    if not na or not nb or min(len(na), len(nb)) < 10:
        return False
    # ponytail: SequenceMatcher catches pronoun swaps; 0.80 held ~13 dups dry-run; upgrade: token Jaccard if rewrites drift
    return difflib.SequenceMatcher(None, na, nb).ratio() >= 0.80


def principle_line_pool(fm: dict) -> list[str]:
    """Normalized clauses from description, key_concept, and level_1..level_5."""
    pool: list[str] = []
    seen: set[str] = set()
    for field in ("description", "key_concept", *LEVEL_KEYS):
        src = fm.get(field)
        if not isinstance(src, str) or not src.strip():
            continue
        raw = src.strip()
        if field in LEVEL_KEYS:
            raw = strip_level_prefix(raw)
        chunks = [raw]
        for block in raw.split("\n\n"):
            block = block.strip()
            if not block or "|" in block:
                continue
            if block.startswith("{{<"):
                continue
            if block.startswith("- "):
                block = block[2:]
            block = LEVEL_PREFIX_RE.sub("", block).strip()
            chunks.append(block.replace("\n", " "))
        for chunk in chunks:
            flat = WIKILINK_PLAIN.sub(r"\1", chunk)
            flat = " ".join(flat.replace("**", "").replace("*", "").replace("`", "").split())
            parts = [flat]
            parts.extend(CLAUSE_SPLIT_RE.split(flat))
            for part in parts:
                norm = normalize_shareable_line(part)
                if len(norm) >= 10 and norm not in seen:
                    seen.add(norm)
                    pool.append(norm)
    return pool


FRAGMENT_START = re.compile(
    r"^(not|and|or|but|then)\s",
    re.I,
)
SAME_AS_FRAGMENT = re.compile(r"^same as\b", re.I)
INCOMPLETE_SPLIT_HEAD = re.compile(
    r"\b(isn't|aren't|wasn't|weren't|don't|doesn't|didn't|can't|won't|not merely|not just|not only)\b",
    re.I,
)
POINTER_PREFIX = re.compile(
    # Case-sensitive on purpose: the See/On branches point at a capitalized note title, and a
    # lookahead is needed because the trailing \b applies to the last matched character, so
    # "See [A-Z]\b" never matches "See The". Shareable lines must start capitalized anyway.
    r"^(Garden parallel|Same shape|Same rhythm|Same logic|Same math|Same fruit|Same rescue|"
    r"Faith parallel|More on|Cousins,?|Listed below|Use Note Title|The \[|Goes further than|"
    r"Pairs with|Ancestor of|See(?=\s+[A-Z])|On(?=\s+[A-Z][a-z]+\s+[A-Z]))\b",
)
META_NOTE_LANG = re.compile(
    r"\b(this note|teach the note|where the note|stage the note|note garden|when a note is only)\b",
    re.I,
)
DANGLING_THAT_START = re.compile(r"^That's\b", re.I)
CLAUSE_SO_START = re.compile(r"^So \b", re.I)
DANGLING_DEMONSTRATIVE = re.compile(r"^that('s| is)\s+the\s+bar\b", re.I)
PUNCH_VERB = re.compile(
    r"\b(kill|kills|win|wins|work|works|beat|beats|need|needs|ship|ships|save|saves|fix|fixes|stop|stops|break|breaks|trust|trusts|keep|keeps|make|makes|go|goes|teach|teaches|name|names|run|runs|build|builds|grow|grows|learn|learns|cite|cites|push|pushes|protect|protects|catch|catches|judge|judges|pick|picks|turn|turns|believe|believes|receive|receives|live|lives|love|loves)\b",
    re.I,
)


def ensure_terminal_punct(text: str) -> str:
    text = text.strip()
    if text and text[-1] not in ".!?":
        text += "."
    return text


def _looks_like_title_fragment(text: str) -> bool:
    """Short title-case phrase without a verb - usually a wikilink label, not a principle."""
    t = text.strip().rstrip(".!?")
    if len(t) > 60 or "," in t or ";" in t:
        return False
    words = t.split()
    if len(words) > 7:
        return False
    return not any(w.islower() for w in words if w.isalpha())


def is_complete_shareable_line(line: str) -> bool:
    """True when line reads as a standalone principle, not a clause fragment."""
    text = line.strip()
    if len(text) < 12:
        return False
    if text.endswith("…"):
        return False
    if text[-1] not in ".!?":
        return False
    if text.endswith((",", ";", " -", "-", "–")):
        return False
    if not (text[0].isupper() or text[0] in '"\'('):
        return False
    if FRAGMENT_START.match(text):
        return False
    if SAME_AS_FRAGMENT.match(text):
        return False
    if text.count("(") > text.count(")"):
        return False
    if _looks_like_title_fragment(text):
        return False
    return True


def _incomplete_negation_line(text: str) -> bool:
    """Negation-only line that needs its contrast half to land."""
    if len(text) > 90:
        return False
    lower = text.lower()
    if not any(
        x in lower
        for x in ("isn't", "aren't", "don't", "doesn't", "not merely", "not just", "not only")
    ):
        return False
    if " - " in text or "; " in text:
        return False
    if ", not " in lower:
        return False
    if lower.startswith("the point isn't"):
        return True
    if "don't hand back" in lower:
        return True
    return False


def _bare_noun_list(text: str) -> bool:
    """Comma list of labels with no verb - e.g. 'Judgment, patience, attention.'"""
    t = text.rstrip(".!?").strip()
    if "," not in t or " - " in t or " not " in t.lower():
        return False
    if PUNCH_VERB.search(t):
        return False
    parts = [p.strip() for p in t.split(",")]
    return len(parts) >= 2 and all(len(p.split()) <= 2 for p in parts)


def gets_point_across(line: str) -> bool:
    """True when a reader gets the claim without another line for context."""
    if not is_complete_shareable_line(line):
        return False
    text = line.strip()
    words = text.split()
    if len(words) < 5 and len(text) < 35 and not PUNCH_VERB.search(text):
        return False
    if POINTER_PREFIX.match(text):
        return False
    if META_NOTE_LANG.search(text):
        return False
    if DANGLING_THAT_START.match(text):
        return False
    if CLAUSE_SO_START.match(text):
        return False
    if DANGLING_DEMONSTRATIVE.match(text):
        return False
    if _bare_noun_list(text):
        return False
    if "listed below" in text.lower():
        return False
    if re.match(r"^In that order\.?$", text, re.I):
        return False
    if re.search(r"\[.*\]\([^)]+\)", text):
        return False
    if text.startswith("For ") and not PUNCH_VERB.search(text):
        return False
    if _incomplete_negation_line(text):
        return False
    return True


KC_BULLET_RE = re.compile(r"^\s*-\s+")
KC_BIBLE_RE = re.compile(r"^\s*\{\{<\s*bible\b", re.I)
KC_TABLE_RE = re.compile(r"^\s*\|")


def description_clause_parts(desc: str) -> list[str]:
    """Normalized description clauses for overlap checks."""
    flat = " ".join(desc.split())
    parts = [flat]
    parts.extend(CLAUSE_SPLIT_RE.split(flat))
    out: list[str] = []
    seen: set[str] = set()
    for part in parts:
        norm = normalize_shareable_line(part)
        if len(norm) >= 10 and norm not in seen:
            seen.add(norm)
            out.append(norm)
    return out


def line_overlaps_description(desc: str, line: str) -> bool:
    """True when a key_concept bullet repeats description text."""
    text = line.lstrip("- ").strip()
    nk = normalize_shareable_line(text)
    if len(nk) < 10:
        return False
    for dp in description_clause_parts(desc):
        if shareable_lines_exact_overlap(dp, nk) or dp in nk or nk in dp:
            return True
    return False


def key_concept_overlaps_description(desc: str, kc: str) -> list[str]:
    """Bullet lines in key_concept that repeat description."""
    if not isinstance(desc, str) or not isinstance(kc, str):
        return []
    hits: list[str] = []
    for raw in kc.splitlines():
        stripped = raw.strip()
        if not stripped or not KC_BULLET_RE.match(raw):
            continue
        if KC_BIBLE_RE.match(stripped) or KC_TABLE_RE.match(stripped):
            continue
        if line_overlaps_description(desc, stripped):
            hits.append(stripped.lstrip("- ").strip())
    return hits


def strip_description_from_key_concept(kc: str, desc: str) -> str:
    """Drop key_concept bullets that repeat description."""
    kept: list[str] = []
    for raw in kc.splitlines():
        stripped = raw.strip()
        if (
            stripped
            and KC_BULLET_RE.match(raw)
            and line_overlaps_description(desc, stripped)
        ):
            continue
        kept.append(raw)
    text = "\n".join(kept).strip("\n")
    return f"{text}\n" if text else ""


def _self_check() -> None:
    assert description_clause_parts("Teach the idea out loud to a blank page - where you stumble") == [
        "teach the idea out loud to a blank page - where you stumble",
        "teach the idea out loud to a blank page",
        "where you stumble",
    ]
    desc = "Faith alone saves; works show faith is alive, they do not buy heaven."
    kc = "- Faith alone saves; works show faith is alive, they do not buy heaven.\n- Hear Jesus and do."
    assert line_overlaps_description(desc, "Faith alone saves; works show faith is alive.")
    assert not line_overlaps_description(desc, "Hear Jesus and do - rock stands in the storm.")
    assert key_concept_overlaps_description(desc, kc) == [
        "Faith alone saves; works show faith is alive, they do not buy heaven."
    ]
    assert "Hear Jesus" in strip_description_from_key_concept(kc, desc)
    assert is_complete_shareable_line("Friction kills capture.")
    assert is_complete_shareable_line("Same aim, different plan.")
    assert not is_complete_shareable_line("not mere intellectual agreement.")
    assert not is_complete_shareable_line("Same as The Trusted Inbox.")
    assert not is_complete_shareable_line("There Is No Perfect Solution")
    assert not gets_point_across("The point isn't passivity toward all evil.")
    assert not gets_point_across("Same inbox rule.")
    assert not gets_point_across("That's the pushback on busy-as-virtue.")
    assert not gets_point_across("See The Narrow Way and Loss of Reward for false profession.")
    assert gets_point_across("See which notes the garden treats as anchors.")
    assert not gets_point_across("Integrity in general; this note is the team-visible lane.")
    assert not gets_point_across("So you change the process, not only patch today's fire.")
    assert gets_point_across("Friction kills capture.")
    assert gets_point_across("The point isn't passivity toward all evil - it's refusing to become what hurt you.")
    assert shareable_lines_overlap(
        "Ship the good-enough version live instead of polishing until the deadline owns the work.",
        "Publish the good-enough version live instead of polishing until the deadline owns the work.",
    )
    assert shareable_lines_overlap(
        "What you do matches what you claim when applause, speed, or comfort are not watching.",
        "What I do matches what I claim when applause, speed, or comfort are not watching.",
    )
    assert not shareable_lines_overlap(
        "Folders sort files; links connect ideas.",
        "Two typed links are enough for the garden to stay walkable six months later.",
    )
    assert ensure_terminal_punct("Keep the goal") == "Keep the goal."
    assert bible_verse_ref_in_text("Romans 12:1 shape of obedience") == "Romans 12:1"
    assert bible_verse_ref_in_text("Galatians tender regard") is None
    assert bible_verse_ref_in_text("Mark three sections - explain aloud") is None
    assert "wide verse range" in bible_ref_scope_issues("see John 17:1-26 for context")[0]
    assert not bible_ref_scope_issues("John 17:11-23 prayer")
    assert any("chapter-only" in i for i in bible_ref_scope_issues("read Matthew 5"))
    assert not bible_ref_scope_issues("Matthew 5:38-42")
    assert not bible_ref_scope_issues('{{< bible ref="John 17:1-26" >}}')
    assert front_has_clear_question("Mid-commute spark. What's the move?")
    assert not front_has_clear_question("Mid-commute spark I might forget.")
    assert is_multiple_choice_front("Inbox or organize on the spot?")
    assert append_flashcard_hint_question("Gate broken three weeks.", "Name the owner.").endswith(
        "First fix?"
    )
    meta = {"description": "A test note.", "key_concept": "Claim here."}
    prose = note_prose_text(meta, "")
    assert "A test note." in prose and "Claim here." in prose
    kc = (
        "- Claim punch.\n"
        "- Level 1: Definition text.\n"
        "- Level 2: Explanation text.\n"
        "- Stack bullet.\n"
    )
    cleaned, levels = extract_levels_from_key_concept(kc)
    assert "Level 1" not in cleaned
    assert levels["level_1"] == "Definition text."
    assert levels["level_2"] == "Explanation text."
    assert "Stack bullet" in cleaned
    assembled = format_key_concept_section(
        {
            "key_concept": "- Claim punch.\n- Stack bullet.",
            "level_1": "Definition text.",
            "level_2": "Explanation text.",
            "level_3": "Application text.",
            "level_4": "Systems text.",
            "level_5": "Generative text.",
        }
    )
    lines = assembled.splitlines()
    assert lines[0] == "- Claim punch."
    assert lines[1] == "- Stack bullet."
    assert lines[2] == ""
    assert lines[3] == "### Level 1 - Recognize"
    assert lines[4] == ""
    assert lines[5] == "Definition text."
    assert "### Level 5 - Create" in lines
    assert lines[-1] == "Generative text."
    assert strip_level_prefix("Level 3: Application text.", 3) == "Application text."
    assert relationship_row_errors(
        {"type": "extends", "reason": "missing link"}, 1
    ) == ["relationships[1] missing wikilink"]
    assert not relationship_row_errors(
        {"type": "extends", "wikilink": "[[By Their Fruits]]", "reason": "fruit on output"},
        0,
    )


def shareable_line_from_principle(line: str, fm: dict) -> bool:
    """True when line is a clause from description, key_concept, or levels."""
    nl = normalize_shareable_line(line)
    if not nl:
        return False
    for p in principle_line_pool(fm):
        if nl == p:
            return True
        if len(nl) >= 10 and (p.startswith(nl) or nl.startswith(p) or nl in p or p in nl):
            return True
    return False


def _flashcard_hint_self_check() -> None:
    assert front_has_clear_question("Mid-commute spark. What's the move?")
    assert not front_has_clear_question("Mid-commute spark I might forget.")
    assert is_multiple_choice_front("Inbox or organize on the spot?")
    assert append_flashcard_hint_question("Gate broken three weeks.", "Name the owner.").endswith(
        "First fix?"
    )


if __name__ == "__main__":
    _self_check()
    _flashcard_hint_self_check()
    print("notes_content self-check OK")
