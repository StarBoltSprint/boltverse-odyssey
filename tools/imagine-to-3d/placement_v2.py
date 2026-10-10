"""Automatic placement v2 (2026-10-10, SmiR): camera match on REAL renders, then a real-render greedy layout loop.
Staging only (kc_stage.py mirror); live files are read, never written.

  python3 placement_v2.py camera --stage /workspace/kc-staging/zb --out DIR [--budget 28]
      1) camera match FIRST: in one headless page (tools/object-gate/kc-shots.mjs), coordinate descent on yaw, pitch,
         field of view and camera height (eye offset dy) so the key's features land where the key has them:
         avenue vanishing point + spire top (frame fractions, from the camera the game actually rendered with) and the
         VISIBLE horizon (lowest sky row in the centre band, measured on the render screenshot and on the key image).
         Key targets: layouts/<biome>-composition.json "camera" {vp, spireTop}. Writes DIR/camera-v2.json.
  python3 placement_v2.py place --stage DIR --camera DIR/camera-v2.json --out DIR [--budget 12] [--elements towers,spire]
         [--init layouts/ember-mesa.json]
      3) greedy loop on real renders: one element moves at a time (s / lateral on its own side / yaw), the staging
         layout is rewritten, the page reloads at low res (480x270), key-compare scores the key elements (IoU per
         element: towers, tower-right, spire). A move is kept only if the element it lands in improves and no other
         element gets worse (> 0.01); otherwise it is reverted. Street / spacing / 50-50 / camera rules are checked
         before any render (layout_fit.rules_ok). --init offers a whole earlier layout as the first candidate (kept only
         if it scores better). Hard budget: --budget renders. Writes DIR/layout-v2.json + DIR/placement-log.json.
(2, optional) sand-mound flattening at the key camera is NOT implemented: the height solve lifts the camera over the
mound instead (honest limit, see METHOD).
"""
import argparse, copy, json, math, os, subprocess, sys, time
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import i23d_common as C, kc_stage, layout_fit as LF

LIVE = os.environ.get("I23D_LIVE_ROOT", "/workspace/zb-preview-1008")
OG = C.OBJECT_GATE_DIR
SHOTS = os.path.join(OG, "kc-shots.mjs")
KC_SPEC = os.path.join(OG, "specs", "zone-b", "key-compare.yaml")


class Shots:
    """kc-shots.mjs: one browser for the whole run (the box rule: one headless browser at a time)."""
    def __init__(self):
        env = dict(os.environ); env.setdefault("OG_PLAYWRIGHT", "/workspace/playtest/node_modules/playwright/index.mjs")
        self.p = subprocess.Popen(["node", SHOTS], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, env=env, cwd=OG)
    def __call__(self, **m):
        self.p.stdin.write(json.dumps(m) + "\n"); self.p.stdin.flush(); r = json.loads(self.p.stdout.readline())
        if not r.get("ok"): raise RuntimeError(f"kc-shots {m.get('cmd')}: {r.get('error')}")
        return r
    def close(self):
        try: self.p.stdin.write('{"cmd":"quit"}\n'); self.p.stdin.flush(); self.p.wait(60)
        except Exception: self.p.kill()


def sky_mask(a):
    r, g, b = a[..., 0] * 255, a[..., 1] * 255, a[..., 2] * 255; L = (0.2126 * r + 0.7152 * g + 0.0722 * b)
    return (b > 1.03 * g) & (L > 40)


def visible_horizon(img_path, band=(0.40, 0.60)):
    """lowest row of the top-connected sky (frame fraction) per column in the centre band, median over columns that have sky."""
    import cv2
    a = np.asarray(Image.open(img_path).convert("RGB").resize((320, 180))).astype(np.float32) / 255; s = sky_mask(a)
    s = cv2.morphologyEx(s.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    n, lab = cv2.connectedComponents(s); top = set(lab[0][s[0] > 0].tolist()) - {0}
    s = np.isin(lab, list(top))   # only the sky connected to the top of the frame (not blue-ish sand shadows)
    H, W = s.shape; rows = []
    for x in range(int(band[0] * W), int(band[1] * W)):
        ys = np.nonzero(s[:, x])[0]
        if len(ys): rows.append(ys.max() / H)
    return float(np.median(rows)) if rows else None


def comp_targets(comp):
    c = json.load(open(comp)).get("camera") or {}
    if "vp" not in c or "spireTop" not in c: raise SystemExit(f"{comp}: needs camera.vp and camera.spireTop (key frame fractions)")
    return c


def cam_err(pr, hz, K, khz):
    e = 0.0; parts = {}
    for k, w in (("vp", 1.0), ("spireTop", 1.0)):
        if pr.get(k):
            d = (pr[k][0] - K[k][0]) ** 2 + (pr[k][1] - K[k][1]) ** 2; parts[k] = round(math.sqrt(d), 4); e += w * d
        else: e += 1.0; parts[k] = None
    if hz is not None and khz is not None: parts["visibleHorizon"] = round(hz - khz, 4)   # diagnostic only: the key's warm horizon haze fails the sky colour rule (key 0.29 in the centre band), so it is reported, not fitted
    return e, parts


def camera(a):
    K = comp_targets(a.composition); key = json.load(open(a.composition)).get("key") or "/workspace/zb-bible-1008/key-city3.jpg"
    khz = visible_horizon(key); os.makedirs(a.out, exist_ok=True)
    c0 = dict(json.load(open(a.init_camera))["camera"]) if a.init_camera else dict(x=-51.115, z=9.63, yaw=78, pitch=-1.16, eye=3.15, fovDeg=58)
    c0.setdefault("dy", 0.0); url = a.url
    S = Shots(); log = []; n = 0
    try:
        t0 = time.time(); S(cmd="open", url=url, cam=c0, vp=[480, 270], settle=6000); log.append(f"open {time.time() - t0:.0f}s")
        def evaluate(c):
            nonlocal n
            S(cmd="pose", cam=c, wait=30000); pr = S(cmd="probe"); p = os.path.join(a.out, f"cam{n:03d}.jpg"); S(cmd="shot", path=p); n += 1
            hz = visible_horizon(p); e, parts = cam_err(pr, hz, K, khz)
            log.append(dict(cam={k: c[k] for k in ("yaw", "pitch", "fovDeg", "dy")}, err=round(e, 5), parts=parts, shot=p)); return e, parts, pr
        best = dict(c0); be, bp, bpr = evaluate(best)
        steps = dict(yaw=3.0, pitch=2.0, fovDeg=6.0, dy=3.0); lim = dict(dy=(0.0, 25.0), fovDeg=(40.0, 80.0), pitch=(-12.0, 15.0))
        while n < a.budget and max(steps.values()) > 0.4:
            moved = False
            for k in ("yaw", "pitch", "fovDeg", "dy"):
                for sgn in (1, -1):
                    if n >= a.budget: break
                    c = dict(best); c[k] = round(c[k] + sgn * steps[k], 3)
                    if k in lim: c[k] = min(max(c[k], lim[k][0]), lim[k][1])
                    if c[k] == best[k]: continue
                    e, parts, pr = evaluate(c)
                    if e < be - 1e-6: best, be, bp, bpr, moved = c, e, parts, pr, True; break
            if not moved: steps = {k: v / 2 for k, v in steps.items()}
    finally: S.close()
    first = log[1] if len(log) > 1 else None
    res = dict(camera={**{k: round(v, 3) if isinstance(v, float) else v for k, v in best.items()}, "eye": round(best["eye"] + best.get("dy", 0), 3), "dy": 0.0},
               cameraRaw=best, error=round(be, 5), parts=bp, probe=bpr, first=first, keyTargets=dict(K, visibleHorizon=khz), renders=n, log=log,
               note="eye already includes the solved height offset (dy folded in)")
    C.dump(res, os.path.join(a.out, "camera-v2.json")); print(json.dumps(dict(camera=res["camera"], error=res["error"], parts=bp, first=first and first["parts"], renders=n)))


# ---------------------------------------------------------------- real-render greedy placement
def kc_elements(ids):
    spec = C.read_yaml(KC_SPEC); return [e for e in spec["elements"] if e["id"] in ids]


def score_shot(png, out, ids):
    job = dict(key=C.read_yaml(KC_SPEC)["key"], game=png, out=out, elements=kc_elements(ids), thresholds={"_default": {}}, title="placement v2")
    jp = os.path.join(out, "job.json"); os.makedirs(out, exist_ok=True); C.dump(job, jp)
    subprocess.run([sys.executable, os.path.join(OG, "lib", "keycompare.py"), jp], check=True, capture_output=True, text=True)
    R = json.load(open(os.path.join(out, "key-compare.json")))
    return {e["id"]: (e.get("iou") or 0.0) for e in R["elements"]}


def owner(cam, it, comp_rects):
    """key element whose rect holds the projected centre of the item (analytic, solved camera)."""
    Cm = LF.Cam(cam); h = it.get("height", 90) * 0.5
    uv, d = Cm.project([[it["x"], h, it["z"]]]); u, v = uv[0][0] / LF.W, uv[0][1] / LF.H
    if d[0] <= 1: return None
    for eid, (x0, y0, x1, y1) in comp_rects.items():
        if x0 <= u <= x1 and y0 <= v <= y1: return eid
    return None


def place(a):
    cam = json.load(open(a.camera))["camera"]; ids = ["towers", "tower-right", "spire"]
    rects = {e["id"]: e["key"]["rect"] for e in kc_elements(ids)}
    os.makedirs(a.out, exist_ok=True)
    live_L = json.load(open(os.path.join(LIVE, "objects1", "layout.json")))
    towers = copy.deepcopy(live_L["towers"]); spire = copy.deepcopy(live_L["spire"]); sky = live_L.get("skyline", [])
    cams = [(cam["x"], cam["z"])] + [LF.av_xz(live_L[k]["standS"], live_L[k]["lateral"]) for k in ("hero", "chase", "street") if k in live_L]
    def lay(): return dict(source="placement_v2", towers=[{k: t[k] for k in ("id", "x", "z", "s", "lateral", "yaw") if k in t} for t in towers],
                           spire={k: spire[k] for k in ("id", "x", "z", "s", "lateral", "yaw") if k in spire})
    lp = os.path.join(a.out, "layout-v2.json")
    S = Shots(); n = 0; log = []
    def render(tag):
        nonlocal n
        C.dump(lay(), lp); kc_stage.build(LIVE, a.stage, lp)
        S(cmd="open", url=a.url, cam=cam, vp=[480, 270], settle=a.settle); p = os.path.join(a.out, f"r{n:03d}-{tag}.png"); S(cmd="shot", path=p); n += 1
        return score_shot(p, os.path.join(a.out, f"kc-{n:03d}"), ids), p
    def setp(t, s, lat): t["s"], t["lateral"] = s, lat; t["x"], t["z"] = LF.av_xz(s, lat)
    try:
        base, p0 = render("start"); best = dict(base); log.append(dict(step="start", score=base, shot=p0))
        if a.init:   # a whole earlier layout as one candidate
            I = json.load(open(a.init)); old = copy.deepcopy((towers, spire)); by = {t["id"]: t for t in I.get("towers", [])}
            for t in towers:
                if t["id"] in by: t.update({k: by[t["id"]][k] for k in ("x", "z", "s", "lateral", "yaw") if k in by[t["id"]]})
            if I.get("spire"): spire.update({k: I["spire"][k] for k in ("x", "z", "s", "lateral", "yaw") if k in I["spire"]})
            sc, p = render("init")
            ok = sum(sc.values()) > sum(best.values()) + 0.01 and all(sc[i] >= best[i] - 0.01 for i in ids)
            log.append(dict(step="init " + os.path.basename(a.init), score=sc, kept=ok, shot=p))
            if ok: best = sc
            else: towers, spire = old
        # candidate moves, ranked analytically (cheap) and rendered in that order until the budget is spent
        LF_S = LF.Scene(LIVE, cam, []); LF_S.hcal = 0.82; T = LF.key_targets(a.composition)
        def an_score():
            tm = LF_S.tower_mask(towers) | LF_S.tower_mask(sky); sm = LF_S.spire_mask(spire)
            return LF.iou(tm, T["city"]) + 0.5 * LF.iou(sm, T["spire"])
        sp_item = lambda: dict(spire, module=None, scale=1.0)
        allit = lambda: towers + [sp_item()] + sky
        tried = set()
        while n < a.budget:
            a0 = an_score(); cands = []
            pool = [t for t in towers if t["s"] <= a.max_s] if "towers" in a.elements else []
            pool += [spire] if "spire" in a.elements else []
            for t in pool:
                side = 1 if t["lateral"] > 0 else -1
                for ds, dl, dy in ((-12, 0, 0), (12, 0, 0), (0, -8, 0), (0, 8, 0), (0, 0, -15), (0, 0, 15), (-24, 0, 0), (24, 0, 0)):
                    key = (t["id"], round(t["s"] + ds), round(t["lateral"] + dl), round(t.get("yaw", 0) + dy))
                    if key in tried: continue
                    s0, l0, y0 = t["s"], t["lateral"], t.get("yaw", 0)
                    setp(t, s0 + ds, l0 + dl); t["yaw"] = y0 + dy
                    it = sp_item() if t is spire else t
                    ok = (l0 + dl) * side > 0 and LF.rules_ok(it, allit(), cams)
                    if ok: cands.append((an_score() - a0, key, ds, dl, dy, t))
                    setp(t, s0, l0); t["yaw"] = y0
            if not cands: break
            cands.sort(key=lambda c: -c[0]); g, key, ds, dl, dy, t = cands[0]; tried.add(key)
            s0, l0, y0 = t["s"], t["lateral"], t.get("yaw", 0); own_before = owner(cam, t if t is not spire else dict(spire, height=150), rects)
            setp(t, s0 + ds, l0 + dl); t["yaw"] = y0 + dy
            own = owner(cam, t if t is not spire else dict(spire, height=150), rects) or own_before or ("spire" if t is spire else "towers")
            sc, p = render(f"{t['id']}")
            gain = sc[own] - best[own]; worse = [i for i in ids if sc[i] < best[i] - 0.01]
            ok = gain > 0.005 and not worse
            log.append(dict(step=f"{t['id']} ds {ds} dlat {dl} dyaw {dy}", owner=own, analytic=round(g, 4), score=sc, kept=ok, worse=worse, shot=p))
            if ok: best = sc
            else: setp(t, s0, l0); t["yaw"] = y0
    finally:
        C.dump(lay(), lp); kc_stage.build(LIVE, a.stage, lp); S.close()
    res = dict(camera=cam, budget=a.budget, renders=n, start=log[0]["score"], final=best, kept=[l["step"] for l in log[1:] if l.get("kept")],
               rules="v16 spacing, avenue clear, own side (50/50 kept), cameras clear (layout_fit.rules_ok)", layout=lp, log=log)
    C.dump(res, os.path.join(a.out, "placement-log.json")); print(json.dumps(dict(start=res["start"], final=best, kept=res["kept"], renders=n)))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("cmd", choices=["camera", "place"])
    ap.add_argument("--stage", default="/workspace/kc-staging/zb"); ap.add_argument("--url", default="http://127.0.0.1:8997/index.html")
    ap.add_argument("--out", required=True); ap.add_argument("--budget", type=int, default=None)
    ap.add_argument("--composition", default=os.path.join(HERE, "layouts", "ember-mesa-composition.json"))
    ap.add_argument("--init-camera"); ap.add_argument("--camera"); ap.add_argument("--init"); ap.add_argument("--elements", default="towers,spire")
    ap.add_argument("--max-s", type=float, default=320); ap.add_argument("--settle", type=int, default=5000)
    a = ap.parse_args(); _ = kc_stage._refuse_live(a.stage)
    if a.cmd == "camera": a.budget = a.budget or 28; camera(a)
    else: a.budget = a.budget or 12; place(a)
