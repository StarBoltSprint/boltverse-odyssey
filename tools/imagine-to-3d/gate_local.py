"""Final gate stage of imagine-to-3d (stand-in until tools/object-gate lands; same row shape).
gate(spec) -> {"pass": bool, "rows": [{name, pass, value, limit, fix}]}.  Profiles per object type."""
import json, sys, numpy as np
from scipy.spatial import cKDTree
sys.path.insert(0, __file__.rsplit('/', 1)[0])
import qc as QC

PROFILES = {
    # nativePxM: Imagine plate px per metre on the nearest walkable face (detail tiles excluded)
    "mesa":  dict(iou=0.9, stretch=1.3, nativePxM=64, lodPx=1.0, twinYawDeg=40, twinScale=1.15, sinkMin=0.3, lod0Max=60000),
    "tower": dict(iou=0.9, stretch=1.3, nativePxM=64, lodPx=1.0, twinYawDeg=0, twinScale=1.0, sinkMin=0.3, lod0Max=60000),
    "rock":  dict(iou=0.9, stretch=1.3, nativePxM=64, lodPx=1.0, twinYawDeg=40, twinScale=1.15, sinkMin=0.1, lod0Max=20000),
}
FOCAL_PX = 1200 / (2 * np.tan(np.deg2rad(58) / 2))   # portrait phone 540x1200, vfov 58

def lod_dev(glb):
    m = QC.read_glb(glb); names = sorted(m)
    out = []
    for a, b in zip(names, names[1:]):
        Pa, _ = m[a]; Pb, Ib = m[b]
        # dense samples on the coarser LOD's triangles vs the finer LOD's vertices, both ways
        tri = Pb[Ib]; r = np.random.default_rng(0).random((len(tri), 2)); r = np.where(r.sum(1, keepdims=True) > 1, 1 - r, r)
        sb = tri[:, 0] + (tri[:, 1] - tri[:, 0]) * r[:, :1] + (tri[:, 2] - tri[:, 0]) * r[:, 1:]
        d1, _ = cKDTree(Pa).query(sb); d2, _ = cKDTree(np.vstack([Pb, sb])).query(Pa)
        d = np.concatenate([d1, d2]); out.append(dict(pair=f"{a}->{b}", p95=float(np.percentile(d, 95)), p99=float(np.percentile(d, 99))))
    return out

def gate(spec):
    P = PROFILES[spec["type"]]; rows = []
    def row(name, ok, value, limit, fix=None): rows.append(dict(name=name, pass_=bool(ok), value=value, limit=limit, fix=fix))
    meta, q = spec["meta"], spec["qc"]
    row("silhouette IoU", all(v >= P["iou"] for v in meta["iou"].values()), meta["iou"], P["iou"], "regenerate the failing view as an edit of the front")
    smax = max(v["stretch"]["max"] for v in q.values())
    row("UV stretch", smax <= P["stretch"], smax, P["stretch"], "add projection directions (proj.py)")
    row("mesh manifold", all(v["nonManifoldEdges"] == 0 for v in q.values()), {k: v["nonManifoldEdges"] for k, v in q.items()}, 0, "remesh")
    lod0 = q[sorted(q)[0]]["tris"]; row("LOD0 tris", lod0 <= P["lod0Max"], lod0, P["lod0Max"], "decimate")
    # native Imagine density on the nearest face (plates only, detail excluded), at the largest placed scale
    smax_sc = max(p["scale"] for p in spec["placements"])
    px = meta["pxm"] / smax_sc
    row("native Imagine px/m (no detail)", px >= P["nativePxM"], round(px, 2), P["nativePxM"],
        "needs higher-res plates: split each view into bands and Imagine-edit each band at full res (new Imagine budget)")
    # repetition: two placements of the same mesh that read as twins (same mirror, close yaw, close scale)
    twins = []
    pl = spec["placements"]
    for i in range(len(pl)):
        for j in range(i + 1, len(pl)):
            a, b = pl[i], pl[j]
            dy = abs((a["yaw"] - b["yaw"] + 180) % 360 - 180)
            if a["mirror"] == b["mirror"] and dy < P["twinYawDeg"] and max(a["scale"], b["scale"]) / min(a["scale"], b["scale"]) < P["twinScale"]:
                twins.append(f'{a["id"]}~{b["id"]} dyaw {dy:.0f}')
    row("no repetition (twin placements)", not twins, twins or "none", f"yaw >= {P['twinYawDeg']} or mirror or scale x{P['twinScale']}", "re-yaw / mirror the later twin")
    # approach morph: LOD swap error in screen px at the switch distance (nearest rock edge)
    devs = spec.get("lodDev") or []
    sw = spec["lodSwitch"]; R = spec["radiusM"]; worst = 0; det = []
    for k, d in enumerate(devs):
        for p in pl:
            edge = max(1.0, sw[k + 1] * p["scale"] - R * p["scale"])
            e = d["p99"] * p["scale"] / edge * FOCAL_PX; worst = max(worst, e)
        det.append(f'{d["pair"]} p99 {d["p99"]:.3f} m')
    row("approach morph (LOD pop px)", worst <= P["lodPx"], round(worst, 2), P["lodPx"], "push the LOD switch out")
    # grounding (from the runtime placement data when available)
    if spec.get("runtime"):
        rt = spec["runtime"]
        bad = [it["id"] for it in rt["items"] if not (it["baseY"] <= it["minGround"] - P["sinkMin"])]
        row("grounding (sunk, never floating)", not bad, bad or "all sunk", P["sinkMin"], "lower baseY")
        sh = rt.get("shadow") or {}
        row("shadows static + neutral", bool(sh.get("mesaCasters")), sh, "static world-fixed map, mesa casters > 0, tint (0.34,0.36,0.42)", "add casters to the fit")
    for r in rows: r["pass"] = r.pop("pass_")
    return dict(pass_all=all(r["pass"] for r in rows), rows=rows, detail=dict(lodDev=det))
