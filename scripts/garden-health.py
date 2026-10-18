#!/usr/bin/env python3
"""Weekly garden health: lint:garden + plain-text link issues report."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
import sys
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
from site_paths import REPO_ROOT, SITE_ROOT as ROOT

ISSUES_TXT = ROOT / "public/notes/issues/index.txt"
PRE_HUGO = _SCRIPTS / "preHugo.mjs"


def run(cmd: list[str], *, cwd: Path = REPO_ROOT, quiet: bool = False) -> int:
    if not quiet:
        print(f"$ {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=cwd, check=False).returncode


def main() -> int:
    print("GARDEN HEALTH")
    print("=" * 40)

    print("\n## Lint")
    lint_failed = run(["pnpm", "lint:garden"]) != 0

    print("\n## Link issues")
    run(["node", str(PRE_HUGO)], quiet=True)
    if run(["hugo", "--quiet"], cwd=ROOT) != 0:
        print("hugo build failed", file=sys.stderr)
        return 1

    if not ISSUES_TXT.is_file():
        print(f"missing {ISSUES_TXT.relative_to(ROOT)}", file=sys.stderr)
        return 1

    body = ISSUES_TXT.read_text(encoding="utf-8").rstrip()
    print(body)
    print()

    if lint_failed:
        print("FAIL - lint:garden reported errors.", file=sys.stderr)
        return 1

    if "- 0 notes affected" not in body:
        print("WARN - link issues remain. Copy report → agent fix pass.", file=sys.stderr)
        return 2

    print("OK - garden health passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
