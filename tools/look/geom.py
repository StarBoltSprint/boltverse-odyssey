"""Sun direction from a measured azimuth and elevation. No colour."""
import json, math, os


def heading_to_dir(heading_deg, elevation_deg=0.0):
    h = math.radians(float(heading_deg))
    e = math.radians(float(elevation_deg))
    return [
        round(math.sin(h) * math.cos(e), 6),
        round(math.sin(e), 6),
        round(-math.cos(h) * math.cos(e), 6),
    ]


def read_sun(path):
    if not path or not os.path.exists(path):
        return None
    doc = json.load(open(path))
    sun = doc.get("sun") or {}
    az = sun.get("azimuthDeg", doc.get("sunAzimuthDeg"))
    el = sun.get("elevationDeg", doc.get("sunElevationDeg"))
    biome = (doc.get("biome") or {}).get("sun") or {}
    if az is None:
        az = biome.get("azimuthDeg")
    if el is None:
        el = biome.get("elevationDeg")
    if az is None or el is None:
        return None
    return {
        "azimuthDeg": float(az),
        "elevationDeg": float(el),
        "dir": heading_to_dir(az, el),
        "source": os.path.abspath(path),
    }


def elevation_from_key(img):
    """Scalar from the brightest row of the key. Higher in the frame reads as a higher sun."""
    import sample
    y = sample.luma(sample.srgb_to_lin(img)).mean(axis=1)
    row = int(y.argmax())
    frac = row / max(img.shape[0] - 1, 1)
    elev = float(max(5.0, min(50.0, (0.5 - frac) * 60.0)))
    return round(elev, 3)
