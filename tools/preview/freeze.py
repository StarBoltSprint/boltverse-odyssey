#!/usr/bin/env python3
"""Freeze a zone play page after a step's gates pass.

Copies the play tree into previews/<zone>/<commit>/, points latest at that
commit, and rewrites a phone index of every frozen step. Local files only.
This command does not open a tunnel, bind a public interface, or deploy.

  python3 tools/preview/freeze.py \
    --zone zone-a \
    --commit <sha> \
    --report <step>/REPORT.md \
    --play-dir <play> \
    --walk <step>/playcheck/walk.mp4 \
    --out previews

Exit 0 when the copy and the index are written. Exit 1 when the report
is not PASS or the play tree is missing. Exit 2 on a bad invocation.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

COMMIT_RE = re.compile(r"^[0-9a-f]{7,40}$")
ZONE_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
VERDICT_RE = re.compile(r"verdict\s*[:=]\s*(PASS|FAIL|WARN|INCOMPLETE)\b", re.I)
DATE_RE = re.compile(r"\bdate\s*[:=]\s*(\d{4}-\d{2}-\d{2})\b", re.I)
PASS = "PASS"


def fail(msg: str, code: int = 1) -> int:
    print(f"FAIL preview: {msg}", file=sys.stderr)
    return code


def parse_report(path: Path) -> tuple[str | None, str | None]:
    if path.suffix.lower() == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        verdict = data.get("verdict") or data.get("ok")
        if verdict is True:
            verdict = "PASS"
        if verdict is False:
            verdict = "FAIL"
        date = data.get("date")
        return (str(verdict).upper() if verdict else None, str(date) if date else None)
    text = path.read_text(encoding="utf-8")
    found = VERDICT_RE.findall(text)
    dates = DATE_RE.findall(text)
    verdict = found[-1].upper() if found else None
    if verdict is None:
        for line in text.splitlines():
            token = line.strip().upper()
            if token in {"PASS", "FAIL", "WARN", "INCOMPLETE"}:
                verdict = token
    return verdict, (dates[-1] if dates else None)


def lock_segment(path: Path) -> bool:
    return any(part == "lock" for part in path.parts)


def copy_play(src: Path, dest: Path) -> None:
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(src, dest)


def git_date(commit: str, repo: Path) -> str | None:
    proc = subprocess.run(
        ["git", "log", "-1", "--format=%cs", commit],
        cwd=repo,
        text=True,
        capture_output=True,
    )
    if proc.returncode != 0:
        return None
    text = proc.stdout.strip()
    return text or None


def write_index(zone_dir: Path, zone: str) -> None:
    rows = []
    for child in sorted(zone_dir.iterdir()):
        meta_path = child / "meta.json"
        if not child.is_dir() or child.name == "latest" or not meta_path.is_file():
            continue
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        rows.append(meta)
    rows.sort(key=lambda row: (str(row.get("date") or ""), str(row.get("commit") or "")))
    latest = ""
    latest_path = zone_dir / "latest"
    if latest_path.is_symlink():
        latest = latest_path.resolve().name
    body = []
    for meta in rows:
        commit = html.escape(str(meta.get("commit") or ""))
        date = html.escape(str(meta.get("date") or ""))
        verdict = html.escape(str(meta.get("verdict") or ""))
        walk = meta.get("walk")
        if walk:
            href = html.escape(f"{meta['commit']}/{walk}")
            walk_cell = f'<a href="{href}">walk.mp4</a>'
        else:
            walk_cell = "none"
        play_href = html.escape(f"{meta['commit']}/play/")
        body.append(
            "<tr>"
            f"<td><a href=\"{play_href}\">{commit}</a></td>"
            f"<td>{date}</td>"
            f"<td>{verdict}</td>"
            f"<td>{walk_cell}</td>"
            "</tr>"
        )
    latest_line = html.escape(latest) if latest else "none"
    page = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(zone)} previews</title>
  <style>
    body {{ margin: 16px; font: 16px/1.4 sans-serif; background: #111; color: #eee; }}
    a {{ color: #9cf; }}
    table {{ border-collapse: collapse; width: 100%; }}
    td, th {{ border-bottom: 1px solid #333; text-align: left; padding: 8px 6px; }}
  </style>
</head>
<body>
  <h1>{html.escape(zone)}</h1>
  <p>Local phone previews. Latest: {latest_line}. A public URL is a separate owner OK.</p>
  <table>
    <tr><th>Commit</th><th>Date</th><th>REPORT</th><th>Walk</th></tr>
    {''.join(body)}
  </table>
</body>
</html>
"""
    (zone_dir / "index.html").write_text(page, encoding="utf-8")


def point_latest(zone_dir: Path, commit: str) -> None:
    link = zone_dir / "latest"
    if link.is_symlink() or link.exists():
        link.unlink()
    link.symlink_to(commit, target_is_directory=True)


def freeze(
    zone: str,
    commit: str,
    report: Path,
    play_dir: Path,
    out: Path,
    walk: Path | None,
    date: str | None,
    repo: Path,
) -> int:
    if not ZONE_RE.match(zone):
        return fail(f"zone {zone} is not a slug", 2)
    if not COMMIT_RE.match(commit):
        return fail("commit must be 7–40 hex characters", 2)
    if lock_segment(play_dir):
        return fail("play path is under lock/", 2)
    if not report.is_file():
        return fail(f"report missing: {report}", 2)
    verdict, report_date = parse_report(report)
    if verdict != PASS:
        return fail(f"REPORT verdict is {verdict or 'missing'}; freeze waits for PASS")
    if not play_dir.is_dir() or not any(play_dir.iterdir()):
        return fail(f"play directory is empty: {play_dir}")
    if walk is not None and not walk.is_file():
        return fail(f"walk missing: {walk}", 2)

    chosen = date or report_date or git_date(commit, repo) or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    zone_dir = out / zone
    version = zone_dir / commit
    play_dest = version / "play"
    zone_dir.mkdir(parents=True, exist_ok=True)
    version.mkdir(parents=True, exist_ok=True)
    copy_play(play_dir, play_dest)
    walk_name = None
    if walk is not None:
        shutil.copy2(walk, version / "walk.mp4")
        walk_name = "walk.mp4"
    meta = {
        "zone": zone,
        "commit": commit,
        "date": chosen,
        "verdict": PASS,
        "report": str(report),
        "walk": walk_name,
        "play": "play",
        "publicUrl": None,
    }
    (version / "meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    point_latest(zone_dir, commit)
    write_index(zone_dir, zone)
    print(f"PASS preview zone={zone} commit={commit} page={zone_dir / 'index.html'}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Freeze a local phone copy of a zone play page")
    parser.add_argument("--zone", required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--play-dir", type=Path, required=True)
    parser.add_argument("--walk", type=Path, default=None)
    parser.add_argument("--out", type=Path, default=Path("previews"))
    parser.add_argument("--date", default="")
    parser.add_argument("--repo", type=Path, default=Path("."))
    args = parser.parse_args(argv)
    return freeze(
        zone=args.zone,
        commit=args.commit.lower(),
        report=args.report,
        play_dir=args.play_dir,
        out=args.out,
        walk=args.walk,
        date=args.date.strip() or None,
        repo=args.repo,
    )


if __name__ == "__main__":
    sys.exit(main())
