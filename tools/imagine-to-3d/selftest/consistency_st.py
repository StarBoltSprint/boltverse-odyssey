"""Self-test (box paths) for palette.py + consistency.py: grading lowers palette ΔE and keeps the size; the check
flags / rejects off-palette plates; identical views pass the overlap rule; a re-coloured view fails it."""
import sys, os, json, tempfile
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import numpy as np, palette as PAL, consistency as CO, i23d_common as C
from PIL import Image
KEY = "/workspace/zb-bible-1008/key-city3.jpg"; PLATES = "/workspace/mesa-1009/plates-v11"
P = PAL.sample(KEY, os.path.join(C.OBJECT_GATE_DIR, "specs/zone-b/key-compare.yaml"), tempfile.mktemp(suffix=".json"))
d = tempfile.mkdtemp(); ok = True
for w in ("w1", "w14"):
    src = f"{PLATES}/{w}.jpg"; r = PAL.grade(src, P, "sandstone", f"{d}/{w}.jpg", 0.8, f"{d}/log.jsonl")
    same = Image.open(src).size == Image.open(f"{d}/{w}.jpg").size
    good = r["after"]["deLit"] < r["before"]["deLit"] and r["after"]["deShadow"] < r["before"]["deShadow"] and same
    ok &= good; print("grade", w, r["before"], "->", r["after"], "size kept" if same else "SIZE CHANGED", "OK" if good else "XX")
c = CO.check([f"{PLATES}/w14.jpg"], KEY, P, "sandstone", [0, 0.21, 0.24, 0.58], d)
print("check raw w14:", c["rows"][0]["verdict"], c["rows"][0]["deLit"]); ok &= c["rows"][0]["verdict"] != "ACCEPT"
a = C.load_rgb(f"{PLATES}/w1.jpg"); C.save_rgb(a, f"{d}/v1.png"); C.save_rgb(np.roll(a, 60, axis=1), f"{d}/v2.png")
b = a.copy(); b[..., 2] = np.clip(b[..., 2] * 1.25, 0, 1); C.save_rgb(np.roll(b, 60, axis=1), f"{d}/v3.png")
v = CO.views([f"{d}/v1.png", f"{d}/v2.png", f"{d}/v3.png"], None, d)
for r in v["rows"]: print("views", os.path.basename(r["a"]), os.path.basename(r["b"]), r["status"], r.get("ssim"), r.get("deMean"))
ok &= v["rows"][0]["status"] == "PASS" and v["rows"][1]["status"] == "FAIL"
print("PASS consistency selftest" if ok else "FAIL consistency selftest"); sys.exit(0 if ok else 1)
