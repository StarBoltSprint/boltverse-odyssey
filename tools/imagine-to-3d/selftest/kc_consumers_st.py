"""Selftest (offline, no browser): kc_stage mirror + kc_mesa / kc_glb consumers write ONLY into the staging dir, the
patched mesa module carries every patch, warp / plates / relief / spire grade produce loadable outputs, live untouched."""
import hashlib, json, os, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, HERE)
LIVE = os.environ.get("I23D_LIVE_ROOT", "/workspace/zb-preview-1008")
import numpy as np


def sha(p): return hashlib.sha256(open(p, "rb").read()).hexdigest()


def run(*a):
    r = subprocess.run([sys.executable, *a], cwd=HERE, capture_output=True, text=True)
    assert r.returncode == 0, r.stderr[-800:]; return json.loads(r.stdout.strip().splitlines()[-1])


def main():
    watch = [os.path.join(LIVE, "mesas", "mesas-v11.mjs"), os.path.join(LIVE, "objects1", "layout.json"), os.path.join(LIVE, "mesas", "plates11", "plates.json"),
             os.path.join(LIVE, "mesas", "strata6", "L-mid2-geo.json"), os.path.join(LIVE, "objects1", "spire", "spire.glb")]
    before = {p: sha(p) for p in watch}
    st = tempfile.mkdtemp(prefix="kc-st-"); stage = os.path.join(st, "zb")
    run("kc_stage.py", "build", "--live", LIVE, "--out", stage, "--layout", os.path.join(HERE, "layouts", "ember-mesa.json"))
    mod = open(os.path.join(stage, "mesas", "mesas-v11.mjs")).read()
    for k in ("kc-params.json", "LAYOUT.map(", "KC.strata", "KC.plates", "RG * q[k + 9]", "L.x != null"): assert k in mod, k
    L = json.load(open(os.path.join(stage, "objects1", "layout.json"))); assert L["kcLayout"]["moved"], "layout not applied"
    # synthetic warp: key edge 20 px higher everywhere (raise the skyline)
    ncol = 320; w = dict(step=4, keyTop=[0.30] * ncol, gameTop=[0.33] * ncol)
    wp = os.path.join(st, "warp.json"); json.dump(w, open(wp, "w"))
    cam = os.path.join(st, "cam.json"); json.dump(dict(camera=dict(x=-51.115, z=9.63, yaw=78, pitch=-1.16, eye=3.15, fovDeg=58)), open(cam, "w"))
    r = run("kc_mesa.py", "warp", "--stage", stage, "--warp", wp, "--camera", cam)
    assert any(m["warped"] and m["stretchMax"] > 1.0 for m in r["mesas"]), r
    rk = os.path.join(st, "rank.json"); json.dump([{"plate": f"{LIVE}/mesas/plates11/w{i}.jpg", "style": 1 - i / 20} for i in (3, 15, 9, 1, 6, 10, 8, 7, 16, 13)], open(rk, "w"))
    r = run("kc_mesa.py", "plates", "--stage", stage, "--ranking", rk, "--detail", "1.3")
    assert "w6" not in r["walls"] and len(set(r["walls"])) == len(r["walls"]), r
    r = run("kc_mesa.py", "relief", "--stage", stage, "--value", "1.5"); assert r["reliefGain"] == 1.5
    kc = os.path.join(st, "kc.json"); json.dump(dict(elements=[dict(id="spire", labKeyLit=[65, 15, 14], labGameLit=[70, 16, 14], labKeyShadow=[16, 9, 5], labGameShadow=[45, 5, 2])]), open(kc, "w"))
    r = run("kc_glb.py", "grade", "--glb", os.path.join(LIVE, "objects1", "spire", "spire.glb"), "--stage", stage, "--image", "1", "--gain-from", kc, "--only", "shadow")
    import kc_glb
    J, B = kc_glb.read_glb(open(r["glb"], "rb").read()); assert len(J["images"]) == 2 and J["asset"]["extras"]["kcGrade"]
    P = json.load(open(os.path.join(stage, "mesas", "kc-params.json"))); assert P["strata"] == "strata-kc" and P["plates"] == "plates-kc" and P["layout"]
    # rebuild keeps the GLB override and the consumer outputs
    run("kc_stage.py", "build", "--live", LIVE, "--out", stage, "--layout", os.path.join(HERE, "layouts", "ember-mesa.json"))
    assert not os.path.islink(os.path.join(stage, "objects1", "spire")), "override lost on rebuild"
    # refuses live
    rr = subprocess.run([sys.executable, "kc_mesa.py", "relief", "--stage", LIVE, "--value", "1"], cwd=HERE, capture_output=True, text=True)
    assert rr.returncode != 0 and "refusing" in rr.stderr + rr.stdout and not os.path.exists(os.path.join(LIVE, "mesas", "kc-params.json")), "live write not refused"
    after = {p: sha(p) for p in watch}; assert before == after, "LIVE FILE CHANGED"
    print("PASS kc consumers selftest (staging only, live untouched)")


if __name__ == "__main__": main()
