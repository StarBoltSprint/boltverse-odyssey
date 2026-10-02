#!/usr/bin/env python3
"""Cite the owner's local X decrees that match a step spec.

  python3 tools/decrees/brief.py --spec <step.md> --step <step-dir>
  python3 tools/decrees/brief.py --spec <step.md> --step <step-dir> --kit howling-eclipse

Default decrees file: decrees/decrees.jsonl. Override with --decrees.
That file is local. It is not committed when it is absent. A missing file
still writes a brief and exits 0.

Exit 0 when the brief is written. Exit 2 when the spec is missing.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

DEFAULT_DECREES = ROOT / "decrees" / "decrees.jsonl"
STOP = {
    "about",
    "after",
    "again",
    "also",
    "and",
    "before",
    "biome",
    "each",
    "file",
    "from",
    "have",
    "into",
    "must",
    "only",
    "over",
    "plate",
    "step",
    "that",
    "than",
    "the",
    "their",
    "them",
    "then",
    "this",
    "using",
    "with",
    "your",
    "zone",
}
WORD = re.compile(r"[a-z0-9]{4,}")


def keywords(text: str) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for token in WORD.findall(text.casefold()):
        if token in STOP or token in seen:
            continue
        seen.add(token)
        found.append(token)
    return found


def load_decrees(path: Path) -> tuple[list[dict], list[str]]:
    rows = []
    notes = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        text = line.strip()
        if not text:
            continue
        try:
            obj = json.loads(text)
        except json.JSONDecodeError:
            notes.append(f"line {number} is not JSON")
            continue
        if not isinstance(obj, dict):
            notes.append(f"line {number} is not an object")
            continue
        post_id = obj.get("id") or obj.get("post_id") or obj.get("postId")
        date = obj.get("date") or obj.get("posted_at") or obj.get("created_at") or ""
        quote = obj.get("text") or obj.get("quote") or ""
        if not post_id or not isinstance(quote, str):
            notes.append(f"line {number} has no id or text")
            continue
        rows.append({"id": str(post_id), "date": str(date), "text": quote})
    return rows, notes


def rank(rows: list[dict], words: list[str], top: int) -> list[dict]:
    scored = []
    for row in rows:
        hay = row["text"].casefold()
        hits = [word for word in words if word.casefold() in hay]
        if not hits:
            continue
        scored.append({**row, "hits": hits, "score": len(hits)})
    scored.sort(key=lambda row: (-row["score"], row["date"], row["id"]), reverse=False)
    # date descending on a tie: sort is stable if we sort score first then date desc
    scored.sort(key=lambda row: (-row["score"], tuple(-ord(ch) for ch in row["date"]), row["id"]))
    return scored[:top]


def quote_of(text: str, limit: int = 240) -> str:
    flat = re.sub(r"\s+", " ", text).strip()
    if len(flat) <= limit:
        return flat
    return flat[: limit - 1].rstrip() + "…"


def render(spec: Path, decrees: Path, present: bool, words: list[str], matches: list[dict], notes: list[str]) -> str:
    lines = [
        "# Decree brief",
        "",
        f"Spec: `{spec}`",
        f"Decrees: `{decrees}`",
        f"Keywords: {', '.join(words) if words else '(none)'}",
        "",
    ]
    if not present:
        lines.append("No local decrees file. Nothing was invented.")
        lines.append("")
    if notes:
        lines.append("Skipped lines: " + "; ".join(notes))
        lines.append("")
    if not matches:
        lines.append("No decree matched these keywords.")
        lines.append("")
    else:
        lines.append("## Matches")
        lines.append("")
        for index, row in enumerate(matches, start=1):
            lines.append(f"### {index}. post {row['id']} — {row['date']}")
            lines.append("")
            lines.append(f"> {quote_of(row['text'])}")
            lines.append("")
            lines.append("Matched: " + ", ".join(row["hits"]))
            lines.append("")
    return "\n".join(lines)


def write_brief(
    spec: Path,
    step: Path,
    decrees: Path,
    top: int,
    extra: list[str],
) -> tuple[Path, int]:
    text = spec.read_text(encoding="utf-8")
    words = keywords(text)
    for hook in extra:
        token = hook.strip().casefold()
        if token and token not in words:
            words.append(token)
    notes: list[str] = []
    rows: list[dict] = []
    present = decrees.is_file()
    if present:
        rows, notes = load_decrees(decrees)
    matches = rank(rows, words, top) if present else []
    step.mkdir(parents=True, exist_ok=True)
    dest = step / "decree-brief.md"
    dest.write_text(render(spec, decrees, present, words, matches, notes), encoding="utf-8")
    return dest, len(matches)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Write a decree brief for one step")
    parser.add_argument("--spec", type=Path, required=True)
    parser.add_argument("--step", type=Path, required=True)
    parser.add_argument("--decrees", type=Path, default=DEFAULT_DECREES)
    parser.add_argument("--top", type=int, default=5)
    parser.add_argument("--kit", default="")
    parser.add_argument("--hooks", action="append", default=None)
    args = parser.parse_args(argv)
    if not args.spec.is_file():
        print(f"FAIL decrees: spec missing: {args.spec}", file=sys.stderr)
        return 2
    if args.top < 1 or args.top > 20:
        print("FAIL decrees: --top must be 1..20", file=sys.stderr)
        return 2
    extra = list(args.hooks or [])
    if args.kit:
        from tools.kits.kit import hooks_for

        try:
            extra.extend(hooks_for(args.kit))
        except FileNotFoundError:
            print(f"FAIL decrees: unknown kit {args.kit}", file=sys.stderr)
            return 2
    dest, count = write_brief(args.spec, args.step, args.decrees, args.top, extra)
    state = "present" if args.decrees.is_file() else "absent"
    print(f"PASS decrees file={state} matches={count} brief={dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
