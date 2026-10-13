#!/usr/bin/env python3
"""tools/keysheet/extract.py — key image -> key feature sheet (any zone, fully local).
usage: extract.py ELEMENTS.json KEY.jpg OUTDIR [--sam2-python /workspace/.venv-sam2/bin/python] [--no-sam2]

ELEMENTS.json (hand-authored per zone, see zones/zd-terrace.json): a list of visible elements, each with
  id, kind (region | band | dark_rect | drips | straight_bar), what (shape / thickness / colour / position words),
  box [x0,y0,x1,y1] (fractions of the key) = SAM2 box prompt and search window, optional params, and pass rules.
Writes OUTDIR/masks/<id>.png (SAM2 mask, or the box when SAM2 is off/unavailable), OUTDIR/sheet.json with,
per element: mask bbox/area/centroid (px and fraction), Lab colour of the mask, measured detector values on the
key (count, thickness, boxes) and the pass rule check.py applies to a render."""
import argparse, json, subprocess, sys, tempfile
from pathlib import Path
import cv2, numpy as np
HERE = Path(__file__).resolve().parent; ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import detect as D

W = 1024


def sam2_masks(key, els, py):
    boxes = [{"id": e["id"], "box": e["box"]} for e in els if e.get("sam2", True)]
    with tempfile.TemporaryDirectory() as t:
        bj = Path(t) / "b.json"; bj.write_text(json.dumps({"instances": boxes}))
        r = subprocess.run([py, str(ROOT / "tools/placement-from-key/sam2_boxes.py"), str(key), str(bj), f"{t}/l.npy", f"{t}/r.json"],
                           capture_output=True, text=True, timeout=900)
        if r.returncode:
            raise RuntimeError(r.stderr[-400:])
        lab = np.load(f"{t}/l.npy"); rep = json.loads(Path(f"{t}/r.json").read_text())
    # larger boxes are painted first; smaller ones overwrite -> per-id masks from labels + own box
    out = {}
    for inst in rep["instances"]:
        out[inst["id"]] = lab == inst["label"]
    return out


def region_mask(e, sam, shape):
    h, w = shape
    x0, y0, x1, y1 = e["box"]
    box = np.zeros(shape, bool); box[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)] = True
    m = sam.get(e["id"])
    if m is None or m.sum() < 50:
        return box, "box"
    m = cv2.resize(m.astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST) > 0
    grow = int(e.get("grow_frac", 0.03) * w)            # tolerate render misregistration
    m = cv2.dilate(m.astype(np.uint8), np.ones((2 * grow + 1, 2 * grow + 1), np.uint8)) > 0
    return m & box, "sam2"


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("elements"); ap.add_argument("key"); ap.add_argument("out")
    ap.add_argument("--sam2-python", default="/workspace/.venv-sam2/bin/python"); ap.add_argument("--no-sam2", action="store_true")
    a = ap.parse_args(argv)
    spec = json.loads(Path(a.elements).read_text()); els = spec["elements"]
    out = Path(a.out); (out / "masks").mkdir(parents=True, exist_ok=True)
    K = cv2.resize(cv2.imread(a.key), (W, W), interpolation=cv2.INTER_AREA)
    sam, how = {}, "box"
    if not a.no_sam2 and Path(a.sam2_python).exists():
        try:
            sam = sam2_masks(a.key, els, a.sam2_python); how = "sam2.1_hiera_small"
        except Exception as ex:  # noqa: BLE001
            how = f"box (sam2 failed: {str(ex)[:120]})"
    lab = D.lab_of(K); L = lab[..., 0]
    sheet = {"zone": spec.get("zone"), "key": str(a.key), "frame_px": W, "masks_from": how, "elements": []}
    for e in els:
        R, src = region_mask(e, sam, (W, W))
        cv2.imwrite(str(out / "masks" / f"{e['id']}.png"), R.astype(np.uint8) * 255)
        p = dict(e.get("params", {}))
        if "thr_pct" in p:            # brightness threshold from the key region itself
            p["thr_L"] = float(np.percentile(L[R], 100 - p["thr_pct"]))
        meas = D.KINDS[e["kind"]](L, lab, R, p)
        ys, xs = np.nonzero(R)
        col = [float(lab[..., k][R].mean()) for k in range(3)]
        sheet["elements"].append({
            "id": e["id"], "kind": e["kind"], "what": e.get("what", ""), "mask": f"masks/{e['id']}.png", "mask_src": src,
            "bbox_px": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())], "area_frac": round(float(R.mean()), 5),
            "centroid_frac": [round(float(xs.mean()) / W, 4), round(float(ys.mean()) / W, 4)],
            "region_lab": [round(v, 2) for v in col], "params": p, "key": meas, "rule": e.get("rule", {})})
    (out / "sheet.json").write_text(json.dumps(sheet, indent=1))
    print(json.dumps({e["id"]: e["key"].get("count") for e in sheet["elements"]}))


if __name__ == "__main__":
    main()
