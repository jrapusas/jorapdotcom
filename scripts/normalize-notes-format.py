#!/usr/bin/env python3
"""Normalize note formatting: dedupe relationships, trim examples to two."""

from __future__ import annotations

import re
import sys
from pathlib import Path
import sys
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
from site_paths import SITE_ROOT as ROOT

import yaml

from notes_content import dump_frontmatter, parse_display_fields, relationship_frontmatter_errors, split_frontmatter


NOTES = ROOT / "content/english/notes"
SKIP = {"_index.md"}
MAX_EXAMPLES = 2

REL_PRIORITY = {"contradicts": 0, "extends": 1, "implements": 2, "alternative": 3}

DOMAIN_KEYWORDS: list[tuple[str, ...]] = [
    ("faith", "church", "sermon", "prayer", "gospel", "worship", "scripture", "pastor"),
    ("parenting", "kid", "child", "son", "daughter", "bedtime", "parent", "father"),
    ("sports", "coach", "ref", "game", "court", "gym", "drill", "whistle", "player"),
    ("digital", "post", "send", "inbox", "email", "slack", "social", "thumb", "tweet"),
    ("healthcare", "clinic", "doctor", "patient", "nurse", "hospital"),
    ("commute", "jeepney", "traffic", "commute", "bus", "pickup line"),
    ("service", "customer", "shift", "restaurant", "wait time"),
    ("workplace", "meeting", "boss", "coworker", "deadline", "office"),
    ("home", "neighbor", "fridge", "parking", "condo", "yard", "chore"),
    ("school", "teacher", "classroom", "homework", "school"),
    ("safety", "incident", "near-miss", "hazard", "site", "ppe"),
    ("pkm", "note", "wikilink", "garden", "whiteboard", "bulletin board"),
]

CARD_ITEM_RE = re.compile(
    r'^\s+-\s+front:\s+"((?:[^"\\]|\\.)*)"\s*\n\s+back:\s+"((?:[^"\\]|\\.)*)"\s*$',
    re.M,
)


def load_fm(raw_fm: str) -> dict:
    data = yaml.safe_load(raw_fm) or {}
    return data if isinstance(data, dict) else {}


def parse_cards(fm: dict) -> list[tuple[str, str]]:
    cards = []
    for item in fm.get("cards") or []:
        if isinstance(item, dict) and item.get("front") and item.get("back"):
            cards.append((str(item["front"]), str(item["back"])))
    return cards


def norm(s: str) -> str:
    s = re.sub(r"\[\[([^\]]+)\]\]", r"LINK", s.lower())
    return re.sub(r"\s+", " ", s).strip()


def is_card_echo(text: str, cards: list[tuple[str, str]]) -> bool:
    ntext = norm(text)
    for front, back in cards:
        nfront, nback = norm(front), norm(back)
        combo = f"{nfront} - {nback}"
        if ntext == combo:
            return True
        if nfront in ntext and ntext.endswith(nback) and len(ntext) < len(combo) + 30:
            return True
        if ntext.startswith(nfront[: min(40, len(nfront))]) and nback in ntext:
            if len(ntext) < len(nfront) + len(nback) + 25:
                return True
    return False


def bullet_domains(text: str) -> set[str]:
    lower = text.lower()
    found = {row[0] for row in DOMAIN_KEYWORDS if any(k in lower for k in row[1:])}
    return found or {"general"}


def domain_distance(a: set[str], b: set[str]) -> int:
    return len(a ^ b)


def pick_diverse_two(bullets: list[str]) -> list[str]:
    if len(bullets) <= MAX_EXAMPLES:
        return bullets
    domains = [bullet_domains(b) for b in bullets]
    first = 0
    best_j = 1
    best_dist = domain_distance(domains[first], domains[1])
    for j in range(2, len(bullets)):
        dist = domain_distance(domains[first], domains[j])
        if dist > best_dist:
            best_dist = dist
            best_j = j
    return [bullets[first], bullets[best_j]]


def dedupe_examples(fm: dict, cards: list[tuple[str, str]]) -> tuple[dict, int]:
    examples = fm.get("examples")
    if not isinstance(examples, list):
        return fm, 0

    bullets: list[str] = []
    removed = 0
    seen: set[str] = set()
    for item in examples:
        if not isinstance(item, str):
            continue
        text = item.strip()
        if not text:
            continue
        key = norm(text)
        if key in seen:
            removed += 1
            continue
        if cards and is_card_echo(text, cards):
            removed += 1
            continue
        seen.add(key)
        bullets.append(text)

    trimmed = pick_diverse_two(bullets)
    removed += max(0, len(bullets) - len(trimmed))
    if trimmed != examples:
        fm["examples"] = trimmed
    return fm, removed


def dedupe_relationships(fm: dict) -> tuple[dict, int]:
    rels = fm.get("relationships")
    if not isinstance(rels, list):
        return fm, 0

    best: dict[str, dict[str, str]] = {}
    removed = 0
    for item in rels:
        if not isinstance(item, dict):
            continue
        typ = str(item.get("type", "")).strip()
        wikilink = str(item.get("wikilink", "")).strip()
        reason = str(item.get("reason", "")).strip()
        link_key = wikilink.lower()
        row = {"type": typ, "wikilink": wikilink, "reason": reason}
        if link_key not in best:
            best[link_key] = row
            continue
        removed += 1
        old = best[link_key]
        old_pri = REL_PRIORITY.get(old["type"], 99)
        new_pri = REL_PRIORITY.get(typ, 99)
        if new_pri < old_pri or (new_pri == old_pri and len(reason) > len(old["reason"])):
            best[link_key] = row

    rows = sorted(best.values(), key=lambda r: (r["type"].lower(), r["wikilink"].lower()))
    if rows != rels:
        fm["relationships"] = rows
    return fm, removed


def normalize_file(path: Path, dry_run: bool = False) -> list[str]:
    changes: list[str] = []
    raw = path.read_text(encoding="utf-8")
    fixed = raw.replace("\u2014", "-").replace("\u2013", "-")

    raw_fm, body = split_frontmatter(fixed)
    if not raw_fm:
        if not fixed.endswith("\n"):
            fixed += "\n"
            changes.append("trailing newline")
        if fixed != raw and not dry_run:
            path.write_text(fixed, encoding="utf-8")
        return changes

    fm = load_fm(raw_fm)
    cards = parse_cards(fm)

    fm, removed = dedupe_examples(fm, cards)
    if removed:
        changes.append(f"trimmed {removed} example(s)")

    fm, rel_removed = dedupe_relationships(fm)
    if rel_removed:
        changes.append(f"removed {rel_removed} duplicate relationship(s)")

    body = body.lstrip("\n")
    if body:
        body = "\n" + body

    out = f"---\n{dump_frontmatter(fm)}\n---{body}"
    if not out.endswith("\n"):
        out += "\n"
        changes.append("trailing newline")

    if out != raw:
        if not dry_run:
            path.write_text(out, encoding="utf-8")
        if not changes:
            changes.append("format normalized")
    return changes


def verify_notes() -> int:
    """ponytail: one runnable check - fails if duplicates or >2 examples remain."""
    bad = 0
    for path in sorted(NOTES.glob("*.md")):
        if path.name in SKIP:
            continue
        fm = load_fm(split_frontmatter(path.read_text(encoding="utf-8"))[0])
        examples = fm.get("examples")
        if isinstance(examples, list):
            bullets = [x for x in examples if isinstance(x, str) and x.strip()]
            if len(bullets) > MAX_EXAMPLES:
                print(f"FAIL examples {path.name}: {len(bullets)}")
                bad += 1
        rels = fm.get("relationships")
        if isinstance(rels, list):
            raw_fm, _ = split_frontmatter(path.read_text(encoding="utf-8"))
            for msg in relationship_frontmatter_errors(parse_display_fields(raw_fm)):
                print(f"FAIL {msg} {path.name}")
                bad += 1
            rows = [(r.get("type", ""), r.get("wikilink", "")) for r in rels if isinstance(r, dict)]
            sorted_rows = sorted(rows, key=lambda r: (r[0].lower(), r[1].lower()))
            if rows != sorted_rows:
                print(f"FAIL unsorted rel {path.name}")
                bad += 1
            seen: set[str] = set()
            for row in rows:
                key = row[1].strip().lower()
                if key in seen:
                    print(f"FAIL duplicate rel {path.name}: {row[1]}")
                    bad += 1
                seen.add(key)
    return bad


def main() -> int:
    if "--verify" in sys.argv:
        return 1 if verify_notes() else 0

    dry_run = "--check" in sys.argv
    total_changes = 0
    touched = 0

    for path in sorted(NOTES.glob("*.md")):
        if path.name in SKIP:
            continue
        changes = normalize_file(path, dry_run=dry_run)
        if changes:
            touched += 1
            total_changes += len(changes)
            print(f"{'[check] ' if dry_run else ''}{path.name}: {', '.join(changes)}")

    mode = "would update" if dry_run else "updated"
    print(f"\n{mode} {touched} files ({total_changes} fixes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
