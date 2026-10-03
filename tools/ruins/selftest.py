#!/usr/bin/env python3
"""Placement and measure checks for a built ruin kit. Does not cook images."""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _w(*parts):
    return "".join(parts)


# Assembled so the source file does not store the banned tokens.
BANNED = re.compile(
    "|".join([
        _w("vio", "let"),
        _w("indi", "go"),
        _w("mag", "enta"),
        _w("cy", "an"),
        _w("bro", "nze"),
        _w("gun", "metal"),
        _w("pal", "ette"),
        r"#[0-9a-fA-F]{3,8}\b",
        r"\b" + _w("glo", "w") + r"\b",
        r"\b" + _w("nig", "ht") + r"\b",
    ]),
    re.I,
)


def fail(msg):
    print("FAIL", msg)
    return 1


def main():
    kit = "howling-eclipse"
    if len(sys.argv) > 1 and sys.argv[1] == "--kit":
        kit = sys.argv[2]
    num_path = Path(__file__).resolve().parent / "numbers" / (kit + ".json")
    numbers = json.loads(num_path.read_text())
    pack = ROOT / numbers["pack"] / "src" / "ruins"
    manifest = json.loads((pack / "manifest.json").read_text())
    measure = json.loads((pack / "measure.json").read_text())
    problems = []
    ids = [o["id"] for o in manifest["objects"]]
    if ids != ["gate", "wreck"]:
        problems.append("objects " + str(ids))
    focal = float(numbers["focalPx"])
    for obj in manifest["objects"]:
        approach = focal / float(obj["texelsPerM"])
        if abs(approach - float(obj["minApproachM"])) > 0.05:
            problems.append(obj["id"] + " approach")
        keep = float(obj["horizRadiusM"]) + float(obj["minApproachM"])
        if abs(keep - float(obj["keepRadiusM"])) > 0.05:
            problems.append(obj["id"] + " keep")
        mesh = ROOT / obj["mesh"]
        if not mesh.is_file() or mesh.stat().st_size > 20 * 1024 * 1024:
            problems.append(obj["id"] + " mesh size")
        if mesh.read_bytes()[:4] != b"RUIN":
            problems.append(obj["id"] + " magic")
        for skin in obj["skins"]:
            path = ROOT / skin
            if not path.is_file():
                problems.append("missing " + skin)
            sib = path.with_suffix(".PROMPT.txt")
            if not sib.is_file():
                problems.append("missing prompt sibling " + sib.name)
    if not measure["gate"].get("openingClear"):
        problems.append("opening blocked")
    if measure["gate"].get("holeCount", 0) < 1:
        problems.append("no opening")
    if measure["gate"].get("pierProfileMae", 0) < 0.03:
        problems.append("piers look the same")
    if not measure["wreck"].get("howlPass"):
        problems.append("howl report missing")
    hole = measure["wreck"].get("hole") or []
    if len(hole) < 5 or hole[4] < 10:
        problems.append("wreck hole")
    if measure["wreck"].get("skinNacelles") not in (0, None):
        problems.append("nacelles still painted")
    part_ids = [p["id"] for p in measure["gateParts"] + measure["wreckParts"]]
    if len(part_ids) != len(set(part_ids)):
        problems.append("duplicate part ids")
    # Scan the generator and the pack text. Skins are images.
    roots = [
        Path(__file__).resolve().parent,
        pack,
        ROOT / "packs" / "zone-a" / "play" / "ruins.js",
    ]
    for base in roots:
        files = [base] if base.is_file() else list(base.rglob("*"))
        for path in files:
            if path.suffix.lower() not in {".py", ".js", ".json", ".txt", ".md"}:
                continue
            if "__pycache__" in path.parts or path.name == "selftest.py":
                continue
            text = path.read_text(errors="ignore")
            if BANNED.search(text):
                problems.append("tone word in " + str(path.relative_to(ROOT)))
    if problems:
        return fail("; ".join(problems))
    print("PASS")
    print(json.dumps({
        "gateApproach": manifest["objects"][0]["minApproachM"],
        "wreckApproach": manifest["objects"][1]["minApproachM"],
        "parts": len(part_ids),
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
