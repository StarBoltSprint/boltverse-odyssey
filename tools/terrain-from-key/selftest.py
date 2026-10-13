#!/usr/bin/env python3
"""terrain-from-key selftest (offline): Zone B regression + generic masks on tiny fixtures.

1. Zone B identical: mask_depth.ground_mask with zones/zone-b.json == the frozen pre-refactor function, bit for bit,
   on the real Zone B key (when on the box) and on synthetic frames; run.py resolves the same paths/heading as before.
2. generic.py: a good synthetic key PASSES; a key with no ground, a non-image, a colour-rule zone FAIL / exit 2.
"""
import importlib.util, json, os, subprocess, sys, tempfile, shutil
import numpy as np
from PIL import Image
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H)
R = []
def ok(n, c, info=""):
    R.append(bool(c)); print(f"{'PASS' if c else 'FAIL'}  {n}" + (f"  ({info})" if info and not c else ""))
spec = importlib.util.spec_from_file_location("legacy", os.path.join(H, "tests", "legacy_mask_depth_1011.py")); legacy = importlib.util.module_from_spec(spec); spec.loader.exec_module(legacy)
import mask_depth as md
zb = json.load(open(os.path.join(H, "zones", "zone-b.json")))
cfg = {k: v for k, v in zb["mask"].items() if k != "method"}
ok("zone-b.json mask values == the old hard-wired constants", cfg == md.ZONE_B_MASK)
feats = json.load(open(os.path.join(H, "features.json")))
rng = np.random.default_rng(3); frames = [("synthetic-noise", rng.integers(0, 256, (72, 128, 3), dtype=np.uint8))]
y = np.linspace(0, 1, 90)[:, None, None]; frames.append(("synthetic-dune", (np.concatenate([np.full((90, 160, 1), 200), np.full((90, 160, 1), 120), np.full((90, 160, 1), 60)], 2) * (0.5 + y)).clip(0, 255).astype(np.uint8)))
key = zb["key"]
if os.path.exists(key): frames.append(("zone-b key-city3", np.asarray(Image.open(key).convert("RGB"))))
for name, rgb in frames:
    a = legacy.ground_mask(rgb, feats); b = md.ground_mask(rgb, feats, zb["mask"]); c = md.ground_mask(rgb, feats)
    same = all(np.array_equal(a[i], b[i]) and np.array_equal(a[i], c[i]) for i in (0, 1)) and a[2] == b[2] == c[2]
    ok(f"Zone B mask identical to pre-refactor ({name}, ground {a[0].mean():.3f})", same)
ok("Zone B real key present for the regression", os.path.exists(key), "key-city3 missing: synthetic only")
src = open(os.path.join(H, "run.py")).read()
ok("run.py has no hard-wired /workspace path left", "/workspace/" not in src.replace('ZONE.get("preview", "/workspace/zb-preview-1008")', ""))
env = dict(os.environ, TFK_ZONE="zone-b")
r = subprocess.run([sys.executable, "-c", "import sys;sys.argv=['x'];sys.path.insert(0,'.');import run;print(run.KEY_DEFAULT,run.PRIOR,run.LIVE,run.OUT.name,run.HEADING)"], cwd=H, capture_output=True, text=True, env=env)
ok("run.py (zone-b) resolves the original key/prior/live/out/heading",
   r.stdout.split() == ["/workspace/zb-bible-1008/key-city3.jpg", "/workspace/zb-bible-1008/compare/run2/camera-key.json", "/workspace/zb-preview-1008/main.mjs", "terrain-key2-1011", "78.0"], r.stdout + r.stderr[-300:])
# ---- generic on fixtures (offline colour-cluster path)
T = tempfile.mkdtemp(prefix="tfk-st-")
try:
    import math
    good = Image.new("RGB", (128, 72))
    for x in range(128):
        sk = int(72 * (0.3 + 0.08 * math.sin(x / 9)))
        for yy in range(72):
            good.putpixel((x, yy), (40, 60, 140) if yy < sk else ((120, 110, 100) if yy < 40 else (230, 235, 240)))
    gp = os.path.join(T, "good.png"); good.save(gp)
    G = [sys.executable, os.path.join(H, "generic.py"), "--offline", "--out"]
    r = subprocess.run(G + [os.path.join(T, "o1"), "--key", gp], capture_output=True, text=True)
    ok("generic: good synthetic key -> PASS with height.bin", r.returncode == 0 and os.path.exists(os.path.join(T, "o1", "data", "height.bin")), r.stdout + r.stderr[-300:])
    Image.new("RGB", (128, 72), (40, 60, 140)).save(os.path.join(T, "sky.png"))
    r = subprocess.run(G + [os.path.join(T, "o2"), "--key", os.path.join(T, "sky.png")], capture_output=True, text=True)
    ok("generic: key with no ground (all sky) -> FAIL", r.returncode == 1, r.stdout[-300:])
    open(os.path.join(T, "bad.png"), "w").write("not an image")
    ok("generic: non-image key -> exit 2", subprocess.run(G + [os.path.join(T, "o3"), "--key", os.path.join(T, "bad.png")], capture_output=True).returncode == 2)
    ok("generic: colour-rule zone (zone-b) refused -> exit 2", subprocess.run(G + [os.path.join(T, "o4"), "--zone", "zone-b"], capture_output=True).returncode == 2)
    ok("generic: unknown zone -> exit 2", subprocess.run(G + [os.path.join(T, "o5"), "--zone", "nope"], capture_output=True).returncode == 2)
    zd = json.load(open(os.path.join(H, "zones", "zone-d.json")))["key"]
    if os.path.exists(zd):
        r = subprocess.run(G + [os.path.join(T, "o6"), "--zone", "zone-d"], capture_output=True, text=True)
        ok("generic: Zone D key-zd1-b (offline masks) -> PASS", r.returncode == 0, r.stdout[-300:])
finally:
    shutil.rmtree(T, ignore_errors=True)
print(f"\n{sum(R)}/{len(R)} checks passed"); sys.exit(0 if all(R) else 1)
