#!/usr/bin/env python3
"""Reader-style spec sheet from the key image: object list, scale, plates needed, one auto.py spec per object.

  python3 tools/golden/spec_sheet.py --key KEY --work WORK [--max 3] [--offline]

Objects = the largest relief components of the key (tools/terrain-from-key/masks_auto.py: not ground, not sky) that do
not span the frame edge to edge (those are the rim, built by the terrain). Scale from the key camera (eye 2.6 m, fov 48):
the base row below the horizon gives the distance, the pixel height gives metres. Plates needed per object: a front
view and a 45 deg view, each an image_edit of the key crop on a plain background (so the silhouette can be cut).
Writes WORK/spec-sheet.json, WORK/specs/<id>.json (auto.py --method golden-hull), WORK/crops/<id>.png.
"""
import argparse, json, math, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

H = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(H))
sys.path.insert(0, os.path.join(REPO, "tools", "terrain-from-key"))
from masks_auto import auto_masks  # noqa: E402

EYE, FOV = 2.6, 48.0
TYPE_BY_HUE = [("ice", lambda r, g, b: b > r + 15 and b > 140), ("rock", lambda r, g, b: True)]


def sheet(key, work, mx=3, offline=False):
    m = auto_masks(key, {"fovDeg": FOV}, offline=offline); rgb = m["rgb"]; h, w = rgb.shape[:2]
    rel = ndi.binary_opening(m["relief"], iterations=2); lab, k = ndi.label(rel)
    hz = m["horizon"] * h; f = (w / 2) / math.tan(math.radians(FOV) / 2); objs = []
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        if sl is None: continue
        ys, xs = sl; bh, bw = ys.stop - ys.start, xs.stop - xs.start; area = int((lab[sl] == i).sum())
        if bh < 0.08 * h or bw > 0.7 * w or area < 0.004 * h * w or ys.stop >= h - 1: continue  # bottom-edge = foreground terrain
        objs.append((area, ys.start, ys.stop, xs.start, xs.stop, i))
    # a frame-wide relief mass (rim walls) can still carry a landmark: a column band whose top rises far above the rim
    land = rel | m["ground"]; tops = np.array([np.argmax(land[:, x]) if land[:, x].any() else h for x in range(w)], np.float32)
    base = float(np.median(tops)); rise = base - tops; thr = 0.12 * h
    cols = rise > thr; lc, nc = ndi.label(cols)
    for j in range(1, nc + 1):
        xs_ = np.where(lc == j)[0]
        if len(xs_) < 0.02 * w: continue
        x0, x1 = int(xs_.min()), int(xs_.max()) + 1; y0 = int(tops[x0:x1].min())
        y1 = int(min(h, base + 0.05 * h)); area = int(rel[y0:y1, x0:x1].sum())
        if not any(abs(o[3] - x0) < 0.05 * w and abs(o[4] - x1) < 0.05 * w for o in objs):
            objs.append((area, y0, y1, x0, x1, None))
    objs.sort(key=lambda o: -(o[2] - o[1]) * (o[4] - o[3])); out = []
    os.makedirs(os.path.join(work, "crops"), exist_ok=True); os.makedirs(os.path.join(work, "specs"), exist_ok=True)
    for n, (area, y0, y1, x0, x1, li) in enumerate(objs[:mx]):
        oid = f"o{n + 1}"
        below = max(1.0, y1 - hz); dist = min(800.0, EYE * f / below) if y1 > hz else 300.0
        hm = float(np.clip(dist * (y1 - y0) / f, 2, 150))
        pad = int(0.06 * max(y1 - y0, x1 - x0)); box = (max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad))
        crop = os.path.join(work, "crops", oid + ".png"); Image.fromarray(rgb).crop(box).save(crop)
        r, g, b = (rgb[lab == li] if li is not None else rgb[y0:y1, x0:x1].reshape(-1, 3)).mean(0)
        typ = next(t for t, fn in TYPE_BY_HUE if fn(r, g, b))
        plates = {"front": f"obj-{oid}-front", "side": f"obj-{oid}-side"}
        out.append({"id": oid, "type": typ, "boxFrac": [round(box[0] / w, 3), round(box[1] / h, 3), round(box[2] / w, 3), round(box[3] / h, 3)],
                    "heightM": round(hm, 1), "distanceM": round(dist, 1), "areaFrac": round(area / (h * w), 4), "crop": crop, "plates": plates,
                    "budgetTris": 25000 if hm < 30 else 90000})
    res = {"key": os.path.abspath(key), "masks": m["method"], "horizonRow": round(m["horizon"], 3), "objects": out}
    json.dump(res, open(os.path.join(work, "spec-sheet.json"), "w"), indent=1)
    return res


def prompts_for(sh):
    lock = "Same world, light and palette as the reference; the object ALONE, centred, whole, on a plain flat dark-grey background, no ground, no text."
    P = []
    for o in sh["objects"]:
        P.append({"slot": o["plates"]["front"], "aspect": "1:1", "refs": [o["crop"]], "prompt": f"Front view of this {o['type']} object (about {o['heightM']} m tall), straight-on. {lock}"})
        P.append({"slot": o["plates"]["side"], "aspect": "1:1", "refs": [o["crop"]], "prompt": f"The same {o['type']} object seen from 45 degrees to its left, same height. {lock}"})
    return P


def auto_spec(o, plates_dir, work):
    find = lambda s: next((os.path.join(plates_dir, s + e) for e in (".png", ".jpg", ".jpeg", ".webp") if os.path.exists(os.path.join(plates_dir, s + e))), None)
    return {"object": o["id"], "type": o["type"], "heightM": o["heightM"], "crop": o["crop"], "work": os.path.join(work, "objects", o["id"]),
            "budgetTris": o["budgetTris"], "sideAngleDeg": 45, "imagine": {"views": {"front": find(o["plates"]["front"]), "side": find(o["plates"]["side"])}}}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--key", required=True); ap.add_argument("--work", required=True)
    ap.add_argument("--max", type=int, default=3); ap.add_argument("--offline", action="store_true"); a = ap.parse_args()
    r = sheet(a.key, a.work, a.max, a.offline); print(json.dumps({"masks": r["masks"], "objects": [(o["id"], o["type"], o["heightM"]) for o in r["objects"]]}))
