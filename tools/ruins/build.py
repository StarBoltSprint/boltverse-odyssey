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

from colliders import body_field, covered_at, free_span, mesh_groups, read_ruin, sd_at, walk_line, wall_area  # noqa: E402
from gate import build_gate  # noqa: E402
from sealed import atlas_groups, copy_prompts, face_yaw, horiz_radius, load_sealed  # noqa: E402
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
// Room between the footprint circle and the walkable rim (field.contain uses radiusAt * 1.045).
let rimRoom = Infinity;
for (let i = 0; i < 72; i++) {
  const a = (i / 72) * Math.PI * 2;
  const px = x + Math.sin(a) * keep, pz = z + Math.cos(a) * keep;
  rimRoom = Math.min(rimRoom, radiusAt(Math.atan2(px, pz)) * 1.045 - Math.hypot(px, pz));
}
process.stdout.write(JSON.stringify({
  cord, bubbleD, far, inside, rimRoom,
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
    # No keep-out circle. The passage sits on the corridor; colliders follow the faces.
    report["footprintRadiusM"] = round(horiz, 3)
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

    # Sealed ruins: earlier cooked lofts the owner keeps (numbers "sealed"), placed by the same rules.
    sealed_objs = []
    sealed_report = {}
    spawn_xz = numbers["corridor"]["spawn"]
    placed = [(gx, gz, report["horizRadiusM"], "gate"), (wx, wz, winfo["horizRadiusM"], "wreck")]
    rocks_path = ROOT / numbers["pack"] / "src" / "rocks" / "manifest.json"
    rock_discs = []
    if rocks_path.is_file():
        rocks = json.loads(rocks_path.read_text())
        for inst in rocks.get("instances", []):
            t = (rocks.get("types") or {}).get(inst.get("type"))
            if not t or t.get("kind") != "hull" or inst.get("collider") is False:
                continue
            sz = t.get("objectSize") or [1, 1, 1]
            rock_discs.append((inst["x"], inst["z"], 0.5 * math.hypot(sz[0], sz[2]) * inst.get("scale", 1), inst.get("id")))
    for ent in numbers.get("sealed", []):
        sid = ent["id"]
        sdir = ROOT / ent["dir"]
        sinfo, sgroups = load_sealed(sdir)
        sx = float(ent["x"])
        sz_ = float(ent["z"])
        syaw = face_yaw(spawn_xz, sx, sz_) if ent.get("face") == "spawn" else math.radians(float(ent["yawDeg"]))
        shoriz = horiz_radius(sgroups)
        splace = corridor_clear(numbers, sx, sz_, shoriz + body_r)
        if not splace["clear"]:
            raise SystemExit(sid + " footprint meets the corridor " + json.dumps(splace))
        if not splace["inside"] or splace["far"] > float(numbers["skyRadiusM"]) - 2:
            raise SystemExit(sid + " is outside the rim or the dome")
        # Bolt must be able to walk all the way round a kept ruin, inside the walkable rim.
        if splace["rimRoom"] < 2 * body_r + 2.0:
            raise SystemExit(sid + " is too near the walkable rim to walk round (" + str(round(splace["rimRoom"], 2)) + " m)")
        for ox, oz, orad, oid in placed:
            gap = math.hypot(sx - ox, sz_ - oz) - orad - shoriz
            if gap < 2 * body_r + 1.0:
                raise SystemExit(sid + " overlaps " + oid + " (gap " + str(round(gap, 2)) + " m)")
        # A rock on the walking line through the opening is a visible blocker: refuse it.
        ob = sinfo["openingBoxM"]
        sdepth = float(sinfo["depthM"])
        c, sn = math.cos(syaw), math.sin(syaw)
        mid = 0.5 * (ob[0] + ob[1])

        def to_world(lx, lz):
            return (c * lx + sn * lz + sx, -sn * lx + c * lz + sz_)

        a = to_world(mid, 8.0)
        b = to_world(mid, -sdepth - 8.0)
        axis_clear = 99.0
        for rx, rz, rr, _rid in rock_discs:
            vx, vz = b[0] - a[0], b[1] - a[1]
            t = max(0.0, min(1.0, ((rx - a[0]) * vx + (rz - a[1]) * vz) / (vx * vx + vz * vz)))
            axis_clear = min(axis_clear, math.hypot(a[0] + vx * t - rx, a[1] + vz * t - rz) - rr)
        if axis_clear < body_r + 0.3:
            raise SystemExit(sid + " has a rock on its walking line (clear " + str(round(axis_clear, 2)) + " m)")
        odir = pack / sid
        odir.mkdir(parents=True, exist_ok=True)
        draws, (aw, ah) = atlas_groups(sdir, sinfo, sgroups, odir / "atlas.jpg")
        (odir / sid).with_suffix(".ruin").write_bytes(pack_ruin(draws))
        copy_prompts(sdir, sinfo, odir)
        write_prompt(odir / "atlas.PROMPT.txt", "packed skin of a sealed ruin, plates side by side, unscaled", "as packed", "as packed")
        sgroups_np = read_ruin(odir / (sid + ".ruin"))
        sfield = body_field(sgroups_np, float(ent["sinkM"]), coll_opt)
        srun = walk_line(sfield, (mid, 3.0), (mid, -sdepth - 3.0), body_r)
        if not srun["free"]:
            raise SystemExit(sid + " opening is not walkable for the body radius " + json.dumps(srun))
        sealed_report[sid] = {
            "source": sinfo["source"],
            "throughOpening": srun,
            "freeWidthM": round(max(free_span(sfield, mid, -f * sdepth, ob[0] - 1.0, ob[1] + 1.0) for f in (0.25, 0.5, 0.75)), 3),
            "underArch": covered_at(sfield, mid, -0.5 * sdepth),
            "axisRockClearM": round(axis_clear, 3),
            "rimRoomM": round(splace["rimRoom"], 3),
            "atlas": [aw, ah],
            "horizRadiusM": round(shoriz, 3),
            "placement": splace,
            "parts": sinfo.get("parts"),
        }
        coll[sid] = {k: sealed_report[sid][k] for k in ("throughOpening", "freeWidthM", "underArch")}
        placed.append((sx, sz_, shoriz, sid))
        sealed_objs.append({
            "id": sid,
            "mesh": numbers["pack"] + "/src/ruins/" + sid + "/" + sid + ".ruin",
            "skins": [numbers["pack"] + "/src/ruins/" + sid + "/atlas.jpg"],
            "frame": sinfo.get("frame", "gate"),
            "sealed": ent["dir"],
            "x": sx,
            "z": sz_,
            "yaw": round(syaw, 4),
            "sink": float(ent["sinkM"]),
            "contact": [0, 0],
            "heightM": sinfo["heightM"],
            "srcH": sinfo["srcH"],
            "texelsPerM": sinfo["texelsPerM"],
            "minApproachM": sinfo["minApproachM"],
            "horizRadiusM": round(shoriz, 3),
            "footprintRadiusM": round(shoriz, 3),
            "depthM": sdepth,
            "openingBoxM": ob,
            "openingTopM": ob[3],
            "bounds": sinfo["bounds"],
        })

    manifest = {
        "schema": "ruins-pack/2",
        "kit": args.kit,
        "collider": coll_opt,
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
                "footprintRadiusM": report["footprintRadiusM"],
                "depthM": report["depthM"],
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
        ] + sealed_objs,
    }
    (pack / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    measure = {"gate": report, "gateParts": parts, "wreck": winfo, "wreckParts": wparts, "sealed": sealed_report, "colliders": coll}
    (pack / "measure.json").write_text(json.dumps(measure, indent=2) + "\n")
    numbers_path.write_text(json.dumps(numbers, indent=2) + "\n")
    # Solved gate centre is written back. Colliders are rebuilt from the faces in play.
    print(json.dumps({
        "kit": args.kit,
        "gateApproach": report["minApproachM"],
        "gateHeight": report["heightM"],
        "gateOpening": coll["gate"],
        "gateOpeningWidthM": report["openingWidthM"],
        "gateDepth": report["depthM"],
        "gateX": round(gx, 3),
        "gateZ": round(gz, 3),
        "nearTexels": report["nearTexelsPerM"],
        "wreckApproach": winfo["minApproachM"],
        "wreckHeight": winfo["heightM"],
        "wreckHangar": coll.get("wreck"),
        "gateFoot": foot["badIn"] == 0 and foot["badDome"] == 0,
        "wreckClear": place_w["clear"],
        "sealed": {k: {kk: v[kk] for kk in ("throughOpening", "freeWidthM", "axisRockClearM", "rimRoomM", "atlas")} for k, v in sealed_report.items()},
    }, indent=2))
    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
