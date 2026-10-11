"""Self-test for the look tools. No Imagine call. No live preview write."""
import json, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import colour_check
import curves
import grade
import sample
import stage
import budget


def check(cond, msg):
    if not cond:
        raise SystemExit("FAIL " + msg)


def main():
    budget.assert_matches_perf(os.path.join(HERE, "..", "perf", "stats.mjs"))
    node = subprocess.run(["node", os.path.join(HERE, "curves.mjs")], capture_output=True, text=True, check=True)
    js = json.loads(node.stdout)
    py_a = curves.srgb_encode(curves.aces([0.18, 0.18, 0.18], 1)).tolist()
    py_g = curves.agx([0.18, 0.18, 0.18], 1).tolist()
    for name, a, b in (("aces", py_a, js["aces"]), ("agx", py_g, js["agx"])):
        if max(abs(x - y) for x, y in zip(a, b)) > 1e-4:
            raise SystemExit(f"FAIL curve parity {name} py={a} js={b}")
    img = np.zeros((32, 48, 3), np.float32)
    img[:16, :, 2] = 0.45
    img[16:, :, 0] = 0.75
    img[16:, :, 1] = 0.35
    img[4:8, 20:28] = 1.0
    with tempfile.TemporaryDirectory() as d:
        key = os.path.join(d, "key.png")
        Image.fromarray((img * 255).astype(np.uint8)).save(key)
        feat = grade.build(key, d)
        check(feat["curve"] in ("aces", "agx"), "curve")
        check(0 < feat["exposure"] < 3, "exposure")
        check(os.path.exists(os.path.join(d, "lut.png")), "lut")
        lut = np.asarray(Image.open(os.path.join(d, "lut.png")))
        check(lut.shape == (16, 256, 3), f"lut shape {lut.shape}")
        if feat["lutStrength"] == 0:
            check(abs(int(lut[0, 15, 0]) - 255) <= 2 and int(lut[0, 15, 1]) <= 2, "identity lut red")
        rgb = sample.mean_rect(sample.load_rgb(key), [0, 0, 1, 0.5])
        check(rgb[2] > rgb[0], "sample")
        bad = os.path.join(d, "bad.py")
        open(bad, "w").write("TINT = '#" + "ff00aa'\n")
        hits = colour_check.scan_text(bad, open(bad).read())
        check(hits, "planted hex must fail")
        doc = {"fog": {"rgb": rgb, "linear": [round(float(v), 6) for v in sample.srgb_to_lin(np.array(rgb))],
                       "source": {"image": key, "method": "mean-rect", "rect": [0, 0, 1, 0.5]}}}
        open(os.path.join(d, "ok.json"), "w").write(json.dumps(doc))
        hits = []
        colour_check.verify_json(os.path.join(d, "ok.json"), doc, hits, {})
        check(not hits, "resample " + str(hits))
    hits = colour_check.scan_tree(HERE)
    check(not hits, "tree " + " | ".join(hits[:8]))
    live = "/workspace/zb-preview-1008/main.mjs"
    if os.path.exists(live):
        patched = stage.patch_main(open(live, encoding="utf-8").read())
        check(patched.count("LOOK-UNREAL") >= 2, "markers")
        check("await import(\"./look/look.mjs\")" in patched, "import")
        stage.patch_main(patched)
    row = budget.summarise([16.6] * 50 + [40])
    check(row["fpsAvg"] > 50, "fps")
    enabled, why = budget.ship_default("grade", {"frameMs": 20, "fpsAvg": 50}, {"frameMs": 21, "fpsAvg": 47}, True)
    check(enabled, why)
    enabled, why = budget.ship_default("grade", {"frameMs": 20}, {"frameMs": 30}, True)
    check(not enabled and "frame" in why, why)
    for name in ("bake", "envmap", "fog", "shadows", "sprites"):
        try:
            mod = __import__(name)
        except ModuleNotFoundError:
            continue
        if hasattr(mod, "selftest"):
            mod.selftest(check)
    print("PASS look selftest")
    return 0


if __name__ == "__main__":
    sys.exit(main())
