#!/usr/bin/env python3
"""STE-flavored mechanical slop score — violations per 100 words (lower is cleaner)."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
import sys
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
from site_paths import SITE_ROOT as ROOT, resolve_content_file

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore[assignment]

from notes_content import note_prose_text, split_frontmatter


NOTES_DIR = ROOT / "content/english/notes"

# ponytail: heuristic subset of ASD-STE100 / ste-lint.py — not a certified STE checker
PHRASAL = (
    "spin up",
    "spin down",
    "reach out",
    "dive into",
    "dives into",
    "diving into",
    "kick off",
    "kicks off",
    "roll out",
    "rolls out",
    "tear down",
    "ramp up",
    "circle back",
    "drill down",
    "spun up",
    "reaching out",
)
BE = r"(?:am|is|are|was|were|be|been|being)"
PP_IRREG = (
    "done|made|sent|read|built|kept|held|set|put|run|written|shown|given|taken|"
    "found|got|gotten|seen|known|thrown|drawn"
)
# ponytail: bureaucratic noun piles only — not "satisfaction of" / "fraction of"
SLOP_NOMINAL_OF = (
    "analysis of",
    "implementation of",
    "utilization of",
    "evaluation of",
    "optimization of",
    "integration of",
    "deployment of",
    "management of",
    "consideration of",
    "application of",
    "establishment of",
    "maintenance of",
    "preparation of",
    "presentation of",
    "assessment of",
    "examination of",
    "identification of",
    "facilitation of",
    "configuration of",
)
LONG_SENTENCE_WORDS = 25
LONG_SENTENCE_RATIO = 0.30
# ponytail: bureaucratic perform/carry-out only — not faith "perform virtue" or link-type "carry out"
PERFORM_BUREAU = re.compile(r"\bperform(?:s|ed)?\s+(?:an?|the)\s+\w+", re.I)
CARRY_OUT_BUREAU = re.compile(
    r"\bcarry(?:s)?\s+out\s+(?:an?|the)\s+(?:analysis|evaluation|implementation|assessment|examination|study|review|audit|test|plan|program|project|initiative)\b",
    re.I,
)
# ponytail: idiomatic passives, not committee slop — skip before counting
PASSIVE_SKIP = re.compile(
    r"\b(?:was named|is set up|are set up|is buried|are buried|is geared|"
    r"what was typed|have(?:n't| not) been touched|is built for|can be \w+ed|"
    r"won't be buried|be advertised|is plugged|are done|is done|is crowded|"
    r"are tied to|is paywalled|is rented|are commented|being \w+|"
    r"hadn't been updated|haven't been updated|been logged into|was hired to|"
    r"is excited|is polished|is balanced|is concentrated|is tuned|are marked|"
    r"to be done|"
    r"is owed|are owed|are factored|were linked|when the bar is red|"
    r"is programmed|is measured|were entrusted|was used|were wronged|been wronged|"
    r"is unmetered|be humbled|be exalted|be seen|be comforted|be satisfied|be called|"
    r"was settled|is settled|is declared|am tempted|was given|was tired|are headed|"
    r"was made|am saved|was moved|is isolated|is stranded|are connected|"
    r"is received|is built|be transformed|be reconciled|are excluded|are included|"
    r"is renewed|are saved|is typed|Is Borrowed|Is Written|be treated|are borrowed|"
    r"is entrusted|was arrested)\b",
    re.I,
)


def _count_passive_voice(text: str) -> int:
    cleaned = PASSIVE_SKIP.sub(" ", text)
    return len(re.findall(rf"\b{BE}\s+(?:\w+ed|{PP_IRREG})\b", cleaned, re.I))


def strip_code(text: str) -> str:
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"`[^`]*`", " ", text)
    return text


def sentences(text: str) -> list[str]:
    out: list[str] = []
    for line in text.split("\n"):
        s = line.strip()
        if not s:
            continue
        s = re.sub(r"^\s*#{1,6}\s*", "", s)
        s = re.sub(r"^\s*(?:[-*+]|\d+[.)])\s+", "", s)
        if not s:
            continue
        parts = re.split(r"(?<=[.!?:])\s+(?=[A-Z0-9\"'\-])", s)
        for part in parts:
            part = part.strip()
            if part:
                out.append(part)
    return out


def word_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z0-9][A-Za-z0-9'\-/]*", text))


def count_ci(text: str, phrases: tuple[str, ...]) -> tuple[int, list[str]]:
    hits: list[str] = []
    total = 0
    for phrase in phrases:
        pat = re.compile(rf"(?<!\w){re.escape(phrase)}(?!\w)", re.I)
        for match in pat.finditer(text):
            total += 1
            hits.append(phrase)
    return total, hits


def analyze_text(raw: str) -> dict:
    text = strip_code(raw)
    sents = sentences(text)
    words = word_count(text)
    if words == 0:
        return {
            "words": 0,
            "sentences": 0,
            "violations": {},
            "total": 0,
            "total_per100w": 0.0,
            "long_sentence_ratio": 0.0,
        }

    longs = [(word_count(s), s) for s in sents if word_count(s) > LONG_SENTENCE_WORDS]
    long_ratio = len(longs) / len(sents) if sents else 0.0
    # ponytail: ratio warn needs enough sentences — one long example ≠ 100% slop
    ratio_warn = len(sents) >= 4 and long_ratio > LONG_SENTENCE_RATIO

    violations: dict[str, int] = {
        f"long_sentence(>{LONG_SENTENCE_WORDS}w)": len(longs),
        "passive_voice": _count_passive_voice(text),
        "ing_main_verb": len(re.findall(rf"\b{BE}\s+\w+ing\b", text, re.I)),
        "nominalization": len(PERFORM_BUREAU.findall(text))
        + len(CARRY_OUT_BUREAU.findall(text))
        + len(
            re.findall(
                r"\b(?:conduct(?:s|ed)?|provide(?:s|d)?|make use of|makes use of)\b",
                text,
                re.I,
            )
        )
        + sum(len(re.findall(re.escape(p), text, re.I)) for p in SLOP_NOMINAL_OF),
    }
    phrasal_count, phrasal_hits = count_ci(text, PHRASAL)
    violations["phrasal_verb"] = phrasal_count

    total = sum(violations.values())
    per100 = {k: round(v * 100.0 / words, 2) for k, v in violations.items()}

    return {
        "words": words,
        "sentences": len(sents),
        "violations": violations,
        "total": total,
        "total_per100w": round(total * 100.0 / words, 2),
        "long_sentence_ratio": round(long_ratio, 3),
        "long_sentence_ratio_warn": ratio_warn,
        "sample_phrasal": list(dict.fromkeys(phrasal_hits))[:6],
        "longest_sentence_words": max((wc for wc, _ in longs), default=0),
    }


def mechanical_flags(result: dict, *, passive_min: int = 2) -> list[tuple[str, str]]:
    """Return (rule_id, detail) pairs for slop-lint warn integration."""
    flags: list[tuple[str, str]] = []
    v = result["violations"]
    if v.get("nominalization", 0) > 0:
        flags.append(("nominalization", "verb pile — analyze the log, not perform an analysis of"))
    if v.get("passive_voice", 0) >= passive_min:
        flags.append(("passive-voice", "name the actor when you know who did it"))
    if v.get("phrasal_verb", 0) > 0:
        sample = ", ".join(result.get("sample_phrasal", [])[:3])
        detail = "plain verb — dive into → read, spin up → start"
        if sample:
            detail += f" ({sample})"
        flags.append(("phrasal-verb", detail))
    if result.get("long_sentence_ratio_warn"):
        pct = int(result["long_sentence_ratio"] * 100)
        flags.append(
            (
                "long-sentences",
                f"{pct}% of sentences exceed {LONG_SENTENCE_WORDS} words — vary length or split",
            )
        )
    return flags


def _is_note_path(path: Path) -> bool:
    try:
        path.resolve().relative_to(NOTES_DIR.resolve())
        return True
    except ValueError:
        return False


def scoreable_text(path: Path, raw: str, *, body_only: bool = False) -> str:
    """Blog: body after frontmatter. Garden notes: frontmatter prose fields + body."""
    if body_only or not _is_note_path(path):
        if raw.startswith("---"):
            end = raw.find("\n---", 3)
            if end != -1:
                return raw[end + 4 :]
        return raw
    if not raw.startswith("---"):
        return raw
    if yaml is None:
        sys.exit("pip install pyyaml required for note slop-score")
    fm, body = split_frontmatter(raw)
    meta = yaml.safe_load(fm) or {}
    return note_prose_text(meta, body)


def _self_check() -> None:
    clean = analyze_text("I read the log. It failed on line three.")
    assert clean["total"] == 0

    assert count_ci("Hard-to-reach outlets are fine.", ("reach out",))[0] == 0
    assert _count_passive_voice("block_setup() was named first.") == 0
    assert _count_passive_voice("an engineer is excited") == 0
    assert _count_passive_voice("The parser read the file.") == 0

    sloppy = analyze_text(
        "An analysis of the log was performed by the parser. "
        "It is important to dive into the details. "
        "Furthermore, a comprehensive evaluation of the configuration was conducted."
    )
    assert sloppy["violations"]["nominalization"] >= 1
    faith_plain = analyze_text("Do not perform virtue for the crowd - carry out, or swap ideas.")
    assert faith_plain["violations"]["nominalization"] == 0
    assert sloppy["violations"]["passive_voice"] >= 1
    assert sloppy["violations"]["phrasal_verb"] >= 1

    long_body = " ".join(["word"] * 30) + "."
    ratio = analyze_text((long_body + " Short. ") * 4)
    assert ratio["long_sentence_ratio_warn"]

    note_path = NOTES_DIR / "capture.md"
    if note_path.is_file():
        raw = note_path.read_text(encoding="utf-8")
        prose = scoreable_text(note_path, raw)
        body_only = scoreable_text(note_path, raw, body_only=True)
        assert word_count(prose) > word_count(body_only)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="*", help="Markdown files to score")
    parser.add_argument("--json", action="store_true", help="Full JSON per file")
    parser.add_argument(
        "--body-only",
        action="store_true",
        help="Score markdown body only (skip note frontmatter prose)",
    )
    parser.add_argument("--self-check", action="store_true")
    args = parser.parse_args()

    if args.self_check:
        _self_check()
        print("slop-score self-check OK")
        return 0

    if not args.files:
        result = analyze_text(sys.stdin.read())
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(
                f"words={result['words']:4d} total={result['total']:3d} "
                f"per100w={result['total_per100w']:6.2f}"
            )
        return 0

    exit_code = 0
    for path_str in args.files:
        path = resolve_content_file(path_str)
        if path is None:
            print(f"slop-score: missing file {path_str}", file=sys.stderr)
            exit_code = 1
            continue
        text = path.read_text(encoding="utf-8")
        text = scoreable_text(path, text, body_only=args.body_only)
        result = analyze_text(text)
        if args.json:
            payload = {"file": str(path), **result}
            print(json.dumps(payload, indent=2))
        else:
            print(
                f"{path.name:40} words={result['words']:4d} "
                f"total={result['total']:3d} per100w={result['total_per100w']:6.2f}"
            )
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
