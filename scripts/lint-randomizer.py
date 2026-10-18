#!/usr/bin/env python3
"""Validate data/randomizer.yaml - edit the YAML directly; no rebuild script."""

from __future__ import annotations

import sys
from pathlib import Path
import sys
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
from site_paths import SITE_ROOT as ROOT

try:
    import yaml
except ImportError:
    sys.exit("pip install pyyaml required for lint-randomizer")


YAML = ROOT / "data" / "randomizer.yaml"
REQUIRED_COLLECTION_KEYS = frozenset({"id", "title", "mode", "tagline"})


def validate(data: dict) -> list[str]:
    errors: list[str] = []
    collections = data.get("collections")
    if not isinstance(collections, list) or not collections:
        return ["collections: missing or empty"]

    ids: set[str] = set()
    for i, col in enumerate(collections):
        prefix = f"collections[{i}]"
        if not isinstance(col, dict):
            errors.append(f"{prefix}: not a mapping")
            continue
        missing = REQUIRED_COLLECTION_KEYS - col.keys()
        if missing:
            errors.append(f"{prefix}: missing {sorted(missing)}")
        cid = col.get("id")
        if isinstance(cid, str):
            if cid in ids:
                errors.append(f"{prefix}: duplicate id {cid!r}")
            ids.add(cid)
        mode = col.get("mode")
        if mode == "ranked-prompts":
            items = col.get("items")
            if not isinstance(items, list) or not items:
                errors.append(f"{prefix}: ranked-prompts needs non-empty items")
        elif mode == "spectrum":
            spectrums = col.get("spectrums")
            if not isinstance(spectrums, list) or not spectrums:
                errors.append(f"{prefix}: spectrum needs non-empty spectrums")
            else:
                for j, row in enumerate(spectrums):
                    if not isinstance(row, dict) or not row.get("left") or not row.get("right"):
                        errors.append(f"{prefix}.spectrums[{j}]: needs left and right")
        elif mode == "quiz":
            items = col.get("items")
            if not isinstance(items, list) or not items:
                errors.append(f"{prefix}: quiz needs non-empty items")
    return errors


def main() -> int:
    if not YAML.is_file():
        print(f"Missing {YAML.relative_to(ROOT)}", file=sys.stderr)
        return 1
    data = yaml.safe_load(YAML.read_text(encoding="utf-8")) or {}
    errors = validate(data)
    if errors:
        print("randomizer.yaml:", file=sys.stderr)
        for err in errors:
            print(f"  {err}", file=sys.stderr)
        return 1
    n = len(data.get("collections") or [])
    print(f"randomizer.yaml OK ({n} collections)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
