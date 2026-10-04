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


def write_atlas(inbox, dest):
    from PIL import Image

    front = Image.open(inbox / "front.jpg").convert("RGB")
    detail = inbox / "detail.jpg"
    if detail.is_file():
        other = Image.open(detail).convert("RGB")
        canvas = Image.new("RGB", (front.width + other.width, max(front.height, other.height)))
        canvas.paste(front, (0, 0))
        canvas.paste(other, (front.width, 0))
    else:
        canvas = front
    dest.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dest, "JPEG", quality=92, optimize=True)


def solve_anchor(numbers, report):
    gate = numbers["gate"]
    spawn = numbers["corridor"]["spawn"]
    if "alongM" not in gate:
        gx = float(gate["x"])
        gz = float(gate["z"])
        yaw = math.atan2(spawn[0] - gx, spawn[1] - gz)
        return gx, gz, yaw
    head = math.radians(float(numbers["corridor"]["headingDeg"]))
    fx, fz = math.sin(head), math.cos(head)
    along = float(gate["alongM"])
    px = spawn[0] + fx * along
    pz = spawn[1] + fz * along
    ox, _oy, oz = report["openingLocal"]
    gx, gz = px, pz
    yaw = 0.0
    for _ in range(4):
        yaw = math.atan2(spawn[0] - gx, spawn[1] - gz)
        c, s = math.cos(yaw), math.sin(yaw)
        dx = ox * c + oz * s
        dz = -ox * s + oz * c
        gx = px - dx
        gz = pz - dz
    yaw = math.atan2(spawn[0] - gx, spawn[1] - gz)
    report["openingAnchor"] = [round(px, 3), round(pz, 3)]
    return gx, gz, yaw


def footprint_ok(numbers, gx, gz, yaw, bounds):
    """Corners stay inside the rim and under the dome. Passage sits on the corridor."""
    script = r"""
import { radiusAt, heightAt } from "./packs/zone-a/play/field.js";
const gx = Number(process.env.RUIN_X);
const gz = Number(process.env.RUIN_Z);
const yaw = Number(process.env.RUIN_YAW);
const sky = Number(process.env.RUIN_SKY);
const sink = Number(process.env.RUIN_SINK);
const bounds = JSON.parse(process.env.RUIN_BOUNDS);
const c = Math.cos(yaw), s = Math.sin(yaw);
const pts = [];
for (const x of [bounds.min[0], bounds.max[0]]) {
  for (const y of [bounds.min[1], bounds.max[1]]) {
    for (const z of [bounds.min[2], bounds.max[2]]) {
      const wx = gx + x * c + z * s;
      const wz = gz - x * s + z * c;
      const ground = heightAt(wx, wz);
      const wy = ground - sink + y;
      const th = Math.atan2(wx, wz);
      const R = radiusAt(th);
      pts.push({
        wx, wz, wy,
        inside: Math.hypot(wx, wz) < R * 0.97,
        dome: Math.hypot(wx, wy, wz) < sky - 1,
      });
    }
  }
}
const badIn = pts.filter((p) => !p.inside).length;
const badDome = pts.filter((p) => !p.dome).length;
process.stdout.write(JSON.stringify({ badIn, badDome, n: pts.length }));
"""
    env = {
        "RUIN_X": str(gx),
        "RUIN_Z": str(gz),
        "RUIN_YAW": str(yaw),
        "RUIN_SKY": str(numbers["skyRadiusM"]),
        "RUIN_SINK": str(numbers["gate"]["sinkM"]),
        "RUIN_BOUNDS": json.dumps(bounds),
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


def corridor_clear(numbers, x, z, keep):
    """True when the keep circle stays off the run and the spawn bubble."""
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

    meshes, parts, report = build_gate(inbox, numbers)
    if not report.get("openingClear"):
        raise SystemExit("gate opening is blocked by faces")
    gx, gz, yaw = solve_anchor(numbers, report)
    numbers["gate"]["x"] = round(gx, 3)
    numbers["gate"]["z"] = round(gz, 3)
    horiz = 0.0
    for mesh in meshes:
        arr = mesh.xyzuv
        for i in range(0, len(arr), 5):
            horiz = max(horiz, math.hypot(arr[i], arr[i + 2]))
    report["horizRadiusM"] = round(horiz, 3)
    report["yawRad"] = round(yaw, 4)
    keep_g = horiz + report["minApproachM"]
    report["keepRadiusM"] = round(keep_g, 3)
    report["keepUsed"] = False
    foot = footprint_ok(numbers, gx, gz, yaw, report["bounds"])
    report["footprint"] = foot
    if foot["badIn"]:
        raise SystemExit("gate footprint leaves the walkable rim " + json.dumps(foot))
    if foot["badDome"]:
        raise SystemExit("gate footprint meets the sky dome " + json.dumps(foot))

    (gate_dir / "gate.ruin").write_bytes(pack_ruin([(m.skin, m.xyzuv, m.idx) for m in meshes]))
    write_atlas(inbox, gate_dir / "atlas.jpg")
    for name, job in (
        ("front.jpg", "front elevation, one gateway, opening kept"),
        ("side.jpg", "side elevation, wall thickness, measure"),
        ("detail.jpg", "surface plate for thickness faces"),
        ("sec-pier-l.jpg", "measure only, left jamb section"),
        ("sec-pier-r.jpg", "measure only, right jamb section"),
        ("sec-lintel.jpg", "measure only, lintel section"),
    ):
        src = inbox / name
        if not src.is_file():
            continue
        write_prompt(src.with_suffix(".PROMPT.txt"), job, "as cooked", "as cooked")
    write_prompt(
        (gate_dir / "atlas.jpg").with_suffix(".PROMPT.txt"),
        "packed skin, elevation beside the surface plate, unscaled",
        "as packed",
        "as packed",
    )

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
    keep_w = winfo["horizRadiusM"] + winfo["minApproachM"]
    place_w = corridor_clear(numbers, wx, wz, keep_w)
    winfo["placement"] = place_w
    winfo["keepRadiusM"] = round(keep_w, 3)
    winfo["yawRad"] = round(math.radians(float(numbers["wreck"]["yawDeg"])), 4)
    if not place_w["clear"]:
        raise SystemExit("wreck keep-out meets the corridor " + json.dumps(place_w))
    if place_w["far"] > float(numbers["skyRadiusM"]) - 2:
        raise SystemExit("wreck can sit outside the sky dome")
    if not place_w["inside"]:
        raise SystemExit("wreck is outside the walkable rim")

    manifest = {
        "schema": "ruins-pack/1",
        "kit": args.kit,
        "objects": [
            {
                "id": "gate",
                "mesh": numbers["pack"] + "/src/ruins/gate/gate.ruin",
                "skins": [
                    numbers["pack"] + "/src/ruins/gate/atlas.jpg",
                ],
                "frame": "gate",
                "x": round(gx, 3),
                "z": round(gz, 3),
                "yaw": report["yawRad"],
                "sink": float(numbers["gate"]["sinkM"]),
                "contact": [0, 0],
                "heightM": report["heightM"],
                "srcH": report["contentH"],
                "texelsPerM": report["texelsPerM"],
                "nearTexelsPerM": report["nearTexelsPerM"],
                "atlasSplitU": report["atlas"]["frontU"][1],
                "openingWidthM": report["openingWidthM"],
                "openingHeightM": report["openingHeightM"],
                "minApproachM": report["minApproachM"],
                "horizRadiusM": report["horizRadiusM"],
                "keepRadiusM": report["keepRadiusM"],
                "colliders": [],
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
                "keepRadiusM": winfo["keepRadiusM"],
                "colliders": [],
            },
        ],
    }
    (pack / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    measure = {"gate": report, "gateParts": parts, "wreck": winfo, "wreckParts": wparts}
    (pack / "measure.json").write_text(json.dumps(measure, indent=2) + "\n")
    numbers_path.write_text(json.dumps(numbers, indent=2) + "\n")
    # Solved centre is written back. The keep radius is recorded and is not a wall.
    print(json.dumps({
        "kit": args.kit,
        "gateKeep": report["keepRadiusM"],
        "gateApproach": report["minApproachM"],
        "gateHeight": report["heightM"],
        "gateOpening": report["openingWidthM"],
        "gateDepth": report["depthM"],
        "gateX": round(gx, 3),
        "gateZ": round(gz, 3),
        "nearTexels": report["nearTexelsPerM"],
        "wreckKeep": winfo["keepRadiusM"],
        "wreckApproach": winfo["minApproachM"],
        "wreckHeight": winfo["heightM"],
        "gateFoot": foot["badIn"] == 0 and foot["badDome"] == 0,
        "wreckClear": place_w["clear"],
    }, indent=2))
    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
