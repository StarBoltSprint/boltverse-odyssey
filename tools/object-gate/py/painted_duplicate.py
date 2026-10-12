"""Blocking gate: a plate still shows a painted feature where that feature's geometry already exists.

python3 painted_duplicate.py <spec.json> [--out report.json]
python3 painted_duplicate.py --selftest

spec.json:
  plates: [{id, image, mpp, uAxis: x|z, u0, uSign, v0, vSign}]
    column = u0 + uSign * world[uAxis] / mpp
    row    = v0 + vSign * world.y / mpp     (vSign -1: world up is image up)
  features: [{id, faces:[int], plate, world:[x,y,z], lengthM, radiusM, tier, side, kind}]
    An icicle (or stalactite) is a cone hanging down from world (root) by lengthM.

The cone is projected into plate pixels. The mask is that cone plus a 0.05 m margin.
Painted streaks are the vertical bright runs from ghost_streaks (luma > 80 and > 40
above the row's basalt level, narrower than 1.5 m, at least 0.15 m long) that taper
toward the tip and read ice-coloured (white, pale, or cool: B + 12 >= R). A streak
whose pixels sit inside the mask or in the 0.04 m band beside it overlaps the
geometry. Overlap of 0.08 m or more FAILs.

A pale smear left where an inpaint did not meet a cone is the existing ghost_streaks
check: the same bright run with no cone within max(0.2 m, half its width) FAILs.

FAIL JSON (gates-API shape):
  {check, status, failing_face_ids, world_position, suggested_fix}
  suggested_fix is "inpaint painted feature with neighbouring basalt" on FAIL
  and "" on PASS. world_position is null when nothing failed.
Exit 0 on PASS, 1 on FAIL, 2 on a bad invocation.
"""
import json, sys, os, subprocess, tempfile
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import ghost_streaks as GS

CHECK = "painted_duplicate"
FIX = "inpaint painted feature with neighbouring basalt"
MARGIN_M = 0.05
NEAR_M = 0.04
OVERLAP_M = 0.08

def _plate(p):
    return dict(p, uSign=p.get("uSign", 1), vSign=p.get("vSign", -1), uAxis=p.get("uAxis", "x"))

def _load(plate):
    im = Image.open(plate["image"])
    rgb = np.asarray(im.convert("RGB"), np.float32)
    lum = np.asarray(im.convert("L"), np.float32)
    return rgb, lum

def _uv(plate, world):
    x, y, z = world
    horiz = x if plate["uAxis"] == "x" else z
    mpp = plate["mpp"]
    u = plate["u0"] + plate["uSign"] * horiz / mpp
    v = plate["v0"] + plate["vSign"] * y / mpp
    return u, v

def _cone_mask(h, w, u, v_root, v_tip, radius_px):
    mask = np.zeros((h, w), bool)
    span = max(1.0, abs(v_tip - v_root))
    r0, r1 = int(np.floor(min(v_root, v_tip))), int(np.ceil(max(v_root, v_tip)))
    for row in range(max(0, r0), min(h, r1 + 1)):
        t = abs(row - v_root) / span
        t = 0.0 if t < 0 else (1.0 if t > 1 else t)
        half = radius_px * (1.0 - t)
        c0, c1 = int(round(u - half)), int(round(u + half))
        mask[row, max(0, c0):min(w, c1 + 1)] = True
    return mask

def _full_bright(lum, band):
    br, top, c_lo = GS.bright_mask(lum, band)
    full = np.zeros(lum.shape, bool)
    full[top:top + br.shape[0], c_lo:c_lo + br.shape[1]] = br
    return full

def _taper(bright, streak):
    r0, r1, c0, c1 = streak["r0"], streak["r1"], streak["c0"], streak["c1"]
    if r1 - r0 < 4 or c1 < c0: return False
    widths = bright[r0:r1, c0:c1 + 1].sum(1).astype(float)
    q = max(1, len(widths) // 4)
    # r0 is the top of the run (the root); the tip is the lower end and must be narrower
    return float(widths[-q:].mean()) < float(widths[:q].mean()) - 0.5

def _overlap_rows(bright, rgb, streak, near):
    r0, r1, c0, c1 = streak["r0"], streak["r1"], streak["c0"], streak["c1"]
    if r1 <= r0 or c1 < c0: return np.zeros(bright.shape[0], bool)
    sub_b = bright[r0:r1, c0:c1 + 1]
    sub_n = near[r0:r1, c0:c1 + 1]
    pix = rgb[r0:r1, c0:c1 + 1]
    ice = (pix[..., 2] + 12 >= pix[..., 0]) & (pix.mean(2) > 80)
    hit = np.zeros(bright.shape[0], bool)
    hit[r0:r1] = (sub_b & sub_n & ice).any(1)
    return hit

def _bands_for(plates, features, shapes):
    """One full-width drip band per plate / tier / side, tall enough to cover every cone on it."""
    groups = {}
    for f in features:
        p = plates[f["plate"]]
        key = (f["plate"], f.get("tier", 0), f.get("side") or ("front" if p["uAxis"] == "x" else "left"))
        groups.setdefault(key, []).append(f)
    bands, cones = [], []
    for (pid, tier, side), feats in groups.items():
        p = plates[pid]
        h, w = shapes[pid]
        rows = []
        for f in feats:
            u, v = _uv(p, f["world"])
            v_tip = v - p["vSign"] * f["lengthM"] / p["mpp"]
            rows.append(v); rows.append(v_tip)
            cones.append(dict(tier=tier, side=side, x=float(f["world"][0]), z=float(f["world"][2])))
        lo, hi = int(max(0, min(rows) - 8)), int(min(h, max(rows) + 8))
        # Scan the whole plate width on that drip line so a pale smear beside the cone is still seen.
        row0, nrows = max(6, lo), max(16, hi - max(6, lo))
        if row0 + nrows > h: nrows = h - row0
        b = p["mpp"] / p["uSign"]
        a = -p["u0"] * p["mpp"] / p["uSign"]
        bands.append(dict(plate=pid, tex=p["image"], tier=tier, side=side, row0=int(row0), rows=int(nrows),
                          c_lo=0, c_hi=int(w), a=float(a), b=float(b)))
    return bands, cones

def _ghost_world(plate, ghost):
    mid = 0.5 * (ghost["r0"] + ghost["r1"])
    y = (mid - plate["v0"]) * plate["mpp"] / plate["vSign"]
    horiz = float(ghost["coord"])
    if plate["uAxis"] == "z":
        return [0.0, round(float(y), 3), round(horiz, 3)]
    return [round(horiz, 3), round(float(y), 3), 0.0]

def _record(status, faces, world, causes, overlap_m, ghosts):
    # Gates-API shape: face ids are strings; suggested_fix is empty unless FAIL.
    ids = []
    for i in faces:
        s = str(i)
        if s and s not in ids: ids.append(s)
    return dict(check=CHECK, status=status, failing_face_ids=ids, world_position=world,
                suggested_fix=FIX if status == "FAIL" else "",
                causes=causes, overlap_m=round(float(overlap_m), 3), ghosts=int(ghosts))

def evaluate(spec):
    plates = {p["id"]: _plate(p) for p in spec.get("plates") or []}
    features = list(spec.get("features") or [])
    loaded, shapes = {}, {}
    for pid, p in plates.items():
        rgb, lum = _load(p)
        loaded[pid] = (rgb, lum)
        shapes[pid] = lum.shape
    bands, cones = _bands_for(plates, features, shapes)
    if spec.get("bands"): bands = spec["bands"]
    if spec.get("icicles"): cones = spec["icicles"]
    bright = {}
    streaks = {}
    for b in bands:
        pid = b["plate"]
        if pid not in loaded: continue
        lum = loaded[pid][1]
        bright[pid] = _full_bright(lum, b)
        streaks.setdefault(pid, []).extend(GS.detect(lum, b, abs(b["b"])))
    failing = []
    worst_m = 0.0
    worst_world = None
    for f in features:
        pid = f["plate"]
        if pid not in loaded: continue
        rgb, lum = loaded[pid]
        p = plates[pid]
        h, w = lum.shape
        u, v = _uv(p, f["world"])
        v_tip = v - p["vSign"] * float(f["lengthM"]) / p["mpp"]
        radius_px = float(f["radiusM"]) / p["mpp"]
        geom = _cone_mask(h, w, u, v, v_tip, radius_px)
        margin_px = max(2, int(round(MARGIN_M / p["mpp"])))
        near_px = max(2, int(round(NEAR_M / p["mpp"])))
        mask = ndi.binary_dilation(geom, iterations=margin_px)
        near = ndi.binary_dilation(mask, iterations=near_px)
        br = bright.get(pid)
        if br is None: continue
        rows = np.zeros(h, bool)
        for s in streaks.get(pid, []):
            if not _taper(br, s): continue
            rows |= _overlap_rows(br, rgb, s, near)
        overlap_m = float(rows.sum()) * p["mpp"]
        if overlap_m >= OVERLAP_M:
            failing.extend(int(i) for i in f.get("faces") or [])
            if overlap_m > worst_m:
                worst_m = overlap_m
                worst_world = [round(float(v), 3) for v in f["world"]]
    ghost = GS.run(bands, cones) if bands else dict(pass_=True, ghosts=0, list=[])
    causes = []
    if failing: causes.append("overlap")
    if ghost["ghosts"]: causes.append("ghost_streak")
    if not causes:
        return _record("PASS", [], None, [], worst_m, ghost["ghosts"])
    world = worst_world
    if world is None and ghost["list"]:
        g0 = ghost["list"][0]
        world = _ghost_world(plates[g0["plate"]], g0)
    return _record("FAIL", failing, world, causes, worst_m, ghost["ghosts"])

def _basalt(h, w, seed):
    rng = np.random.default_rng(seed)
    n = ndi.uniform_filter(rng.random((h, w)).astype(np.float32), 5)
    L = 38 + 14 * n
    rgb = np.zeros((h, w, 3), np.float32)
    rgb[..., 0] = L + 8
    rgb[..., 1] = L + 1
    rgb[..., 2] = np.maximum(0, L - 6)
    return rgb

def _paint_taper(rgb, col, r0, r1, colour, root_half):
    span = max(1, r1 - r0 - 1)
    for i, row in enumerate(range(r0, r1)):
        t = i / span
        half = int(round((1 - t) * root_half))
        rgb[row, col - half:col + half + 1] = colour

def _spec(image, feature):
    return dict(
        plates=[dict(id="front", image=image, mpp=0.02, uAxis="x", u0=0, uSign=1, v0=40, vSign=-1)],
        features=[feature],
    )

def _feature():
    # root at column 64, row 40; 1.40 m cone, 0.08 m radius
    return dict(id="ici-0", faces=[101, 102, 103], plate="front", kind="icicle",
                world=[1.28, 0.0, -0.4], lengthM=1.4, radiusM=0.08, tier=0, side="front")

def _save(rgb, path):
    Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).save(path)

def _cli(spec_path):
    p = subprocess.run([sys.executable, os.path.abspath(__file__), spec_path], capture_output=True, text=True)
    line = (p.stdout or "").strip().split("\n")[-1] if p.stdout else ""
    return p.returncode, (json.loads(line) if line.startswith("{") else None), p.stderr

def selftest():
    h, w = 220, 256
    with tempfile.TemporaryDirectory(prefix="painted-dup-") as root:
        def plate(name, rgb):
            path = os.path.join(root, name)
            _save(rgb, path)
            return path
        painted_rgb = _basalt(h, w, 1)
        _paint_taper(painted_rgb, 64, 40, 110, (200, 220, 240), 4)   # ice cone painted on the geometric cone
        pale_rgb = _basalt(h, w, 2)
        _paint_taper(pale_rgb, 180, 48, 108, (118, 124, 132), 3)     # pale smear, 2.3 m away from the cone
        clean_rgb = _basalt(h, w, 3)
        rng = np.random.default_rng(9)
        for _ in range(6):   # isolated specks, shorter than a streak
            clean_rgb[int(rng.integers(70, 140)), int(rng.integers(10, 50))] = (230, 235, 245)
        specs = {
            "painted": _spec(plate("painted.png", painted_rgb), _feature()),
            "pale": _spec(plate("pale.png", pale_rgb), _feature()),
            "clean": _spec(plate("clean.png", clean_rgb), _feature()),
        }
        out = {k: evaluate(v) for k, v in specs.items()}
        codes = {}
        for k, v in specs.items():
            path = os.path.join(root, k + ".json")
            json.dump(v, open(path, "w"))
            codes[k] = _cli(path)[0]
        a, b, c = out["painted"], out["pale"], out["clean"]
        ok = (
            a["status"] == "FAIL" and a["causes"] == ["overlap"] and a["ghosts"] == 0
            and a["failing_face_ids"] == ["101", "102", "103"] and a["suggested_fix"] == FIX
            and a["world_position"] == [1.28, 0.0, -0.4] and a["overlap_m"] >= OVERLAP_M
            and b["status"] == "FAIL" and b["causes"] == ["ghost_streak"] and b["ghosts"] >= 1
            and b["failing_face_ids"] == [] and b["suggested_fix"] == FIX and b["overlap_m"] < OVERLAP_M
            and abs(b["world_position"][0] - 3.6) < 0.2
            and c["status"] == "PASS" and c["failing_face_ids"] == [] and c["world_position"] is None
            and c["suggested_fix"] == "" and c["ghosts"] == 0 and c["overlap_m"] == 0
            and codes["painted"] == 1 and codes["pale"] == 1 and codes["clean"] == 0
        )
        return dict(ok=bool(ok), painted_under_geometry=a, pale_smear=b, clean=c, cli=codes)

if __name__ == "__main__":
    argv = sys.argv[1:]
    if "--selftest" in argv:
        report = selftest()
        print(json.dumps(report))
        sys.exit(0 if report["ok"] else 1)
    if not argv or argv[0].startswith("--"):
        print(json.dumps(dict(check=CHECK, status="FAIL", failing_face_ids=[], world_position=None, suggested_fix=FIX, error="usage: painted_duplicate.py <spec.json> [--out path] | --selftest")))
        sys.exit(2)
    spec = json.load(open(argv[0]))
    result = evaluate(spec)
    if "--out" in argv:
        json.dump(result, open(argv[argv.index("--out") + 1], "w"), indent=1)
    print(json.dumps(result))
    sys.exit(0 if result["status"] == "PASS" else 1)
