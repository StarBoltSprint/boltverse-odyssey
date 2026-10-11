"""Feature 6 — god-ray cards already painted in the Imagine atlas, aimed at the key sun.

Overdraw is a solid-angle estimate and is capped. No new texture is generated.
A missing atlas is a request, not a paint.
"""
import math, os

import geom

CAP = 0.08
COUNT = 16
# One shaft: about 6 m wide at 200 m, inside an 80 degree frame, tall on screen.
WIDTH_M = 6.0
DIST_M = 200.0
FOV_DEG = 80.0
VFRAC = 0.35


def _each():
    hfrac = (WIDTH_M / DIST_M) / math.radians(FOV_DEG)
    return hfrac * VFRAC


def _atlas(sky):
    if not sky:
        return None
    root = os.path.dirname(os.path.dirname(os.path.dirname(sky)))
    cand = os.path.join(root, "sky1", "sky7-atlas.png")
    return cand if os.path.exists(cand) else None


def build(key_path, out_dir, sky=None, light=None, plates=None, game=None):
    sun = geom.read_sun(light) if light else None
    if sun is None:
        import sample
        img = sample.load_rgb(key_path)
        elev = geom.elevation_from_key(img)
        sun = {"azimuthDeg": None, "elevationDeg": elev, "dir": geom.heading_to_dir(0.0, elev), "source": "key-bright-row"}
    each = _each()
    keep = max(1, min(COUNT, int(CAP / each)))
    over = round(keep * each, 4)
    atlas = _atlas(sky)
    requests = []
    if atlas is None:
        requests.append({
            "id": "sprites-atlas",
            "purpose": "God-ray and fog cards painted on black, aimed at the key sun.",
            "feature": "sprites",
            "source": os.path.abspath(key_path),
            "prompt": (
                "Paint soft light shafts and a thin haze card on a black field, in the same hour as the key. "
                "The shafts point along the sunlight. No ground, no dog, no text."
            ),
            "count": 1,
        })
    return {
        "id": "sprites",
        "enabled": True,
        "flag": "sprites",
        "sunDir": sun["dir"],
        "sunSource": sun["source"],
        "count": COUNT,
        "keep": keep,
        "eachOverdraw": round(each, 5),
        "overdrawCap": CAP,
        "overdraw": over,
        "atlas": atlas,
        "requests": requests,
    }


def selftest(check):
    each = _each()
    keep = max(1, min(COUNT, int(CAP / each)))
    check(keep * each <= CAP + 1e-6, "cap")
    check(1 <= keep <= COUNT, "count")
