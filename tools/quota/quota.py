#!/usr/bin/env python3
"""Count one Grok CLI ndjson log and append a row to learn/quota-log.md.

Turns, tool calls, image generations, video generations, tokens when the
log has them, and wall time from the first timestamp to the last.

  python3 tools/quota/quota.py --log <session.ndjson> --step <name>

Exit 0 when the row is appended. Exit 2 when the log is missing.
The file is append-only. An old row is left as it was.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = ROOT / "learn" / "quota-log.md"
HEADER = """# Quota log

Append-only. One row per step. `python3 tools/quota/quota.py` adds the row. Do not rewrite an old row. A cell is `n/a` when the log did not carry that number.

| Date | Step | Commit | Turns | Tool calls | Image gens | Video gens | Tokens in | Tokens out | Wall s | Log |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
"""

TURN_TYPES = {"turn", "assistant_turn"}
TOOL_TYPES = {"tool_call", "function_call", "tool"}
IMAGE_TYPES = {"image", "image_generation", "imagine_image"}
VIDEO_TYPES = {"video", "video_generation", "imagine_video"}
IMAGE_NAME = re.compile(r"imagine_image|image_to_image|images?\.generat|image_generat", re.I)
VIDEO_NAME = re.compile(r"imagine_video|image_to_video|video_generat|imagineClip|imagine_clip", re.I)
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}")


def event_type(obj: dict) -> str:
    for key in ("type", "event", "kind"):
        value = obj.get(key)
        if isinstance(value, str):
            return value
    return ""


def event_name(obj: dict) -> str:
    for key in ("name", "tool", "tool_name"):
        value = obj.get(key)
        if isinstance(value, str):
            return value
    return ""


def parse_time(value) -> float | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(text).timestamp()
    except ValueError:
        return None


def stamp_of(obj: dict) -> float | None:
    for key in ("ts", "timestamp", "time"):
        if key in obj:
            found = parse_time(obj.get(key))
            if found is not None:
                return found
    return None


def add_tokens(obj: dict, totals: dict) -> None:
    sources = [obj]
    usage = obj.get("usage")
    if isinstance(usage, dict):
        sources.append(usage)
    got_in = False
    got_out = False
    for source in sources:
        if not got_in:
            for key in ("input_tokens", "prompt_tokens"):
                if isinstance(source.get(key), int) and not isinstance(source.get(key), bool):
                    totals["in"] = (totals["in"] or 0) + source[key]
                    got_in = True
                    break
        if not got_out:
            for key in ("output_tokens", "completion_tokens"):
                if isinstance(source.get(key), int) and not isinstance(source.get(key), bool):
                    totals["out"] = (totals["out"] or 0) + source[key]
                    got_out = True
                    break


def parse_log(path: Path) -> dict:
    turns = 0
    tools = 0
    images = 0
    videos = 0
    assistants = 0
    tokens = {"in": None, "out": None}
    times: list[float] = []
    skipped = 0
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text:
            continue
        try:
            obj = json.loads(text)
        except json.JSONDecodeError:
            skipped += 1
            continue
        if not isinstance(obj, dict):
            skipped += 1
            continue
        kind = event_type(obj)
        name = event_name(obj)
        if kind in TURN_TYPES:
            turns += 1
        if obj.get("role") == "assistant" or (kind == "message" and obj.get("role") == "assistant"):
            assistants += 1
        if kind in TOOL_TYPES:
            tools += 1
        if kind in IMAGE_TYPES or IMAGE_NAME.search(name):
            images += 1
        if kind in VIDEO_TYPES or VIDEO_NAME.search(name):
            videos += 1
        add_tokens(obj, tokens)
        moment = stamp_of(obj)
        if moment is not None:
            times.append(moment)
    if turns == 0:
        turns = assistants
    wall: float | None
    if len(times) >= 2:
        wall = max(times) - min(times)
    elif len(times) == 1:
        wall = 0.0
    else:
        wall = None
    return {
        "turns": turns,
        "tools": tools,
        "images": images,
        "videos": videos,
        "tokens_in": tokens["in"],
        "tokens_out": tokens["out"],
        "wall_s": wall,
        "skipped": skipped,
    }


def cell(value) -> str:
    if value is None:
        return "n/a"
    if isinstance(value, float):
        return f"{value:.1f}"
    return str(value)


def append_row(out: Path, step: str, commit: str, log_name: str, date: str, counts: dict) -> None:
    if not out.is_file() or not out.read_text(encoding="utf-8").strip():
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(HEADER, encoding="utf-8")
    safe_step = step.replace("|", "/")
    row = (
        f"| {date} | {safe_step} | {commit or 'n/a'} | {counts['turns']} | {counts['tools']} | "
        f"{counts['images']} | {counts['videos']} | {cell(counts['tokens_in'])} | "
        f"{cell(counts['tokens_out'])} | {cell(counts['wall_s'])} | {log_name} |\n"
    )
    with out.open("a", encoding="utf-8") as handle:
        handle.write(row)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Append one quota row from a Grok CLI ndjson log")
    parser.add_argument("--log", type=Path, required=True)
    parser.add_argument("--step", required=True)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--commit", default="")
    parser.add_argument("--date", default="")
    args = parser.parse_args(argv)
    if not args.log.is_file():
        print(f"FAIL quota: log missing: {args.log}", file=sys.stderr)
        return 2
    counts = parse_log(args.log)
    date = args.date.strip() or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    before = args.out.read_text(encoding="utf-8") if args.out.is_file() else ""
    append_row(args.out, args.step, args.commit.strip(), args.log.name, date, counts)
    after = args.out.read_text(encoding="utf-8")
    if before and not after.startswith(before):
        print("FAIL quota: existing rows were rewritten", file=sys.stderr)
        return 1
    print(
        "PASS quota "
        f"step={args.step} turns={counts['turns']} tools={counts['tools']} "
        f"images={counts['images']} videos={counts['videos']} "
        f"tokens_in={cell(counts['tokens_in'])} tokens_out={cell(counts['tokens_out'])} "
        f"wall_s={cell(counts['wall_s'])}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
