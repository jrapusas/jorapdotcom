#!/usr/bin/env python3
"""Bible ref scope (fail) and Free Grace phrase warns on faith notes."""

from __future__ import annotations

import re
import sys
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
    sys.exit("pip install pyyaml required for lint-faith-garden")

from notes_content import bible_ref_scope_issues, note_prose_chunks


NOTES = ROOT / "content/english/notes"
FM = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)
SKIP_KINDS = frozenset({"meta", "index"})
SKIP_FILES = frozenset({"_index.md"})
FAITH_TAGS = frozenset(
    {"faith", "eternal principles", "christianity", "theology", "gospel", "jesus", "bible"}
)

# free-grace-audit skill — warn only; triage by hand
FAITH_PHRASE_WARNS = [
    (re.compile(r"\bworks prove faith\b", re.I), "works prove faith"),
    (re.compile(r"\breal faith shows up in obedience\b", re.I), "real faith shows up in obedience"),
    (re.compile(r"\bfruit confirms belonging\b", re.I), "fruit confirms belonging"),
    (re.compile(r"\bdead on inspection\b", re.I), "dead on inspection"),
]


@dataclass(frozen=True)
class Issue:
    path: str
    field: str
    rule: str
    detail: str = ""


def is_faith(meta: dict) -> bool:
    tags = {str(t).lower() for t in (meta.get("tags") or [])}
    cats = {str(c).lower() for c in (meta.get("categories") or [])}
    return bool(tags & FAITH_TAGS or cats & {"faith", "eternal principles"})


def scan_note(path: Path) -> list[Issue]:
    if path.name in SKIP_FILES:
        return []
    rel = str(path.relative_to(ROOT))
    text = path.read_text(encoding="utf-8")
    match = FM.match(text)
    if not match:
        return []
    meta = yaml.safe_load(match.group(1)) or {}
    if meta.get("draft") or meta.get("note_kind", "note") in SKIP_KINDS:
        return []

    body = text[match.end() :]
    issues: list[Issue] = []
    faith = is_faith(meta)

    for field, chunk in note_prose_chunks(meta, body):
        for detail in bible_ref_scope_issues(chunk):
            issues.append(Issue(rel, field, "bible-ref-scope", detail))
        if faith:
            for pattern, label in FAITH_PHRASE_WARNS:
                if pattern.search(chunk):
                    issues.append(Issue(rel, field, "faith-phrase-warn", label))

    return issues


def _self_check() -> None:
    p = Path("website/content/english/notes/x.md")
    meta = {"categories": ["Faith"], "key_concept": "read Matthew 5"}
    body = ""
    chunks = list(note_prose_chunks(meta, body))
    assert any(f == "key_concept" for f, _ in chunks)
    assert is_faith(meta)
    assert not is_faith({"categories": ["Productivity"]})


def main() -> int:
    if "--self-check" in sys.argv:
        _self_check()
        print("lint-faith-garden self-check OK")
        return 0

    issues: list[Issue] = []
    for path in sorted(NOTES.glob("*.md")):
        issues.extend(scan_note(path))

    fails = [i for i in issues if i.rule == "bible-ref-scope"]
    warns = [i for i in issues if i.rule != "bible-ref-scope"]

    # Chapter-only refs are warn on live garden (many level fields say "read John 17").
    for issue in list(fails):
        if issue.detail.startswith("chapter-only"):
            fails.remove(issue)
            warns.append(
                Issue(issue.path, issue.field, "bible-chapter-warn", issue.detail)
            )

    if "--summary" in sys.argv:
        print(f"Faith garden lint — {len(fails)} fail, {len(warns)} warn")
        return 0

    for issue in fails:
        detail = f" ({issue.detail})" if issue.detail else ""
        print(f"  {issue.path}: {issue.field}: {issue.rule}{detail}", file=sys.stderr)
    for issue in warns:
        detail = f" ({issue.detail})" if issue.detail else ""
        print(f"  WARN {issue.path}: {issue.field}: {issue.rule}{detail}", file=sys.stderr)

    if fails:
        print(f"Faith garden lint: {len(fails)} fail(s)", file=sys.stderr)
        return 1 if "--check" in sys.argv else 0

    if warns:
        print(f"Faith garden lint OK ({len(warns)} warn(s))")
    else:
        print("Faith garden lint OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
