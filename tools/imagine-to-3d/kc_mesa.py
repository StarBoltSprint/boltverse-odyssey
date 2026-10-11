"""Keyloop consumers for the strata2 mesas (2026-10-10, SmiR: wire the keyloop steps into the mesa generator output).
Every command reads the LIVE strata / plates read-only and writes into the KC STAGING mirror (kc_stage.py) only, then
points mesas/kc-params.json at the result, so the next key-camera render shows the correction.

  python3 kc_mesa.py warp   --warp kc-warp-mesas.json --stage DIR [--camera cam.json] [--gain 0.8]
        silhouette warp: per key-frame column, vertical stretch of the mesa that owns the skyline there so its top edge
        moves toward the key's (warp json from fixloop: keyTop / gameTop per 4 px column). The far tiered outline is
        rounded toward the key because the per-column delta is smoothed (9 columns) and applied as a stretch (base fixed).
  python3 kc_mesa.py plates --stage DIR [--offsets kc-grade.json --element mesas] [--ranking kc-plates-mesas.json]
        [--detail G] [--gain-from key-compare.json]
        plate grade (lit / shadow separately, Lab offsets from the loop or linear gains measured key vs render),
        plate re-pick (wall slots refilled from the ranked EXISTING Imagine plates, best plate on the most used slot),
        detail layer (high-pass gain of the Imagine pixels, sigma 2 px). Imagine pixels only, nothing painted.
        State is cumulative in plates-kc/kc-state.json and every build restarts from the live plates (no re-encoding drift).
  python3 kc_mesa.py relief --stage DIR --value G      relief strength: displacement gain of the LOD0 relief grid.

Exit 0 on success; all outputs listed in the printed JSON.
"""
import argparse, json, math, os, shutil, sys
import numpy as np, cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
LIVE = os.environ.get("I23D_LIVE_ROOT", "/workspace/zb-preview-1008")
AV_O, AV_F, AV_R = (0.287, 1.349), (0.97933, -0.20233), (0.20817, 0.97938)
def av_xz(s, lat): return AV_O[0] + AV_F[0] * s + AV_R[0] * lat, AV_O[1] + AV_F[1] * s + AV_R[1] * lat
HERO = av_xz(-52, 0)
FW, FH = 1280, 720


def _guard(path):
    """the target's PARENT must resolve outside live (the target itself may be a staging symlink that gets replaced)"""
    rp = os.path.join(os.path.realpath(os.path.dirname(os.path.abspath(path))), os.path.basename(path))
    if rp.startswith(os.path.realpath(LIVE) + os.sep): raise SystemExit(f"kc_mesa: refusing to write into live {LIVE}: {path}")


def params(stage, **kw):
    import kc_stage
    return kc_stage.params_update(stage, **kw)


def layout(stage):
    p = json.load(open(os.path.join(stage, "mesas", "kc-params.json")))
    if p.get("layout"): return p["layout"]
    import layout_fit
    return layout_fit.Scene(LIVE, dict(x=0, z=0, yaw=0, pitch=0, eye=3, fovDeg=58), []).mesas


class Cam:
    def __init__(self, c, ground=0.3):
        self.p = np.array([c["x"], ground + c["eye"], c["z"]]); p, y = math.radians(c["pitch"]), math.radians(-c["yaw"])
        Rx = np.array([[1, 0, 0], [0, math.cos(p), -math.sin(p)], [0, math.sin(p), math.cos(p)]])
        Ry = np.array([[math.cos(y), 0, math.sin(y)], [0, 1, 0], [-math.sin(y), 0, math.cos(y)]])
        self.R = Ry @ Rx; self.f = (FH / 2) / math.tan(math.radians(c["fovDeg"]) / 2)

    def project(self, P):
        q = (P - self.p) @ self.R; d = np.maximum(-q[:, 2], 0.5)
        return FW / 2 + self.f * q[:, 0] / d, FH / 2 - self.f * q[:, 1] / d, d


def read_lod(sd, mid, li, gi):
    ld = gi["lods"][li]; st = gi.get("stride", 12); n = ld["verts"]
    raw = open(os.path.join(sd, f"{mid}-lod{li}.bin"), "rb").read()
    q = np.frombuffer(raw, np.int16, n * st).reshape(n, st).copy()
    return q, raw[n * st * 2:], ld


def placement(L, gi):
    x, z = (L["x"], L["z"]) if L.get("x") is not None else av_xz(L["s"], L["lat"])
    yaw = math.degrees(math.atan2(HERO[0] - x, HERO[1] - z)) if L.get("face") else L.get("yaw", 0)
    return x, z, math.radians(yaw), (-1 if L.get("mirror") else 1), -0.6 * L["scale"]


def to_world(q, Q, pl):
    x, z, yaw, mx, base = pl
    px, py, pz = q[:, 0] / Q[0], q[:, 1] / Q[1], q[:, 2] / Q[2]
    lx, lz = px * mx, pz
    return np.stack([x + lx * math.cos(yaw) + lz * math.sin(yaw), base + py, z - lx * math.sin(yaw) + lz * math.cos(yaw)], 1), py


def warp(a):
    W = json.load(open(a.warp)); cam = Cam(json.load(open(a.camera))["camera"] if a.camera else a.cam)
    step = W.get("step", 4); kt, gt = W["keyTop"], W["gameTop"]
    ncol = len(kt); delta = np.zeros(ncol); have = np.zeros(ncol, bool)
    for i, (k, g) in enumerate(zip(kt, gt)):
        if k is not None and g is not None: delta[i] = k - g; have[i] = True
    # smooth across 9 columns (rounds the stepped outline), zero where either edge is missing
    ker = np.ones(9) / 9; num = np.convolve(delta * have, ker, "same"); den = np.convolve(have.astype(float), ker, "same")
    dsm = np.where(den > 0.2, num / np.maximum(den, 1e-6), 0.0) * have
    src = os.path.join(LIVE, "mesas", a.src); dst = os.path.join(a.stage, "mesas", "strata-kc"); _guard(dst)
    os.makedirs(dst, exist_ok=True)
    lay = layout(a.stage); report = []
    # pass 1: top screen row per column per mesa (LOD1 shell) to find the skyline owner of every column
    data = {}
    for L in lay:
        gi = json.load(open(os.path.join(src, f"{L['id']}-geo.json"))); Q = gi["qscale"]; pl = placement(L, gi)
        q1, _, ld1 = read_lod(src, L["id"], 1, gi)
        P, _ = to_world(q1.astype(np.float64), Q, pl); u, v, d = cam.project(P)
        ok = (u >= 0) & (u < FW) & (v > -FH) & (v < FH)
        top = np.full(ncol, np.inf); c = (u[ok] // step).astype(int).clip(0, ncol - 1)
        np.minimum.at(top, c, v[ok]); data[L["id"]] = (gi, pl, top)
    tops = np.stack([t for _, _, t in data.values()]); owner = np.argmin(tops, 0); ids = list(data)
    for k, L in enumerate(lay):
        gi, pl, top = data[L["id"]]; mine = (owner == k) & np.isfinite(top) & have
        files = [f"{L['id']}-geo.json"] + [f"{L['id']}-lod{i}.bin{z}" for i in range(len(gi["lods"])) for z in ("", ".gz")]
        if mine.sum() < 3 or not np.any(np.abs(dsm[mine]) > 1 / FH):
            for f in files:
                if os.path.exists(os.path.join(src, f)):
                    t = os.path.join(dst, f)
                    if os.path.lexists(t): os.remove(t)
                    os.symlink(os.path.join(src, f), t)
            report.append(dict(id=L["id"], warped=False, columns=int(mine.sum()))); continue
        Q = gi["qscale"]; fac_all = []
        gi2 = json.loads(json.dumps(gi)); gi2["gz"] = False; gi2["kcWarp"] = dict(src=os.path.abspath(a.warp), gain=a.gain)
        for li in range(len(gi["lods"])):
            q, tail, ld = read_lod(src, L["id"], li, gi)
            P, py = to_world(q.astype(np.float64), Q, pl); u, v, d = cam.project(P)
            col = (u // step).astype(int).clip(0, ncol - 1)
            # metres per pixel at the vertex depth; target top move (positive delta = key edge lower = shrink)
            ytop = np.zeros(ncol); np.maximum.at(ytop, col, py)
            dy_m = -a.gain * dsm[col] * FH * d / cam.f
            f = np.where(mine[col] & (ytop[col] > 5), 1 + dy_m / np.maximum(ytop[col], 5), 1.0).clip(0.7, 1.3)
            nb = ld.get("blockVertStart") or len(q)
            f[nb:] = 1.0   # fallen blocks sit on the dunes at runtime: never stretched
            y_new = (q[:, 1] / Q[1]) * np.where(q[:, 1] > 0, f, 1.0)
            if np.abs(y_new).max() * Q[1] > 32000: raise SystemExit(f"kc_mesa warp: y overflow in {L['id']} lod{li}")
            q[:, 1] = np.round(y_new * Q[1]).astype(np.int16)
            for z in ("", ".gz"):
                if os.path.lexists(os.path.join(dst, f"{L['id']}-lod{li}.bin{z}")): os.remove(os.path.join(dst, f"{L['id']}-lod{li}.bin{z}"))
            open(os.path.join(dst, f"{L['id']}-lod{li}.bin"), "wb").write(q.tobytes() + tail)
            fac_all.append(f[:nb][q[:nb, 1] > 0])
        fa = np.concatenate(fac_all); mean_f = float(fa.mean())
        for r in gi2["rings"]: r["y1"] = r["y1"] * mean_f; r["y0"] = r["y0"] * mean_f if r["y0"] > 0 else r["y0"]
        p = os.path.join(dst, f"{L['id']}-geo.json")
        if os.path.lexists(p): os.remove(p)
        json.dump(gi2, open(p, "w"))
        report.append(dict(id=L["id"], warped=True, columns=int(mine.sum()), stretchMin=round(float(fa.min()), 3), stretchMax=round(float(fa.max()), 3), stretchMean=round(mean_f, 3)))
    params(a.stage, strata="strata-kc")
    rep = dict(step="silhouette_warp", out=dst, gain=a.gain, meanAbsDeltaPx=round(float(np.abs(dsm[have]).mean() * FH), 2) if have.any() else 0, mesas=report)
    json.dump(rep, open(os.path.join(dst, "kc-warp-report.json"), "w"), indent=1); print(json.dumps(rep)); return rep


# ---------------------------------------------------------------- plates: grade / re-pick / detail (Imagine pixels only)
def _lin(c): c = np.asarray(c, float); return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def _srgb(c): c = np.clip(c, 0, 1); return np.where(c <= 0.0031308, 12.92 * c, 1.055 * c ** (1 / 2.4) - 0.055)


def lab_to_lin(lab):
    import palette
    return _lin(palette.lab_to_srgb(np.asarray(lab, float).reshape(1, 1, 3)).reshape(3))


def plates(a):
    src = os.path.join(LIVE, "mesas", a.src); dst = os.path.join(a.stage, "mesas", "plates-kc"); _guard(dst)
    os.makedirs(dst, exist_ok=True); sp = os.path.join(dst, "kc-state.json")
    S = json.load(open(sp)) if os.path.exists(sp) else dict(gain={"lit": [1, 1, 1], "shadow": [1, 1, 1]}, offsets=None, walls=None, detail=1.0, log=[])
    P = json.load(open(os.path.join(src, "plates.json")))
    if a.gain_from:   # linear gains per half from a key-compare result: lin(key) / lin(game), damped by --damp
        e = next(x for x in json.load(open(a.gain_from))["elements"] if x["id"] == a.element)
        for half, kk, gg in (("lit", "labKeyLit", "labGameLit"), ("shadow", "labKeyShadow", "labGameShadow")):
            g = (lab_to_lin(e[kk]) + 1e-4) / (lab_to_lin(e[gg]) + 1e-4)
            S["gain"][half] = [round(float(x * np.clip(gi ** a.damp, a.clip_lo, 2.0)), 4) for x, gi in zip(S["gain"][half], g)]
        S["log"].append(dict(op="gain-from", src=os.path.abspath(a.gain_from), element=a.element, gain=S["gain"]))
    if a.offsets: S["offsets"] = json.load(open(a.offsets)).get(a.element); S["log"].append(dict(op="offsets", offsets=S["offsets"]))
    if a.detail is not None: S["detail"] = a.detail; S["log"].append(dict(op="detail", value=a.detail))
    if a.ranking:   # re-pick: wall slots refilled from the ranked existing plates (excluded ones skipped)
        rank = [os.path.splitext(os.path.basename(r["plate"]))[0] for r in json.load(open(a.ranking))]
        excl = set(a.exclude.split(",")) if a.exclude else set()
        cand = [r for r in rank if r.startswith("w") and r not in excl and r in P["gains"]]
        slots = len(P["walls"]); use = slot_usage(a.stage, slots)
        order = sorted(range(slots), key=lambda i: -use[i])   # most used slot first
        new = list(P["walls"])
        for i, name in zip(order, cand[:slots]): new[i] = name
        if len(set(new)) == len(new): S["walls"] = new; S["log"].append(dict(op="repick", walls=new, slotUse=use))
    # build from the live plates
    P2 = json.loads(json.dumps(P)); P2["walls"] = S["walls"] or P["walls"]; P2["kc"] = dict(state=sp)
    names = sorted(set(P2["walls"] + [P2["block"]] + P2["caps"]))
    import palette, i23d_common as C
    for n in names:
        im = np.asarray(Image.open(os.path.join(src, f"{n}.jpg")).convert("RGB")).astype(np.float32) / 255
        if S["detail"] != 1.0:   # detail layer: high-pass gain of the Imagine pixels (sigma 2 px), clipped
            bl = cv2.GaussianBlur(im, (0, 0), 2.0); im = np.clip(bl + S["detail"] * (im - bl), 0, 1)
        lab = C.srgb_to_lab(im); med = np.median(lab[..., 0]); w = 1 / (1 + np.exp(-(lab[..., 0] - med) / 4.0))[..., None]
        if S["offsets"]: lab = lab + w * np.array(S["offsets"]["lit"]) + (1 - w) * np.array(S["offsets"]["shadow"]); im = palette.lab_to_srgb(lab)
        if S["gain"] != {"lit": [1, 1, 1], "shadow": [1, 1, 1]}:
            gl = _lin(im); g = w * np.array(S["gain"]["lit"]) + (1 - w) * np.array(S["gain"]["shadow"]); im = _srgb(gl * g)
        t = os.path.join(dst, f"{n}.jpg")
        if os.path.lexists(t): os.remove(t)
        Image.fromarray((np.clip(im, 0, 1) * 255 + 0.5).astype(np.uint8)).save(t, quality=95)
    json.dump(P2, open(os.path.join(dst, "plates.json"), "w"), indent=1); json.dump(S, open(sp, "w"), indent=1)
    params(a.stage, plates="plates-kc")
    rep = dict(step="plates", out=dst, walls=P2["walls"], gain=S["gain"], offsets=S["offsets"], detail=S["detail"], plates=len(names))
    print(json.dumps(rep)); return rep


def slot_usage(stage, slots):
    """vertex count per wall slot over the key-visible mesas (LOD1), from the staged strata"""
    p = json.load(open(os.path.join(stage, "mesas", "kc-params.json"))); sd = os.path.join(stage, "mesas", p.get("strata", "strata6"))
    use = [0] * slots
    for L in layout(stage)[:4]:
        gi = json.load(open(os.path.join(sd, f"{L['id']}-geo.json"))); q, _, _ = read_lod(sd, L["id"], 1, gi)
        pl = np.round(q[:, 3] / gi["qscale"][3]).astype(int)
        for i in range(slots): use[i] += int((pl == i).sum())
    return use


def relief(a):
    p = params(a.stage, reliefGain=float(a.value)); print(json.dumps(dict(step="relief_strength", reliefGain=p["reliefGain"]))); return p


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("cmd", choices=["warp", "plates", "relief", "detail"])
    ap.add_argument("--stage", default="/workspace/kc-staging/zb"); ap.add_argument("--warp"); ap.add_argument("--camera")
    ap.add_argument("--gain", type=float, default=0.8); ap.add_argument("--src", default=None)
    ap.add_argument("--offsets"); ap.add_argument("--element", default="mesas"); ap.add_argument("--ranking"); ap.add_argument("--exclude", default="w6")
    ap.add_argument("--detail", type=float); ap.add_argument("--gain-from"); ap.add_argument("--damp", type=float, default=0.8); ap.add_argument("--value"); ap.add_argument("--clip-lo", type=float, default=0.5)
    a = ap.parse_args()
    a.cam = dict(x=-51.115, z=9.63, yaw=78, pitch=-1.16, eye=3.15, fovDeg=58)
    if a.cmd == "warp": a.src = a.src or "strata6"; warp(a)
    elif a.cmd == "plates": a.src = a.src or "plates11"; plates(a)
    elif a.cmd == "detail": a.src = a.src or "plates11"; a.detail = float(a.value); plates(a)
    else: relief(a)
