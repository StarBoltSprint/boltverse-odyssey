"""Feature 2 — baked light into the ground albedo, plus a Cycles uv2 path.

The page loads the albedo plates. cycles_bake.py is the mesh lightMap path.
An Imagine relight is written as a request and is not generated.
"""
import os
import numpy as np
from PIL import Image

import geom
import sample

# Sand / avenue band of a key frame. The rect is a measurement window, not a tint.
SAND = (0.30, 0.62, 0.70, 0.82)


def _normal_for(path):
    root = os.path.dirname(os.path.dirname(path))
    base = os.path.splitext(os.path.basename(path))[0]
    cand = os.path.join(root, "normal", base + "-nh.jpg")
    return cand if os.path.exists(cand) else None


def _plates(plates):
    if not plates or not os.path.isdir(plates):
        return []
    names = [n for n in sorted(os.listdir(plates)) if n.startswith("ground-g") and n.lower().endswith((".jpg", ".png"))]
    return [os.path.join(plates, n) for n in names]


def _shade(albedo, normal, bounce_lin, elev_deg):
    lin = sample.srgb_to_lin(albedo)
    if normal is None:
        ao = np.ones(lin.shape[:2], np.float32)
    else:
        height = normal[..., 2]
        if float(height.std()) < 0.02:
            ao = np.ones(height.shape, np.float32)
        else:
            med = float(np.median(height))
            spread = max(float(height.std()) * 2.0, 1e-3)
            ao = np.clip((height - med) / spread * 0.5 + 0.85, 0.55, 1.0).astype(np.float32)
    mix = (1.0 - ao) * float(max(0.08, min(0.35, 0.35 * (1.0 - np.sin(np.deg2rad(elev_deg))))))
    bounce = np.array(bounce_lin, np.float32)
    out = lin * ao[..., None] * (1.0 - mix[..., None]) + bounce * mix[..., None]
    return np.clip(sample.lin_to_srgb(out), 0, 1)


def build(key_path, out_dir, sky=None, light=None, plates=None, game=None):
    key = sample.load_rgb(key_path)
    bounce = sample.colour(key, SAND, os.path.abspath(key_path))
    sun = geom.read_sun(light) if light else None
    if sun is None:
        elev = geom.elevation_from_key(key)
        sun = {"azimuthDeg": None, "elevationDeg": elev, "dir": None, "source": "key-bright-row"}
    dest = os.path.join(out_dir, "bake")
    os.makedirs(dest, exist_ok=True)
    written, size = [], None
    for i, path in enumerate(_plates(plates)):
        albedo = sample.load_rgb(path)
        npath = _normal_for(path)
        normal = sample.load_rgb(npath) if npath else None
        if normal is not None and normal.shape[:2] != albedo.shape[:2]:
            normal = None
        img = _shade(albedo, normal, bounce["linear"], sun["elevationDeg"])
        if size is None:
            size = int(img.shape[0])
        name = f"g{i}.png"
        Image.fromarray((img * 255).astype(np.uint8)).save(os.path.join(dest, name))
        written.append(f"bake/{name}")
    src = _plates(plates)[0] if _plates(plates) else os.path.abspath(key_path)
    request = {
        "id": "bake-sand",
        "purpose": "Relight the shadowed grains so the sand bounce matches the key avenue.",
        "feature": "bake",
        "source": src,
        "prompt": (
            "Edit this ground plate. Keep the same sand and the same sun direction already in the picture. "
            "In the shadowed grains only, add the warm light that has bounced off the avenue floor in the key. "
            "Leave the lit grains as they are. Do not add an object, a person, or a new light source."
        ),
        "count": 1,
    }
    return {
        "id": "bake",
        "enabled": True,
        "flag": "bake",
        "sun": {k: sun[k] for k in ("azimuthDeg", "elevationDeg", "dir", "source")},
        "bounce": bounce,
        "size": size,
        "plates": written,
        "ao": "normal-blue" if written else "none",
        "cycles": "tools/look/cycles_bake.py",
        "requests": [request],
    }


def selftest(check):
    import json, tempfile
    from PIL import Image as Im
    img = np.zeros((16, 16, 3), np.float32)
    img[:, :, 0] = 0.55
    img[:, :, 1] = 0.42
    img[12:, :, :] *= 0.4
    nrm = np.zeros_like(img)
    nrm[..., 2] = 0.8
    nrm[4:8, 4:8, 2] = 0.2
    with tempfile.TemporaryDirectory() as d:
        key = os.path.join(d, "key.png")
        plates = os.path.join(d, "ground")
        os.makedirs(plates)
        Im.fromarray((img * 255).astype(np.uint8)).save(key)
        Im.fromarray((img * 255).astype(np.uint8)).save(os.path.join(plates, "ground-g0.jpg"))
        os.makedirs(os.path.join(d, "normal"))
        Im.fromarray((nrm * 255).astype(np.uint8)).save(os.path.join(d, "normal", "ground-g0-nh.jpg"))
        # _normal_for expects plates dir's parent / normal. Layout: d/ground and d/normal.
        feat = build(key, d, plates=plates)
        check(feat["plates"] == ["bake/g0.png"], "bake name")
        check(os.path.exists(os.path.join(d, "bake", "g0.png")), "bake file")
        check(feat["requests"] and feat["requests"][0]["count"] == 1, "bake request")
        check("#" not in feat["requests"][0]["prompt"], "bake prompt")
        doc = {"bounce": feat["bounce"]}
        import colour_check
        hits = []
        colour_check.verify_json("bake", doc, hits, {})
        check(not hits, "bake colour " + str(hits))
        raw = open(os.path.join(os.path.dirname(__file__), "cycles_bake.py"), encoding="utf-8").read()
        check("uv2" in raw and "lightMap" in raw, "cycles path")
        check(not colour_check.scan_text("cycles_bake.py", raw), "cycles scan")
    json.dumps(feat)
