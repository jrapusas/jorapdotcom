"""Shared OKF v0.2 bundle helpers for notes and blog exports."""

from __future__ import annotations

import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
import sys
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
from site_paths import SITE_ROOT as ROOT

from notes_content import parse_scalar, split_frontmatter_parts as split_frontmatter


HUGO_TOML = ROOT / "hugo.toml"
OKF_VERSION = "0.2"
BASEURL_RE = re.compile(r'^baseURL\s*=\s*"([^"]+)"', re.M)


def read_base_url() -> str:
    if not HUGO_TOML.exists():
        return "https://www.jorap.com/"
    text = HUGO_TOML.read_text(encoding="utf-8")
    match = BASEURL_RE.search(text)
    if not match:
        return "https://www.jorap.com/"
    return match.group(1).rstrip("/") + "/"


def yaml_frontmatter(fields: dict[str, object]) -> str:
    lines = ["---"]
    for key, value in fields.items():
        if value is None or value == "":
            continue
        if isinstance(value, dict):
            pairs = ", ".join(f"{k}: {v}" for k, v in value.items() if v)
            lines.append(f"{key}: {{ {pairs} }}")
            continue
        if isinstance(value, list):
            if not value:
                continue
            quoted = ", ".join(f'"{item}"' for item in value)
            lines.append(f"{key}: [{quoted}]")
        else:
            text = str(value)
            if re.search(r'[:#\[\]{}&,*!|>\'"%@`]', text):
                lines.append(f'{key}: "{text}"')
            else:
                lines.append(f"{key}: {text}")
    lines.append("---")
    return "\n".join(lines) + "\n"


def clear_bundle_dir(out_dir: Path) -> None:
    if out_dir.exists():
        for path in sorted(out_dir.rglob("*"), reverse=True):
            if path.is_file():
                path.unlink()
        for path in sorted(out_dir.rglob("*"), reverse=True):
            if path.is_dir():
                path.rmdir()
    out_dir.mkdir(parents=True, exist_ok=True)


def write_update_log(out_dir: Path, *, git_subpath: str, export_message: str) -> None:
    try:
        proc = subprocess.run(
            [
                "git",
                "log",
                "--since=120 days ago",
                "--pretty=format:%ad|%s",
                "--date=short",
                "--",
                git_subpath,
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=False,
        )
    except OSError:
        proc = None

    grouped: dict[str, list[str]] = {}
    if proc and proc.returncode == 0:
        for line in proc.stdout.splitlines():
            if "|" not in line:
                continue
            day, subject = line.split("|", 1)
            grouped.setdefault(day, []).append(subject.strip())

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    lines = ["# Directory Update Log", ""]
    if today not in grouped:
        lines.extend([f"## {today}", f"* **Export**: {export_message}", ""])

    for day in sorted(grouped.keys(), reverse=True):
        lines.append(f"## {day}")
        if day == today:
            lines.append(f"* **Export**: {export_message}")
        for subject in grouped[day][:12]:
            lines.append(f"* **Update**: {subject}")
        lines.append("")

    (out_dir / "log.md").write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def validate_bundle(out_dir: Path) -> list[str]:
    errors: list[str] = []
    for path in sorted(out_dir.rglob("*.md")):
        rel = path.relative_to(out_dir).as_posix()
        text = path.read_text(encoding="utf-8")

        if rel == "index.md":
            if not text.startswith("---"):
                errors.append(f"{rel}: bundle root index.md must have frontmatter with okf_version")
                continue
            if f'okf_version: "{OKF_VERSION}"' not in text and f"okf_version: '{OKF_VERSION}'" not in text:
                errors.append(f'{rel}: missing okf_version: "{OKF_VERSION}"')
            continue

        if rel == "log.md" or rel.endswith("/index.md"):
            if text.startswith("---"):
                errors.append(f"{rel}: OKF index/log files must not use concept frontmatter")
            continue

        _, inner, _ = split_frontmatter(text)
        if not inner:
            errors.append(f"{rel}: missing YAML frontmatter")
            continue
        if not parse_scalar(inner, "type"):
            errors.append(f"{rel}: missing required type field")

    return errors


def _self_check() -> None:
    fm = yaml_frontmatter({"type": "Test", "title": "Hello: world"})
    assert 'title: "Hello: world"' in fm
    generated = yaml_frontmatter({"generated": {"by": "process:test", "at": "2026-07-26T00:00:00Z"}})
    assert "generated: { by: process:test, at: 2026-07-26T00:00:00Z }" in generated
    assert validate_bundle  # imported


if __name__ == "__main__":
    _self_check()
    print("okf_bundle self-check OK")
