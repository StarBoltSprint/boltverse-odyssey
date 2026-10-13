#!/usr/bin/env python3
"""golden stages: one function per stage of tools/golden/run.sh. Each writes WORK/<stage>/ and WORK/gates/<stage>.json
({"stage","verdict":"PASS"|"FAIL","checks":[{"name","value","limit","ok"}]}); exit 1 on FAIL, 2 on bad input.

  python3 tools/golden/stages.py <stage> --work WORK --key KEY --zone ZONE [--prompts FILE]
  stages: prompts sky ground terrain objects placement gate worldgraph play

Generic on purpose (any key image, no zone-specific paths). What is still a proxy is written in the zone JSON `todo`:
objects are relief meshes cut from their plate (imagine-to-3d auto.py needs a per-object spec + browser gates).
"""
import argparse, json, math, os, struct, sys, hashlib
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE))
BUDGET = {"frameTrisMax": 600000, "groundTrisMax": 150000, "objectTrisMax": 90000, "texturesMBMax": 300,
          "skySeamMax": 28.0, "groundTileSeamMax": 1.6, "groundKeyDeltaLMax": 70.0, "laneClearM": 6.0, "cameraMarginM": 1.0}
EXTS = (".jpg", ".jpeg", ".png", ".webp")


def gate(work, stage, checks, extra=None):
    ok = all(c["ok"] for c in checks)
    d = dict(stage=stage, verdict="PASS" if ok else "FAIL", checks=checks, **(extra or {}))
    os.makedirs(os.path.join(work, "gates"), exist_ok=True)
    json.dump(d, open(os.path.join(work, "gates", stage + ".json"), "w"), indent=1)
    for c in checks:
        if not c["ok"]: print(f"   FAIL {stage}.{c['name']}: {c['value']} (limit {c['limit']})" + (f" - {c['where']}" if c.get("where") else ""))
    print(f"[{stage}] {d['verdict']}")
    return 0 if ok else 1


def chk(name, value, limit, ok, where=None):
    c = {"name": name, "value": value, "limit": limit, "ok": bool(ok)}
    if where: c["where"] = where
    return c


def plates(work, prefix):
    d = os.path.join(work, "plates")
    return sorted(os.path.join(d, f) for f in os.listdir(d) if f.startswith(prefix) and f.lower().endswith(EXTS)) if os.path.isdir(d) else []


def rgb(p, size=None):
    im = Image.open(p).convert("RGB")
    if size: im = im.resize(size, Image.LANCZOS)
    return np.asarray(im).astype(np.float32)


def lum(a): return a @ np.array([0.2126, 0.7152, 0.0722], np.float32)


# ---------------- minimal glTF 2.0 binary writer (positions, uv, indices, one embedded texture) -------------
def write_glb(path, pos, uv, idx, tex_png):
    pos = np.asarray(pos, np.float32); uv = np.asarray(uv, np.float32); idx = np.asarray(idx, np.uint32).ravel()
    blobs = [pos.tobytes(), uv.tobytes(), idx.tobytes(), open(tex_png, "rb").read()]
    views, off, buf = [], 0, b""
    for b in blobs:
        pad = (-len(b)) % 4; views.append({"buffer": 0, "byteOffset": off, "byteLength": len(b)}); buf += b + b"\0" * pad; off += len(b) + pad
    views[0]["target"] = views[1]["target"] = 34962; views[2]["target"] = 34963
    g = {"asset": {"version": "2.0", "generator": "tools/golden"}, "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0}],
         "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "TEXCOORD_0": 1}, "indices": 2, "material": 0}]}],
         "materials": [{"pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0, "roughnessFactor": 1}}],
         "textures": [{"source": 0, "sampler": 0}], "samplers": [{"magFilter": 9729, "minFilter": 9987}],
         "images": [{"bufferView": 3, "mimeType": "image/png"}], "buffers": [{"byteLength": len(buf)}], "bufferViews": views,
         "accessors": [{"bufferView": 0, "componentType": 5126, "count": len(pos), "type": "VEC3", "min": pos.min(0).tolist(), "max": pos.max(0).tolist()},
                       {"bufferView": 1, "componentType": 5126, "count": len(uv), "type": "VEC2"},
                       {"bufferView": 2, "componentType": 5125, "count": len(idx), "type": "SCALAR"}]}
    js = json.dumps(g).encode(); js += b" " * ((-len(js)) % 4)
    out = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(buf)) + struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(buf), 0x004E4942) + buf
    open(path, "wb").write(out); return len(idx) // 3


def glb_tris(path):
    b = open(path, "rb").read(); n = struct.unpack("<I", b[12:16])[0]; g = json.loads(b[20:20 + n])
    return sum(g["accessors"][p["indices"]]["count"] // 3 for m in g["meshes"] for p in m["primitives"])


def grid(n):
    ii, jj = np.meshgrid(np.arange(n), np.arange(n), indexing="ij"); a = (ii[:-1, :-1] * n + jj[:-1, :-1]).ravel()
    return np.stack([a, a + n, a + 1, a + 1, a + n, a + n + 1], 1)


# ------------------------------------------------------------------------------------------------ stages
def st_prompts(a):
    k = rgb(a.key, (64, 36)); pal = k.reshape(-1, 3); top, bot = lum(k[:12]).mean(), lum(k[-12:]).mean()
    out = os.path.join(a.work, "prompts.json")
    if a.prompts:  # caller-provided prompt sheet (e.g. a zone's sky12 prompts) - validated by imagine_auto
        d = json.load(open(a.prompts))
    else:
        hexes = ["#%02x%02x%02x" % tuple(int(v) for v in np.percentile(pal, q, axis=0)) for q in (10, 50, 90)]
        lock = f"Same world, light and palette as the reference key image ({', '.join(hexes)}); photographic, no text, no people."
        sl = [{"slot": f"sky-S{i:02d}", "aspect": "16:9", "refs": [os.path.abspath(a.key)],
               "prompt": f"Sky only, heading {i*30} deg (30 deg step, 35 deg coverage), horizon at the bottom tenth, seamless with its neighbours. {lock}"} for i in range(12)]
        sl += [{"slot": f"ground-{c}", "aspect": "1:1", "refs": [os.path.abspath(a.key)],
                "prompt": f"Top-down seamless tileable ground texture, material {c} of the key image's ground, flat even light. {lock}"} for c in ("a", "b")]
        import spec_sheet
        sh = spec_sheet.sheet(a.key, a.work, offline=os.environ.get("GOLDEN_MASKS") == "offline")
        sl += spec_sheet.prompts_for(sh)
        d = {"zone": a.zone, "slots": sl}
    json.dump(d, open(out, "w"), indent=1)
    n = len(d.get("slots", []))
    return gate(a.work, "prompts", [chk("slots", n, ">=3", n >= 3), chk("keyTopBrighterThanBottom", round(float(top - bot), 1), "info", True)])


def st_sky(a):
    P = plates(a.work, "sky-")
    if len(P) < 4: return gate(a.work, "sky", [chk("skyPlates", len(P), ">=4", False)])
    H = 128; ims = [rgb(p, (int(H * 16 / 9), H)) for p in P]; W = ims[0].shape[1]; ov = W // 8
    seams = []
    for i in range(len(ims)):
        A, B = ims[i], ims[(i + 1) % len(ims)]
        seams.append(round(float(np.abs(A[:, -ov:].mean((0, 1)) - B[:, :ov].mean((0, 1))).mean() + np.abs(lum(A[:, -ov:]).mean(1) - lum(B[:, :ov]).mean(1)).mean()), 2))
    ramp = np.linspace(0, 1, ov, dtype=np.float32)[None, :, None]; strip = ims[0][:, :W - ov].copy(); parts = [strip]
    for i in range(1, len(ims) + 1):
        prev, cur = ims[i - 1], ims[i % len(ims)]
        parts.append(prev[:, W - ov:] * (1 - ramp) + cur[:, :ov] * ramp)
        if i < len(ims): parts.append(cur[:, ov:W - ov])
    ring = np.concatenate(parts, 1)
    eq = np.asarray(Image.fromarray(ring.clip(0, 255).astype(np.uint8)).resize((2048, 512), Image.LANCZOS)).astype(np.float32)
    cap = np.repeat(eq[:1], 256, 0) * 0.98; fl = np.repeat(eq[-1:], 256, 0) * 0.6
    full = np.concatenate([cap, eq, fl], 0).clip(0, 255).astype(np.uint8)
    os.makedirs(os.path.join(a.work, "sky"), exist_ok=True); Image.fromarray(full).save(os.path.join(a.work, "sky", "equirect.jpg"), quality=90)
    worst = int(np.argmax(seams)); grad = [float(lum(im[: H // 3]).mean() - lum(im[-H // 3:]).mean()) for im in ims]
    darkTop = [os.path.basename(P[i]) for i, g in enumerate(grad) if g < -8]
    return gate(a.work, "sky", [chk("plates", len(P), ">=4", True),
                                chk("worstSeam", seams[worst], BUDGET["skySeamMax"], seams[worst] <= BUDGET["skySeamMax"],
                                    f"{os.path.basename(P[worst])}|{os.path.basename(P[(worst+1)%len(P)])}"),
                                chk("topBrighterThanBottom", len(darkTop), 0, not darkTop, ",".join(darkTop) or None)], {"seams": seams})


def st_ground(a):
    P = plates(a.work, "ground-")
    if not P: return gate(a.work, "ground", [chk("groundPlates", 0, ">=1", False)])
    key = rgb(a.key, (256, 144)); kl = float(lum(key[-48:]).mean()); od = os.path.join(a.work, "ground"); os.makedirs(od, exist_ok=True)
    C = [chk("groundPlates", len(P), ">=1", True)]
    for p in P:
        t = rgb(p, (512, 512)); n = 512; h = n // 2
        s = np.roll(np.roll(t, h, 0), h, 1)  # offset copy: its seams are in the middle; blend with a centre-weighted mask
        y = np.abs(np.linspace(-1, 1, n))[:, None]; x = np.abs(np.linspace(-1, 1, n))[None, :]; w = (np.maximum(x, y) ** 3)[..., None]
        tile = t * (1 - w) + s * w
        edge = float(np.abs(tile[:, 0] - tile[:, -1]).mean() + np.abs(tile[0] - tile[-1]).mean()) / 2
        inner = float(np.abs(np.diff(tile[:, h - 64:h + 64], axis=1)).mean()) + 0.5  # natural neighbour-pixel step
        seam = edge / inner  # wrap edge vs an ordinary interior step: 1 = invisible
        name = os.path.splitext(os.path.basename(p))[0]; Image.fromarray(tile.clip(0, 255).astype(np.uint8)).save(os.path.join(od, name + ".png"))
        dl = abs(float(lum(t).mean()) - kl)
        C += [chk(f"{name}.tileSeam", round(seam, 2), BUDGET["groundTileSeamMax"], seam <= BUDGET["groundTileSeamMax"], name),
              chk(f"{name}.keyDeltaL", round(dl, 1), BUDGET["groundKeyDeltaLMax"], dl <= BUDGET["groundKeyDeltaLMax"], name)]
    return gate(a.work, "ground", C)


def st_terrain(a):
    """tools/terrain-from-key/generic.py (masks from the key: MoGe-2 + SAM2, colour-cluster offline) -> terrain.glb."""
    import subprocess
    tk = os.path.join(a.work, "terrain-key"); cfg = os.path.join(a.work, "terrain-key.json")
    json.dump({"zone": a.zone, "mask": {"method": "auto", "fovDeg": 48, "eyeM": 2.6}}, open(cfg, "w"))
    r = subprocess.run([sys.executable, os.path.join(REPO, "tools", "terrain-from-key", "generic.py"), "--config", cfg, "--key", a.key, "--out", tk]
                       + (["--offline"] if os.environ.get("GOLDEN_MASKS") == "offline" else []), capture_output=True, text=True)
    print("   " + (r.stdout.strip().splitlines() or ["(no output)"])[-1])
    if r.returncode != 0:
        g = json.load(open(os.path.join(tk, "gates.json"))) if os.path.exists(os.path.join(tk, "gates.json")) else {"checks": {}}
        return gate(a.work, "terrain", [chk(f"terrain-from-key.{k}", c["value"], c["limit"], c["pass"]) for k, c in g["checks"].items()] or [chk("terrain-from-key", r.returncode, 0, False)])
    hj = json.load(open(os.path.join(tk, "data", "height.json"))); n = hj["nx"]; S = hj["step"] * (n - 1)
    Hh = np.fromfile(os.path.join(tk, "data", "height.bin"), np.float32).reshape(hj["nz"], n).astype(np.float64)
    xs = np.linspace(-S / 2, S / 2, n); X, Z = np.meshgrid(xs, xs)
    rim = np.array([json.load(open(os.path.join(tk, "gates.json")))["checks"]["rimMin_m"]["value"]])
    od = os.path.join(a.work, "terrain"); os.makedirs(od, exist_ok=True)
    pos = np.stack([X.ravel(), Hh.ravel(), Z.ravel()], 1); uv = np.stack([(X.ravel() + S / 2) / 8, (Z.ravel() + S / 2) / 8], 1)
    tex = plates(a.work, "ground-") and os.path.join(a.work, "ground", os.path.splitext(os.path.basename(plates(a.work, 'ground-')[0]))[0] + ".png")
    if not tex or not os.path.exists(tex):
        tex = os.path.join(od, "flat.png"); Image.new("RGB", (8, 8), (128, 128, 128)).save(tex)
    tris = write_glb(os.path.join(od, "terrain.glb"), pos, uv, grid(n), tex)
    json.dump({"size_m": S, "n": n, "heights": np.round(Hh, 2).tolist()}, open(os.path.join(od, "heights.json"), "w"))
    spine = Hh[np.abs(xs) < 150][:, np.abs(xs) < 10];  # play disc (r<150 m) along the spine
    slope = float(np.abs(np.diff(spine, axis=0)).max() / (S / (n - 1)))
    rmin = float(rim.min())
    return gate(a.work, "terrain", [chk("finite", bool(np.isfinite(Hh).all()), True, np.isfinite(Hh).all()),
                                    chk("rimMin_m", round(rmin, 1), ">=40", rmin >= 40), chk("reliefRange_m", round(float(Hh.max() - Hh.min()), 1), ">=20", Hh.max() - Hh.min() >= 20),
                                    chk("spineSlope", round(slope, 3), "<=0.3", slope <= 0.3), chk("groundTris", tris, BUDGET["groundTrisMax"], tris <= BUDGET["groundTrisMax"])], {"tris": tris})


def st_objects(a):
    """Every object of the spec sheet -> tools/imagine-to-3d/auto.py --method golden-hull (carved hull + offline
    oblique-profile / triangle-quality / untextured-area / budget gates, fix-ledger + one retry, render sheet)."""
    import spec_sheet, subprocess
    od = os.path.join(a.work, "objects"); os.makedirs(od, exist_ok=True)
    sp = os.path.join(a.work, "spec-sheet.json")
    if not os.path.exists(sp): spec_sheet.sheet(a.key, a.work, offline=os.environ.get("GOLDEN_MASKS") == "offline")
    sh = json.load(open(sp)); C, objs = [], []
    # plate-driven objects: obj-<id>-front plates the sheet does not list (caller-provided prompts / seeded plates)
    known = {o["plates"]["front"] for o in sh["objects"]}
    for p in plates(a.work, "obj-"):
        st = os.path.splitext(os.path.basename(p))[0]
        if st.endswith("-front") and st not in known:
            oid = st[4:-6]; crop = p
            sh["objects"].append({"id": oid, "type": "prop", "heightM": 12.0, "crop": crop, "budgetTris": 25000, "source": "plates",
                                  "plates": {"front": st, "side": f"obj-{oid}-side"}})
    if os.environ.get("GOLDEN_OBJECTS_FROM") == "plates":
        sh["objects"] = [o for o in sh["objects"] if spec_sheet.auto_spec(o, os.path.join(a.work, "plates"), a.work)["imagine"]["views"]["front"]]
    if not sh["objects"]: return gate(a.work, "objects", [chk("specSheetObjects", 0, ">=1", False)])
    auto = os.path.join(REPO, "tools", "imagine-to-3d", "auto.py"); ad = os.path.join(a.work, "art-director"); os.makedirs(ad, exist_ok=True)
    for o in sh["objects"]:
        spec = spec_sheet.auto_spec(o, os.path.join(a.work, "plates"), a.work)
        if os.environ.get("GOLDEN_HOOKS"): spec["_testHooks"] = json.loads(os.environ["GOLDEN_HOOKS"]).get(o["id"], {})
        if os.environ.get("GOLDEN_RETRIES"): spec["retries"] = int(os.environ["GOLDEN_RETRIES"])
        if not spec["imagine"]["views"]["front"]:
            C.append(chk(f"{o['id']}.plates", "missing", "front plate", False, o["plates"]["front"])); continue
        sp_o = os.path.join(a.work, "specs", o["id"] + ".json"); os.makedirs(os.path.dirname(sp_o), exist_ok=True); json.dump(spec, open(sp_o, "w"), indent=1)
        r = subprocess.run([sys.executable, auto, "run", sp_o, "--method", "golden-hull"], capture_output=True, text=True)
        print(r.stdout.strip()[-600:])
        res = json.load(open(os.path.join(spec["work"], "result.json"))) if os.path.exists(os.path.join(spec["work"], "result.json")) else {"verdict": "ERROR", "attempts": []}
        last = res["attempts"][-1]["rows"] if res.get("attempts") else {}
        for k, row in last.items(): C.append(chk(f"{o['id']}.{k}", row["value"], row["limit"], row["pass"], o["id"]))
        C.append(chk(f"{o['id']}.attempts", len(res.get("attempts", [])), "<=2", r.returncode == 0, o["id"]))
        if r.returncode == 0:
            rel = os.path.relpath(res["glb"], a.work)
            shutil_copy(res["artDirector"]["sheet"], os.path.join(ad, o["id"] + ".jpg"))
            objs.append({"id": o["id"], "glb": rel, "tris": res["tris"], "kind": "golden-hull", "height_m": o["heightM"], "type": o["type"], "artDirector": "pending"})
    json.dump({"objects": objs}, open(os.path.join(od, "objects.json"), "w"), indent=1)
    sheets = [os.path.join(ad, f) for f in sorted(os.listdir(ad)) if f.endswith(".jpg") and f != "render-sheet.jpg"]
    if sheets:
        ims = [Image.open(p) for p in sheets]; W = max(i.width for i in ims); S = Image.new("RGB", (W, sum(i.height for i in ims)))
        y = 0
        for i in ims: S.paste(i, (0, y)); y += i.height
        S.save(os.path.join(ad, "render-sheet.jpg"), quality=88)
    return gate(a.work, "objects", C, {"artDirector": {"status": "pending-art-director", "sheet": "art-director/render-sheet.jpg"}})


def shutil_copy(a_, b_):
    import shutil; shutil.copyfile(a_, b_)


def st_placement(a):
    O = json.load(open(os.path.join(a.work, "objects", "objects.json")))["objects"]
    H = json.load(open(os.path.join(a.work, "terrain", "heights.json"))); hh = np.array(H["heights"]); S = H["size_m"]; n = H["n"]
    k = lum(rgb(a.key, (64, 36))); sal = np.abs(k - k.mean()).sum(0); col = int(np.argmax(sal))  # most salient key column
    P, C = [], []
    sheet = {o["id"]: o for o in (json.load(open(os.path.join(a.work, "spec-sheet.json")))["objects"] if os.path.exists(os.path.join(a.work, "spec-sheet.json")) else [])}
    lane = BUDGET["laneClearM"] + BUDGET["cameraMarginM"]
    for i, o in enumerate(O):
        so = sheet.get(o["id"])
        if so:  # where the key shows it: azimuth from the crop centre (fov 48), distance from the key camera solve
            az = math.radians((0.5 * (so["boxFrac"][0] + so["boxFrac"][2]) - 0.5) * 48); r = float(np.clip(so.get("distanceM", 80), 40, 140))
        else:
            az = math.radians(-35 + 70 * col / 63 + i * 40); r = 60 + 25 * i
        rad = max(6.0, 0.35 * float(o.get("height_m", 12)))
        x, z = r * math.sin(az), -r * math.cos(az)
        if abs(x) < rad + lane: x = math.copysign(rad + lane + 0.5, x if x else (1 if i % 2 else -1))  # keep the spine lane clear
        for _ in range(20):  # two objects never share a footprint: step the newcomer back along the view ray
            if all(math.dist((x, z), (q["position"][0], q["position"][2])) > rad + q["radius_m"] + 1 for q in P): break
            z -= rad + 2
        gi = int(round((z + S / 2) / S * (n - 1))); gj = int(round((x + S / 2) / S * (n - 1)))
        P.append({"id": o["id"], "position": [round(x, 2), round(float(hh[gi, gj]) - 0.15, 2), round(z, 2)], "radius_m": round(rad, 2)})
    for i, p in enumerate(P):
        d_sp = abs(p["position"][0]) - p["radius_m"]; C.append(chk(f"{p['id']}.laneClear_m", round(d_sp, 2), f">={lane} or off-spine", d_sp >= lane or abs(p["position"][2]) > 300, p["id"]))
        for q in P[i + 1:]:
            d = math.dist(p["position"][::2], q["position"][::2]); C.append(chk(f"{p['id']}~{q['id']}.gap_m", round(d, 2), ">radii", d > p["radius_m"] + q["radius_m"]))
        inside = max(abs(p["position"][0]), abs(p["position"][2])) < S / 2; C.append(chk(f"{p['id']}.insideTerrain", inside, True, inside))
    os.makedirs(os.path.join(a.work, "placement"), exist_ok=True); json.dump({"placements": P}, open(os.path.join(a.work, "placement", "placement.json"), "w"), indent=1)
    return gate(a.work, "placement", C or [chk("objects", 0, ">=1", False)])


def st_gate(a):
    C = []
    for s in ("sky", "ground", "terrain", "objects", "placement"):
        g = os.path.join(a.work, "gates", s + ".json"); v = json.load(open(g))["verdict"] if os.path.exists(g) else "MISSING"
        C.append(chk(f"{s}.verdict", v, "PASS", v == "PASS"))
    tris = glb_tris(os.path.join(a.work, "terrain", "terrain.glb")) + sum(glb_tris(os.path.join(a.work, o["glb"])) for o in json.load(open(os.path.join(a.work, "objects", "objects.json")))["objects"])
    mb = sum(os.path.getsize(os.path.join(r, f)) for d in ("sky", "ground", "objects", "terrain") for r, _, fs in os.walk(os.path.join(a.work, d)) for f in fs) / 1e6
    C += [chk("frameTris", tris, BUDGET["frameTrisMax"], tris <= BUDGET["frameTrisMax"]), chk("assetsMB", round(mb, 2), BUDGET["texturesMBMax"], mb <= BUDGET["texturesMBMax"])]
    for p in [os.path.join(a.work, "terrain", "terrain.glb")] + [os.path.join(a.work, o["glb"]) for o in json.load(open(os.path.join(a.work, "objects", "objects.json")))["objects"]]:
        b = open(p, "rb").read(4); C.append(chk(f"{os.path.basename(p)}.glbMagic", b == b"glTF", True, b == b"glTF"))
    return gate(a.work, "gate", C, {"frameTris": tris, "assetsMB": round(mb, 2)})


def st_worldgraph(a):
    P = {p["id"]: p for p in json.load(open(os.path.join(a.work, "placement", "placement.json")))["placements"]}
    O = json.load(open(os.path.join(a.work, "objects", "objects.json")))["objects"]
    z = {"schema": "zone.v1", "version": "1.0", "id": a.zone, "keyImage": os.path.basename(a.key),
         "keyCamera": {"fov": 48, "position": [0, 2.6, 4.5], "target": [0, 2, -10]}, "biome": {"id": a.zone},
         "lighting": {"sun": {"intensity": 1}, "fog": {}, "halo": {}},
         "sky": {"equirect": "sky/equirect.jpg"}, "terrain": {"glb": "terrain/terrain.glb", "heights": "terrain/heights.json"},
         "ground": {"layers": sorted(f"ground/{f}" for f in os.listdir(os.path.join(a.work, "ground")))},
         "objects": [{"id": o["id"], "asset": {"glb": o["glb"], "lods": []}, "sources": [f"plates/{o['id']}"], "cameras": [],
                      "transform": {"position": P[o["id"]]["position"], "rotationDeg": 0, "scale": 1}, "fidelity": {"kind": o["kind"]},
                      "wake": {"type": "placeholder", "enabled": False}} for o in O],
         "gameplay": {"spawn": [0, 0, 0]}, "qualityGates": {s: json.load(open(os.path.join(a.work, "gates", s + ".json")))["verdict"] for s in ("sky", "ground", "terrain", "objects", "placement", "gate")},
         "todo": ["Art Director verdict on art-director/render-sheet.jpg (pending, never auto-approved)", "objects are carved two-view hulls (golden-hull): no LOD chain / KTX2 yet"],
         "wakeDefaults": {"type": "placeholder", "enabled": False}, "runtime": {"biome": {}, "layout": {}, "groundDetail": {}}}
    json.dump(z, open(os.path.join(a.work, "zone.json"), "w"), indent=1)
    missing = [f for f in [z["sky"]["equirect"], z["terrain"]["glb"]] + [o["asset"]["glb"] for o in z["objects"]] if not os.path.exists(os.path.join(a.work, f))]
    return gate(a.work, "worldgraph", [chk("schema", z["schema"], "zone.v1", True), chk("objects", len(z["objects"]), ">=1", len(z["objects"]) >= 1),
                                       chk("assetsResolve", len(missing), 0, not missing, ",".join(missing) or None)])


PLAY = """<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>%ZONE%</title>
<style>body{margin:0;overflow:hidden;background:#000}</style>
<script type=importmap>{"imports":{"three":"https://unpkg.com/three@0.160.0/build/three.module.js","three/addons/":"https://unpkg.com/three@0.160.0/examples/jsm/"}}</script>
<script type=module>
import * as THREE from 'three'; import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const z = await (await fetch('zone.json')).json();
const r = new THREE.WebGLRenderer({antialias:true}); r.setPixelRatio(Math.min(devicePixelRatio,1.5)); r.setSize(innerWidth,innerHeight); document.body.appendChild(r.domElement);
const s = new THREE.Scene(), cam = new THREE.PerspectiveCamera(48, innerWidth/innerHeight, 0.1, 3000);
s.add(new THREE.HemisphereLight(0xffffff,0x334455,2));
const sky = new THREE.TextureLoader().load(z.sky.equirect); sky.mapping = THREE.EquirectangularReflectionMapping; sky.colorSpace = THREE.SRGBColorSpace; s.background = sky;
const L = new GLTFLoader(); L.load(z.terrain.glb, g => { g.scene.traverse(o=>{ if(o.material&&o.material.map){o.material.map.wrapS=o.material.map.wrapT=THREE.RepeatWrapping;}}); s.add(g.scene); });
for (const o of z.objects) L.load(o.asset.glb, g => { g.scene.position.fromArray(o.transform.position); g.scene.lookAt(0, o.transform.position[1], 0); s.add(g.scene); });
let t=0, keys={}; onkeydown=e=>keys[e.key]=1; onkeyup=e=>keys[e.key]=0; let yaw=0, pz=0;
addEventListener('pointermove', e=>{ if(e.buttons) yaw -= e.movementX*0.005; });
(function f(){ requestAnimationFrame(f); if(keys.ArrowUp||keys.w) pz-=0.3; if(keys.ArrowDown||keys.s) pz+=0.3; if(keys.ArrowLeft) yaw+=0.02; if(keys.ArrowRight) yaw-=0.02;
 cam.position.set(Math.sin(yaw)*4.5, 2.6, pz+Math.cos(yaw)*4.5); cam.lookAt(0,2,pz-10); r.render(s,cam); })();
</script>"""


def st_play(a):
    open(os.path.join(a.work, "index.html"), "w").write(PLAY.replace("%ZONE%", a.zone))
    url = f"http://localhost:{a.port}/index.html"; open(os.path.join(a.work, "PLAY_URL.txt"), "w").write(url + "\n")
    print(f"[play] serve: python3 -m http.server {a.port} -d {a.work}  ->  {url}")
    return gate(a.work, "play", [chk("index", True, True, True)], {"url": url})


def st_artdirector(a):
    """Final gate: the Art Director judges art-director/render-sheet.jpg. Never auto-approved: without a recorded
    verdict (art-director/verdict.json {"verdict": "KEEP"|"FAIL", "notes": ...}) the world is built but PENDING."""
    ad = os.path.join(a.work, "art-director"); vp = os.path.join(ad, "verdict.json"); sheet = os.path.join(ad, "render-sheet.jpg")
    v = json.load(open(vp)).get("verdict") if os.path.exists(vp) else "PENDING"
    d = {"stage": "artdirector", "verdict": {"KEEP": "PASS", "FAIL": "FAIL"}.get(v, "PENDING"), "sheet": sheet if os.path.exists(sheet) else None,
         "checks": [chk("artDirectorVerdict", v, "KEEP", v == "KEEP")]}
    json.dump(d, open(os.path.join(a.work, "gates", "artdirector.json"), "w"), indent=1)
    print(f"[artdirector] {d['verdict']}" + (f" - render sheet for the Art Director: {sheet}" if v == "PENDING" else ""))
    return 1 if v == "FAIL" else 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("stage"); ap.add_argument("--work", required=True); ap.add_argument("--key", required=True)
    ap.add_argument("--zone", required=True); ap.add_argument("--prompts"); ap.add_argument("--port", type=int, default=8790); a = ap.parse_args()
    if not os.path.isfile(a.key): print(f"bad key image: {a.key}", file=sys.stderr); sys.exit(2)
    try: Image.open(a.key).verify()
    except Exception: print(f"key is not an image: {a.key}", file=sys.stderr); sys.exit(2)
    fn = globals().get("st_" + a.stage)
    if not fn: print(f"unknown stage {a.stage}", file=sys.stderr); sys.exit(2)
    sys.exit(fn(a))
