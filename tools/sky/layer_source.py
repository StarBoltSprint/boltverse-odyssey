#!/usr/bin/env python3
"""Prove a shipped sky video layer kept every pixel of its Imagine source.

  python3 tools/sky/layer_source.py record --source <imagine.mp4> --out <layer>.source.json
  python3 tools/sky/layer_source.py check --shipped <layer>.mp4 (--source <imagine.mp4> | --record <layer>.source.json)
        [--mag 0.5625 --canvas-w 720 --phone-px 1080] [--json <report.json>]

The record is the measured Imagine original: codec, size, fps, frame count, video bitrate,
and one md5 per decoded frame. Commit it next to the layer (it is small). The original
itself stays in the session folder.

check fails (exit 1) when the shipped file:
  - is smaller than the source in width or height,
  - has a different frame rate,
  - has a frame whose decoded pixels are not a frame of the source (a re-encode, a scale,
    a crop, a colour change, a crf pass), or
  - is displayed above magnification 1 when --mag is given.
A stream copy (audio or cover stripped, container changed) keeps every decoded frame and
passes. Keeping a subset of the source frames (no new pixels) passes and is reported.
Exit 2 is a broken invocation (missing file, no ffprobe).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path


def need_tools() -> None:
    for t in ("ffprobe", "ffmpeg"):
        if not shutil.which(t):
            print(f"layer_source: {t} not found", file=sys.stderr)
            raise SystemExit(2)


def probe(path: Path) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=codec_name,profile,width,height,r_frame_rate,nb_frames,bit_rate,pix_fmt:format=duration",
         "-of", "json", str(path)],
        capture_output=True, text=True, check=True).stdout
    j = json.loads(out)
    s = j["streams"][0]
    num, den = s.get("r_frame_rate", "0/1").split("/")
    return {
        "codec": s.get("codec_name"),
        "profile": s.get("profile"),
        "pixFmt": s.get("pix_fmt"),
        "width": int(s["width"]),
        "height": int(s["height"]),
        "fps": round(float(num) / float(den or 1), 4),
        "frames": int(s["nb_frames"]) if s.get("nb_frames", "N/A") not in ("N/A", None) else None,
        "videoBitrate": int(s["bit_rate"]) if s.get("bit_rate") not in (None, "N/A") else None,
        "duration": float(j.get("format", {}).get("duration", 0) or 0),
    }


def frame_hashes(path: Path) -> list[str]:
    """md5 of every decoded frame of the first video stream (rgb24, source size)."""
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-map", "0:v:0", "-pix_fmt", "rgb24",
         "-f", "framemd5", "-"],
        capture_output=True, text=True, check=True).stdout
    hashes = []
    for line in out.splitlines():
        if not line or line.startswith("#"):
            continue
        hashes.append(line.rsplit(",", 1)[-1].strip())
    return hashes


def measure(path: Path) -> dict:
    rec = probe(path)
    rec["frameMd5"] = frame_hashes(path)
    if rec["frames"] is None:
        rec["frames"] = len(rec["frameMd5"])
    rec["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
    rec["file"] = str(path)
    return rec


def check(shipped: dict, source: dict, mag: float | None, canvas_w: int | None,
          phone_px: int | None = None) -> tuple[bool, list[dict]]:
    rows = []

    def row(name: str, ok: bool, msg: str) -> None:
        rows.append({"row": name, "pass": ok, "msg": msg})

    row("size", shipped["width"] >= source["width"] and shipped["height"] >= source["height"],
        f"shipped {shipped['width']}x{shipped['height']} vs source {source['width']}x{source['height']}")
    row("fps", abs(shipped["fps"] - source["fps"]) < 1e-3, f"shipped {shipped['fps']} vs source {source['fps']}")
    src = set(source["frameMd5"])
    foreign = [i for i, h in enumerate(shipped["frameMd5"]) if h not in src]
    same = shipped["frameMd5"] == source["frameMd5"]
    if same:
        msg = f"all {len(shipped['frameMd5'])} decoded frames identical to the source"
    elif not foreign:
        msg = f"subset: {len(shipped['frameMd5'])} of {len(source['frameMd5'])} source frames, no new pixels"
    else:
        msg = (f"{len(foreign)} of {len(shipped['frameMd5'])} shipped frames are not source pixels "
               f"(first at frame {foreign[0]}): re-encode, scale, crop or colour pass")
    row("pixels", not foreign, msg)
    sb, vb = shipped.get("videoBitrate"), source.get("videoBitrate")
    if sb and vb:
        row("bitrate", same or not foreign or sb >= vb,
            f"shipped {sb / 1000:.0f} kb/s vs source {vb / 1000:.0f} kb/s" + (" (bit-identical frames)" if same else ""))
    if mag is not None:
        shown = shipped["width"] * mag
        msg = f"mag {mag} -> {shown:.0f} px wide on screen"
        if canvas_w:
            msg += f" on a {canvas_w}-px canvas ({100 * shown / canvas_w:.0f}% of the width)"
        row("magnification", mag <= 1.0 + 1e-9, msg)
        if canvas_w and phone_px:
            up = phone_px / canvas_w
            rows.append({"row": "phone", "pass": True, "info": True,
                         "msg": f"INFO canvas {canvas_w} px -> {phone_px} physical px (browser x{up:.2f}); "
                                f"layer drawn at {shipped['width'] * mag:.0f} canvas px = {shipped['width'] * mag * up:.0f} physical px; "
                                f"source px per canvas px {1 / mag:.2f}, distinct samples per physical px {1 / up:.2f}"})
    return all(r["pass"] for r in rows), rows


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("record")
    r.add_argument("--source", required=True)
    r.add_argument("--out", required=True)
    c = sub.add_parser("check")
    c.add_argument("--shipped", required=True)
    g = c.add_mutually_exclusive_group(required=True)
    g.add_argument("--source")
    g.add_argument("--record")
    c.add_argument("--mag", type=float)
    c.add_argument("--canvas-w", type=int)
    c.add_argument("--phone-px", type=int, help="physical phone width, e.g. 1080 for 412 CSS px at DPR 2.625 (INFO row)")
    c.add_argument("--json")
    a = ap.parse_args(argv)
    need_tools()
    if a.cmd == "record":
        p = Path(a.source)
        if not p.is_file():
            print(f"layer_source: no file {p}", file=sys.stderr)
            return 2
        rec = measure(p)
        Path(a.out).write_text(json.dumps(rec, indent=1) + "\n")
        print(f"recorded {p.name}: {rec['width']}x{rec['height']} {rec['fps']} fps {rec['frames']} frames "
              f"{(rec['videoBitrate'] or 0) / 1000:.0f} kb/s -> {a.out}")
        return 0
    sp = Path(a.shipped)
    if not sp.is_file():
        print(f"layer_source: no file {sp}", file=sys.stderr)
        return 2
    if a.source:
        if not Path(a.source).is_file():
            print(f"layer_source: no file {a.source}", file=sys.stderr)
            return 2
        source = measure(Path(a.source))
    else:
        if not Path(a.record).is_file():
            print(f"layer_source: no file {a.record}", file=sys.stderr)
            return 2
        source = json.loads(Path(a.record).read_text())
    shipped = measure(sp)
    ok, rows = check(shipped, source, a.mag, a.canvas_w, a.phone_px)
    for x in rows:
        tag = "INFO" if x.get("info") else ("PASS" if x["pass"] else "FAIL")
        print(f"{tag}  {x['row']:<13} {x['msg']}")
    print("Verdict:", "PASS" if ok else "FAIL")
    if a.json:
        Path(a.json).write_text(json.dumps({"pass": ok, "rows": rows, "shipped": {k: v for k, v in shipped.items() if k != 'frameMd5'},
                                            "source": {k: v for k, v in source.items() if k != 'frameMd5'}}, indent=1) + "\n")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
