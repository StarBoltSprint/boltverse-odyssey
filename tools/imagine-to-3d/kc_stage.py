"""Key-compare STAGING mirror of a live game dir (2026-10-10, SmiR: wire the keyloop steps; staging only).

    python3 kc_stage.py build --live /workspace/zb-preview-1008 --out /workspace/kc-staging/zb [--layout layouts/ember-mesa.json]
    python3 kc_stage.py serve --out /workspace/kc-staging/zb --port 8997

The staging dir is a mirror made of SYMLINKS to the live files (nothing live is copied, edited or deleted), except:
  mesas/mesas-v11.mjs   patched copy: reads mesas/kc-params.json (layout, strata dir, plates dir, relief gain) so the
                        keyloop consumers (kc_mesa.py) change what the key camera renders without touching live files
  mesas/kc-params.json  written by kc_mesa.py / layout_fit.py
  objects1/layout.json  the live tower/spire layout with the biome layout file applied (towers, spire)
Live files are only ever READ.
"""
import argparse, json, math, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REAL_DIRS = ("mesas", "objects1")          # real dirs in staging (entries symlinked one by one)
MESA_MODULE = "mesas-v11.mjs"

# exact text patches on the live mesa module (each must apply exactly once, else the build fails: never guess)
PATCHES = [
    ("export async function mountMesas({ THREE, biome, field, world, camera, renderer }) {",
     "export async function mountMesas({ THREE, biome, field, world, camera, renderer }) {\n"
     "  // kc staging (kc_stage.py): keyloop consumers write mesas/kc-params.json {layout, strata, plates, reliefGain}\n"
     "  const KC = await fetch(`./mesas/kc-params.json?t=${Date.now()}`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));\n"
     "  const LAYOUT = KC.layout || MESA_LAYOUT, RG = KC.reliefGain ?? 1; window.__mesasKC = KC;"),
    ("Promise.all(MESA_LAYOUT.map(async (L) => {", "Promise.all(LAYOUT.map(async (L) => {"),
    ("for (const L of MESA_LAYOUT) {", "for (const L of LAYOUT) {"),
    ('QS.get("mesaStrata") || "strata6"', 'QS.get("mesaStrata") || KC.strata || "strata6"'),
    ('QS.get("mesaPlates") || "plates11"', 'QS.get("mesaPlates") || KC.plates || "plates11"'),
    ("dp[i * 3] = q[k + 9] / Q[9]; dp[i * 3 + 1] = q[k + 10] / Q[10]; dp[i * 3 + 2] = q[k + 11] / Q[11];",
     "dp[i * 3] = RG * q[k + 9] / Q[9]; dp[i * 3 + 1] = RG * q[k + 10] / Q[10]; dp[i * 3 + 2] = RG * q[k + 11] / Q[11];"),
    ("const [x, z] = avXZ(L.s, L.lat);", "const [x, z] = L.x != null ? [L.x, L.z] : avXZ(L.s, L.lat);"),
]


def _link(src, dst):
    if os.path.lexists(dst): os.remove(dst) if not os.path.isdir(dst) or os.path.islink(dst) else shutil.rmtree(dst)
    os.symlink(src, dst)


def patch_module(src_text):
    t = src_text
    for a, b in PATCHES:
        n = t.count(a)
        if n != 1: raise SystemExit(f"kc_stage: patch anchor found {n}x (expected 1): {a[:70]}")
        t = t.replace(a, b)
    return "// KC STAGING COPY (kc_stage.py) of the live module; never deploy this file.\n" + t


def apply_layout(live_layout, lay):
    """Biome layout file -> objects layout: move / rotate towers + spire (positions, yaw; grounding recomputed by place())."""
    d = json.loads(json.dumps(live_layout)); moved = {}
    byid = {t["id"]: t for t in d["towers"]}; byid["spire"] = d["spire"]
    for it in lay.get("towers", []) + ([lay["spire"]] if lay.get("spire") else []):
        t = byid.get(it["id"])
        if not t: continue
        old = (t["x"], t["z"], t.get("yaw", 0))
        for k in ("x", "z", "s", "lateral", "yaw", "scale"):
            if k in it: t[k] = it[k]
        for k in ("baseY", "sink", "grounding", "visible", "sunNudges"): t.pop(k, None)   # recomputed by place()
        moved[it["id"]] = (old, (t["x"], t["z"], t.get("yaw", 0)))

    # cables / anchors: not moved (hanging cables were removed from the game at v22; objects-t7 never reads them)
    d["kcLayout"] = {"source": lay.get("source"), "moved": sorted(moved)}
    return d


def build(live, out, layout=None):
    live = os.path.abspath(live); _refuse_live(out, live); os.makedirs(out, exist_ok=True)
    for e in os.listdir(live):
        if e in REAL_DIRS or e in ("main-kc.mjs", "kc.html"): continue
        _link(os.path.join(live, e), os.path.join(out, e))
    for dname in REAL_DIRS:
        d = os.path.join(out, dname)
        if os.path.islink(d): os.remove(d)
        os.makedirs(d, exist_ok=True)
        for e in os.listdir(os.path.join(live, dname)):
            if (dname, e) in (("mesas", MESA_MODULE), ("objects1", "layout.json")) or e.startswith("kc-") or e.startswith("strata-kc") or e.startswith("plates-kc"): continue
            t = os.path.join(d, e)
            if os.path.isdir(t) and not os.path.islink(t) and os.path.exists(os.path.join(t, "KC-OVERRIDE")): continue   # kc_glb.py override (e.g. graded spire)
            _link(os.path.join(live, dname, e), os.path.join(d, e))
    open(os.path.join(out, "mesas", MESA_MODULE), "w").write(patch_module(open(os.path.join(live, "mesas", MESA_MODULE)).read()))
    kp = os.path.join(out, "mesas", "kc-params.json")
    params = json.load(open(kp)) if os.path.exists(kp) else {}
    L = json.load(open(os.path.join(live, "objects1", "layout.json")))
    if layout:
        lay = json.load(open(layout)); lay["source"] = os.path.abspath(layout)
        L = apply_layout(L, lay)
        if lay.get("mesas"): params["layout"] = lay["mesas"]
    os.remove(os.path.join(out, "objects1", "layout.json")) if os.path.lexists(os.path.join(out, "objects1", "layout.json")) else None
    json.dump(L, open(os.path.join(out, "objects1", "layout.json"), "w"), indent=1)
    json.dump(params, open(kp, "w"), indent=1)
    # mask page: the live main.mjs + the layer-3 hook of main-mesatest.mjs (mesaOnly), on the patched v11 module
    mm = open(os.path.join(live, "main.mjs")).read(); a = 'loadEl.style.display = "none";\nwindow.__ready = true;'
    if mm.count(a) != 1: raise SystemExit("kc_stage: main.mjs ready anchor not found")
    mm = mm.replace(a, 'loadEl.style.display = "none";\nif (Q.has("mesaOnly")) camera.layers.set(3);   // kc staging: mesas only (mask)\nwindow.__ready = true;')
    for f in ("main-kc.mjs", "kc.html"):
        if os.path.lexists(os.path.join(out, f)): os.remove(os.path.join(out, f))
    open(os.path.join(out, "main-kc.mjs"), "w").write("// KC STAGING COPY of main.mjs (+ mesaOnly mask hook)\n" + mm)
    ih = open(os.path.join(live, "index.html")).read(); import re
    open(os.path.join(out, "kc.html"), "w").write(re.sub(r'src="\./main\.mjs[^"]*"', 'src="./main-kc.mjs"', ih))
    open(os.path.join(out, "KC-STAGING.txt"), "w").write(f"staging mirror of {live} (symlinks); built by kc_stage.py; layout {layout}\n")
    return dict(out=out, layout=layout, params=params)


def _refuse_live(out, live=os.environ.get("I23D_LIVE_ROOT", "/workspace/zb-preview-1008")):
    o, l = os.path.realpath(out), os.path.realpath(live)
    if o == l or o.startswith(l + os.sep): raise SystemExit(f"kc_stage: refusing to write into the live root {live}: {out}")


def params_update(out, **kw):
    _refuse_live(out)
    kp = os.path.join(out, "mesas", "kc-params.json"); p = json.load(open(kp)) if os.path.exists(kp) else {}
    p.update({k: v for k, v in kw.items() if v is not None}); json.dump(p, open(kp, "w"), indent=1); return p


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("cmd", choices=["build", "serve", "params"])
    ap.add_argument("--live", default="/workspace/zb-preview-1008"); ap.add_argument("--out", default="/workspace/kc-staging/zb")
    ap.add_argument("--layout"); ap.add_argument("--port", type=int, default=8997); ap.add_argument("--set", nargs="*", default=[])
    a = ap.parse_args()
    if a.cmd == "build": print(json.dumps(build(a.live, a.out, a.layout)))
    elif a.cmd == "params": print(json.dumps(params_update(a.out, **{k: json.loads(v) for k, v in (s.split("=", 1) for s in a.set)})))
    else:
        log = open(os.path.join(a.out, "..", f"serve-{a.port}.log"), "a")
        p = subprocess.Popen([sys.executable, "-m", "http.server", str(a.port), "--bind", "127.0.0.1"], cwd=a.out, stdout=log, stderr=log, start_new_session=True)
        print(json.dumps(dict(pid=p.pid, url=f"http://127.0.0.1:{a.port}/index.html")))
