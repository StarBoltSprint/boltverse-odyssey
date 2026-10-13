#!/usr/bin/env python3
"""tools/materials/texflow.py - key crop -> Imagine (grok CLI image_edit, subscription) -> tileable texture -> local gate
-> material library. Works for any key: crops come from the AUTO key sheet (largest L2 elements of each class).
usage: python3 tools/materials/texflow.py SHEETDIR [--classes snow,ice,stone] [--lib DIR] [--tries 2] [--dry]
Gate vs the class key crop (all must hold): seam <= 1.5 both axes, high-pass self-similarity < 0.5 (no visible repeat),
>= 500 px/m, chroma dEab <= 15 (L matched by shader gain), grain: high-pass std ratio 0.5..2.0 (roughness),
gradient-orientation entropy |diff| <= 0.35, FFT peak ratio <= 1.6x key (no periodic stripes).
Failures are regenerated (new grok job, stricter prompt) up to --tries; passing tiles + gate JSON land in the library
with an index.json for reuse by later keys."""
import argparse, json, shutil, subprocess, sys, time, urllib.parse
from pathlib import Path
import numpy as np, cv2
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE.parent / "keysheet"))
from seamless import seamless, gates  # noqa: E402
GROK = "/home/box/.local/bin/grok"; WORK = Path("/workspace/grokcli/scratch/texflow")
TILE_M = {"snow": 1.2, "ice": 1.0, "stone": 1.9, "dark": 1.9}
DESC = {"snow": "wind-packed fresh snow, soft irregular lumps, sags and small crumbled chunks, faint sparkle",
        "ice": "matte slightly translucent blue glacial ice with crisp coarse fracture planes, vertical melt-flow streaks and strong internal cracks (high-contrast grain like the reference icefall)",
        "stone": "frost-dusted dark blue-grey basalt blocks surface, chipped worn edges, rime in cracks",
        "dark": "deep shadowed basalt recess surface"}


def crop_for(sd, cls, n=3):
    sh = json.loads((sd / "sheet.json").read_text()); K = cv2.imread(str(sd / "key1024.png"))
    els = sorted([e for e in sh["elements"] if e["level"] == 2 and e["class"] == cls], key=lambda e: -e["area_frac"])
    crops = []
    for e in els[:12]:
        x0, y0, x1, y1 = e["bbox_px"]; s = max(96, min(x1 - x0, y1 - y0))
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2; a, b = max(cx - s // 2, 0), max(cy - s // 2, 0)
        c = K[b:b + s, a:a + s]
        if c.shape[0] >= 64 and c.shape[1] >= 64:
            crops.append(c)
        if len(crops) >= n:
            break
    return crops


def stats(im):
    g = cv2.cvtColor(cv2.resize(im, (256, 256), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY).astype(np.float32)
    hp = g - cv2.GaussianBlur(g, (0, 0), 3)
    gx, gy = cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1)
    h = np.histogram(np.arctan2(gy, gx) % np.pi, 12, (0, np.pi), weights=np.hypot(gx, gy))[0] + 1e-6; h /= h.sum()
    F = np.abs(np.fft.fft2(g - g.mean())); F[0, 0] = 0
    return {"hp_std": float(hp.std()), "orient_H": float(-(h * np.log(h)).sum() / np.log(12)), "fft_peak": float(F.max() / (F.mean() + 1e-6))}


def gate(tile, keyc, cls):
    g = gates(tile, TILE_M[cls], keyc); a, b = stats(tile), stats(keyc)
    g["grain"] = {"hp_ratio": round(a["hp_std"] / max(b["hp_std"], 1e-3), 3), "orient_dH": round(abs(a["orient_H"] - b["orient_H"]), 3),
                  "fft_ratio": round(a["fft_peak"] / max(b["fft_peak"], 1e-3), 3)}
    gr = g["grain"]
    g["pass_grain"] = bool(0.5 <= gr["hp_ratio"] <= 2.0 and gr["orient_dH"] <= 0.35 and gr["fft_ratio"] <= 1.6)
    g["pass_all"] = bool(g["pass"] and g["pass_grain"]); return g


def grok_edit(srcs, cls, attempt):
    WORK.mkdir(parents=True, exist_ok=True)
    extra = " Strictly avoid any repeating pattern, stripes or grid; organic random variation at many scales." if attempt else ""
    prompt = (f'Use ONLY your image_edit tool (no code, no other tools). Make exactly 1 call, aspect_ratio "1:1", then reply with the output file path only.\n'
              f'image={json.dumps([str(s) for s in srcs])} prompt: "Seamless tileable texture, flat orthographic top-down material swatch of {DESC[cls]}, '
              f'colours and grain sampled from the reference crops, uniform even lighting, no shadows, no perspective, no objects, no horizon, no text, '
              f'edges wrap seamlessly, no visible repeating motif.{extra}"')
    t0 = time.time()
    r = subprocess.run([GROK, "-p", prompt, "--always-approve", "--output-format", "json", "--cwd", str(WORK)], capture_output=True, text=True, timeout=900)
    try:
        sid = json.loads(r.stdout)["sessionId"]
    except Exception:  # noqa: BLE001
        return None, {"error": (r.stderr or r.stdout)[-400:]}
    base = Path.home() / ".grok/sessions" / urllib.parse.quote(str(WORK), safe="") / sid / "images"
    imgs = sorted(base.glob("*.jpg")) if base.exists() else sorted((Path.home() / ".grok/sessions").glob(f"*/{sid}/images/*.jpg"))
    return (imgs[-1] if imgs else None), {"session": sid, "sec": round(time.time() - t0, 1)}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("sheet"); ap.add_argument("--classes", default="snow,ice,stone")
    ap.add_argument("--lib", default="/workspace/kitrelief-out/matlib"); ap.add_argument("--tries", type=int, default=2); ap.add_argument("--dry", action="store_true")
    a = ap.parse_args(); sd = Path(a.sheet); lib = Path(a.lib); lib.mkdir(parents=True, exist_ok=True)
    idx_p = lib / "index.json"; idx = json.loads(idx_p.read_text()) if idx_p.exists() else {"materials": []}
    (WORK / "in").mkdir(parents=True, exist_ok=True); report = []
    for cls in a.classes.split(","):
        crops = crop_for(sd, cls)
        if not crops:
            report.append({"class": cls, "status": "no key crop"}); continue
        srcs = []
        for i, c in enumerate(crops[:3]):
            p = WORK / "in" / f"{cls}{i}.jpg"; cv2.imwrite(str(p), cv2.resize(c, (256, 256), interpolation=cv2.INTER_CUBIC), [cv2.IMWRITE_JPEG_QUALITY, 88]); srcs.append(p)
        keyc = np.hstack([cv2.resize(c, (256, 256)) for c in crops[:3]])
        row = {"class": cls, "crops": [str(s) for s in srcs], "attempts": []}
        for t in range(a.tries):
            if a.dry:
                break
            img, meta = grok_edit(srcs, cls, t)
            if img is None:
                row["attempts"].append(meta); continue
            raw = cv2.imread(str(img)); tile = seamless(raw); g = gate(tile, keyc, cls)
            row["attempts"].append({**meta, "img": str(img), "gate": g})
            if g["pass_all"]:
                out = lib / f"{sd.name}-{cls}.jpg"; cv2.imwrite(str(out), tile, [cv2.IMWRITE_JPEG_QUALITY, 88])
                rec = {"name": f"{sd.name}-{cls}", "class": cls, "file": out.name, "tile_m": TILE_M[cls], "key": json.loads((sd / "sheet.json").read_text())["key"],
                       "gate": g, "made": time.strftime("%Y-%m-%d %H:%M")}
                idx["materials"] = [m for m in idx["materials"] if m["name"] != rec["name"]] + [rec]; row["status"] = "PASS"; row["file"] = str(out); break
        row.setdefault("status", "dry" if a.dry else "FAIL")
        report.append(row); print(json.dumps({k: row[k] for k in ("class", "status")}), flush=True)
    idx_p.write_text(json.dumps(idx, indent=1)); (lib / "last-run.json").write_text(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
