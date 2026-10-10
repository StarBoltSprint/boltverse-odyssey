"""Stage 0 'classify' (q16 #1): object type of a key crop -> type profile (views, geometry strategy, px/m, relief
amplitude, gate thresholds) from profiles/<type>.yaml merged with the tools/object-gate profile of that type.

Types: building (hard-surface), rock (organic), wreck (wreck/prop), vegetation, ice (ice/transparent), creature, effect.
Heuristics (always): silhouette straightness (Hough), aspect, fill, hue families, boundary sharpness, banding.
Grok vision (optional, --vision grokbuild): one headless Grok Build step looks at the crop and answers JSON
{type, confidence, checklist}; it wins when the heuristics are unsure (margin < 0.15) or say creature/vegetation/ice,
which have no Zone B training examples.

  python3 classify.py <crop.png> [--mask m.npy] [--height-m 45] [--out type-profile.json] [--vision none|grokbuild]
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import i23d_common as C

TYPES = ["building", "rock", "wreck", "vegetation", "ice", "creature", "effect"]


def features(img, mask):
    import cv2
    h, w = mask.shape
    bb = C.bbox(mask) or (0, 0, w, h); x0, y0, x1, y1 = bb
    area = mask.sum(); fill = float(area / max(1, (x1 - x0) * (y1 - y0)))
    aspect = float((y1 - y0) / max(1, (x1 - x0)))
    hsv = cv2.cvtColor((img * 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    H, S, V = hsv[..., 0] * 2, hsv[..., 1] / 255, hsv[..., 2] / 255
    m = mask
    frac = lambda sel: float((sel & m).sum() / max(1, area))
    warm = frac(((H < 50) | (H > 340)) & (S > 0.25) & (V > 0.15))
    green = frac((H > 70) & (H < 170) & (S > 0.2) & (V > 0.12))
    cyan = frac((H >= 170) & (H < 230) & (S > 0.12) & (V > 0.45))
    grey = frac((S < 0.18))
    bright = float(V[m].mean()) if area else 0.0
    L = C.luma(img); g8 = (L * 255).astype(np.uint8)
    edges = cv2.Canny(g8, 40, 120) > 0
    band = ndi.binary_dilation(mask, iterations=3)
    e = edges & band
    diag = np.hypot(x1 - x0, y1 - y0)
    lines = cv2.HoughLinesP(e.astype(np.uint8) * 255, 1, np.pi / 180, 30, minLineLength=max(12, int(0.08 * diag)), maxLineGap=3)
    straight_len = 0.0; ang = []
    if lines is not None:
        for (a, b, c, d) in np.asarray(lines).reshape(-1, 4):
            straight_len += np.hypot(c - a, d - b); ang.append(np.degrees(np.arctan2(d - b, c - a)) % 180)
    straight = float(min(1.0, straight_len / max(1, e.sum())))
    ang = np.array(ang) if ang else np.zeros(0)
    vert = float(((np.abs(ang - 90) < 20)).mean()) if len(ang) else 0.0
    gy, gx = ndi.sobel(L, 0), ndi.sobel(L, 1)
    gm = np.hypot(gx, gy)
    hband = float((np.abs(gy)[m].sum()) / max(1e-6, (np.abs(gx)[m].sum() + np.abs(gy)[m].sum()))) if area else 0.5
    boundary = mask ^ ndi.binary_erosion(mask, iterations=2)
    inside = ndi.binary_erosion(mask, iterations=6)
    edge_sharp = float(gm[boundary].mean() / (gm[inside].mean() + 1e-3)) if inside.any() and boundary.any() else 1.0
    bg = ~ndi.binary_dilation(mask, iterations=6)
    bg_dark = float(V[bg].mean() < 0.12) if bg.any() else 0.0
    tex = float(ndi.laplace(L)[inside].std()) if inside.any() else 0.0
    hull_area = float(cv2.contourArea(cv2.convexHull(np.argwhere(mask)[:, ::-1].astype(np.int32)))) if area > 10 else 1.0
    solidity = float(area / max(1.0, hull_area))
    dark = frac(V < 0.3)
    sat = float(S[m].mean()) if area else 0.0
    diag_l = float(((np.abs(ang - 90) >= 20) & (np.abs(ang - 0) >= 15) & (np.abs(ang - 180) >= 15)).mean()) if len(ang) else 0.0
    nlines = float(len(ang) / max(1.0, diag / 40))
    return dict(fill=round(fill, 3), aspect=round(aspect, 3), warm=round(warm, 3), green=round(green, 3), cyan=round(cyan, 3),
                grey=round(grey, 3), bright=round(bright, 3), straight=round(straight, 3), vertLines=round(vert, 3),
                hband=round(hband, 3), edgeSharp=round(edge_sharp, 3), bgDark=bg_dark, texture=round(tex, 4), maskFrac=round(float(area / (h * w)), 3),
                solidity=round(solidity, 3), dark=round(dark, 3), sat=round(sat, 3), diagLines=round(diag_l, 3), lineDensity=round(nlines, 3))


def scores(f):
    """Hand-tuned linear scores (tuned on the 16 Zone B crops in selftest; warm sunset light tints everything, so hue
    is NOT used for rock vs building). Higher = more likely."""
    cl = lambda x: min(1.0, max(0.0, x))
    tall = cl((f["aspect"] - 1.2) / 1.0); wide = cl((0.8 - f["aspect"]) / 0.4)
    solid_hi = cl((f["solidity"] - 0.85) / 0.15); solid_lo = cl((0.9 - f["solidity"]) / 0.15)
    sat_hi = cl((f["sat"] - 0.25) / 0.25); sat_lo = cl((0.3 - f["sat"]) / 0.2)
    s = dict(
        building=2.0 * tall + 1.5 * f["vertLines"] + 0.8 * f["straight"],
        rock=0.8 * (1 - f["straight"]) * (1 - tall) + 2.0 * sat_hi + 0.5 * solid_hi - 1.2 * f["vertLines"] * tall
             - 2.0 * solid_lo - 1.5 * f["bgDark"],
        wreck=1.5 * wide * f["diagLines"] + 3.0 * (1 - f["solidity"]) + 0.6 * f["straight"] + 1.5 * sat_lo - 1.5 * f["bgDark"],
        vegetation=4.0 * f["green"] + 0.6 * (1 - f["fill"]) - 1.0 * f["straight"],
        ice=4.0 * f["cyan"] + 0.8 * f["bright"] * (1 - f["warm"]) - 0.8 * f["warm"],
        creature=0.3,   # no reliable heuristic: Grok vision decides
        effect=3.0 * f["bgDark"] + 0.8 * cl(1.2 - f["edgeSharp"]) - 1.0 * tall,
    )
    return {k: round(float(v), 3) for k, v in s.items()}


def softmax(d, t=0.35):
    v = np.array(list(d.values())) / t; v = np.exp(v - v.max()); v /= v.sum()
    return {k: round(float(x), 3) for k, x in zip(d, v)}


def vision_prompt(crop, out_json):
    return (f"Look at the image {crop} (a crop of a game key art). Classify the ONE main object into exactly one of "
            f"{TYPES} (building = hard-surface architecture; rock = organic solid like mesa/boulder/cliff; wreck = wreck, "
            "vehicle, debris or prop; ice = ice/glass/crystal/transparent; effect = sand/dust/smoke/particles with no solid "
            "body). Also list 4-10 visual features a 3D copy must keep (shape, materials, colours, details), each with an "
            f"approximate bbox in crop pixels. Write ONLY this JSON to {out_json}: "
            '{"type": "...", "confidence": 0..1, "why": "...", "checklist": [{"id": "...", "feature": "...", "region": [x0,y0,x1,y1]}]}')


def run_vision(crop, work):
    """One headless Grok Build step (own worktree under $I23D_VISION_WT). Returns the parsed JSON or None."""
    import subprocess
    wt = os.environ.get("I23D_VISION_WT")
    if not wt: return dict(error="set I23D_VISION_WT to a free git worktree for the vision step")
    out = os.path.join(work, "vision.json"); pf = os.path.join(work, "vision-prompt.md")
    open(pf, "w").write(vision_prompt(os.path.abspath(crop), os.path.abspath(out)))
    spec = os.path.join(wt, "spec.md")
    if not os.path.exists(spec): open(spec, "w").write("# vision step: answer the prompt, edit nothing\n")
    subprocess.run([os.path.join(os.environ.get("I23D_KIT", "/workspace/grokcli/kit"), "run-step.sh"), wt, spec, pf],
                   env=dict(os.environ, KIT_WAIT="1", EFFORT="medium"))
    return json.load(open(out)) if os.path.exists(out) else dict(error="vision step wrote no answer")


def classify(crop, mask=None, height_m=None, vision="none", work=None):
    img = C.load_rgb(crop)
    s = 512 / max(img.shape[:2])
    if s < 1:   # analysis copy only (the crop itself is never modified)
        img = np.asarray(Image.fromarray((img * 255).astype(np.uint8)).resize((round(img.shape[1] * s), round(img.shape[0] * s)), Image.LANCZOS)).astype(np.float32) / 255
    m = C.load_mask(mask, (img.shape[1], img.shape[0])) if mask else C.object_mask(img)
    f = features(img, m); sc = scores(f); pr = softmax(sc)
    order = sorted(pr, key=pr.get, reverse=True); top, second = order[0], order[1]
    margin = pr[top] - pr[second]
    needs_vision = margin < 0.15 or top in ("creature", "vegetation", "ice")
    decided, source, vis = top, "heuristics", None
    if vision == "grokbuild":
        vis = run_vision(crop, work or os.path.dirname(os.path.abspath(crop)))
        if vis and vis.get("type") in TYPES and (needs_vision or vis.get("confidence", 0) >= 0.8):
            decided, source = vis["type"], "grok-vision"
    prof = C.load_profile(decided)
    gate_type = prof["gate"]["profile"]
    if decided == "wreck" and height_m and height_m < prof["gate"].get("smallBelowM", 0):
        gate_type = prof["gate"]["smallProfile"]; prof["gateResolved"] = C._deep_merge(C.gate_profile(gate_type), {})
    checklist = list((prof["gateResolved"].get("checklistTemplate") or []))
    if vis and vis.get("checklist"): checklist += [dict(c, source="grok-vision") for c in vis["checklist"]]
    return dict(crop=os.path.abspath(crop), type=decided, source=source, gateProfile=gate_type, confidence=pr[decided] if source == "heuristics" else vis.get("confidence"),
                margin=round(margin, 3), needsVision=bool(needs_vision and source == "heuristics"), probabilities=pr, scores=sc, features=f,
                heightM=height_m, profile={k: v for k, v in prof.items() if k != "gateResolved"}, gate=prof["gateResolved"], checklist=checklist,
                vision=vis)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("crop"); ap.add_argument("--mask"); ap.add_argument("--height-m", type=float)
    ap.add_argument("--out"); ap.add_argument("--vision", default="none", choices=["none", "grokbuild"])
    a = ap.parse_args()
    r = classify(a.crop, a.mask, a.height_m, a.vision, os.path.dirname(a.out) if a.out else None)
    if a.out: C.dump(r, a.out)
    print(json.dumps({k: r[k] for k in ("type", "source", "confidence", "margin", "needsVision", "probabilities")}))
