#!/usr/bin/env python3
"""Fixture decrees: keyword rank, kit hooks, and a missing file.

  python3 tools/decrees/selftest.py
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BRIEF = ROOT / "tools" / "decrees" / "brief.py"
FIXTURE = ROOT / "tools" / "decrees" / "fixture" / "decrees.jsonl"
SPEC = ROOT / "tools" / "decrees" / "fixture" / "spec.md"
PY = sys.executable


def fail(msg: str) -> None:
    raise SystemExit(f"FAIL selftest: {msg}")


def run(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run([PY, str(BRIEF), *args], cwd=ROOT, text=True, capture_output=True)


def test_rank() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        step = Path(tmp) / "step"
        proc = run(["--spec", str(SPEC), "--step", str(step), "--decrees", str(FIXTURE), "--top", "2"])
        if proc.returncode != 0:
            fail(proc.stderr)
        text = (step / "decree-brief.md").read_text(encoding="utf-8")
        if "post 184201" not in text or "2026-09-12" not in text:
            fail(f"top post missing:\n{text}")
        if "post 184199" not in text:
            fail("second match missing")
        if "post 184202" in text:
            fail("unrelated decree was cited")
        if "angular hull" not in text:
            fail("quote missing")
        first = text.find("post 184201")
        second = text.find("post 184199")
        if first < 0 or second < 0 or first > second:
            fail("rank order")
        if "matches=2" not in proc.stdout:
            fail(proc.stdout)


def test_kit_hooks() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        spec = Path(tmp) / "spec.md"
        spec.write_text("# Step\n\nMeasure the horizon band.\n", encoding="utf-8")
        step = Path(tmp) / "step"
        alone = run(["--spec", str(spec), "--step", str(step), "--decrees", str(FIXTURE), "--top", "5"])
        if alone.returncode != 0 or "matches=0" not in alone.stdout:
            fail(f"horizon spec should not match the fixture alone:\n{alone.stdout}")
        hooked = run(
            [
                "--spec",
                str(spec),
                "--step",
                str(step),
                "--decrees",
                str(FIXTURE),
                "--kit",
                "howling-eclipse",
                "--top",
                "5",
            ]
        )
        if hooked.returncode != 0 or "matches=0" in hooked.stdout:
            fail(f"kit hooks should add matches:\n{hooked.stdout}\n{hooked.stderr}")
        text = (step / "decree-brief.md").read_text(encoding="utf-8")
        if "post 184201" not in text:
            fail("kit hook did not cite the ship decree")


def test_absent() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        step = Path(tmp) / "step"
        missing = Path(tmp) / "no-such.jsonl"
        proc = run(["--spec", str(SPEC), "--step", str(step), "--decrees", str(missing)])
        if proc.returncode != 0 or "file=absent" not in proc.stdout:
            fail(proc.stdout + proc.stderr)
        text = (step / "decree-brief.md").read_text(encoding="utf-8")
        if "No local decrees file" not in text:
            fail(text)


def main() -> None:
    test_rank()
    test_kit_hooks()
    test_absent()
    print("PASS decrees selftest")


if __name__ == "__main__":
    main()
