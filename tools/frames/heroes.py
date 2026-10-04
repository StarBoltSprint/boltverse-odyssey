"""Brief versus proof shots.

A brief that names nothing under `## Must show` or `## Heroes` is n/a.
A named element must have a box in shows.json, and that crop must not be flat
or empty. This module does not guess what a picture depicts.
"""

from __future__ import annotations

import json
import re

from pixels import crop_stats

_HEAD = re.compile(r"^##\s+(Must show|Heroes)\b", re.I)
_H2 = re.compile(r"^##\s+")
_ITEM = re.compile(r"^\s*[-*]\s+(.+?)\s*$")


def parse_must_show(text: str) -> list[str]:
    items = []
    on = False
    for line in text.splitlines():
        if _H2.match(line):
            if on:
                break
            on = bool(_HEAD.match(line))
            continue
        if not on:
            continue
        found = _ITEM.match(line)
        if found:
            items.append(found.group(1).strip())
    return items


def _lookup(shows: dict, name: str):
    want = name.casefold()
    if name in shows:
        return name, shows[name]
    for key, value in shows.items():
        if str(key).casefold() == want:
            return key, value
    for key, value in shows.items():
        if want in str(key).casefold() or str(key).casefold() in want:
            return key, value
    return None, None


def check_heroes(brief_text: str, shows: dict, images: dict) -> dict:
    """images maps a shot name to an RGB array. shows maps an element to {shot, box}."""
    items = parse_must_show(brief_text or "")
    if not items:
        return {
            "result": "n/a",
            "rows": [],
            "reason": "brief names no hero elements under Must show or Heroes",
        }
    rows = []
    for name in items:
        key, spec = _lookup(shows or {}, name)
        if spec is None:
            rows.append({"element": name, "result": "FAIL", "reason": "no box in shows.json"})
            continue
        shot = spec.get("shot")
        box = spec.get("box")
        if shot not in images or not box:
            rows.append({"element": name, "result": "FAIL", "reason": f"shot {shot} was not loaded"})
            continue
        stats = crop_stats(images[shot], box)
        result = "PASS" if stats["visible"] else "FAIL"
        rows.append(
            {
                "element": name,
                "result": result,
                "shot": shot,
                "box": list(box),
                "reason": stats["reason"],
                "std": stats["std"],
                "mean": stats["mean"],
                "matched": key,
            }
        )
    failed = any(row["result"] == "FAIL" for row in rows)
    return {"result": "FAIL" if failed else "PASS", "rows": rows, "reason": None}


def load_shows(path: str) -> dict:
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
    if isinstance(data, dict) and "shows" in data and isinstance(data["shows"], dict):
        return data["shows"]
    return data
