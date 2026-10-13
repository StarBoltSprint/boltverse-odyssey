#!/usr/bin/env python3
"""tools/gatesuite/run.py <build-url> [--out gate-report.json] [--selftest]

One gate run over a served (or local) build. Steps, in this order, each writing its own section of ONE
gate-report.json:  spine, layout, walk, pack, budget, playgate, depthmeasure, kitjudge.
A section that is missing, skipped, errored or has no evidence counts as FAIL ("not implemented, never pass").

The build is described by <build-url>/build.json:
  {"name", "kind": "tier|piece|greybox", "spine": "spine.json", "glbs": {"lod0": "a.glb", "lod1": ..., "lod2": ...},
   "glb_ref": {"lod0": "unpacked.glb"},            # pack: unpacked reference (UV range / tri count must match)
   "colliders": "colliders.json",                  # [{id, min[3], max[3], mesh, world?}] Y-up metres, physics only
   "expect": {"height_m": 7.5, "tol": 0.10},       # depthmeasure: Reader-spec height, +-10 %
   "page": "play.html?view=key&hud=0",             # playgate: served page exposing window.__inventory/__probe
   "inventory": "inventory.json",                  # (offline alternative to the page)
   "judge": {"render": "key.png", "key": "...", "mask": "...", "score": "judge.json"},
   "views": {"side": "view-side.png", "chase": "view-chase.png", ...},
   "textures": [{"w":1024,"h":1024}], "texel_px_per_m": 539, "draws": 0}
"""
import argparse, json, math, subprocess, sys, tempfile, urllib.request
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT))
from tools.gatesuite import glbio  # noqa: E402

STEPS = ["spine", "layout", "walk", "pack", "budget", "playgate", "depthmeasure", "kitjudge"]
ENGINE = {"piece": {"lod0": 3000, "lod1": 1000, "lod2": 300}, "tier": {"lod0": 90000}, "greybox": {"lod0": 90000},
          "draws_max": 20, "tex_mb_max": 48, "texel_min": 500}
LAYOUT = {"max_grade": 0.14, "max_pitch_step_deg_per_5m": 4.0, "camera": {"behind": 4.5, "above": 2.6, "vfov_deg": 48},
          "collider_out_max_m": 0.05, "collider_inset_m": 0.02, "spine_min": (1, 3, 1)}
WALK = {"sprint_mps": 8.0, "dt": 1 / 60, "snap_deg_per_frame": 1.0, "capsule_r": 0.35, "lane_m": 2.5}
KITJUDGE = {"gate": 50.0, "dark_rect_frac": 0.004, "dark_rel": 0.5, "rect_fill": 0.75, "stripe_ratio": 9.0}


# ---------------------------------------------------------------- io
class Build:
    def __init__(self, url):
        self.url = url.rstrip("/")
        self.local = not self.url.startswith("http")
        self.tmp = Path(tempfile.mkdtemp(prefix="gatesuite-"))
        self.m = json.loads(self.text("build.json"))

    def text(self, rel):
        return self.path(rel).read_text()

    def path(self, rel):
        if self.local:
            p = Path(rel) if Path(rel).is_absolute() else Path(self.url) / rel
            if not p.exists():
                raise FileNotFoundError(rel)
            return p
        out = self.tmp / rel.replace("/", "__").split("?")[0]
        if not out.exists():
            urllib.request.urlretrieve(f"{self.url}/{rel}", out)
        return out


def sec(status, checks, **kw):
    return {"status": status, "checks": checks, **kw}


def verdict(checks):
    return "PASS" if checks and all(c["ok"] for c in checks) else "FAIL"


def chk(name, ok, value=None, rule=None):
    return {"check": name, "ok": bool(ok), "value": value, "rule": rule}


# ---------------------------------------------------------------- spine helpers
def spine_version(s):
    v = str(s.get("version", "")).split("v")[-1]
    try:
        return tuple(int(x) for x in v.split("."))
    except ValueError:
        return (0,)


def spine_pitch(s):
    pts = s.get("points", [])
    S = np.array([p["s"] for p in pts], float)
    P = np.array([p.get("cam_pitch_deg", s.get("camera", {}).get("pitch_deg", 0)) for p in pts], float)
    Y = np.array([p.get("y", 0) for p in pts], float)
    return S, P, Y


# ---------------------------------------------------------------- steps
def step_spine(b, ctx):
    s = ctx["spine"]
    v = spine_version(s)
    S, P, Y = spine_pitch(s)
    c = [chk("version >= 1.3.1", v >= LAYOUT["spine_min"], ".".join(map(str, v)), "spine.json version"),
         chk("points present", len(S) > 2, len(S)),
         chk("camera block present", "camera" in s, s.get("camera"))]
    return sec(verdict(c), c)


def step_layout(b, ctx):
    s = ctx["spine"]
    S, P, Y = spine_pitch(s)
    c = []
    if len(S) > 2:
        ds = np.diff(S); grade = np.abs(np.diff(Y)) / np.maximum(ds, 1e-6)
        c.append(chk("grade <= 14 %", grade.max() <= LAYOUT["max_grade"] + 1e-6, round(float(grade.max()), 4)))
        step = np.abs(np.diff(P)) / np.maximum(ds, 1e-6) * 5
        i = int(step.argmax())
        c.append(chk("pitch step <= 4 deg / 5 m", step.max() <= LAYOUT["max_pitch_step_deg_per_5m"] + 1e-6,
                     {"max": round(float(step.max()), 2), "at_s": float(S[i + 1])}))
    cam = s.get("camera", {})
    for k, v in LAYOUT["camera"].items():
        c.append(chk(f"camera.{k} == {v}", abs(float(cam.get(k, -999)) - v) < 0.01, cam.get(k)))
    cols = ctx.get("colliders")
    if cols is None:
        c.append(chk("colliders present (Level Designer rules)", False, "missing"))
    else:
        out_max, worst = 0.0, None
        for col in cols:
            ms = [m for m in ctx["meshes"] if m["name"] == col.get("mesh")] or ctx["meshes"]
            V = np.vstack([m["V"] for m in ms])
            lo, hi = V.min(0), V.max(0)
            o = float(max((lo - np.array(col["min"])).max(), (np.array(col["max"]) - hi).max()))
            if o > out_max:
                out_max, worst = o, col["id"]
        c.append(chk("no collider face > 5 cm outside its mesh", out_max <= LAYOUT["collider_out_max_m"] + 1e-9,
                     {"max_out_m": round(out_max, 3), "collider": worst}))
    return sec(verdict(c), c)


def step_walk(b, ctx):
    """Deterministic fixed-timestep walk along the spine at sprint speed (fps-independent)."""
    s = ctx["spine"]
    S, P, Y = spine_pitch(s)
    c, events = [], []
    if len(S) < 3:
        return sec("FAIL", [chk("spine points", False, len(S))])
    blend = float(s.get("climb", {}).get("pitch_blend_m", 0) or 0)
    t = np.arange(S[0], S[-1], WALK["sprint_mps"] * WALK["dt"])
    if blend > 0:   # pitch per point blended over pitch_blend_m (spine contract)
        k = max(1, int(round(blend / (WALK["sprint_mps"] * WALK["dt"]))))
        Pi = np.interp(t, S, P)
        Pi = np.convolve(np.pad(Pi, (k // 2, k - k // 2 - 1), mode="edge"), np.ones(k) / k, mode="valid")
    else:          # no blend: camera takes each point's pitch as it reaches it
        Pi = P[np.clip(np.searchsorted(S, t, side="right") - 1, 0, len(P) - 1)]
    d = np.abs(np.diff(Pi))
    bad = np.nonzero(d > WALK["snap_deg_per_frame"])[0]
    for i in bad[:20]:
        events.append({"s": round(float(t[i + 1]), 2), "check": "camera_snap", "value": round(float(d[i]), 2)})
    c.append(chk("camera pitch delta <= 1 deg / frame", len(bad) == 0, {"max": round(float(d.max()), 3), "events": len(bad)}))
    cols = [x for x in (ctx.get("colliders") or []) if x.get("world")]
    if not cols:
        c.append(chk("world colliders along the spine (snag check)", False, "no world colliders in build"))
    else:
        xy = np.array([p["xy"] for p in s["points"]], float)
        n = 0
        for col in cols:   # glTF Y-up world: x east, -z north
            lo, hi = np.array(col["min"]), np.array(col["max"])
            for p, y in zip(xy, Y):
                q = np.array([p[0], y + 0.9, -p[1]])
                dd = np.maximum(np.maximum(lo - q, q - hi), 0)
                if np.linalg.norm(dd[[0, 2]]) < WALK["capsule_r"] and lo[1] < q[1] < hi[1]:
                    n += 1; events.append({"xy": p.tolist(), "check": "invisible_wall_or_snag", "collider": col["id"]})
        c.append(chk("no collider in the player lane", n == 0, n))
    return sec(verdict(c), c, events=events)


def step_pack(b, ctx):
    c = []
    refs = b.m.get("glb_ref", {})
    for lod, rel in b.m.get("glbs", {}).items():
        ms, j = glbio.meshes(b.path(rel))
        uv = [m["uv"] for m in ms if m["uv"] is not None]
        tris = int(sum(len(m["F"]) for m in ms))
        pos_mm = all("min" in j["accessors"][p["attributes"]["POSITION"]] for me in j["meshes"] for p in me["primitives"])
        c.append(chk(f"{lod}: POSITION accessors carry min/max", pos_mm))
        if lod in refs:
            rm, _ = glbio.meshes(b.path(refs[lod]))
            ru = [m["uv"] for m in rm if m["uv"] is not None]
            if uv and ru:
                a = np.vstack(uv); r = np.vstack(ru)
                diff = float(max(np.abs(a.min(0) - r.min(0)).max(), np.abs(a.max(0) - r.max(0)).max()))
                c.append(chk(f"{lod}: UV range matches unpacked within 0.001", diff <= 0.001,
                             {"packed": [a.min(0).round(4).tolist(), a.max(0).round(4).tolist()], "unpacked": [r.min(0).round(4).tolist(), r.max(0).round(4).tolist()]}))
            rt = int(sum(len(m["F"]) for m in rm))
            c.append(chk(f"{lod}: triangle count unchanged by packing", rt == tris, {"packed": tris, "unpacked": rt}))
        else:
            q = "KHR_mesh_quantization" in j.get("extensionsUsed", [])
            c.append(chk(f"{lod}: unpacked reference (required when quantized)", not q, "quantized without glb_ref" if q else "float GLB"))
        nan = any(not np.isfinite(m["V"]).all() for m in ms)
        c.append(chk(f"{lod}: finite positions", not nan))
    if not c:
        c.append(chk("glbs listed", False, "none"))
    return sec(verdict(c), c)


def step_budget(b, ctx):
    kind = b.m.get("kind", "tier")
    lim = ENGINE.get(kind, ENGINE["tier"])
    c = []
    for lod, rel in b.m.get("glbs", {}).items():
        ms, _ = glbio.meshes(b.path(rel))
        tris = int(sum(len(m["F"]) for m in ms if not m["name"].startswith(("collider", "marker", "socket"))))
        if lod in lim:
            c.append(chk(f"{kind} {lod} tris <= {lim[lod]}", tris <= lim[lod], tris))
    for lod in lim:
        if lod not in b.m.get("glbs", {}):
            c.append(chk(f"{lod} present", False, "missing"))
    ms0 = ctx["meshes"]
    draws = b.m.get("draws") or len({(m["mesh"], m["material"]) for m in ms0 if not m["name"].startswith(("collider", "marker"))})
    c.append(chk(f"draw calls <= {ENGINE['draws_max']} (instanced per piece x material)", draws <= ENGINE["draws_max"], draws))
    tex = b.m.get("textures")
    if tex is None:
        c.append(chk("texture memory declared", False, "missing"))
    else:
        mb = sum(t["w"] * t["h"] * 4 * 4 / 3 for t in tex) / 2 ** 20
        c.append(chk(f"texture MB <= {ENGINE['tex_mb_max']}", mb <= ENGINE["tex_mb_max"], round(mb, 1)))
    tx = ctx.get("probe", {}).get("texPxPerM") or b.m.get("texel_px_per_m")
    c.append(chk(f"texel density >= {ENGINE['texel_min']} px/m", tx is not None and tx >= ENGINE["texel_min"], tx))
    return sec(verdict(c), c)


def step_playgate(b, ctx):
    inv, probe, errs = None, {}, []
    if b.m.get("page"):
        try:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                br = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
                pg = br.new_page(viewport={"width": 412, "height": 915}, device_scale_factor=1.5)
                pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
                pg.goto(f"{b.url}/{b.m['page']}" if not b.local else (Path(b.url) / b.m["page"]).as_uri())
                pg.wait_for_function("window.__ready === true", timeout=180000)
                inv = pg.evaluate("window.__inventory || null"); probe = pg.evaluate("window.__probe || {}") or {}
                br.close()
        except Exception as e:  # noqa: BLE001
            errs.append(f"page: {e}"[:300])
    elif b.m.get("inventory"):
        d = json.loads(b.text(b.m["inventory"])); inv, probe = d.get("inventory"), d.get("probe", {})
    ctx["probe"] = (probe or {}).get("px") or {}
    c = [chk("served page or inventory read", inv is not None, errs or None)]
    if inv is not None:
        import re
        base = lambda n: re.sub(r"_\d+$", "", n)   # three.js GLTFLoader de-duplicates names as name_1, name_2
        names = {m["name"] for m in ctx["meshes"]} | {base(m["name"]) for m in ctx["meshes"]}
        drawn = [n for n in inv if n.get("visible", True) and n.get("drawn", True)]
        col = [n["name"] for n in drawn if n["name"].lower().startswith(("collider", "col_")) or n.get("physics")]
        c.append(chk("no collider node drawn", not col, col[:10]))
        outside = [n["name"] for n in drawn if n.get("source") == "build" and n["name"] not in names and base(n["name"]) not in names]
        c.append(chk("every drawn build node is in the GLB mesh list", not outside, outside[:10]))
        ds = [n["name"] for n in drawn if n.get("doubleSided") and not n.get("glb_doubleSided")]
        c.append(chk("doubleSided only where the GLB says so", not ds, ds[:10]))
        c.append(chk("no page errors", not errs, errs[:3]))
    return sec(verdict(c), c, probe=probe)


def _vhits(points, V, F):
    """For each point: heights (glTF Y) of all triangles crossing the vertical line through it."""
    A, B, C = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    d = (B[:, 2] - C[:, 2]) * (A[:, 0] - C[:, 0]) + (C[:, 0] - B[:, 0]) * (A[:, 2] - C[:, 2])
    ok = np.abs(d) > 1e-12
    dd = np.where(ok, d, 1)
    out = []
    for p in points:
        x, z = p[0], p[2]
        l1 = ((B[:, 2] - C[:, 2]) * (x - C[:, 0]) + (C[:, 0] - B[:, 0]) * (z - C[:, 2])) / dd
        l2 = ((C[:, 2] - A[:, 2]) * (x - C[:, 0]) + (A[:, 0] - C[:, 0]) * (z - C[:, 2])) / dd
        l3 = 1 - l1 - l2
        ins = ok & (l1 >= 0) & (l2 >= 0) & (l3 >= 0)
        out.append(l1[ins] * A[ins, 1] + l2[ins] * B[ins, 1] + l3[ins] * C[ins, 1])
    return out


def _support_gap(points, meshes):
    """0 if the point is inside any closed mesh (odd crossings above it), else the drop to the nearest surface below."""
    gap = np.full(len(points), np.inf)
    for m in meshes:
        for k, ys in enumerate(_vhits(points, m["V"], m["F"])):
            p = points[k][1]
            if (ys > p).sum() % 2 == 1:
                gap[k] = 0.0
            elif (ys <= p).any():
                gap[k] = min(gap[k], p - ys[ys <= p].max())
    return gap


def step_depthmeasure(b, ctx):
    ms = [m for m in ctx["meshes"] if not m["name"].lower().startswith(("collider", "socket", "marker"))]
    c = []
    exp = b.m.get("expect", {})
    V = np.vstack([m["V"] for m in ms]) if ms else np.zeros((1, 3))
    h = float(V[:, 1].max() - max(V[:, 1].min(), 0.0))
    if "height_m" in exp:
        tol = exp.get("tol", 0.10)
        c.append(chk(f"height vs Reader spec +-{tol:.0%}", abs(h - exp["height_m"]) <= tol * exp["height_m"],
                     {"model_m": round(h, 3), "spec_m": exp["height_m"]}))
    else:
        c.append(chk("Reader-spec height declared", False, "missing expect.height_m"))
    mk = [m for m in ctx["meshes"] if m["name"].lower().startswith("marker")]
    mh = float(mk[0]["V"][:, 1].max() - mk[0]["V"][:, 1].min()) if mk else None
    c.append(chk("1.8 m marker present", mh is not None and abs(mh - 1.8) <= 0.02, mh))
    # float: every overhang piece (cornice*/slab*) must rest on something within 2 cm below its underside
    over = [m for m in ms if any(k in m["name"].lower() for k in ("cornice", "slab", "overhang")) and "support" not in m["name"].lower()]
    if over:
        others = [m for m in ms if m not in over and not m["name"].lower().startswith("icicle")]
        worst, n_float, n = 0.0, 0, 0
        walls = [m for m in others if m["name"].lower().startswith(("tier", "wall"))] or others
        zfront = float(np.percentile(np.vstack([m["V"] for m in walls])[:, 2], 99)) if walls else 0.0
        for m in over:
            Vm = m["V"]
            pts = []
            zlo, zhi = Vm[:, 2].min(), Vm[:, 2].max()
            # probe 0.3 m behind the supports' front face (the visible seat line), inside the overhang's depth
            zw = float(np.clip(zfront - 0.3, zlo + 0.05, zhi - 0.05))
            for x in np.arange(Vm[:, 0].min() + 0.25, Vm[:, 0].max() - 0.2, 0.5):   # one probe per 0.5 m of run
                hy = _vhits([[x, 0.0, zw]], Vm, m["F"])[0]                  # the overhang's own underside here
                if len(hy):
                    pts.append([x, float(hy.min()) - 0.03, zw])
            pts = np.array(pts)
            gap = _support_gap(pts, others) if len(pts) else np.zeros(0)
            n += len(pts); n_float += int((gap > 0.02).sum())
            worst = max(worst, float(np.where(np.isfinite(gap), gap, 99).max()) if len(gap) else 0)
        c.append(chk("0 m float under overhangs (2 cm tolerance)", n > 0 and n_float == 0, {"probes": n, "floating": n_float, "worst_gap_m": round(worst, 3)}))
    elif exp.get("overhang"):
        c.append(chk("overhang pieces found for float check", False, "none"))
    return sec(verdict(c), c, measured={"height_m": round(h, 3)})


def _dark_rects(img):
    """Hard dark rectangles: blobs darker than half the view's median lightness (blur 4 px, opened 9 px),
    >= 0.4 % of the view, filling >= 75 % of their bounding box (a straight-edged void, not stone texture)."""
    import cv2
    L = cv2.GaussianBlur(cv2.cvtColor(img, cv2.COLOR_BGR2LAB)[:, :, 0].astype(float) * 100 / 255, (0, 0), 4)
    m = (L < KITJUDGE["dark_rel"] * np.median(L)).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    hits = []
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if a > KITJUDGE["dark_rect_frac"] * m.size and a / (w * h) >= KITJUDGE["rect_fill"]:
            hits.append({"box": [int(x), int(y), int(w), int(h)], "area_frac": round(a / m.size, 4), "fill": round(a / (w * h), 2)})
    return hits


def _stripe(img):
    """Periodic stripe / chevron energy: strongest non-DC peak of the column-mean gradient spectrum over its median."""
    import cv2
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(float)
    gx = np.abs(cv2.Sobel(g, cv2.CV_64F, 1, 0, ksize=3)).mean(0)
    gy = np.abs(cv2.Sobel(g, cv2.CV_64F, 0, 1, ksize=3)).mean(1)
    r = 0.0
    for prof in (gx, gy):
        p = prof - prof.mean()
        sp = np.abs(np.fft.rfft(p * np.hanning(len(p))))[3:len(p) // 4]
        if len(sp):
            r = max(r, float(sp.max() / (np.median(sp) + 1e-9)))
    return r


def step_kitjudge(b, ctx):
    import cv2
    c = []
    j = b.m.get("judge", {})
    score = None
    if j.get("score"):
        score = json.loads(b.text(j["score"]))
    elif j.get("render"):
        out = subprocess.run([sys.executable, str(ROOT / "tools/kit/judge.py"), str(b.path(j["render"])), str(b.path(j["key"])), str(b.path(j["mask"])),
                              "--gate", str(KITJUDGE["gate"])], capture_output=True, text=True, timeout=900)
        score = json.loads(out.stdout) if out.stdout.strip().startswith("{") else None
    c.append(chk(f"tools/kit/judge.py total >= {KITJUDGE['gate']}", score is not None and score["total"] >= KITJUDGE["gate"],
                 None if score is None else {"total": score["total"], "scores": score.get("scores")}))
    views = b.m.get("views", {})
    if not views:
        c.append(chk("review views present", False, "missing"))
    for name, rel in views.items():
        img = cv2.imread(str(b.path(rel)))
        if img is None:
            c.append(chk(f"{name}: view readable", False)); continue
        img = img[60:]   # drop HUD text
        dr = _dark_rects(img)
        c.append(chk(f"{name}: no dark hard rectangle", not dr, dr[:3]))
        st = _stripe(img)
        c.append(chk(f"{name}: stripe/chevron repeat (FFT) < {KITJUDGE['stripe_ratio']}", st < KITJUDGE["stripe_ratio"], round(st, 2)))
    return sec(verdict(c), c)


FN = {"spine": step_spine, "layout": step_layout, "walk": step_walk, "pack": step_pack, "budget": step_budget,
      "playgate": step_playgate, "depthmeasure": step_depthmeasure, "kitjudge": step_kitjudge}


def run(url, out=None, only=None):
    rep = {"build": url, "tool": "tools/gatesuite/run.py", "order": STEPS, "sections": {}}
    try:
        b = Build(url)
    except Exception as e:  # noqa: BLE001
        rep["sections"] = {s: sec("FAIL", [chk("build.json readable", False, str(e)[:200])]) for s in STEPS}
        rep["verdict"] = "FAIL"
        return rep
    ctx = {}
    try:
        ctx["spine"] = json.loads(b.text(b.m.get("spine", "spine.json")))
    except Exception as e:  # noqa: BLE001
        ctx["spine"] = {"_error": str(e)[:200]}
    try:
        ctx["meshes"] = glbio.meshes(b.path(b.m["glbs"]["lod0"]))[0]
    except Exception:  # noqa: BLE001
        ctx["meshes"] = []
    try:
        ctx["colliders"] = json.loads(b.text(b.m["colliders"])) if b.m.get("colliders") else None
    except Exception:  # noqa: BLE001
        ctx["colliders"] = None
    for s in STEPS:
        if only and s not in only:
            rep["sections"][s] = sec("FAIL", [chk("section run", False, "skipped")], skipped=True)
            continue
        try:
            rep["sections"][s] = FN[s](b, ctx)
        except Exception as e:  # noqa: BLE001
            rep["sections"][s] = sec("FAIL", [chk("section ran without error", False, f"{type(e).__name__}: {e}"[:300])])
    for s in STEPS:   # missing / skipped sections are FAIL
        rep["sections"].setdefault(s, sec("FAIL", [chk("section present", False, "missing")]))
    rep["verdict"] = "PASS" if all(rep["sections"][s]["status"] == "PASS" for s in STEPS) else "FAIL"
    rep["summary"] = {s: rep["sections"][s]["status"] for s in STEPS}
    if out:
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        Path(out).write_text(json.dumps(rep, indent=1, default=str))
    return rep


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("build_url", nargs="?")
    ap.add_argument("--out", default="gate-report.json")
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        from tools.gatesuite import selftest
        sys.exit(selftest.main())
    r = run(a.build_url, a.out, a.only)
    print(json.dumps(r["summary"] if "summary" in r else r, indent=1)); print("verdict", r["verdict"], "->", a.out)
    sys.exit(0 if r["verdict"] == "PASS" else 1)
