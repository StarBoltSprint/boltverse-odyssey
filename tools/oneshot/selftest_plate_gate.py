import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import plate_gate as g
S = "/workspace/zd-bible-1012/zd-plates/sky12"; FX = os.path.join(g.REPO, "tools/sky-band-gate/fixtures")
T = "/workspace/grokcli/wt/zd-terrace-1012/steps/zone-d/01-terrace"
final5 = [p["src"] for p in json.load(open(S + "/ktx2-final5-mip1-star/pack-report.json"))["plates"]]
rows, ok = [], True
def rec(name, want, got, why=""):
    global ok; good = (want == got); ok &= good; rows.append((name, want, got, "ok" if good else "MISMATCH", why))
def swap(sec, path):  # put a fixture into the final5 ring in its own section
    return [path if f"-{sec}-" in os.path.basename(f) else f for f in final5]
def sky_status(sec, path):
    r = [x for x in g.gate_sky_set(swap(sec, path)) if x["path"] == path][0]
    return r["status"], [k for k, v in r["checks"].items() if v["status"] == "FAIL"]
# must PASS
sky = g.gate_sky_set(final5); bad = [os.path.basename(r["path"]) + ":" + ",".join(k for k, v in r["checks"].items() if v["status"] == "FAIL") for r in sky if r["status"] != "PASS"]
rec("sky12 final5 KEEP set (12)", "PASS", "PASS" if not bad else "FAIL", ";".join(bad))
v35 = sorted(f"{T}/plates/v35/{f}" for f in os.listdir(f"{T}/plates/v35"))
ob = g.gate_object_set(v35, f"{T}/object-gate-v3.5/painted-duplicate-spec.json")
rec("terrace v3.5 plates (3)", "PASS", "PASS" if all(r["status"] == "PASS" for r in ob) else "FAIL",
    ";".join(os.path.basename(r["path"]) for r in ob if r["status"] != "PASS"))
# must FAIL (sky copies, each in its own section of the final5 ring)
for name, sec, p in [("S04 final4 (Milky Way trace)", "S04", f"{S}/zd-sky12-S04-final4.jpg"),
                     ("S04 final (MW band, stand-in)", "S04", f"{S}/zd-sky12-S04-final.jpg"),
                     ("S05 final2 (band)", "S05", f"{FX}/zd-sky12-S05-final2-fail.jpg"),
                     ("S09 final3 (diagonal stripe)", "S09", f"{FX}/zd-sky12-S09-final3-fail.jpg"),
                     ("S09 strong clean (blotchy)", "S09", None),
                     ("S11 final2 (low haze)", "S11", f"{FX}/zd-sky12-S11-final2-fail.jpg"),
                     ("S11 final4 (low haze)", "S11", f"{FX}/zd-sky12-S11-final4-fail.jpg")]:
    if not p or not os.path.exists(p): rows.append((name, "FAIL", "MISSING", "fixture file not on box", "")); continue
    st, why = sky_status(sec, p); rec(name, "FAIL", st, ",".join(why))
import numpy as np
base = g.rgb(final5[0]).astype(np.float32) / 255
okb, info = g.star_mip(base, "box"); rec("box-filtered sky mip 1", "FAIL", "PASS" if okb else "FAIL", json.dumps(info))
oks, info = g.star_mip(base, None); rec("star-preserving mip 1 (shipped)", "PASS", "PASS" if oks else "FAIL", json.dumps(info))
spec = json.load(open(f"{T}/object-gate-v3.5/painted-duplicate-spec.json"))
for p in spec["plates"]: p["image"] = p["image"].replace("v35", "v34")
json.dump(spec, open("/tmp/pd-v34-selftest.json", "w"))
ob4 = g.gate_object_set([p["image"] for p in spec["plates"]], "/tmp/pd-v34-selftest.json")
rec("wall plate v3.4 with painted icicles", "FAIL", "FAIL" if any(r["checks"]["painted_duplicate"]["status"] == "FAIL" for r in ob4) else "PASS")
d = g.gate_plate("/workspace/playtest-terrace-v35/door-3m.png", "object")
rec("door-3m.png dark band (dd80963f)", "FAIL", d["checks"]["hard_dark_shapes"]["status"], json.dumps(d["checks"]["hard_dark_shapes"]["rects"]))
up = np.asarray(g.Image.fromarray(g.rgb(v35[0])).resize((512, 512)).resize((1024, 1024), g.Image.BICUBIC))
rec("2x upscaled plate (native_res)", "FAIL", "PASS" if g.native_res(up, "object")[0] else "FAIL")
for r in rows: print("| %s | %s | %s | %s | %s |" % r)
json.dump(rows, open(os.path.join(g.REPO, "out/plate-gate-selftest.json"), "w"), indent=1)
print("selftest", "PASS" if ok else "FAIL"); sys.exit(0 if ok else 1)
