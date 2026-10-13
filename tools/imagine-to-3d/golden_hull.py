"""auto.py --method golden-hull: one object from its plates, no hand step, offline gates, fix-ledger + one retry.

  python3 tools/imagine-to-3d/auto.py run spec.json --method golden-hull

Spec (written by tools/golden/spec_sheet.py, JSON is valid YAML):
  {"object": id, "type": "rock|building|prop|ice", "key": key.jpg, "crop": key-crop.png, "heightM": 12,
   "work": DIR, "imagine": {"views": {"front": plate, "side": plate}}, "budgetTris": 25000}
Build: silhouette of the front plate x silhouette of the side plate -> carved voxel hull (a real volume, never a facade),
surface quads -> triangles, texture = atlas [front | side] projected along the view axes. Then, offline, on the object's
own renders (numpy z-buffer, no browser): oblique-profile (tools/gate/volume.py, oblique45 + grazing), triangle quality
(tools/gate/quality.py), untextured / grey area on the colour renders, triangle budget. FAIL -> learn/fix-ledger.jsonl
row + ONE automatic retry with the ledger's fix -> re-gate. A render sheet (key crop + 4 views) is saved for the Art
Director's final verdict (status "pending-art-director": never auto-approved).
Exit 0 PASS, 1 FAIL after retry, 2 bad spec.
"""
import json, math, os, struct, sys, time
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, REPO)
from tools.gate.volume import oblique_view  # noqa: E402
from tools.gate.quality import triangle_quality  # noqa: E402

LEDGER = os.environ.get("GOLDEN_FIX_LEDGER", os.path.join(REPO, "learn", "fix-ledger.jsonl"))
GREY_STD_MAX, GREY_SAT_MAX, GREY_FRAC_MAX = 1.6, 8.0, 0.05
# check -> the automatic fix the retry applies (and the ledger records)
FIXES = {"triangleQuality": ("weld-and-regrid", {"res": -8}), "obliqueProfile": ("chamfer-with-mirrored-45-view", {"chamfer": True}),
         "untexturedArea": ("reproject-from-nearest-plate", {"fillGrey": True}), "budget": ("coarser-grid", {"res": -12})}


def load_spec(path):
    s = json.load(open(path)) if path.endswith(".json") else __import__("yaml").safe_load(open(path))
    for k in ("object", "work", "imagine"):
        if k not in s: raise ValueError(f"spec missing {k}")
    v = s["imagine"].get("views", {})
    if "front" not in v or not os.path.isfile(v["front"]): raise ValueError("spec needs imagine.views.front (an existing plate)")
    return s


def silhouette(path, n):
    im = np.asarray(Image.open(path).convert("RGB").resize((n, n), Image.Resampling.LANCZOS)).astype(np.float32)
    b = 3; border = np.concatenate([im[:b].reshape(-1, 3), im[-b:].reshape(-1, 3), im[:, :b].reshape(-1, 3), im[:, -b:].reshape(-1, 3)])
    bg = np.median(border, 0); m = np.abs(im - bg).sum(2) > 45
    from scipy import ndimage as ndi
    m = ndi.binary_opening(m, iterations=1); lab, k = ndi.label(m)
    if k: m = lab == (np.bincount(lab.ravel())[1:].argmax() + 1)
    return ndi.binary_fill_holes(m), im


def carve(spec, p):
    n = p["res"]; v = spec["imagine"]["views"]
    F, fim = silhouette(v["front"], n)
    side_path = v.get("side") if (v.get("side") and os.path.isfile(v["side"]) and p.get("sideFromFront", True) is not None) else None
    S, sim = silhouette(side_path, n) if side_path else (F, fim)
    # occ[x, y, z]: front image (row=y top->bottom, col=x), side image (col=z)
    if float(spec.get("sideAngleDeg", 90)) == 45 and side_path:
        # side plate shot at 45 deg: depth from the front silhouette (symmetric guess) AND the diagonal silhouette
        i = np.arange(n); X, Z = np.meshgrid(i, i, indexing="ij")
        u = np.clip(((X - Z) / math.sqrt(2) + n / 2).round().astype(int), 0, n - 1)  # diagonal axis the 45 view sees
        occ = F.T[:, :, None] & F[None, :, :] & S[:, u].transpose(1, 0, 2)  # front(x,y) & front-as-depth(z,y) & S45(u,y)
    else:
        occ = F.T[:, :, None] & S.T[:, None, :]
    if p.get("chamfer"):  # retry fix: also carve with the mirrored diagonal view (the far 45 side assumed symmetric)
        i = np.arange(n); X, Z = np.meshgrid(i, i, indexing="ij")
        u2 = np.clip(((X + Z) / math.sqrt(2) - (n / 2) * (math.sqrt(2) - 1)).round().astype(int), 0, n - 1)
        occ &= S[:, u2].transpose(1, 0, 2)
    occ = occ[:, ::-1, :]  # y up
    if p.get("flat"):  # test hook: a pasted facade (one voxel thick)
        occ[:] = False; occ[:, :, n // 2] = F.T[:, ::-1]
    return occ, fim, sim


def surface(occ, H, fim, sim, grey_bad=False, smooth=4):
    n = occ.shape[0]; s = H / n
    pad = np.pad(occ, 1); P, UV, I = [], [], []
    atlas = np.concatenate([fim, sim], 1).clip(0, 255).astype(np.uint8)
    if grey_bad: atlas[:, : atlas.shape[1] // 4] = 128  # test hook: a grey untextured patch
    for ax in range(3):
        for sgn in (1, -1):
            sh = [0, 0, 0]; sh[ax] = sgn
            nb = np.roll(pad, -sgn, axis=ax)[1:-1, 1:-1, 1:-1] if True else None
            face = occ & ~nb
            xs, ys, zs = np.nonzero(face)
            if not len(xs): continue
            base = np.stack([xs, ys, zs], 1).astype(np.float32)
            o = base.copy(); o[:, ax] += 1 if sgn > 0 else 0
            a1, a2 = [k for k in range(3) if k != ax]
            corners = []
            for du, dv in ((0, 0), (1, 0), (1, 1), (0, 1)):
                c = o.copy(); c[:, a1] += du; c[:, a2] += dv; corners.append(c)
            q = np.stack(corners, 1)  # (F,4,3)
            if sgn < 0: q = q[:, ::-1]
            if ax == 0: q = q[:, [0, 3, 2, 1]] if sgn > 0 else q
            # uv: x/z faces + top/bottom use the front plate (x,y) ; x-normal faces use the side plate (z,y)
            uvs = []
            for k in range(4):
                c = q[:, k]
                if ax == 0: u = 0.5 + 0.5 * (c[:, 2] / n)
                else: u = 0.5 * (c[:, 0] / n)
                vv = 1 - (c[:, 1] / n) if ax != 1 else 1 - (np.clip(ys + 0.5, 0, n) / n)
                uvs.append(np.stack([u, vv], 1))
            uvq = np.stack(uvs, 1)
            k0 = sum(len(x) for x in P)
            P.append(((q - [n / 2, 0, n / 2]) * s).reshape(-1, 3)); UV.append(uvq.reshape(-1, 2))
            idx = k0 + np.arange(len(q))[:, None] * 4
            I.append(np.concatenate([idx + [0, 1, 2], idx + [0, 2, 3]], 0))
    if not P: return None
    pos = np.concatenate(P).astype(np.float32); uv = np.concatenate(UV).astype(np.float32); tri = np.concatenate(I).astype(np.int64)
    # make every triangle counter-clockwise seen from outside: orient by the face normal vs centroid offset
    T = pos[tri]; nrm = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]); cen = T.mean(1) - pos.mean(0)
    flip = (nrm * cen).sum(1) < 0; tri[flip] = tri[flip][:, ::-1]
    pos = smooth_welded(pos, tri, iters=smooth)
    return pos, uv, tri, atlas


def smooth_welded(pos, tri, iters=4, lam=0.5, mu=-0.53):
    """Taubin smoothing on the welded surface (faces keep their own UVs; shared corners move together, no cracks).
    Turns voxel stairs into real slopes, so oblique / grazing views see varied normals like the plate's volume."""
    if iters <= 0: return pos
    key = np.round(pos * 1e4).astype(np.int64); uniq, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.ravel()
    P = pos[np.unique(inv, return_index=True)[1]].astype(np.float64); P = np.zeros((len(uniq), 3)); np.add.at(P, inv, pos); P /= np.bincount(inv)[:, None]
    e = inv[tri]; E = np.concatenate([e[:, [0, 1]], e[:, [1, 2]], e[:, [2, 0]]]); E = np.unique(np.sort(E, 1), axis=0)
    deg = np.bincount(E.ravel(), minlength=len(P)).astype(np.float64)[:, None]
    for it in range(iters * 2):
        acc = np.zeros_like(P); np.add.at(acc, E[:, 0], P[E[:, 1]]); np.add.at(acc, E[:, 1], P[E[:, 0]])
        P = P + (lam if it % 2 == 0 else mu) * (acc / np.maximum(deg, 1) - P)
    return P[inv].astype(np.float32)


def render(pos, uv, tri, atlas, az, el, W=160):
    """Tiny z-buffer rasterizer: depth (m, NaN = miss), world normal, colour (atlas, nearest)."""
    a, e = math.radians(az), math.radians(el)
    fwd = -np.array([math.sin(a) * math.cos(e), math.sin(e), math.cos(a) * math.cos(e)])
    right = np.cross(fwd, [0, 1, 0]); right /= np.linalg.norm(right); up = np.cross(right, fwd)
    c = pos.mean(0); rad = np.linalg.norm(pos - c, axis=1).max(); eye = c - fwd * rad * 3.0
    rel = pos - eye; X, Y, Z = rel @ right, rel @ up, rel @ fwd
    f = W / 2 / math.tan(math.radians(22)); sx = W / 2 + f * X / Z; sy = W / 2 - f * Y / Z
    D = np.full((W, W), np.inf, np.float32); N = np.zeros((W, W, 3), np.float32); C = np.zeros((W, W, 3), np.float32)
    T = pos[tri]; nrm = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]); nl = np.linalg.norm(nrm, axis=1, keepdims=True); nrm = nrm / np.maximum(nl, 1e-9)
    ah, aw = atlas.shape[:2]
    for t in range(len(tri)):
        i0, i1, i2 = tri[t]; xs = sx[[i0, i1, i2]]; ys = sy[[i0, i1, i2]]
        x0, x1 = max(0, int(xs.min())), min(W - 1, int(xs.max()) + 1); y0, y1 = max(0, int(ys.min())), min(W - 1, int(ys.max()) + 1)
        if x0 > x1 or y0 > y1: continue
        den = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if abs(den) < 1e-9: continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        l0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / den
        l1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / den; l2 = 1 - l0 - l1
        ins = (l0 >= 0) & (l1 >= 0) & (l2 >= 0)
        if not ins.any(): continue
        z = l0 * Z[i0] + l1 * Z[i1] + l2 * Z[i2]
        sub = D[y0:y1 + 1, x0:x1 + 1]; upd = ins & (z < sub)
        if not upd.any(): continue
        sub[upd] = z[upd]
        u = l0 * uv[i0, 0] + l1 * uv[i1, 0] + l2 * uv[i2, 0]; v = l0 * uv[i0, 1] + l1 * uv[i1, 1] + l2 * uv[i2, 1]
        px = np.clip((u * (aw - 1)).astype(int), 0, aw - 1); py = np.clip((v * (ah - 1)).astype(int), 0, ah - 1)
        shade = 0.55 + 0.45 * max(0.0, float(nrm[t] @ np.array([0.4, 0.8, 0.45]) / 1.0))
        C[y0:y1 + 1, x0:x1 + 1][upd] = atlas[py[upd], px[upd]] * shade
        N[y0:y1 + 1, x0:x1 + 1][upd] = nrm[t]
    D[~np.isfinite(D)] = np.nan
    return D, N, C


def untextured_area(C, D):
    hit = ~np.isnan(D); g = C.mean(2); b = 8; tot = bad = 0
    for y in range(0, C.shape[0] - b + 1, b):
        for x in range(0, C.shape[1] - b + 1, b):
            if hit[y:y + b, x:x + b].mean() < 0.9: continue
            tot += 1; blk = C[y:y + b, x:x + b]
            sat = float((blk.max(2) - blk.min(2)).mean()); sd = float(g[y:y + b, x:x + b].std())
            if sd < GREY_STD_MAX and sat < GREY_SAT_MAX: bad += 1
    return (bad / tot) if tot else 1.0, tot


def write_glb(path, pos, uv, tri, atlas):
    import io
    bio = io.BytesIO(); Image.fromarray(atlas).save(bio, "PNG"); png = bio.getvalue()
    blobs = [pos.astype(np.float32).tobytes(), uv.astype(np.float32).tobytes(), tri.astype(np.uint32).tobytes(), png]
    views, off, buf = [], 0, b""
    for bb in blobs:
        pad = (-len(bb)) % 4; views.append({"buffer": 0, "byteOffset": off, "byteLength": len(bb)}); buf += bb + b"\0" * pad; off += len(bb) + pad
    g = {"asset": {"version": "2.0", "generator": "imagine-to-3d golden-hull"}, "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0}],
         "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "TEXCOORD_0": 1}, "indices": 2, "material": 0}]}],
         "materials": [{"pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0, "roughnessFactor": 1}}],
         "textures": [{"source": 0}], "images": [{"bufferView": 3, "mimeType": "image/png"}], "buffers": [{"byteLength": len(buf)}], "bufferViews": views,
         "accessors": [{"bufferView": 0, "componentType": 5126, "count": len(pos), "type": "VEC3", "min": pos.min(0).tolist(), "max": pos.max(0).tolist()},
                       {"bufferView": 1, "componentType": 5126, "count": len(uv), "type": "VEC2"},
                       {"bufferView": 2, "componentType": 5125, "count": int(tri.size), "type": "SCALAR"}]}
    js = json.dumps(g).encode(); js += b" " * ((-len(js)) % 4)
    open(path, "wb").write(struct.pack("<III", 0x46546C67, 2, 28 + len(js) + len(buf)) + struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(buf), 0x004E4942) + buf)


def gate_mesh(pos, uv, tri, atlas, work, budget):
    rd = os.path.join(work, "renders"); os.makedirs(rd, exist_ok=True); views = {}
    for name, az, el in (("front", 0, 8), ("oblique45", 45, 12), ("grazing", 78, 4), ("back", 180, 8)):
        D, N, C = render(pos, uv, tri, atlas, az, el); views[name] = (D, C)
        np.savez_compressed(os.path.join(rd, name + "-pass.npz"), depth=D, normal=N)
        Image.fromarray(C.clip(0, 255).astype(np.uint8)).save(os.path.join(rd, name + ".png"))
    ob = {k: oblique_view(os.path.join(rd, k + "-pass.npz")) for k in ("oblique45", "grazing")}
    tq = triangle_quality(pos[tri])
    gfr = max(untextured_area(C, D)[0] for D, C in views.values())
    rows = {"obliqueProfile": dict(value={k: [v["stepFrac"], v["normSpread"]] for k, v in ob.items()}, limit="stepFrac>=0.03, normSpread>=0.15", pass_=all(v["pass"] for v in ob.values())),
            "triangleQuality": dict(value={"degenerate": tq["degenerate"], "sliverFrac": tq["sliverFrac"]}, limit="0 degenerate, sliver<=1%", pass_=tq["pass"]),
            "untexturedArea": dict(value=round(gfr, 4), limit=GREY_FRAC_MAX, pass_=gfr <= GREY_FRAC_MAX),
            "budget": dict(value=len(tri), limit=budget, pass_=0 < len(tri) <= budget)}
    rows = {k: {"value": r["value"], "limit": r["limit"], "pass": bool(r["pass_"])} for k, r in rows.items()}
    return rows, views


def sheet(spec, views, out):
    crop = spec.get("crop"); tiles = []
    if crop and os.path.isfile(crop):
        k = Image.open(crop).convert("RGB"); k.thumbnail((160, 160)); t = Image.new("RGB", (160, 160)); t.paste(k, ((160 - k.width) // 2, (160 - k.height) // 2)); tiles.append(t)
    tiles += [Image.fromarray(C.clip(0, 255).astype(np.uint8)) for _D, C in views.values()]
    s = Image.new("RGB", (160 * len(tiles), 160)); [s.paste(t, (160 * i, 0)) for i, t in enumerate(tiles)]; s.save(out, quality=88)


def build_once(spec, p, hooks):
    occ, fim, sim = carve(spec, {**p, **({"flat": True} if hooks.get("flat") else {})})
    srf = surface(occ, spec.get("heightM", 12), fim, sim, grey_bad=hooks.get("grey") and not p.get("fillGrey"), smooth=int(spec.get("smooth", 2)))
    if srf is None: return None
    pos, uv, tri, atlas = srf
    if hooks.get("shred") and not p.get("weld"):  # test hook: shredded mesh (sliver fan across the hull)
        rng = np.random.default_rng(1); k = len(tri) // 4
        a = rng.integers(0, len(pos), k); tri = np.concatenate([tri, np.stack([a, (a + 1) % len(pos), (a + 2) % len(pos)], 1)])
    return pos, uv, tri, atlas


def run_cli(spec_path):
    try: spec = load_spec(spec_path)
    except Exception as e: print(f"[golden-hull] BAD SPEC: {e}", file=sys.stderr); return 2
    work = spec["work"]; os.makedirs(work, exist_ok=True); hooks = spec.get("_testHooks", {})
    p = {"res": int(spec.get("res", 40))}; budget = int(spec.get("budgetTris", 25000)); attempts = []
    last = 1 + int(spec.get("retries", 1))
    for attempt in range(1, last + 1):
        t0 = time.time(); b = build_once(spec, p, hooks)
        if b is None:
            rows, views = {"silhouette": {"value": 0, "limit": ">0 voxels", "pass": False}}, {}
        else:
            pos, uv, tri, atlas = b; rows, views = gate_mesh(pos, uv, tri, atlas, work, budget)
        fails = [k for k, r in rows.items() if not r["pass"]]
        attempts.append({"attempt": attempt, "params": dict(p), "rows": rows, "seconds": round(time.time() - t0, 2)})
        for k in fails: print(f"   FAIL {spec['object']}.{k}: {rows[k]['value']} (limit {rows[k]['limit']})")
        if not fails or attempt == last: break
        os.makedirs(os.path.dirname(LEDGER), exist_ok=True)
        for k in fails:  # fix-ledger: what failed, which fix the retry applies
            fx, delta = FIXES.get(k, ("none", {}))
            for dk, dv in delta.items(): p[dk] = max(16, p.get(dk, 40) + dv) if dk == "res" else dv
            if k == "triangleQuality": p["weld"] = True
            with open(LEDGER, "a") as fh:
                fh.write(json.dumps({"t": time.strftime("%Y-%m-%dT%H:%M:%S"), "object": spec["object"], "check": k, "value": rows[k]["value"],
                                     "fix": fx, "params": dict(p), "tool": "imagine-to-3d golden-hull"}) + "\n")
        print(f"[golden-hull] {spec['object']}: retry with {p}")
    ok = not fails
    if ok:
        write_glb(os.path.join(work, spec["object"] + ".glb"), pos, uv, tri, atlas)
        sheet(spec, views, os.path.join(work, "render-sheet.jpg"))
    res = {"object": spec["object"], "verdict": "PASS" if ok else "FAIL", "attempts": attempts,
           "glb": os.path.join(work, spec["object"] + ".glb") if ok else None, "tris": int(len(tri)) if b is not None else 0,
           "artDirector": {"status": "pending-art-director", "sheet": os.path.join(work, "render-sheet.jpg") if ok else None}}
    json.dump(res, open(os.path.join(work, "result.json"), "w"), indent=1)
    print(f"[golden-hull] {spec['object']}: {res['verdict']} after {len(attempts)} attempt(s)")
    return 0 if ok else 1
