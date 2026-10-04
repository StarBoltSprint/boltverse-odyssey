#!/usr/bin/env python3
"""RuinGenerator. One command, one kit. Numbers in, meshes out."""

import argparse
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from colliders import body_field, covered_at, free_span, mesh_groups, sd_at, walk_line, wall_area  # noqa: E402
from gate import build_gate  # noqa: E402
from geom import pack_ruin  # noqa: E402
from wreck import build_wreck  # noqa: E402


def load_numbers(kit):
    path = Path(__file__).resolve().parent / "numbers" / (kit + ".json")
    if not path.is_file():
        raise SystemExit("no numbers for kit " + kit)
    data = json.loads(path.read_text())
    if data.get("kit") != kit:
        raise SystemExit("kit id mismatch")
    return data, path


def prompt_sibling(job, pixels, aspect):
    template = (Path(__file__).resolve().parent / "templates" / "plates.txt").read_text()
    return (
        template.replace("{JOB}", job)
        .replace("{PIXELS}", pixels)
        .replace("{ASPECT}", aspect)
    )


def write_prompt(path, job, pixels, aspect):
    path.write_text(prompt_sibling(job, pixels, aspect))


def corridor_clear(numbers, x, z, keep):
    """True when the footprint circle (radius `keep`) stays off the run and the spawn bubble."""
    script = r"""
import { radiusAt } from "./packs/zone-a/play/field.js";
const spawn = process.env.RUIN_SPAWN.split(",").map(Number);
const heading = Number(process.env.RUIN_HEAD) * Math.PI / 180;
const length = Number(process.env.RUIN_LEN);
const half = Number(process.env.RUIN_HALF);
const bubble = Number(process.env.RUIN_BUBBLE);
const x = Number(process.env.RUIN_X);
const z = Number(process.env.RUIN_Z);
const keep = Number(process.env.RUIN_KEEP);
const ax = Math.sin(heading), az = Math.cos(heading);
const dx = x - spawn[0], dz = z - spawn[1];
let t = dx * ax + dz * az;
t = Math.max(0, Math.min(length, t));
const cx = spawn[0] + ax * t, cz = spawn[1] + az * t;
const cord = Math.hypot(x - cx, z - cz);
const bubbleD = Math.hypot(x - spawn[0], z - spawn[1]);
let far = 0;
for (let i = 0; i < 72; i++) {
  const th = (i / 72) * Math.PI * 2;
  const R = radiusAt(th) * 0.98;
  far = Math.max(far, Math.hypot(Math.sin(th) * R - x, Math.cos(th) * R - z));
}
const th = Math.atan2(x, z);
const inside = Math.hypot(x, z) < radiusAt(th);
process.stdout.write(JSON.stringify({
  cord, bubbleD, far, inside,
  clear: cord - half > keep && bubbleD - bubble > keep,
}));
"""
    corridor = numbers["corridor"]
    env = {
        "RUIN_SPAWN": ",".join(str(v) for v in corridor["spawn"]),
        "RUIN_HEAD": str(corridor["headingDeg"]),
        "RUIN_LEN": str(corridor["lengthM"]),
        "RUIN_HALF": str(corridor["halfWidthM"]),
        "RUIN_BUBBLE": str(corridor["bubbleM"]),
        "RUIN_X": str(x),
        "RUIN_Z": str(z),
        "RUIN_KEEP": str(keep),
    }
    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        env={**dict(**{k: v for k, v in __import__("os").environ.items()}), **env},
    )
    if proc.returncode != 0:
        raise SystemExit(proc.stderr)
    return json.loads(proc.stdout)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--kit", required=True)
    args = ap.parse_args()
    numbers, numbers_path = load_numbers(args.kit)
    inbox = Path(__file__).resolve().parent / "inbox" / args.kit
    if not (inbox / "front.jpg").is_file():
        raise SystemExit("missing inbox plates for " + args.kit)
    pack = ROOT / numbers["pack"] / "src" / "ruins"
    if pack.exists():
        shutil.rmtree(pack)
    gate_dir = pack / "gate"
    wreck_dir = pack / "wreck"
    gate_dir.mkdir(parents=True)
    wreck_dir.mkdir(parents=True)

    coll_opt = dict(numbers.get("collider") or {})
    body_r = float(coll_opt.get("bodyRadiusM", 0.3))
    meshes, _boxes, parts, report = build_gate(inbox, numbers)
    if not report.get("openingClear"):
        raise SystemExit("gate opening is blocked by faces")
    spawn = numbers["corridor"]["spawn"]
    gx = float(numbers["gate"]["x"])
    gz = float(numbers["gate"]["z"])
    yaw = math.atan2(spawn[0] - gx, spawn[1] - gz)
    # Horizontal reach of the local mesh.
    horiz = 0.0
    for mesh in meshes:
        arr = mesh.xyzuv
        for i in range(0, len(arr), 5):
            horiz = max(horiz, math.hypot(arr[i], arr[i + 2]))
    report["horizRadiusM"] = round(horiz, 3)
    report["yawRad"] = round(yaw, 4)
    # No keep-out circle. The corridor test uses the real footprint plus Bolt's radius.
    foot_g = horiz + body_r
    place_g = corridor_clear(numbers, gx, gz, foot_g)
    report["placement"] = place_g
    report["footprintRadiusM"] = round(horiz, 3)
    if not place_g["clear"]:
        raise SystemExit("gate footprint meets the corridor " + json.dumps(place_g))
    if place_g["far"] > float(numbers["skyRadiusM"]) - 2:
        raise SystemExit("gate can sit outside the sky dome")
    if not place_g["inside"]:
        raise SystemExit("gate is outside the walkable rim")

    (gate_dir / "gate.ruin").write_bytes(pack_ruin([(m.skin, m.xyzuv, m.idx) for m in meshes]))
    for name, job in (
        ("front.jpg", "front elevation skin, one gateway, opening kept"),
        ("side.jpg", "side elevation skin, wall thickness"),
        ("sec-pier-l.jpg", "measure only, left jamb section"),
        ("sec-pier-r.jpg", "measure only, right jamb section"),
        ("sec-lintel.jpg", "measure only, lintel section"),
    ):
        src = inbox / name
        if name in ("front.jpg", "side.jpg"):
            shutil.copyfile(src, gate_dir / name)
        write_prompt(src.with_suffix(".PROMPT.txt"), job, "as cooked", "as cooked")
        if name in ("front.jpg", "side.jpg"):
            write_prompt((gate_dir / name).with_suffix(".PROMPT.txt"), job, "as cooked", "as cooked")

    wmeshes, wparts, winfo, wpaths = build_wreck(numbers)
    (wreck_dir / "wreck.ruin").write_bytes(pack_ruin([(m.skin, m.xyzuv, m.idx) for m in wmeshes if m.idx]))
    skin_names = ["port.jpg", "stbd.jpg", "top.jpg", "belly.jpg", "stern.jpg"]
    for src, name in zip(wpaths, skin_names):
        shutil.copyfile(src, wreck_dir / name)
        write_prompt(
            (wreck_dir / name).with_suffix(".PROMPT.txt"),
            "unlit skin copied from the validated hard-object plate " + name,
            "as copied",
            "as copied",
        )
    wx = float(numbers["wreck"]["x"])
    wz = float(numbers["wreck"]["z"])
    foot_w = winfo["horizRadiusM"] + body_r
    place_w = corridor_clear(numbers, wx, wz, foot_w)
    winfo["placement"] = place_w
    winfo["footprintRadiusM"] = winfo["horizRadiusM"]
    winfo["yawRad"] = round(math.radians(float(numbers["wreck"]["yawDeg"])), 4)
    if not place_w["clear"]:
        raise SystemExit("wreck footprint meets the corridor " + json.dumps(place_w))

    # Tight colliders from the faces, on flat ground at the seat. Openings must stay walkable.
    coll = {"rule": "wall where a face crosses the body band; openings walkable; no keep-out", **coll_opt}
    gsink = float(numbers["gate"]["sinkM"])
    gfield = body_field(mesh_groups(meshes), gsink, coll_opt)
    ob = report["openingBoxM"]
    depth = float(report["depthM"])
    ocx = 0.5 * (ob[0] + ob[1])
    run = walk_line(gfield, (ocx, 3.0), (ocx, -depth - 3.0), body_r)
    width_mid = max(free_span(gfield, ocx, -f * depth, ob[0] - 1.0, ob[1] + 1.0) for f in (0.25, 0.5, 0.75))
    coll["gate"] = {
        "groundLocalY": gsink,
        "throughOpening": run,
        "freeWidthM": round(width_mid, 3),
        "underArch": covered_at(gfield, ocx, -0.5 * depth),
        "pierWallM2": [
            wall_area(gfield, lambda x, z: x < ob[0] + 0.05),
            wall_area(gfield, lambda x, z: x > ob[1] - 0.05),
        ],
        "openingWallM2": wall_area(gfield, lambda x, z: ob[0] + 0.35 < x < ob[1] - 0.35 and -depth < z < 0),
        "sealedCells": gfield["sealed"],
    }
    if not run["free"]:
        raise SystemExit("gate opening is not walkable for the body radius " + json.dumps(run))
    hang = winfo.get("hangar")
    if hang:
        wground = float(winfo.get("contactY", 0.0)) + float(numbers["wreck"]["sinkM"])
        wfield = body_field(mesh_groups(wmeshes), wground, coll_opt)
        hx = 0.5 * (hang["x"][0] + hang["x"][1])
        pz = hang["portZ"]
        inside = walk_line(wfield, (hx, pz + 3.0), (hx, pz - 1.5), body_r)
        deepest = 0.0
        d = 0.0
        while d < 10.0 and sd_at(wfield, hx, pz - d) >= body_r:
            deepest = d
            d += 0.05
        coll["wreck"] = {
            "groundLocalY": round(wground, 3),
            "intoHangar": inside,
            "hangarDepthM": round(deepest, 3),
            "coveredInside": covered_at(wfield, hx, pz - 1.0),
            "sealedCells": wfield["sealed"],
        }
        if not inside["free"]:
            raise SystemExit("wreck hangar is not walkable for the body radius " + json.dumps(inside))
    if place_w["far"] > float(numbers["skyRadiusM"]) - 2:
        raise SystemExit("wreck can sit outside the sky dome")
    if not place_w["inside"]:
        raise SystemExit("wreck is outside the walkable rim")

    manifest = {
        "schema": "ruins-pack/2",
        "kit": args.kit,
        "collider": coll_opt,
        "objects": [
            {
                "id": "gate",
                "mesh": numbers["pack"] + "/src/ruins/gate/gate.ruin",
                "skins": [
                    numbers["pack"] + "/src/ruins/gate/front.jpg",
                    numbers["pack"] + "/src/ruins/gate/side.jpg",
                ],
                "frame": "gate",
                "x": gx,
                "z": gz,
                "yaw": report["yawRad"],
                "sink": float(numbers["gate"]["sinkM"]),
                "contact": [0, 0],
                "heightM": report["heightM"],
                "srcH": report["contentH"],
                "texelsPerM": report["texelsPerM"],
                "minApproachM": report["minApproachM"],
                "horizRadiusM": report["horizRadiusM"],
                "openingBoxM": report["openingBoxM"],
                "openingTopM": report["openingBoxM"][3],
                "bounds": report["bounds"],
            },
            {
                "id": "wreck",
                "mesh": numbers["pack"] + "/src/ruins/wreck/wreck.ruin",
                "skins": [numbers["pack"] + "/src/ruins/wreck/" + name for name in skin_names],
                "frame": "ship",
                "x": wx,
                "z": wz,
                "yaw": winfo["yawRad"],
                "sink": float(numbers["wreck"]["sinkM"]),
                "contact": winfo["contact"],
                "heightM": winfo["heightM"],
                "srcH": int(round(winfo["texelsPerM"] * winfo["heightM"])),
                "texelsPerM": winfo["texelsPerM"],
                "minApproachM": winfo["minApproachM"],
                "horizRadiusM": winfo["horizRadiusM"],
                "contactY": winfo.get("contactY", 0.0),
                "hangar": winfo.get("hangar"),
                "bounds": winfo["bounds"],
            },
        ],
    }
    (pack / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    measure = {"gate": report, "gateParts": parts, "wreck": winfo, "wreckParts": wparts, "colliders": coll}
    (pack / "measure.json").write_text(json.dumps(measure, indent=2) + "\n")
    # numbers file stays the kit input. Colliders are rebuilt from the faces in play.
    print(json.dumps({
        "kit": args.kit,
        "gateApproach": report["minApproachM"],
        "gateHeight": report["heightM"],
        "gateOpening": coll["gate"],
        "wreckApproach": winfo["minApproachM"],
        "wreckHeight": winfo["heightM"],
        "wreckHangar": coll.get("wreck"),
        "gateClear": place_g["clear"],
        "wreckClear": place_w["clear"],
    }, indent=2))
    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
