"""Terrace assembly from the 10 hero pieces, snapped on the greybox layout (3 x 2.5 m tiers, 2.5 m treads),
tier ends fitted to the Zone D key (v11 key-mask tiers scaled by the Reader spec: 2.5 m / 4.4 m solved tier),
door recess on tier 1 at the key door, then placed in the spine world at s=450, yawed to the spine heading."""
import json, math
from pathlib import Path
import numpy as np
import pieces as P
from geom import Mesh, box as gbox

K = 2.5 / 4.4                                   # Reader spec / solved key tier-1 height
KEY_TIERS = [(-11.5, 20.28), (-12.0, 20.6), (-12.03, 18.55)]   # v11 key-mask tier x extents (kit units)
KEY_DOOR_X = (3.77 + 5.47) / 2                  # key door centre (kit units)
KEY_CORNICE = (-0.82, 10.35)
# key-colour projection (key-zd1-b.jpg inside the SAM2 tier mask vs the library albedo means), linear gains
KEY_GAIN = {"stone": [0.6, 0.7, 0.9], "snow": [0.85, 0.95, 1.05]}   # snow: key canopies/treads read bright blue-white (keysheet), was 0.47/0.65/0.64


def solid(lo, hi, name, snow=0.0):
    m = gbox(lo, hi, 0.0, name, "stone")
    return P.tag(P.orient(m), snow=snow)


KEY_ROWS = [7, 4, 4]   # key-scale rises: v11 stepped tops 4.4 / 7.1 m (solved key camera) -> 4.375 / 6.875 / 9.375 m in 0.625 m courses
SPEC_ROWS = [4, 4, 4]  # Reader spec: 3 x 2.5 m
SLAB_T = 0.45   # tread snow slab thickness (kit-art caps 0.5-0.8 incl. the rolled lip)
DOOR_TIERS = (0, 1, 2)  # key feature sheet: three stacked doorways, one per tier
CANOPY_HALF = 2.0       # canopy cornice 4 m wide over a 2.6 m door bay


def layout(sc=K, lod=0, rows_list=None, facade=None):
    """sc: metres per key-kit unit. sc=K -> Reader spec (2.5 m tiers); sc=1 -> key scale (tiers as solved from the key, ~4.4 m)."""
    ROWS = rows_list or (SPEC_ROWS if sc < 1 else KEY_ROWS)
    RS = [r * P.COURSE_H for r in ROWS]; Z0 = [sum(RS[:k]) for k in range(3)]; ZT = [Z0[k] + RS[k] for k in range(3)]
    T = 2.5                                            # tread (spec and v11 key fit agree)
    R = RS[0]                                          # tier-1 top: cornice seat
    BACK = 3 * T + 1.0
    meshes, inst, empt = {}, [], []
    def piece(key):
        if key not in meshes:
            fn = P.PIECES[key.split("@")[0]][0]
            meshes[key] = fn(lod) if "@" not in key else P.wall_block_course(lod, seed=int(key.split("@")[1]))
        return key
    n = 0
    def put(key, t, yaw=0.0, mirror=False):
        nonlocal n
        k = piece(key)
        if mirror:   # baked mirror (x -> -x, winding flipped): no negative node scale, so instancing keeps front faces
            mk_ = key + "~m"
            if mk_ not in meshes:
                src = meshes[k]; Vm = src.V.copy(); Vm[:, 0] *= -1
                meshes[mk_] = Mesh(Vm, src.F[:, ::-1].copy(), src.name + "_m", src.material)
                meshes[mk_].attrs = dict(getattr(src, "attrs", {}))
            k = mk_
        inst.append((f"{key.split('@')[0].split('~')[0]}_{n}", k, t, yaw)); n += 1
    door_x = round(KEY_DOOR_X * sc * 2) / 2
    tiers, treads = [], []
    for k, (a, b) in enumerate(KEY_TIERS):
        x0 = math.floor(a * sc * 2) / 2; ncol = int(round((b * sc - x0) / 2.0)); x1 = x0 + 2 * ncol
        tiers.append((x0, x1))
        yf, z0, Rk = k * T, Z0[k], RS[k]
        if facade:   # v4: facade rebuilt block by block from the key's measured block layout (tools/placer/facade.py)
            hb = float(np.clip(facade["block_h_m"][2], 0.2, 1.2)); nr = max(1, int(round(Rk / hb))); ch = Rk / nr   # upper quartile: joint maps over-split blocks
            wv = [float(np.clip(v, 0.2, 2.0)) for v in (facade["block_w_m"][0], facade["block_w_m"][1], facade["block_w_m"][2], (facade["block_w_m"][1] + facade["block_w_m"][2]) / 2)]
            jw = float(np.clip(facade["joint_w_m"][1], 0.01, 0.1)); bond = float(facade["bond"][1])
            pr = float(np.clip(abs((facade.get("protrusion_rel_h") or [0, 0.3, 0])[1]) * hb, 0.03, 0.4))
            rng = np.random.default_rng(31 + k)
            for vi, wb in enumerate(wv):
                kk = f"facade_block@{vi}"
                if kk not in meshes:
                    meshes[kk] = P.facade_block(lod, wb, ch, 0.2 + pr, jw, seed=vi)
            for r in range(nr):
                x = x0 + (bond * wv[1] if r % 2 else 0.0)
                while True:
                    vi = int(rng.integers(0, 4)); wb = wv[vi]
                    if x + wb > x1 + 1e-6:
                        vi = int(np.argmin(wv)); wb = wv[vi]
                        if x + wb > x1 + 1e-6:
                            break
                    xc = x + wb / 2; x += wb
                    if k in DOOR_TIERS and abs(xc - door_x) < 1.5 and r * ch < 2.4:
                        continue
                    inst.append((f"facade_block_{n}", f"facade_block@{vi}", (xc, yf - rng.uniform(0, 0.5) * pr, z0 + r * ch), 0.0)); n += 1
        for r in range(ROWS[k] if facade else 0, ROWS[k]):
            crng = np.random.default_rng(1000 * k + r)             # v5: random bond phase, random variant (4: draw budget), x/y/z
            off = float(crng.uniform(0.3, 1.7)) if r % 2 else float(crng.uniform(0, 0.4))   # z jitter -> no stripe repeats
            xs = np.arange(x0 + 1.0 + off, x1 - 0.99, 2.0)
            for i, xc in enumerate(xs):
                if k in DOOR_TIERS and abs(xc - door_x) < 1.5 and r * P.COURSE_H < 2.4:
                    continue                                       # door bay
                put(f"wall_block_course@{int(crng.integers(1, 5))}", (xc + float(crng.uniform(-0.15, 0.15)), yf - float(crng.uniform(0, 0.06)),
                    z0 + r * P.COURSE_H + float(crng.uniform(-0.08, 0.08))))   # course lines wander +-8 cm: no FFT stripe
            if off:                                                # half-course fillers at the ends of offset rows
                pass
            put("wall_block_corner", (x1 - 0.45, yf, z0 + r * P.COURSE_H))
            put("wall_block_corner", (x0 + 0.45, yf, z0 + r * P.COURSE_H), 0.0, True)
        # core (hidden behind the course backing) + tread snow
        core = f"core{k}"
        if k in DOOR_TIERS:
            meshes[core] = P.merged([solid([x0, yf + 0.2, z0], [door_x - 1.0, BACK, z0 + Rk], "c"),
                                     solid([door_x + 1.0, yf + 0.2, z0], [x1, BACK, z0 + Rk], "c"),
                                     solid([door_x - 1.0, yf + 0.2, z0 + 2.4], [door_x + 1.0, BACK, z0 + Rk], "c"),
                                     solid([door_x - 1.0, yf + 1.5, z0], [door_x + 1.0, BACK, z0 + 2.4], "c")], core, "stone")
        else:
            meshes[core] = P.merged([solid([x0, yf + 0.2, z0], [x1, BACK, z0 + Rk], "c")], core, "stone")
        inst.append((f"tier{k + 1}_core", core, (0, 0, 0), 0.0)); 
        # v2 (key: biggest visible gap): thick white snow slab on every tread, rounded, overhanging the tier front
        # v3 (keysheet no_bar): rounded extruded slab whose front lip bulges/droops along x - no straight edge
        dep = 1.3   # bulging lip part; the flat tread behind it is a plain slab whose front edge is buried in the lip
        treads.append(P.tag(P.rbox([x0 + 0.1, yf + 0.9, z0 + Rk - 0.05], [x1 - 0.1, BACK - 0.05, z0 + Rk + SLAB_T * 0.8], 0.1, 1), snow=1.0))
        prof = P.rounded_profile([(dep, -0.05), (dep, SLAB_T), (0.3, SLAB_T * 1.08), (-0.25, SLAB_T * 0.8), (-0.4, 0.15), (-0.3, -0.15), (0.0, -0.05)], 0.12, 3)
        prof = [(y_ + yf, z_ + z0 + Rk) for y_, z_ in prof]
        ph = 1.3 * k + 0.4
        slab = P.extrude_profile(prof, x0 + 0.1, x1 - 0.1, int((x1 - x0) / 0.5), f"tread_snow{k}",
                                 wobble=lambda x, ph=ph: 0.88 + 0.12 * math.sin(x * 1.3 + ph) + 0.08 * math.sin(x * 3.7 + 2 * ph))
        treads.append(P.tag(slab, snow=1.0))
        empt += [(f"socket_tier{k + 1}_front_L", (x0, yf, z0)), (f"socket_tier{k + 1}_front_R", (x1, yf, z0 + 0))]
    meshes["tread_snow"] = P.merged(treads, "tread_snow", "stone"); inst.append(("tread_snow", "tread_snow", (0, 0, 0), 0.0))
    # doors: the key stacks one doorway per tier in the same column, each under a snow canopy
    for k in DOOR_TIERS:
        put("door_recess_frame", (door_x, k * T, Z0[k]))
    # key feature sheet (specs/zd/key-features.json): per tier a thick snow cap along the front, and over every
    # doorway a canopy = short cornice + corbels carrying a thick bulging overhanging snow slab; icicles root
    # INSIDE the slab lip (no bar). The long tier-1 cornice of v1 is gone (not in the key).
    ic_s = P.PIECES["icicle_cluster_s"][0](0); ic_l = P.PIECES["icicle_cluster_l"][0](0)  # pivot heights from LOD0
    hs, hl = ic_s.V[:, 2].max(), ic_l.V[:, 2].max()
    cx0, cx1 = door_x - CANOPY_HALF, door_x + CANOPY_HALF
    for k in range(3):
        x0, x1 = tiers[k]; yf = k * T; zt = ZT[k]
        door = k in DOOR_TIERS
        for xc in np.arange(x0 + 1.0, x1 - 0.99, 2.0):
            if door and cx0 - 0.5 < xc < cx1 + 0.5:
                continue
            jr = np.random.default_rng(abs(int(xc * 10)) + 97 * k + 1000)      # break the straight cap line (keysheet no_bar)
            put("snow_drift_cap", (xc + jr.uniform(-0.15, 0.15), yf - 0.1 + jr.uniform(-0.12, 0.08), zt + jr.uniform(-0.08, 0.1)), jr.uniform(-5, 5))
        put("snow_drift_end", (x0 + 0.4, yf, zt)); put("snow_drift_end", (x1 - 0.4, yf, zt))
        for xc in np.arange(x0 + 1.5, x1 - 1.0, 3.0):
            if door and cx0 - 0.5 < xc < cx1 + 0.5:
                continue
            put("icicle_cluster_s", (xc, yf - 0.4, zt - hs))      # root inside the cap lip
        if door:
            for xc in np.arange(cx0 + 1.0, cx1, 2.0):
                put("cornice_run", (xc, yf, zt)); put("corbel", (xc, yf, zt - 0.62))
            put("cornice_end", (cx1 + 0.5, yf, zt)); put("cornice_end", (cx0 - 0.5, yf, zt), 0.0, True)
            # snow pillow on the canopy (thick bulging drooping slab), icicles as its children rooted in the lip
            zp = zt + 0.32
            put("snow_pillow", (door_x, yf - 0.6, zp))
            for j_, xc in enumerate(np.arange(cx0 - 0.1, cx1 + 0.2, 0.75)):
                key = "icicle_cluster_l" if j_ % 3 == 1 else "icicle_cluster_s"
                h_ = hl if key.endswith("_l") else hs
                put(key, (xc, yf - 0.6 + P.PILLOW_LIP[0] + 0.1, zp + P.PILLOW_LIP[1] + 0.12 - h_))
    # 1.8 m marker in front of the terrace
    mk = P.tag(P.orient(gbox([-0.15, -0.15, 0], [0.15, 0.15, 1.8], 0.0, "marker_1.8m", "stone")))
    meshes["marker_1.8m"] = mk
    inst.append(("marker_1.8m", "marker_1.8m", (x0 - 1.5, -3.0, 0.0), 0.0))
    empt += [("socket_door", (door_x, 0.0, 0.0)), ("socket_canopy_L", (cx0, 0.0, R)), ("socket_canopy_R", (cx1, 0.0, R))]
    return meshes, inst, empt, {"tiers": tiers, "cornice": [cx0, cx1], "door_x": door_x, "tier_h": ZT[2] / 3, "height": ZT[2], "rises": RS, "tread": T, "back": BACK, "rows": ROWS, "scale_m_per_kit": sc}


def spine_frame(spine, s, min_clear=6.0, foot=(-8.0, 13.0, 0.0, 8.5)):
    Pp = spine["points"]
    S = np.array([p["s"] for p in Pp]); xy = np.array([p["xy"] for p in Pp]); ys = np.array([p["y"] for p in Pp])
    i = int(np.clip(np.searchsorted(S, s), 1, len(S) - 1)); t = (s - S[i - 1]) / (S[i] - S[i - 1])
    pos = xy[i - 1] + t * (xy[i] - xy[i - 1]); gy = ys[i - 1] + t * (ys[i] - ys[i - 1])
    d = (xy[i] - xy[i - 1]) / np.linalg.norm(xy[i] - xy[i - 1]); left = np.array([-d[1], d[0]])
    off = 2.0
    while True:
        O = pos + left * off - d * 2.5
        # colliders are world AABBs of the yawed pieces: clear the lane against the world AABB of the yawed footprint
        cs = np.array([O + a * d + b_ * left for a in foot[:2] for b_ in foot[2:]])
        lo, hi = cs.min(0), cs.max(0)
        dd = np.maximum(np.maximum(lo - xy, xy - hi), 0)
        clear = float(np.hypot(dd[:, 0], dd[:, 1]).min())
        if clear >= min_clear:
            break
        off += 0.25
    yaw = math.degrees(math.atan2(d[1], d[0]))                     # glTF yaw about +Y
    heading = (math.degrees(math.atan2(d[0], d[1])) + 360) % 360   # compass, clockwise from north
    return {"origin_gl": [float(O[0]), float(gy), float(-O[1])], "yaw_gl_deg": yaw, "heading_deg": heading, "clear_m": clear, "ground_y": float(gy)}


def _add_placer(meshes, inst, sc, placer):
    """auto key sheet -> placed snow patches / icicles / rubble (tools/placer). Returns the placement log."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "placer"))
    import placer as PL
    sheet, groups, scope = placer
    if not groups:
        return {"placed": {}, "groups": []}
    am, ai, log = PL.place(meshes, inst, sheet, sc, scope, tuple(g for g in groups if g != "facade"))
    meshes.update(am); inst.extend(ai); log["groups"] = groups; return log


def _decimate(meshes):
    """planar-region decimation on every piece (geom.decimate_planar): coplanar face sets re-triangulated from their
    boundary loop; snow/ice-tagged faces (pillows, drips, broken snow edges) keep full density. In place; returns tris."""
    from geom import decimate_planar
    before = sum(len(m.F) for m in meshes.values())
    for k in list(meshes):
        meshes[k] = decimate_planar(meshes[k])
    return {"tris_before": before, "tris_after": sum(len(m.F) for m in meshes.values())}


def cmd_terrace(spine_path, out, variant="spec", fit_mask=None, placer=None):
    import sys, shutil
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from tools.gatesuite import glbio
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    spine = json.loads(Path(spine_path).read_text()); shutil.copy(spine_path, out / "spine.json")
    sc = K if variant == "spec" else 1.0
    meshes, inst, empt, info = layout(sc, 0)
    fac = None
    if placer and "facade" in placer[1]:   # rebuild the facade block by block from the key's measured block layout
        import sys as _s
        _s.path.insert(0, str(Path(__file__).resolve().parents[1] / "placer"))
        import facade as FA
        fac = FA.measure(placer[0], meshes, inst, sc, placer[2])
        if fac["block_w_m"]:
            meshes, inst, empt, info = layout(sc, 0, facade=fac); info["facade"] = fac
        else:
            fac = None
    if placer:
        info["placer"] = _add_placer(meshes, inst, sc, placer)
    info["decimate"] = _decimate(meshes)
    xs = [t for tr in info["tiers"] for t in tr]
    fr = spine_frame(spine, 450.0, foot=(min(xs) - 1.0, max(xs) + 1.0, -1.0, info["back"]))
    ex = {"keyGain": KEY_GAIN["stone"], "snowGain": KEY_GAIN["snow"], "key_cam_scale": sc, "variant": variant, "spine": spine.get("version")}
    if placer:   # snow+rubble ground: gated Imagine snow tile from the material library (tools/materials/texflow.py)
        ex.update({"ground": "lib_snow.jpg", "ground_tile_m": 3.0})
    P.write_scene(out / "terrace-local.glb", meshes, inst, empt, ex)
    if fit_mask and Path(fit_mask).exists():   # silhouette fit to the key mask (judge render only)
        import keyfit
        kf = keyfit.fit(out / "terrace-local.glb", fit_mask, sc); info["keyfit"] = kf
        ex["keyfit_offset"] = kf["offset_kit_m"]
        P.write_scene(out / "terrace-local.glb", meshes, inst, empt, ex)
    glbs = {}
    for lod in (0, 1, 2):
        m_l, inst_l, _, _ = layout(sc, lod, facade=fac) if lod else (meshes, inst, empt, info)
        if lod and placer:
            _add_placer(m_l, inst_l, sc, placer)
        if lod:
            _decimate(m_l)
        fn = f"terrace-world-lod{lod}.glb"
        P.write_scene(out / fn, m_l, inst_l, empt, {**ex, "frame": fr}, root=(fr["origin_gl"], fr["yaw_gl_deg"]))
        glbs[f"lod{lod}"] = fn
    ms, _ = glbio.meshes(out / glbs["lod0"])
    cols = []
    for m in ms:
        if m["name"].startswith(("icicle", "snow", "marker")) or "tread_snow" in m["name"]:
            continue
        lo, hi = m["V"].min(0), m["V"].max(0)
        cols.append({"id": f"col_{m['name']}", "mesh": m["name"], "world": True, "min": (lo + 0.02).round(4).tolist(),
                     "max": (hi - 0.02).round(4).tolist(), "note": "world AABB of a yawed piece (OBB yaw in build.json frame)"})
    (out / "colliders.json").write_text(json.dumps(cols))
    (out / "sockets.json").write_text(json.dumps([{"name": n, "kit_local": list(map(float, p))} for n, p in empt], indent=1))
    draws = len({(k, meshes[k].material) for _, k, *_ in inst if not k.startswith("marker")})
    build = {"name": f"zd-terrace-kit-{variant}", "kind": "tier", "spine": "spine.json", "glbs": glbs, "colliders": "colliders.json",
             "sockets": "sockets.json", "frame": fr, "keysheet": "tools/keysheet/zones/zd-terrace/sheet.json", "expect": {"height_m": round(info["height"], 3), "tol": 0.1, "overhang": True},
             "draws": draws, "page": "play.html?view=key&hud=0&model=terrace-local.glb",
             "judge": {"render": "gate/key-render.png", "key": "gate/key.jpg", "mask": "gate/mask.png"},
             "views": {v: f"gate/view-{v}.png" for v in ("3m", "chase", "45", "grazing", "side", "side4m")},
             "textures": [{"w": 1024, "h": 1024}] * 5, "texel_px_per_m": 539,
             "missing_library": ["matte ice texture (flat matte material used)", "trim sheet (none)"]}
    if placer:
        build["autosheet"] = str(Path(placer[0]).resolve()); build["placer"] = info.get("placer")
    build["missing_library"] = [m for m in build["missing_library"] if not placer]
    (out / "build.json").write_text(json.dumps(build, indent=1))
    tris = sum(len(meshes[k].F) for _, k, *_ in inst if not k.startswith("marker"))
    keys = sorted({k.split("@")[0] for _, k, *_ in inst})
    return {"variant": variant, "instances": len(inst), "unique_meshes": len(meshes), "draws": draws, "tris_lod0": tris, "frame": fr, "pieces_used": keys, **info}
