#!/usr/bin/env python3
"""Vision stage selftest. Schema + a tiny sealed box. Not the hero tower.
Edge ring: a painted dark ring FAILs, a flat plate PASSes.
Relief align: an offset edge FAILs, the same edge PASSes.
"""
import os, sys, tempfile, json
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import vision
import vision_build as VB
from checks.edge_ring import measure as edge_ring
from checks.relief_align import overlap

def main():
    doc = {
        "silhouette": {"localXY_m": [[-1, 0], [1, 0], [1, 4], [-1, 4]], "source": "t", "confidence": 1},
        "size": {"width_m": 2, "depth_m": 1, "height_m": 4, "source": "t", "confidence": 1},
        "plan": {"backScale": 1, "source": "t", "confidence": 1},
        "sand": {"sinkBelowBase_m": 0.2, "source": "t", "confidence": 1},
        "features": {"front": [{"type": "chrome", "bbox_normalized": [0.1, 0.1, 0.2, 0.5], "relative_depth": 0.8, "depth_m": 0.2, "confidence": 0.5, "source": "t"}]},
        "placement": {"origin": [0, 0, 0], "right": [1, 0, 0], "up": [0, 1, 0], "toward": [0, 0, 1], "source": "t", "confidence": 1},
    }
    vision.validate(doc)
    try:
        vision.validate({"size": {}})
        raise SystemExit("validate should reject a short doc")
    except ValueError:
        pass
    (V, F, M), meta = VB.massing(vision._doc_for_mesh(doc, doc["features"]["front"]))
    o, nm, n = VB.manifold_counts(V, F)
    assert o == 0 and nm == 0 and n > 0, (o, nm, n)
    td = tempfile.mkdtemp(prefix="vision-st-")
    rep = vision.blender_seal(V, F, meta.get("hole"), os.path.join(td, "box.glb"), os.path.join(td, "box.json"))
    assert rep["open"] == 0 and rep["nonManifold"] == 0, rep
    size = rep.get("gltfSize") or [0, 0, 0]
    # glTF Y is up. A Z-up export lays the box on its side and this fails.
    assert size[1] > size[2] and size[1] > 3, size
    top, _ = vision.feature_atlas_rows(0.02, 0.08, 100)
    bot, _ = vision.feature_atlas_rows(0.90, 0.08, 100)
    assert top < 15 and bot > 80, (top, bot)
    # edge ring
    img = np.full((80, 80, 3), 0.6, np.float32)
    m = np.zeros((80, 80), bool); m[10:70, 10:70] = True
    assert edge_ring(img, m)["ok"], edge_ring(img, m)
    dark = img.copy(); dark[10:14, 10:70] = 0.02; dark[66:70, 10:70] = 0.02; dark[10:70, 10:14] = 0.02; dark[10:70, 66:70] = 0.02
    bad = edge_ring(dark, m)
    assert bad["ok"] is False, bad
    # relief align
    a = Image.new("L", (64, 64), 40); d = ImageDraw.Draw(a); d.rectangle((16, 8, 20, 56), fill=200)
    b = Image.new("RGB", (64, 64), (30, 30, 30)); d2 = ImageDraw.Draw(b); d2.rectangle((16, 8, 20, 56), fill=(220, 220, 220))
    good = overlap(a, b)
    assert good["ok"], good
    c = Image.new("RGB", (64, 64), (30, 30, 30)); d3 = ImageDraw.Draw(c); d3.rectangle((40, 8, 44, 56), fill=(220, 220, 220))
    off = overlap(a, c)
    assert off["ok"] is False, off
    import fusion
    marker = fusion.vflip_marker()
    assert marker["ok"], marker
    mjs = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "runtime", "vision-tower.mjs")).read()
    assert "albedo.flipY = false" in mjs and "normal.flipY = false" in mjs, "runtime flipY"
    # Two-tone facade: every mask pixel is labelled, and one depth cannot hold the set.
    tone = np.zeros((48, 64, 3), np.uint8)
    tone[:, :32] = (30, 30, 30)
    tone[:, 32:] = (210, 210, 210)
    tmask = np.ones((48, 64), bool)
    tlog = []
    tlab, _ = fusion.segment_edge_snap(tone, tmask, tlog, pct=80, min_area=8)
    un = int((tmask & (tlab <= 0)).sum())
    assert un == 0, (un, tlog)
    assert int(tlab.max()) >= 2, tlog
    disp = np.where(tlab == 1, 1.0, 2.0).astype(np.float32)
    q, hist, ok, _med = fusion.plane_depths(tlab, disp, {}, {"features": {"front": []}}, tlog)
    top = max(h["segments"] for h in hist)
    assert ok and top / max(1, len(q)) <= 0.50, (hist, tlog)
    # A face-normalized box must hit the facade strip, not the empty atlas.
    strip = np.zeros((40, 80, 3), np.uint8)
    strip[:, :20] = 40
    strip[:, 16:20] = 220
    sm = np.zeros((40, 80), bool)
    sm[:, :20] = True
    slab = np.ones((40, 80), np.int32)
    slab[~sm] = 0
    sdoc = {"features": {"front": [{"type": "chrome", "bbox_normalized": [0.70, 0.05, 0.25, 0.9], "depth_cm": 85}]}}
    slog = []
    _so, sk = fusion.split_feature_priors(slab, strip, sm, sdoc, slog)
    assert any(v == "chrome" for v in sk.values()), slog
    print("PASS vision_st", json.dumps({"tris": rep["tris"], "align": good["overlap"], "offset": off["overlap"], "vflip": marker["top"], "tone_segs": int(tlab.max()), "tone_share": round(top / len(q), 3)}))

if __name__ == "__main__":
    main()
