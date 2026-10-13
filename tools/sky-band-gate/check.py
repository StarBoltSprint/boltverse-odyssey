#!/usr/bin/env python3
"""Full-size sky-plate band / edge / banding gate.

  python3 tools/sky-band-gate/check.py --plates <dir> --out <reports> [--key-b <jpg>]
  python3 tools/sky-band-gate/check.py --files a.jpg b.jpg --out <reports>

Exit 0 = all PASS. Exit 1 = one or more FAIL. Exit 2 = bad invocation.
JPG/JSON outputs only. Stops if disk free < 2 GB.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from measures import assess_plate, key_b_median_star, load_rgb, mean_v  # noqa: E402

DISK_FLOOR_KB = 2_000_000
PLATE_RE = re.compile(r"zd-sky12-(S\d{2})(?:-(final(\d+)|graded))?\.jpg$")


def disk_free_kb(path: str = "/") -> int:
    st = os.statvfs(path)
    return int(st.f_bavail * st.f_frsize / 1024)


def pick_plates(plates_dir: Path) -> list[tuple[str, Path]]:
    """Highest finalN per SXX, else graded, else bare."""
    best: dict[str, tuple[int, Path]] = {}
    for p in sorted(plates_dir.glob("zd-sky12-S*.jpg")):
        m = PLATE_RE.search(p.name)
        if not m:
            continue
        sid = m.group(1)
        if m.group(2) and m.group(2).startswith("final"):
            rank = 100 + int(m.group(3) or 1)
        elif m.group(2) == "graded":
            rank = 50
        else:
            rank = 10
        cur = best.get(sid)
        if cur is None or rank > cur[0]:
            best[sid] = (rank, p)
    return [(k, best[k][1]) for k in sorted(best)]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--plates", type=Path, help="sky12 directory")
    ap.add_argument("--files", nargs="*", type=Path, help="explicit plate files")
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--key-b", type=Path, default=None)
    args = ap.parse_args(argv)

    free = disk_free_kb()
    if free < DISK_FLOOR_KB:
        print(f"STOP: disk free {free} KB < 2 GB", file=sys.stderr)
        return 2

    if args.files:
        items = []
        for f in args.files:
            m = re.search(r"(S\d{2})", f.name)
            items.append((m.group(1) if m else f.stem, f))
    elif args.plates:
        items = pick_plates(args.plates)
    else:
        print("need --plates or --files", file=sys.stderr)
        return 2

    if not items:
        print("no plates found", file=sys.stderr)
        return 2

    args.out.mkdir(parents=True, exist_ok=True)
    key_b = args.key_b
    if key_b is None:
        cand = Path(__file__).resolve().parent / "fixtures" / "key-zd1-b.jpg"
        key_b = cand if cand.is_file() else None
    key_med = key_b_median_star(key_b) if key_b else None

    # first pass: mean V for ring median
    loaded = []
    for sid, path in items:
        rgb = load_rgb(path)
        loaded.append((sid, path, rgb, mean_v(rgb)))
    ring_med = float(sorted(v for *_, v in loaded)[len(loaded) // 2])

    plates_out = []
    any_fail = False
    edge_plates = []
    for sid, path, rgb, mv in loaded:
        if disk_free_kb() < DISK_FLOOR_KB:
            print(f"STOP mid-run: disk free < 2 GB", file=sys.stderr)
            return 2
        row = assess_plate(rgb, key_b_med=key_med, ring_median_v=ring_med)
        row["id"] = sid
        row["path"] = str(path)
        row["size"] = list(rgb.shape[1::-1])  # W,H
        plates_out.append(row)
        if row["status"] == "FAIL":
            any_fail = True
        if row["edge"]["fail"]:
            edge_plates.append(sid)

    report = {
        "gate": "sky-band-gate",
        "ring_median_V": round(ring_med, 4),
        "key_b_median_star_px": key_med,
        "thresholds": {
            "glow_mw": {"density_min": 1.30, "soft_min": 0.40, "nn_max": 12.0},
            "tight_mw": {"density_min": 1.25, "star_ratio_min": 1.80, "nn_max": 4.0},
            "mean_v_max_delta": 0.03,
            "min_star_px": 2.0,
            "edge_ratio_max": 1.045,
            "banding_risk_fail_phone": 0.45,
            "astc": "4x4",
            "phone_dither_lsb": 1.0,
        },
        "edge_line_plates": edge_plates,
        "plates": plates_out,
        "status": "FAIL" if any_fail else "PASS",
    }
    (args.out / "report.json").write_text(json.dumps(report, indent=2) + "\n")

    # small contact sheet of FAIL plates only (jpg)
    fails = [p for p in plates_out if p["status"] == "FAIL"]
    if fails:
        thumbs = []
        for p in fails[:6]:
            im = Image.open(p["path"]).convert("RGB").resize((320, 180))
            thumbs.append(im)
        if thumbs:
            w = sum(t.size[0] for t in thumbs)
            sheet = Image.new("RGB", (w, 180), (16, 16, 20))
            x = 0
            for t in thumbs:
                sheet.paste(t, (x, 0))
                x += t.size[0]
            sheet.save(args.out / "fail-contact.jpg", quality=85)

    md = [f"# sky-band-gate\n", f"status: **{report['status']}**\n", f"ring median V: {ring_med:.4f}\n",
          f"edge line plates: {', '.join(edge_plates) if edge_plates else '(none)'}\n",
          "| id | status | dens | lane | V | edge | band_phone | reasons |\n|---|---|---|---|---|---|---|---|\n"]
    for p in plates_out:
        md.append(
            f"| {p['id']} | {p['status']} | {p['density_ratio_eff']:.3f} | {p['lane_frac_eff']:.4f} | "
            f"{p['mean_V']:.3f} | {'Y' if p['edge']['fail'] else 'n'} | "
            f"{p['banding']['banding_risk_astc4x4_dither1lsb']:.3f} | {'; '.join(p['reasons']) or '—'} |\n"
        )
    (args.out / "report.md").write_text("".join(md))
    print(json.dumps({"status": report["status"], "n": len(plates_out), "edge_line_plates": edge_plates}))
    return 1 if any_fail else 0


if __name__ == "__main__":
    sys.exit(main())
