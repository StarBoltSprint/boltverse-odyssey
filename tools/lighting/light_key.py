"""Lighting + atmosphere from the key image (2026-10-10, SmiR). Staging only; Imagine pixels only.

  python3 light_key.py measure --key key.jpg --camera camera-v2.json --out DIR [--layout objects1/layout.json]
      Measures on the KEY (every colour is sampled from the key, never typed):
        sun          centroid of the brightest blob -> azimuth / elevation through the key camera (three.js YXZ camera),
                     core colour, halo colour (bright half of the annulus 2-6 R) and halo radial profile (L by radius)
        sky          gradient: CIELAB per 5 % row band of the top-connected sky
        haze         colour at the avenue vanishing gap; density by distance = fog fraction of the dark tower pixels in
                     each composition tower slot vs that slot's camera distance (from the layout), fit 1 - exp(-d / D)
        shadow       tint (a*, b*) and darkness (L*) of the darkest 20 % of the ground (rows 0.65-1)
      -> DIR/key-light.json
  python3 light_key.py fit --measure DIR/key-light.json --out DIR [--kc key-compare.json]
      Maps the measurements to engine parameters (written as a PROPOSAL, nothing applied):
        sunAzimuthDeg / sunElevationDeg (objects-t7 sun + shadow, biome.sun for the sky dome, halo sprite and ground),
        sunHex (key sun core colour), hemi fill (sky = key zenith band, ground = key shadow colour), fog colour + band
        amounts (biome.fog, from the density fit), per-object haze (mesas fogW / hazeW scaled by key vs render fog
        fraction when a key-compare json is given), chromeGraphite (USE_ZB_CHROME_BODY dark side, scaled toward the key
        spire shadow colour from the render). Shadow rule: dark, neutral, slight cool tint (b* in [-6, 0]) - checked.
      -> DIR/kc-light-proposal.json
  python3 light_key.py apply --proposal P --stage /workspace/kc-staging/zb --only sun[,fog,hemi,graphite,mesaHaze]
      copies the chosen groups into <stage>/kc-light.json (+ mesa haze into kc-params) and rebuilds the staging copies.
  python3 light_key.py test --stage S --camera camera-v2.json --out DIR --elements sun
      one low-res render (kc-shots) + key-compare of the listed elements.
Halo, god-rays, dust and fog keep sampling their Imagine textures (sky1/sky7-atlas.png, dust plates): this module only
moves the sun and sets light / fog parameters sampled from the key; it never sets a sprite tint or paints a colour.
"""
import argparse, json, math, os, subprocess, sys
import numpy as np, cv2
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); I23D = os.path.join(os.path.dirname(HERE), "imagine-to-3d"); sys.path.insert(0, I23D)
import i23d_common as C
from skimage.color import rgb2lab, lab2rgb

LIVE = os.environ.get("I23D_LIVE_ROOT", "/workspace/zb-preview-1008")


def load(p): return np.asarray(Image.open(p).convert("RGB")).astype(np.float32) / 255


def lab_mean(px): return [round(float(x), 2) for x in rgb2lab(px.reshape(-1, 1, 3)).reshape(-1, 3).mean(0)] if len(px) else None


def lab_hex(lab):
    c = np.clip(lab2rgb(np.array(lab, float).reshape(1, 1, 3)).reshape(3), 0, 1); return "#" + "".join(f"{int(round(v * 255)):02x}" for v in c)


def cam_R(c):
    p, y = math.radians(c["pitch"]), math.radians(-c["yaw"])
    Rx = np.array([[1, 0, 0], [0, math.cos(p), -math.sin(p)], [0, math.sin(p), math.cos(p)]])
    Ry = np.array([[math.cos(y), 0, math.sin(y)], [0, 1, 0], [-math.sin(y), 0, math.cos(y)]])
    return Ry @ Rx   # main.mjs: camera.rotation.order = "YXZ"


def frame_to_dir(u, v, c, aspect):
    tv = math.tan(math.radians(c["fovDeg"]) / 2); th = tv * aspect
    d = np.array([(u - 0.5) * 2 * th, (0.5 - v) * 2 * tv, -1.0]) @ cam_R(c).T; d /= np.linalg.norm(d)
    return math.degrees(math.atan2(d[0], -d[2])) % 360, math.degrees(math.asin(d[1]))


def top_sky(a):
    r, g, b = a[..., 0] * 255, a[..., 1] * 255, a[..., 2] * 255; L = 0.2126 * r + 0.7152 * g + 0.0722 * b
    s = ((b > 1.03 * g) & (L > 40)).astype(np.uint8); n, lab = cv2.connectedComponents(s)
    return np.isin(lab, list(set(lab[0][s[0] > 0].tolist()) - {0}))


def measure(a):
    img = load(a.key); H, W = img.shape[:2]; cam = json.load(open(a.camera))["camera"]
    L = rgb2lab(img)[..., 0]
    # sun: largest blob above the 99.7th percentile of L in the upper 75 % of the frame
    up = L[: int(0.75 * H)]; thr = max(np.percentile(up, 99.7), 90)
    n, lab, st, cen = cv2.connectedComponentsWithStats((up >= thr).astype(np.uint8))
    k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])); cx, cy = cen[k]; area = st[k, cv2.CC_STAT_AREA]; R0 = max(2.0, math.sqrt(area / math.pi))
    az, el = frame_to_dir(cx / W, cy / H, cam, W / H)
    yy, xx = np.mgrid[:H, :W]; rr = np.hypot(xx - cx, yy - cy)
    core = img[lab == k] if False else img[: int(0.75 * H)][lab == k]
    ann = (rr >= 2 * R0) & (rr <= 6 * R0); halo = img[ann & (L >= np.median(L[ann]))]   # bright half: glow, not the occluders
    prof = [round(float(L[(rr >= r) & (rr < r + R0)].mean()), 1) for r in np.arange(0, 14 * R0, R0)]
    sun = dict(frame=[round(cx / W, 4), round(cy / H, 4)], radiusPx=round(R0, 1), azimuthDeg=round(az, 2), elevationDeg=round(el, 2),
               coreLab=lab_mean(core), haloLab=lab_mean(halo), haloProfileL=prof, threshold=round(float(thr), 1))
    sun["coreHex"], sun["haloHex"] = lab_hex(sun["coreLab"]), lab_hex(sun["haloLab"])
    # sky gradient
    sk = top_sky(img); grad = []
    for i in range(20):
        y0, y1 = int(i * H / 20), int((i + 1) * H / 20); m = sk[y0:y1]
        if m.sum() > 50: grad.append(dict(row=round((i + 0.5) / 20, 3), lab=lab_mean(img[y0:y1][m])))
    # haze at the vanishing gap (composition camera.vp)
    comp = json.load(open(a.composition)); vp = comp.get("camera", {}).get("vp", [0.5, 0.58])
    hz = img[int((vp[1] - 0.06) * H):int((vp[1] - 0.01) * H), int((vp[0] - 0.03) * W):int((vp[0] + 0.03) * W)].reshape(-1, 3)
    haze = dict(lab=lab_mean(hz)); haze["hex"] = lab_hex(haze["lab"])
    # fog fraction by distance: dark tower pixels per composition slot vs the slot's distance (nearest projected tower)
    import layout_fit as LF
    lay = json.load(open(a.layout)); Cm = LF.Cam(cam); pts = []
    for t in lay["towers"] + lay.get("skyline", []):
        uv, d = Cm.project([[t["x"], 40.0, t["z"]]])
        if d[0] > 1: pts.append((uv[0][0] / LF.W, d[0]))
    rows = []
    for sl in comp["towers"]:
        x0, x1, y0, y1 = sl["rect"]; crop = img[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)].reshape(-1, 3)
        lc = rgb2lab(crop.reshape(-1, 1, 3)).reshape(-1, 3); dark = lc[lc[:, 0] <= np.percentile(lc[:, 0], 25)]
        xc = (x0 + x1) / 2; near = [d for u, d in pts if abs(u - xc) < (x1 - x0)]
        if near: rows.append(dict(slot=sl["slot"], distM=round(float(min(near)), 1), darkLab=[round(float(v), 2) for v in dark.mean(0)]))
    Lh = haze["lab"][0]; fog = dict(rows=rows)
    if len(rows) >= 2:
        rows.sort(key=lambda r: r["distM"]); L0 = rows[0]["darkLab"][0]; d0 = rows[0]["distM"]
        for r in rows: r["fogFrac"] = round(float(np.clip((r["darkLab"][0] - L0) / max(Lh - L0, 1e-3), 0, 0.99)), 3)
        ds = np.array([r["distM"] - d0 for r in rows[1:]]); fs = np.array([r["fogFrac"] for r in rows[1:]])
        ok = (fs > 0.01) & (ds > 1)
        D = float(np.median(-ds[ok] / np.log(1 - fs[ok]))) if ok.any() else None
        fog.update(scaleM=None if D is None else round(D, 1), refDistM=d0, note="fraction relative to the nearest slot (its own fog unknown)")
    # shadow: darkest 20 % of the ground band
    gb = img[int(0.65 * H):].reshape(-1, 3); gl = rgb2lab(gb.reshape(-1, 1, 3)).reshape(-1, 3); sh = gl[gl[:, 0] <= np.percentile(gl[:, 0], 20)].mean(0)
    shadow = dict(lab=[round(float(v), 2) for v in sh], neutralCool=bool(-6 <= sh[2] <= 0.5 and abs(sh[1]) <= 8)); shadow["hex"] = lab_hex(shadow["lab"])
    res = dict(key=os.path.abspath(a.key), camera=cam, sun=sun, sky=grad, haze=haze, fog=fog, shadow=shadow)
    os.makedirs(a.out, exist_ok=True); C.dump(res, os.path.join(a.out, "key-light.json"))
    print(json.dumps(dict(sun={k: sun[k] for k in ("frame", "azimuthDeg", "elevationDeg", "coreHex", "haloHex")}, haze=haze["hex"], fogScaleM=fog.get("scaleM"), shadow=shadow)))
    return res


def lin(h): h = h.lstrip("#"); return np.array([((int(h[i:i + 2], 16) / 255 + 0.055) / 1.055) ** 2.4 for i in (0, 2, 4)])
def to_hex(l): l = np.clip(l, 0, 1); s = np.where(l <= 0.0031308, 12.92 * l, 1.055 * l ** (1 / 2.4) - 0.055); return "#" + "".join(f"{int(round(v * 255)):02x}" for v in s)


def fit(a):
    M = json.load(open(a.measure)); s = M["sun"]; P = {}
    P["sun"] = dict(sunAzimuthDeg=s["azimuthDeg"], sunElevationDeg=max(1.0, s["elevationDeg"]), sunHex=s["coreHex"],
                    biome={"sun.azimuthDeg": s["azimuthDeg"], "sun.elevationDeg": max(1.0, s["elevationDeg"]), "sun.hex": s["coreHex"]})
    zen = M["sky"][0]["lab"] if M["sky"] else None
    P["hemi"] = dict(hemiSky=lab_hex(zen) if zen else None, hemiGround=M["shadow"]["hex"])
    f = M["fog"]; D = f.get("scaleM")
    bands = None
    if D:
        B = json.load(open(os.path.join(LIVE, "biome.json")))["fog"]["bands"]
        bands = [dict(b, color=M["haze"]["hex"], amount=round(float(1 - math.exp(-b["dist"] / D)), 3)) for b in B]
    P["fog"] = dict(biome={"fog.color": M["haze"]["hex"], **({"fog.bands": bands} if bands else {})})
    if a.kc:   # render-measured corrections (one proportional step), from a key-compare run of the same staging
        E = {e["id"]: e for e in json.load(open(a.kc))["elements"]}
        sp = E.get("spire")
        if sp and sp.get("labKeyShadow") and sp.get("labGameShadow"):
            import kc_mesa
            g = (kc_mesa.lab_to_lin(sp["labKeyShadow"]) + 1e-4) / (kc_mesa.lab_to_lin(sp["labGameShadow"]) + 1e-4)
            P["graphite"] = dict(chromeGraphite=to_hex(lin("#101114") * np.clip(g, 0.3, 3.0)), gain=[round(float(x), 3) for x in g])
        me = E.get("mesas")
        if me and me.get("labKeyLit") and me.get("labGameLit"):
            Lk, Lg, Lh = me["labKeyLit"][0], me["labGameLit"][0], M["haze"]["lab"][0]
            r = float(np.clip((Lh - Lg) / max(Lh - Lk, 1e-3), 0.3, 3.0))   # r < 1: game lit closer to haze than key -> less haze
            P["mesaHaze"] = dict(fogW=round(0.12 * r, 4), hazeW=round(0.2 * r, 4), ratio=round(r, 3))
    P["checks"] = dict(shadowNeutralCool=M["shadow"]["neutralCool"], haloImagine="sky1/sky7-atlas.png sprite (Imagine), tint untouched",
                       note="all colours sampled from the key image; none typed")
    os.makedirs(a.out, exist_ok=True); C.dump(P, os.path.join(a.out, "kc-light-proposal.json")); print(json.dumps(P)[:1200]); return P


def apply(a):
    sys.path.insert(0, I23D); import kc_stage
    kc_stage._refuse_live(a.stage); P = json.load(open(a.proposal)); kl = os.path.join(a.stage, "kc-light.json")
    cur = json.load(open(kl)) if os.path.exists(kl) else {}; cur.setdefault("biome", {})
    for g in a.only.split(","):
        if g not in P: raise SystemExit(f"group {g} not in proposal")
        if g == "mesaHaze": kc_stage.params_update(a.stage, fogW=P[g]["fogW"], hazeW=P[g]["hazeW"]); continue
        for k, v in P[g].items():
            if k == "biome": cur["biome"].update(v)
            elif k not in ("gain", "ratio") and v is not None: cur[k] = v
    C.dump(cur, kl); kc_stage.write_light_files(LIVE, a.stage); print(json.dumps(cur))


def test(a):
    sys.path.insert(0, I23D); import placement_v2 as PV
    cam = json.load(open(a.camera))["camera"]; os.makedirs(a.out, exist_ok=True); S = PV.Shots()
    try:
        S(cmd="open", url=a.url, cam=cam, vp=[a.w, a.w * 9 // 16], settle=8000); p = os.path.join(a.out, "game.png"); S(cmd="shot", path=p)
    finally: S.close()
    sc = PV.score_shot(p, os.path.join(a.out, "kc"), a.elements.split(","))
    print(json.dumps(dict(shot=p, iou=sc, report=os.path.join(a.out, "kc", "key-compare.json"))))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("cmd", choices=["measure", "fit", "apply", "test"])
    ap.add_argument("--key", default="/workspace/zb-bible-1008/key-city3.jpg"); ap.add_argument("--camera"); ap.add_argument("--out")
    ap.add_argument("--layout", default=os.path.join(LIVE, "objects1", "layout.json"))
    ap.add_argument("--composition", default=os.path.join(I23D, "layouts", "ember-mesa-composition.json"))
    ap.add_argument("--measure"); ap.add_argument("--kc"); ap.add_argument("--proposal"); ap.add_argument("--stage", default="/workspace/kc-staging/zb")
    ap.add_argument("--only", default="sun"); ap.add_argument("--url", default="http://127.0.0.1:8997/index.html"); ap.add_argument("--elements", default="sun")
    ap.add_argument("--w", type=int, default=640)
    a = ap.parse_args(); {"measure": measure, "fit": fit, "apply": apply, "test": test}[a.cmd](a)
