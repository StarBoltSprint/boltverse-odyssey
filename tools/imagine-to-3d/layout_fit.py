"""Layout correction toward the key composition (2026-10-10, SmiR): move / rotate element placements so the KEY CAMERA
reproduces the key image's composition, under the city rules. Writes the biome LAYOUT FILE (staging only; kc_stage.py
applies it to a staging mirror, never to live files).

    python3 layout_fit.py fit --biome ember-mesa --live /workspace/zb-preview-1008 --out layouts/ember-mesa.json

Model (analytic, no browser): three.js camera (rotation order YXZ as main.mjs, (pitch, -yaw, 0), vertical fov, 16:9, y = ground + eye),
towers = yawed square prisms (module base width x scale, layout height), spire = 12 m prism, skyline slabs fixed,
mesas = their real strata rings (strata geo.json, every ring extruded y0..y1). Targets: the key COMPOSITION file
(layouts/<biome>-composition.json: tower / spire slots and mesa polygons measured on the key; colour masks cannot split
sunset-lit towers from rock in key-city3), rasterised at 320x180.
Objective: IoU(towers + far slabs, tower slots) + 0.5 IoU(spire, spire slot) + 0.6 IoU(VISIBLE mesas (not behind towers), mesa polygons).
Rules (hard, every candidate): centre distance >= r1 + r2 + 1.5 max(w1, w2) (v16 spacing rule = real streets, no
clustering); avenue kept clear (|lateral| >= 14 + 6 + r); the tower count stays 50/50 per avenue side (side changes only
as left/right swaps); >= 35 m from the key camera; mesas outside the city (|lateral| >= 110) and >= 30 m from any tower
footprint; nothing in the hero / chase / street camera spots. Wreck and arch have no model in the game: their slots are
written as `status: no-model` (key column / distance targets for when a model exists), never faked with other objects.
"""
import argparse, json, math, os, sys, copy
import numpy as np, cv2
from PIL import Image

AV_O, AV_F, AV_R = (0.287, 1.349), (0.97933, -0.20233), (0.20817, 0.97938)
def av_xz(s, lat): return AV_O[0] + AV_F[0] * s + AV_R[0] * lat, AV_O[1] + AV_F[1] * s + AV_R[1] * lat
def xz_av(x, z):
    dx, dz = x - AV_O[0], z - AV_O[1]; return dx * AV_F[0] + dz * AV_F[1], dx * AV_R[0] + dz * AV_R[1]
BASEW = {"m2": 95 / 4.0, "m3": 110 / 4.0, "m4": 85 / 4.0, "m6": 60 / 3.4}   # relayout.py v16 module base widths (m)
W, H = 320, 180
AVENUE_HALF, STREET_MARGIN = 14.0, 6.0


def wr(it):
    w = (12.0 if it.get("module") is None else BASEW[it["module"]]) * it.get("scale", 1)
    return w, w * math.sqrt(0.5) + 0.6


class Cam:
    def __init__(self, c, ground=0.3):
        self.p = np.array([c["x"], ground + c["eye"], c["z"]]); p, y = math.radians(c["pitch"]), math.radians(-c["yaw"])
        Rx = np.array([[1, 0, 0], [0, math.cos(p), -math.sin(p)], [0, math.sin(p), math.cos(p)]])
        Ry = np.array([[math.cos(y), 0, math.sin(y)], [0, 1, 0], [-math.sin(y), 0, math.cos(y)]])
        self.R = Ry @ Rx; self.f = (H / 2) / math.tan(math.radians(c["fovDeg"]) / 2)

    def project(self, P):
        """world points (N,3) -> pixel (N,2) at 320x180 and camera-space depth (positive in front)"""
        q = (np.asarray(P, float) - self.p) @ self.R   # = R^T (P - p): world -> camera
        d = -q[:, 2]; d_ = np.maximum(d, 0.5)
        return np.stack([W / 2 + self.f * q[:, 0] / d_, H / 2 - self.f * q[:, 1] / d_], 1), d


def prism_mask(cam, poly_xz, y0, y1, m=None):
    m = np.zeros((H, W), np.uint8) if m is None else m
    P = np.array([[x, y, z] for x, z in poly_xz for y in (y0, y1)])
    uv, d = cam.project(P)
    if (d < 1).any(): return m
    hull = cv2.convexHull(uv.astype(np.float32)).astype(np.int32); cv2.fillConvexPoly(m, hull, 1)
    return m


def ring_mask(cam, rings_w, m=None):
    """stepped solid: every strata ring extruded y0..y1, side quads + top cap"""
    m = np.zeros((H, W), np.uint8) if m is None else m
    for ring, y0, y1 in rings_w:
        uv0, d0 = cam.project([[x, y0, z] for x, z in ring]); uv1, d1 = cam.project([[x, y1, z] for x, z in ring])
        if (d0 < 1).any(): continue
        n = len(ring)
        quads = np.stack([uv0, np.roll(uv0, -1, 0), np.roll(uv1, -1, 0), uv1], 1).astype(np.int32)
        for q in quads: cv2.fillConvexPoly(m, q, 1)
        cv2.fillPoly(m, [uv1.astype(np.int32)], 1)
    return m


def square(x, z, w, yaw):
    a = math.radians(yaw); c, s = math.cos(a), math.sin(a); h = w / 2
    return [(x + c * u - s * v, z + s * u + c * v) for u, v in ((-h, -h), (h, -h), (h, h), (-h, h))]


def key_targets(comp_path):
    """Composition slots (layouts/<biome>-composition.json, measured on the key) -> target masks at 320x180."""
    C = json.load(open(comp_path)); city = np.zeros((H, W), np.uint8); rock = np.zeros((H, W), np.uint8)
    R = lambda r: (int(r[0] * W), int(r[2] * H), int(r[1] * W), int(r[3] * H))
    spire = np.zeros((H, W), np.uint8)
    for t in C["towers"]:
        x0, y0, x1, y1 = R(t["rect"]); city[y0:y1, x0:x1] = 1
    x0, y0, x1, y1 = R(C["spire"]["rect"]); spire[y0:y1, x0:x1] = 1
    for m in C["mesas"]: cv2.fillPoly(rock, [np.array([[x * W, y * H] for x, y in m["poly"]], np.int32)], 1)
    return dict(city=city.astype(bool), spire=spire.astype(bool), rockL=rock.astype(bool) & ~city.astype(bool) & ~spire.astype(bool), comp=C)


def iou(a, b):
    u = (a | b).sum(); return float((a & b).sum() / u) if u else 0.0


class Scene:
    def __init__(self, live, cam, mesa_ids, strata="strata6"):
        self.L = json.load(open(os.path.join(live, "objects1", "layout.json")))
        self.cam = Cam(cam); self.hcal = 1.0   # rendered / layout tower height (render calibration, --height-cal)
        src = open(os.path.join(live, "mesas", "mesas-v11.mjs")).read()
        import re
        self.mesas = []
        for m in re.finditer(r'\{ id: "([^"]+)",\s+s: (-?[\d.]+),\s+lat: (-?[\d.]+),\s+scale: ([\d.]+),\s+(face: true|yaw: (-?[\d.]+)),\s+mirror: (true|false) \}', src):
            e = dict(id=m.group(1), s=float(m.group(2)), lat=float(m.group(3)), scale=float(m.group(4)), mirror=m.group(7) == "true")
            if m.group(6) is not None: e["yaw"] = float(m.group(6))
            else: e["face"] = True
            self.mesas.append(e)
        self.geo = {e["id"]: json.load(open(os.path.join(live, "mesas", strata, f"{e['id']}-geo.json"))) for e in self.mesas if e["id"] in mesa_ids}
        self.mesa_ids = mesa_ids
        self.hero = av_xz(self.L["hero"]["standS"], self.L["hero"]["lateral"])

    def tower_mask(self, items):
        m = np.zeros((H, W), np.uint8)
        for t in items:
            w = wr(t)[0]; top = (t.get("height", 90) - t.get("sinkWant", 4)) * self.hcal
            prism_mask(self.cam, square(t["x"], t["z"], w, t.get("yaw", 0)), -2, top, m)
        return m.astype(bool)

    def spire_mask(self, sp):
        return prism_mask(self.cam, square(sp["x"], sp["z"], 12, sp.get("yaw", 0)), -2, sp.get("height", 150) - 4).astype(bool)

    def mesa_world(self, e):
        g = self.geo[e["id"]]; x, z = av_xz(e["s"], e["lat"])
        yaw = math.radians(math.degrees(math.atan2(self.hero[0] - x, self.hero[1] - z)) if e.get("face") else e.get("yaw", 0))
        mx = -1 if e.get("mirror") else 1; base = -0.6 * e["scale"]
        def tw(a, b):
            lx, lz = a * mx, -b
            return x + lx * math.cos(yaw) + lz * math.sin(yaw), z - lx * math.sin(yaw) + lz * math.cos(yaw)
        return [([tw(a, b) for a, b in r["ring"][::2]], base + max(r["y0"], 0), base + r["y1"]) for r in g["rings"]]

    def mesa_mask(self, mesas):
        m = np.zeros((H, W), np.uint8)
        for e in mesas:
            if e["id"] in self.geo: ring_mask(self.cam, self.mesa_world(e), m)
        return m.astype(bool)


def rules_ok(t, others, cams):
    w, r = wr(t)
    if abs(t["lateral"]) < AVENUE_HALF + STREET_MARGIN + r: return False
    for c in cams:
        if math.hypot(t["x"] - c[0], t["z"] - c[1]) < 35 + r: return False
    for o in others:
        if o is t or o.get("id") == t.get("id"): continue
        w2, r2 = wr(o)
        if math.hypot(t["x"] - o["x"], t["z"] - o["z"]) < r + r2 + 1.5 * max(w, w2): return False
    return True


def worst_gap(items):
    v = []
    for i, a in enumerate(items):
        for b in items[i + 1:]:
            v.append((math.hypot(a["x"] - b["x"], a["z"] - b["z"]) - wr(a)[1] - wr(b)[1]) / max(wr(a)[0], wr(b)[0]))
    return round(min(v), 3)


def fit(a):
    cam = dict(x=a.cam_x, z=a.cam_z, yaw=a.cam_yaw, pitch=a.cam_pitch, eye=a.cam_eye, fovDeg=a.cam_fov)
    S = Scene(a.live, cam, a.mesas.split(",")); S.hcal = a.height_cal
    T = key_targets(a.composition)
    L = S.L; towers = copy.deepcopy(L["towers"]); spire = copy.deepcopy(L["spire"]); sky = L.get("skyline", [])
    mesas = copy.deepcopy(S.mesas)
    if a.init:   # continue from an earlier layout file (towers / spire / mesas), e.g. a refinement pass
        I = json.load(open(a.init)); byid = {t["id"]: t for t in I.get("towers", [])}
        for t in towers:
            if t["id"] in byid: t.update({k: v for k, v in byid[t["id"]].items() if k in ("x", "z", "s", "lateral", "yaw")})
        if I.get("spire"): spire.update({k: v for k, v in I["spire"].items() if k in ("x", "z", "s", "lateral", "yaw")})
        if I.get("mesas"): mesas = copy.deepcopy(I["mesas"])
    sp_item = dict(spire, module=None, scale=1.0)   # spire footprint 12 m (wr default)
    cams = [(cam["x"], cam["z"])] + [av_xz(L[k]["standS"], L[k]["lateral"]) for k in ("hero", "chase", "street") if k in L]
    sky_m = S.tower_mask(sky)

    def score(tw, sp, ms):
        # identity-aware: towers + far slabs fill the tower slots, the spire its own slot (v1 let the spire fill a tower
        # slot), visible mesas the mesa polygons; anything projected onto another slot or onto key sky lowers its IoU
        tm = S.tower_mask(tw) | sky_m; sm = S.spire_mask(sp); city = tm | sm
        mm = S.mesa_mask(ms) & ~city
        return iou(tm, T["city"]) + 0.5 * iou(sm, T["spire"]) + 0.6 * iou(mm, T["rockL"]), city, mm

    def set_pos(t, s, lat):
        t["s"], t["lateral"] = s, lat; t["x"], t["z"] = av_xz(s, lat)

    s0, city0, mm0 = score(towers, spire, mesas)
    def parts(city, mm):
        return dict(cityIoU=round(iou(city, T["city"] | T["spire"]), 4), mesaVisibleIoU=round(iou(mm, T["rockL"]), 4))
    before = dict(score=round(s0, 4), **parts(city0, mm0))
    log = []
    allit = lambda: towers + [sp_item] + sky
    best = s0
    for rnd in range(a.rounds):
        # 1) tower moves (s, lateral on the same side, yaw)
        for t in sorted(towers, key=lambda t: t["s"]):
            if t["s"] > a.max_s: continue
            side = 1 if t["lateral"] > 0 else -1; s_, l_, y_ = t["s"], t["lateral"], t.get("yaw", 0); cand = None
            for ds in range(-int(a.s_span), int(a.s_span) + 1, a.step_s):
                for lat in np.arange(AVENUE_HALF + STREET_MARGIN + wr(t)[1], a.max_lat + 0.1, 4.0):
                    for dy in (0, -12, 12):
                        set_pos(t, s_ + ds, side * float(lat)); t["yaw"] = y_ + dy
                        if not rules_ok(t, allit(), cams): continue
                        sc = score(towers, spire, mesas)[0]
                        if sc > best + 1e-4: best, cand = sc, (s_ + ds, side * float(lat), y_ + dy)
            if cand: set_pos(t, cand[0], cand[1]); t["yaw"] = cand[2]; log.append(f"r{rnd} {t['id']} -> s {cand[0]:.0f} lat {cand[1]:.0f} yaw {cand[2]:.0f}: {best:.4f}")
            else: set_pos(t, s_, l_); t["yaw"] = y_
        # 2) left/right swaps (keeps the 50/50 side split)
        for i, ti in enumerate(towers):
            for tj in towers[i + 1:]:
                if (ti["lateral"] > 0) == (tj["lateral"] > 0) or max(ti["s"], tj["s"]) > a.max_s: continue
                a_, b_ = (ti["s"], ti["lateral"]), (tj["s"], tj["lateral"])
                set_pos(ti, *b_); set_pos(tj, *a_)
                if rules_ok(ti, allit(), cams) and rules_ok(tj, allit(), cams):
                    sc = score(towers, spire, mesas)[0]
                    if sc > best + 1e-4: best = sc; log.append(f"r{rnd} swap {ti['id']} <-> {tj['id']}: {best:.4f}"); continue
                set_pos(ti, *a_); set_pos(tj, *b_)
        # 3) spire (s, lateral, right side kept)
        s_, l_ = spire["s"], spire["lateral"]; cand = None
        for ds in range(-40, 41, 4):
            for dl in range(-24, 25, 4):
                set_pos(spire, s_ + ds, l_ + dl); sp_item.update(x=spire["x"], z=spire["z"], s=spire["s"], lateral=spire["lateral"])
                if not rules_ok(sp_item, allit(), cams): continue
                sc = score(towers, spire, mesas)[0]
                if sc > best + 1e-4: best, cand = sc, (s_ + ds, l_ + dl)
        set_pos(spire, *(cand or (s_, l_))); sp_item.update(x=spire["x"], z=spire["z"], s=spire["s"], lateral=spire["lateral"])
        if cand: log.append(f"r{rnd} spire -> s {cand[0]} lat {cand[1]}: {best:.4f}")
        # 4) mesas (key-visible ones): s, lateral (outside the city), yaw / face
        for e in mesas:
            if e["id"] not in S.geo or a.freeze_mesas: continue
            s_, l_ = e["s"], e["lat"]; f_, y_ = e.get("face"), e.get("yaw"); side = 1 if l_ > 0 else -1; cand = None
            maxR = max(math.hypot(*p) for r in S.geo[e["id"]]["rings"] for p in r["ring"])
            for ds in range(-90, 91, 10):
                for lat in range(110, 341, 10):
                    for yv in (None, 0, 90, 180, 270):
                        e["s"], e["lat"] = s_ + ds, side * lat
                        if yv is None: e["face"] = True; e.pop("yaw", None)
                        else: e.pop("face", None); e["yaw"] = yv
                        x, z = av_xz(e["s"], e["lat"])
                        if any(math.hypot(x - t["x"], z - t["z"]) < maxR + wr(t)[1] + 30 for t in towers + [sp_item]): continue
                        if any(o is not e and math.hypot(x - av_xz(o["s"], o["lat"])[0], z - av_xz(o["s"], o["lat"])[1]) < maxR + 70 for o in mesas): continue
                        if any(math.hypot(x - c[0], z - c[1]) < maxR + 40 for c in cams): continue
                        sc = score(towers, spire, mesas)[0]
                        if sc > best + 1e-4: best, cand = sc, (e["s"], e["lat"], yv)
            e["s"], e["lat"] = (cand[0], cand[1]) if cand else (s_, l_)
            yv = cand[2] if cand else ("face" if f_ else y_)
            if yv is None or yv == "face": e["face"] = True; e.pop("yaw", None)
            else: e.pop("face", None); e["yaw"] = yv
            if cand: log.append(f"r{rnd} mesa {e['id']} -> s {cand[0]} lat {cand[1]} yaw {cand[2]}: {best:.4f}")
    s1, city1, mm1 = score(towers, spire, mesas)
    after = dict(score=round(s1, 4), **parts(city1, mm1))
    sides = dict(left=sum(t["lateral"] < 0 for t in towers), right=sum(t["lateral"] > 0 for t in towers))
    out = dict(
        biome=a.biome, source="imagine-to-3d/layout_fit.py", key=os.path.abspath(a.key), live=os.path.abspath(a.live), stagingOnly=True,
        camera=cam, heightCal=a.height_cal, cameraNote="key camera = the game's hero spawn position / pitch / eye (objects-t7 spawn) at the bible fovBase 58, heading 78 = the avenue heading (the key's avenue vanishes at the frame centre)",
        rules=dict(spacing="centre distance >= r1 + r2 + 1.5*max(w1,w2) (v16)", avenue=f"|lateral| >= {AVENUE_HALF} + {STREET_MARGIN} + r",
                   sides="50/50 per avenue side (side changes only as left/right swaps)", camerasClear="35 m + r from key/hero/chase/street cameras",
                   mesas="|lateral| >= 110, >= 30 m from tower footprints, >= 70 m apart"),
        checks=dict(sides=sides, worstGapOverWidth=worst_gap(towers + [sp_item] + sky), spacingMin=1.5, avenueClearMin=round(min(abs(t["lateral"]) - wr(t)[1] for t in towers), 1)),
        score=dict(before=before, after=after),
        towers=[{k: (round(v, 3) if isinstance(v, float) else v) for k, v in t.items() if k in ("id", "module", "x", "z", "s", "lateral", "yaw", "scale")} for t in towers],
        spire={k: (round(v, 3) if isinstance(v, float) else v) for k, v in spire.items() if k in ("id", "x", "z", "s", "lateral", "yaw", "scale")},
        mesas=mesas,
        wreck=dict(status="no-model", note="no wreck object exists in the game (objects-t7 / main / mesas-v11); key: large crashed ship, frame x 0.58-1.0, y 0.47-0.72 (sand right of the avenue, ~60-120 m). Needs a model: request, not faked."),
        arch=dict(status="no-model", note="no rock arch exists in the game; key: arch spanning frame x 0.66-0.85, y 0.38-0.53, behind the spire base (~250-400 m). Needs a model: request, not faked."),
        log=log)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    json.dump(out, open(a.out, "w"), indent=1)
    # preview: key targets vs projection before / after
    def rgb(city, mm, tgt):
        ct = tgt["city"] | tgt["spire"]
        im = np.zeros((H, W, 3), np.uint8); im[ct] = (90, 90, 90); im[tgt["rockL"]] = (60, 90, 160)
        im[city & ~ct] = (200, 60, 60); im[city & ct] = (240, 240, 240); im[mm] = (240, 170, 60); return im
    sheet = np.concatenate([rgb(city0, mm0, T), np.zeros((H, 6, 3), np.uint8), rgb(city1, mm1, T)], 1)
    Image.fromarray(cv2.resize(sheet, (sheet.shape[1] * 2, H * 2), interpolation=cv2.INTER_NEAREST)).save(os.path.splitext(a.out)[0] + "-fit.png")
    print(json.dumps(dict(before=before, after=after, checks=out["checks"], moves=len(log))))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("cmd", choices=["fit"])
    ap.add_argument("--biome", default="ember-mesa"); ap.add_argument("--key", default="/workspace/zb-bible-1008/key-city3.jpg")
    ap.add_argument("--live", default="/workspace/zb-preview-1008"); ap.add_argument("--out", required=True)
    ap.add_argument("--composition", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "layouts", "ember-mesa-composition.json"))
    ap.add_argument("--mesas", default="L-mid,L-mid2,L-far,R-butte"); ap.add_argument("--rounds", type=int, default=2)
    ap.add_argument("--max-s", type=float, default=320); ap.add_argument("--max-lat", type=float, default=90); ap.add_argument("--step-s", type=int, default=6)
    ap.add_argument("--height-cal", type=float, default=1.0, help="rendered / layout tower height, measured on a key-camera render (Zone B R2: 0.75-0.92 -> 0.82)")
    ap.add_argument("--init"); ap.add_argument("--s-span", type=float, default=36); ap.add_argument("--freeze-mesas", action="store_true")
    ap.add_argument("--cam-x", type=float, default=-51.115); ap.add_argument("--cam-z", type=float, default=9.63); ap.add_argument("--cam-yaw", type=float, default=78)
    ap.add_argument("--cam-pitch", type=float, default=-1.16); ap.add_argument("--cam-eye", type=float, default=3.15); ap.add_argument("--cam-fov", type=float, default=58)
    fit(ap.parse_args())
