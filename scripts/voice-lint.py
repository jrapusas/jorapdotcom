#!/usr/bin/env python3
"""Unified voice lint: garden rules, site voice, em-dash sanitize, structural slop."""

from __future__ import annotations

import argparse
import importlib.util
import sys
from pathlib import Path
import sys
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
from site_paths import REPO_ROOT

ROOT = REPO_ROOT  # repo root for scripts/
SCRIPTS = REPO_ROOT / "scripts"


def _load(script: str):
    path = SCRIPTS / f"{script}.py"
    name = script.replace("-", "_")
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def _run(script: str, argv: list[str]) -> int:
    saved = sys.argv
    sys.argv = [script] + argv
    try:
        return int(_load(script).main())
    finally:
        sys.argv = saved


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "mode",
        choices=["garden", "site", "dashes", "slop", "score"],
        help="garden=notes frontmatter; site=voice-words; dashes=em/en dash; slop=AI structure; score=mechanical slop per 100w",
    )
    parser.add_argument("flags", nargs=argparse.REMAINDER)
    args = parser.parse_args()

    mapping = {
        "garden": "garden-voice-lint",
        "site": "notes-voice-lint",
        "dashes": "notes-voice-sanitize",
        "slop": "slop-lint",
        "score": "slop-score",
    }
    extra = args.flags
    if extra and extra[0] == "--":
        extra = extra[1:]
    return _run(mapping[args.mode], extra)


if __name__ == "__main__":
    sys.exit(main())
