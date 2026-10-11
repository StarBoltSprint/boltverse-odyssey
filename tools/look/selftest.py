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
        check("await import(\"./look/look.mjs?v=fix2\")" in patched, "import")
        check("sky7-atlas.png" in stage.patch_index("<head></head>"), "icon")
        stage.patch_main(patched)
    row = budget.summarise([16.6] * 50 + [40])
    check(row["fpsAvg"] > 50, "fps")
    enabled, why = budget.ship_default("grade", {"frameMs": 20, "fpsAvg": 50}, {"frameMs": 21, "fpsAvg": 47}, True)
    check(enabled, why)
    enabled, why = budget.ship_default("grade", {"frameMs": 20}, {"frameMs": 30}, True)
    check(not enabled and "frame" in why, why)
    for name in ("bake", "envmap", "fog", "shadows", "sprites", "sun"):
        try:
            mod = __import__(name)
        except ModuleNotFoundError:
            continue
        if hasattr(mod, "selftest"):
            mod.selftest(check)
    import gates
    same = np.tile(np.linspace(0.05, 0.9, 64, dtype=np.float32), (36, 1))
    rgb = np.stack([same, same * 0.8, same * 0.6], axis=2)
    luma = gates.luma_rows(rgb, rgb)
    check(luma["pass"], "luma same " + str(luma["meanRel"]))
    dark = np.clip(rgb * 0.55, 0, 1)
    dark_row = gates.luma_rows(dark, rgb)
    check(not dark_row["pass"], "dark luma must fail")
    pack = {"features": {"grade": {"reference": "synthetic-pregrade"}}}
    blocked = gates.evaluate(rgb, rgb, rgb, pack)
    check(not blocked["pass"], "synthetic reference must fail")
    sky = np.zeros((80, 120, 3), np.float32)
    sky[:40] = 0.45
    sky[:40, 20:24] = 0.85
    sky[:40, 70:74] = 0.8
    foot = np.full((100, 160, 3), 0.55, np.float32)
    foot[30:70, 30:48] = 0.08
    foot[70:76, 30:48] = 0.30
    foot[30:68, 90:108] = 0.08
    foot[68:74, 90:108] = 0.28
    feet = gates.contact_rows(foot)
    check(feet["pass"], "contact " + str(feet))
    bare = np.full((100, 160, 3), 0.55, np.float32)
    bare[30:70, 40:55] = 0.08
    bare[30:68, 100:118] = 0.08
    check(not gates.contact_rows(bare)["pass"], "missing contact must fail")
    check(gates.godray_score(sky) >= gates.GODRAY_FLOOR, "godray floor")
    check(gates.region_rows(rgb, rgb)[0]["detail"]["deltaE"] == 0.0, "region identity")
    shafts = np.full((100, 160, 3), 0.5, np.float32)
    shafts[:, 20:40] = 0.05
    shafts[:, 100:120] = 0.05
    for x in range(48, 92):
        peak = max(0.0, 1.0 - abs(x - 70) / 12.0)
        shafts[30:55, x] = 0.45 + 0.4 * peak
    shafts[48:54, 118:128] = 1.0
    check(gates.shaft_rows(shafts)["pass"], "shafts " + str(gates.shaft_rows(shafts)))
    flat = np.full((100, 160, 3), 0.5, np.float32)
    flat[:, 20:40] = 0.05
    flat[:, 100:120] = 0.05
    flat[48:54, 118:128] = 1.0
    check(not gates.shaft_rows(flat)["pass"], "flat gaps are not shafts")
    print("PASS look selftest")
    return 0


if __name__ == "__main__":
    sys.exit(main())
