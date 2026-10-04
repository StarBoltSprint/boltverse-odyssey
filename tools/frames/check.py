#!/usr/bin/env python3
"""Scan proof frames for the 2026-10-04 gates.

Reads pixels. Does not draw, grade, or replace a pixel.
Exit 0 when every current row passes or is n/a. Exit 1 when a current row
fails. A historical frame is reported and does not change the exit code.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from heroes import check_heroes, load_shows, parse_must_show
from pixels import (
    foot_contact,
    ground_defects,
    hotspot_fixes,
    sky_defects,
    stair_crown,
    surface_mag,
    untextured,
)
from resume import load as load_progress
from resume import mark, save


def load_rgb(path: Path):
    image = Image.open(path).convert("RGB")
    return np.asarray(image)


def parse_spec(text: str, default_role: str):
    historical = False
    body = text.strip()
    if body.startswith("historical:"):
        historical = True
        body = body[len("historical:") :]
    if "::" in body:
        path, role = body.rsplit("::", 1)
    else:
        path, role = body, default_role
    return historical, path.strip(), role.strip() or default_role


def measure(rgb, role: str) -> list[dict]:
    rows = []
    want_sky = role in ("sky", "all")
    want_ground = role in ("ground", "scene", "all")
    want_scene = role in ("scene", "all")
    if want_scene or role == "ground":
        foot = foot_contact(rgb)
        rows.append(pixel_row("foot_contact", foot, "a sky gap under a solid"))
    if want_scene or want_sky:
        flat = untextured(rgb)
        rows.append(pixel_row("untextured", flat, "a large black or untextured flat"))
    if want_sky:
        sky = sky_defects(rgb)
        rows.append(pixel_row("sky_frame", sky, "a zenith band, seam, streak, slice, or overlapping panel"))
    if want_ground:
        ground = ground_defects(rgb)
        rows.append(pixel_row("ground_frame", ground, "a hard horizon line or a void band"))
    if want_scene:
        stair = stair_crown(rgb)
        failed = bool(stair.get("stair"))
        rows.append(
            {
                "check": "stair_crown",
                "result": "FAIL" if failed else "PASS",
                "detail": stair_detail(stair),
                "numbers": stair,
            }
        )
    return rows


def pixel_row(check: str, report: dict, what: str) -> dict:
    if report.get("skipped"):
        return {
            "check": check,
            "result": "PASS",
            "detail": f"skipped ({report['skipped']})",
            "numbers": report,
        }
    hits = report.get("hits") or []
    if hits:
        named = ", ".join(str(hit.get("kind") or hit.get("check") or "hit") for hit in hits[:6])
        return {"check": check, "result": "FAIL", "detail": f"{what}: {named}. {hits[0]}", "numbers": report}
    return {"check": check, "result": "PASS", "detail": f"no {what}", "numbers": {"hits": []}}


def stair_detail(stair: dict) -> str:
    if stair.get("skipped"):
        return f"skipped ({stair['skipped']})"
    if stair.get("stair"):
        return (
            f"stair-stepped crown, {stair.get('runs')} runs, jump {stair.get('jumpPx')} px. "
            "Use a finer loft grid or smooth the silhouette. Cook the crown at the on-screen "
            "pixel count. Do not enlarge the current texture."
        )
    return f"no stair crown ({stair.get('runs')} runs)"


def magnification(ruins: dict, proof: dict) -> dict:
    objects = {obj["id"]: obj for obj in ruins.get("objects", [])}
    cam = (proof.get("crown") or {}).get("cam") or {}
    fov = float(cam.get("vfovDeg") or 48.08)
    poses = []
    for name in ("hangar", "wreckOut", "gateBase", "gateTop", "crown"):
        block = proof.get(name) or {}
        if name == "crown":
            oid = "gate"
        elif name in ("hangar", "wreckOut"):
            oid = "wreck"
        else:
            oid = "gate"
        dist = block.get("clear")
        if dist is None or oid not in objects:
            continue
        poses.append((name, oid, float(dist)))
    hits = []
    notes = []
    for pose, oid, dist in poses:
        obj = objects[oid]
        densities = [("skin", obj.get("texelsPerM"))]
        if obj.get("nearTexelsPerM"):
            densities.append(("near", obj.get("nearTexelsPerM")))
        mags = []
        for label, texels in densities:
            if not texels:
                continue
            mag = surface_mag(float(texels), dist, 1600.0, fov)
            if mag is None:
                continue
            mags.append({"density": label, "texelsPerM": float(texels), "mag": round(mag, 3)})
        if not mags:
            continue
        best = min(mags, key=lambda item: item["mag"])
        scale = float(obj.get("scale") or 1.0)
        record = {
            "pose": pose,
            "object": oid,
            "dist_m": round(dist, 3),
            "best": best,
            "all": mags,
            "fixes": hotspot_fixes(best["mag"], dist, scale, best["texelsPerM"]) if best["mag"] > 1.0 else [],
        }
        if best["mag"] > 1.0:
            hits.append(record)
        else:
            notes.append(record)
    seats = ((proof.get("crown") or {}).get("seats")) or []
    return {"hits": hits, "notes": notes, "seats": seats, "fov": fov}


def mag_row(report: dict) -> dict:
    hits = report["hits"]
    if not hits:
        return {
            "check": "mag_hotspots",
            "result": "PASS",
            "detail": "no proof distance is above magnification 1 at the best density for that part",
            "numbers": report,
        }
    lines = []
    for hit in hits:
        fixes = "; ".join(hit["fixes"])
        lines.append(
            f"{hit['object']} at {hit['pose']} is mag {hit['best']['mag']} "
            f"({hit['best']['density']} {hit['best']['texelsPerM']} texels/m, {hit['dist_m']} m). {fixes}"
        )
    return {
        "check": "mag_hotspots",
        "result": "FAIL",
        "detail": " ".join(lines),
        "numbers": report,
    }


def seat_row(seats) -> dict | None:
    if not seats:
        return None
    text = ", ".join(
        f"{seat.get('id')} footGap {seat.get('footGap')} m skirts {seat.get('skirts')}" for seat in seats
    )
    return {
        "check": "seat_foot_gap",
        "result": "INFO",
        "detail": (
            "Data footGap is the skirt drop, not the framebuffer. "
            + text
        ),
        "numbers": {"seats": seats},
    }


def collect_jobs(args) -> list[dict]:
    jobs = []
    specs = list(args.image or [])
    if args.list:
        for line in Path(args.list).read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                specs.append(line)
    for spec in specs:
        historical, path, role = parse_spec(spec, args.role)
        jobs.append({"id": path, "path": path, "role": role, "historical": historical, "kind": "image"})
    if args.brief:
        jobs.append({"id": "heroes", "kind": "heroes"})
    if args.ruins and args.proof:
        jobs.append({"id": "magnification", "kind": "mag"})
    return jobs


def run_job(job, args, images) -> dict:
    if job["kind"] == "image":
        path = Path(job["path"])
        if not path.is_file():
            return {"id": job["id"], "result": "FAIL", "detail": "missing file", "rows": []}
        rgb = load_rgb(path)
        rows = measure(rgb, job["role"])
        if job["historical"]:
            for row in rows:
                row["historical"] = True
                if row["result"] == "FAIL":
                    row["result"] = "HISTORICAL"
        failed = any(row["result"] == "FAIL" for row in rows)
        images[path.name] = rgb
        images[str(path)] = rgb
        return {
            "id": job["id"],
            "result": "FAIL" if failed else "PASS",
            "detail": f"{job['role']} {path.name}",
            "rows": rows,
        }
    if job["kind"] == "heroes":
        text = Path(args.brief).read_text(encoding="utf-8")
        shows = load_shows(args.shows) if args.shows else {}
        report = check_heroes(text, shows, images)
        return {
            "id": "heroes",
            "result": report["result"],
            "detail": report["reason"] or json.dumps(report["rows"]),
            "rows": [
                {
                    "check": "heroes",
                    "result": report["result"],
                    "detail": report["reason"] or "; ".join(
                        f"{row['element']} {row['result']}" for row in report["rows"]
                    ),
                    "numbers": report,
                }
            ],
        }
    ruins = json.loads(Path(args.ruins).read_text(encoding="utf-8"))
    proof = json.loads(Path(args.proof).read_text(encoding="utf-8"))
    report = magnification(ruins, proof)
    rows = [mag_row(report)]
    seat = seat_row(report["seats"])
    if seat:
        rows.append(seat)
    current = rows[0]["result"]
    return {"id": "magnification", "result": current, "detail": rows[0]["detail"], "rows": rows}


def render(state, jobs) -> str:
    done = state.get("done") or []
    left = [job["id"] for job in jobs if job["id"] not in done]
    lines = ["# Frame check", "", "Done:"]
    if done:
        for item in done:
            row = next((r for r in state["rows"] if r["id"] == item), None)
            lines.append(f"- {item} — {row['result'] if row else 'done'}")
    else:
        lines.append("- none yet")
    lines.append("")
    lines.append("Left:")
    if left:
        for item in left:
            lines.append(f"- {item}")
    else:
        lines.append("- none")
    lines.append("")
    lines.append("## Rows")
    lines.append("")
    lines.append("| Frame | Check | Result | Detail |")
    lines.append("|---|---|---|---|")
    for block in state.get("rows") or []:
        for row in block.get("rows") or []:
            detail = str(row.get("detail") or "").replace("|", "/").replace("\n", " ")
            if len(detail) > 240:
                detail = detail[:237] + "..."
            lines.append(f"| {block['id']} | {row['check']} | {row['result']} | {detail} |")
    lines.append("")
    current = []
    for block in state.get("rows") or []:
        for row in block.get("rows") or []:
            if row["result"] in ("PASS", "FAIL", "n/a", "INFO", "HISTORICAL"):
                current.append(row["result"])
    fails = [r for r in current if r == "FAIL"]
    lines.append(f"Current fails: {len(fails)}")
    lines.append("")
    return "\n".join(lines)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Proof-frame gates for any biome.")
    parser.add_argument("--image", action="append", default=[], help="path or path::role. Prefix historical:")
    parser.add_argument("--list", help="One image spec per line.")
    parser.add_argument("--role", default="scene", help="Default role: sky, ground, scene, all.")
    parser.add_argument("--brief")
    parser.add_argument("--shows")
    parser.add_argument("--ruins")
    parser.add_argument("--proof")
    parser.add_argument("--out")
    parser.add_argument("--progress")
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args(argv)
    jobs = collect_jobs(args)
    if not jobs:
        print("FAIL no images and no brief")
        return 1
    state = load_progress(args.progress) if args.resume else {"done": [], "left": [], "rows": []}
    done = set(state.get("done") or [])
    images = {}
    # Heroes need the shots. Reload finished images when resuming into a hero step.
    if args.resume and args.brief:
        for job in jobs:
            if job["kind"] == "image" and job["id"] in done and Path(job["path"]).is_file():
                rgb = load_rgb(Path(job["path"]))
                images[Path(job["path"]).name] = rgb
    for job in jobs:
        if job["id"] in done:
            continue
        print("scan " + job["id"], flush=True)
        block = run_job(job, args, images)
        left = [item["id"] for item in jobs]
        mark(state, job["id"], block, left)
        if args.progress:
            save(args.progress, state)
        if args.out:
            Path(args.out).parent.mkdir(parents=True, exist_ok=True)
            Path(args.out).write_text(render(state, jobs), encoding="utf-8")
        print(block["result"] + " " + job["id"])
    text = render(state, jobs)
    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
    else:
        print(text)
    failed = False
    for block in state["rows"]:
        for row in block.get("rows") or []:
            if row["result"] == "FAIL":
                failed = True
    if args.brief and not parse_must_show(Path(args.brief).read_text(encoding="utf-8")):
        pass
    print("FAIL frames" if failed else "PASS frames")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
