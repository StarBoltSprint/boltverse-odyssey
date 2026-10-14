"""Element type classification for the auto key sheet (generic, any key). One type per element:
sky, ground, wall, ice_mass, stone_block, cornice, door, rubble, snow_pillow, tread_snow, snow_patch, icicle.
Inputs are only the sheet's own fields (level, class, src, props) and the element's back-projected points."""
import numpy as np

TYPES = ("sky", "ground", "wall", "ice_mass", "stone_block", "cornice", "door", "rubble", "snow_pillow", "tread_snow", "snow_patch", "icicle")


def up_facing(n):
    """n: unit normal in OpenCV camera coords (y down). Up-facing surface -> normal has a strong -y part."""
    return n is not None and -n[1] > 0.6


def classify(e, n, frame=1024):
    p = e.get("props") or {}; c = e["class"]; a = e["area_frac"]; cy = e["centroid_frac"][1]
    asp = p.get("outline.aspect", 1.0); thick = p.get("depth.thick_px", 0.0)
    if c == "sky":
        return "sky"
    if e["src"] == "drip":
        return "icicle"
    if e["level"] == 1:
        if c == "snow" or up_facing(n):
            return "ground" if cy > 0.45 else "tread_snow"
        return "ice_mass" if c == "ice" else "wall"
    if c == "dark":
        return "door" if p.get("outline.extent", 0) > 0.45 else "stone_block"
    if c == "snow":
        if up_facing(n) and asp >= 2.5:
            return "tread_snow"
        if asp >= 1.5 and thick >= 6:
            return "snow_pillow"
        return "snow_patch"
    if c == "ice":
        return "ice_mass" if a > 0.002 else "icicle" if p.get("outline.h_px", 0) > 2 * p.get("outline.w_px", 1) else "snow_patch"
    if asp >= 4 and p.get("edge.straight", 0) >= 0.25:
        return "cornice"
    if a < 0.002 and cy > 0.55 and up_facing(n):
        return "rubble"
    return "stone_block"
