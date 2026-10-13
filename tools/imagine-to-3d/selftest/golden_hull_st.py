#!/usr/bin/env python3
"""golden-hull selftest (offline, tiny 64 px plates): good object PASSES; flat facade, shredded mesh, grey area FAIL;
a FAIL writes a fix-ledger row and the ONE automatic retry rescues what the ledger fix can fix; bad spec -> exit 2."""
import json, os, shutil, subprocess, sys, tempfile
import numpy as np
from PIL import Image
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); AUTO = os.path.join(H, "auto.py")
R = []
def ok(n, c, info=""):
    R.append(bool(c)); print(f"{'PASS' if c else 'FAIL'}  {n}" + (f"  ({info})" if info and not c else ""))
T = tempfile.mkdtemp(prefix="ghull-st-"); L = os.path.join(T, "ledger.jsonl"); env = dict(os.environ, GOLDEN_FIX_LEDGER=L)
try:
    rng = np.random.default_rng(0)
    def plate(path, taper):
        a = np.full((64, 64, 3), 40.0)
        for y in range(8, 60):
            half = (4 + (y - 8) * 2 // 5) if taper else 8 + (y - 8) // 9 * 3
            a[y, 32 - half:32 + half] = np.array([110, 120, 150]) + rng.normal(0, 18, (2 * half, 3))
        Image.fromarray(a.clip(0, 255).astype(np.uint8)).save(path); return path
    f, s = plate(os.path.join(T, "front.png"), False), plate(os.path.join(T, "side.png"), True)
    def run(name, hooks=None, retries=1, **kw):
        sp = {"object": name, "work": os.path.join(T, name), "heightM": 30, "crop": f, "sideAngleDeg": 45, "retries": retries,
              "imagine": {"views": {"front": f, "side": s}}, "_testHooks": hooks or {}, **kw}
        p = os.path.join(T, name + ".json"); json.dump(sp, open(p, "w"))
        r = subprocess.run([sys.executable, AUTO, "run", p, "--method", "golden-hull"], capture_output=True, text=True, env=env)
        res = json.load(open(os.path.join(T, name, "result.json"))) if os.path.exists(os.path.join(T, name, "result.json")) else {}
        return r, res
    r, res = run("good")
    ok("good carved hull -> PASS, GLB + render sheet, Art Director pending", r.returncode == 0 and os.path.exists(res["glb"]) and os.path.exists(res["artDirector"]["sheet"]) and res["artDirector"]["status"] == "pending-art-director", r.stdout[-300:])
    rows = res["attempts"][0]["rows"]
    ok("good: oblique-profile, triangle quality, untextured area, budget all PASS", all(v["pass"] for v in rows.values()), json.dumps(rows)[:300])
    for hook, check in (("flat", "obliqueProfile"), ("shred", "triangleQuality"), ("grey", "untexturedArea")):
        r, res = run("bad-" + hook, {hook: True}, retries=0)
        row = res["attempts"][-1]["rows"][check] if res.get("attempts") else {"pass": True}
        ok(f"{hook} -> FAIL on {check}", r.returncode == 1 and not row["pass"], r.stdout[-300:])
    r, res = run("budget", budgetTris=50, retries=0)
    ok("over the triangle budget -> FAIL", r.returncode == 1 and not res["attempts"][-1]["rows"]["budget"]["pass"])
    open(L, "w").close()
    r, res = run("rescue-grey", {"grey": True}, retries=1)
    led = [json.loads(x) for x in open(L) if x.strip()]
    ok("grey FAIL -> fix-ledger row + one retry -> PASS", r.returncode == 0 and len(res["attempts"]) == 2 and any(x["check"] == "untexturedArea" and x["fix"] == "reproject-from-nearest-plate" for x in led), r.stdout[-300:])
    r, res = run("rescue-shred", {"shred": True}, retries=1)
    ok("shredded FAIL -> weld-and-regrid retry -> PASS", r.returncode == 0 and len(res["attempts"]) == 2)
    r, res = run("flat-stays", {"flat": True}, retries=1)
    ok("flat facade cannot be rescued by the retry -> FAIL after exactly 2 attempts", r.returncode == 1 and len(res["attempts"]) == 2)
    json.dump({"object": "x", "work": T}, open(os.path.join(T, "bad.json"), "w"))
    ok("spec without imagine views -> exit 2", subprocess.run([sys.executable, AUTO, "run", os.path.join(T, "bad.json"), "--method", "golden-hull"], capture_output=True, env=env).returncode == 2)
finally:
    shutil.rmtree(T, ignore_errors=True)
print(f"\n{sum(R)}/{len(R)} checks passed"); sys.exit(0 if all(R) else 1)
