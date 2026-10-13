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
        sl += [{"slot": "obj-hero", "aspect": "1:1", "refs": [os.path.abspath(a.key)],
                "prompt": f"The key image's main landmark object alone, three-quarter view, plain flat background. {lock}"}]
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
    """Rim relief from the key skyline (zero Imagine images): sky/land boundary per column -> rim height per azimuth,
    mirrored to 360 deg; a flat spine corridor stays walkable. 129x129 grid over 600 m."""
    k = lum(rgb(a.key, (256, 144))); gy = np.abs(np.diff(k, axis=0))
    sky_row = np.argmax(gy[: int(144 * 0.85)], 0).astype(np.float32)  # strongest vertical edge per column = skyline
    prof = (144 * 0.85 - sky_row) / 144.0; prof = np.convolve(prof, np.ones(9) / 9, "same")
    ring = np.concatenate([prof, prof[::-1]]); n = 129; S = 600.0
    xs = np.linspace(-S / 2, S / 2, n); X, Z = np.meshgrid(xs, xs); R = np.hypot(X, Z); A = (np.arctan2(Z, X) + np.pi) / (2 * np.pi)
    rim = 40 + 160 * ring[(A * (len(ring) - 1)).astype(int)]
    Hh = np.where(R > 150, rim * np.clip((R - 150) / 120, 0, 1) ** 1.6, 0.0)
    Hh += 1.5 * np.sin(X / 23) * np.cos(Z / 31) * np.clip(np.abs(X) / 20 - 0.5, 0, 1)  # gentle swell, spine |x|<10 m stays flat
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
    P = plates(a.work, "obj-"); od = os.path.join(a.work, "objects"); os.makedirs(od, exist_ok=True)
    if not P: return gate(a.work, "objects", [chk("objectPlates", 0, ">=1", False)])
    C, objs = [], []
    for p in P:
        name = os.path.splitext(os.path.basename(p))[0]; im = rgb(p, (256, 256)); n = 96
        bg = np.median(np.concatenate([im[:6].reshape(-1, 3), im[-6:].reshape(-1, 3), im[:, :6].reshape(-1, 3), im[:, -6:].reshape(-1, 3)]), 0)
        small = rgb(p, (n, n)); mask = np.abs(small - bg).sum(2) > 40; cov = float(mask.mean())
        L = lum(small) / 255.0; ys, xs_ = np.mgrid[0:n, 0:n]
        sx = (xs_ / (n - 1) - 0.5) * 12; sy = (1 - ys / (n - 1)) * 12; depth = np.where(mask, 1.5 + 2.5 * L, 0.0)
        pos = np.stack([sx.ravel(), sy.ravel(), depth.ravel()], 1); uv = np.stack([xs_.ravel() / (n - 1), ys.ravel() / (n - 1)], 1)
        tri = grid(n); keep = mask.ravel()[tri].all(1); tri = tri[keep]
        texp = os.path.join(od, name + ".png"); Image.open(p).convert("RGB").save(texp)
        tris = write_glb(os.path.join(od, name + ".glb"), pos, uv, tri, texp) if len(tri) else 0
        objs.append({"id": name, "glb": f"objects/{name}.glb", "tris": tris, "coverage": round(cov, 3), "kind": "relief-proxy", "height_m": 12})
        C += [chk(f"{name}.coverage", round(cov, 3), "0.05..0.95", 0.05 <= cov <= 0.95, name),
              chk(f"{name}.tris", tris, BUDGET["objectTrisMax"], 0 < tris <= BUDGET["objectTrisMax"], name)]
    json.dump({"objects": objs}, open(os.path.join(od, "objects.json"), "w"), indent=1)
    return gate(a.work, "objects", C)


def st_placement(a):
    O = json.load(open(os.path.join(a.work, "objects", "objects.json")))["objects"]
    H = json.load(open(os.path.join(a.work, "terrain", "heights.json"))); hh = np.array(H["heights"]); S = H["size_m"]; n = H["n"]
    k = lum(rgb(a.key, (64, 36))); sal = np.abs(k - k.mean()).sum(0); col = int(np.argmax(sal))  # most salient key column
    P, C = [], []
    for i, o in enumerate(O):
        az = math.radians(-35 + 70 * col / 63 + i * 40); r = 60 + 25 * i; x, z = r * math.sin(az), -r * math.cos(az)
        gi = int(round((z + S / 2) / S * (n - 1))); gj = int(round((x + S / 2) / S * (n - 1)))
        P.append({"id": o["id"], "position": [round(x, 2), round(float(hh[gi, gj]) - 0.15, 2), round(z, 2)], "radius_m": 6.0})
    lane = BUDGET["laneClearM"] + BUDGET["cameraMarginM"]
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
         "todo": ["objects are relief proxies: run imagine-to-3d auto.py per object for full volume", "Art Director verdict on renders"],
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


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("stage"); ap.add_argument("--work", required=True); ap.add_argument("--key", required=True)
    ap.add_argument("--zone", required=True); ap.add_argument("--prompts"); ap.add_argument("--port", type=int, default=8790); a = ap.parse_args()
    if not os.path.isfile(a.key): print(f"bad key image: {a.key}", file=sys.stderr); sys.exit(2)
    try: Image.open(a.key).verify()
    except Exception: print(f"key is not an image: {a.key}", file=sys.stderr); sys.exit(2)
    fn = globals().get("st_" + a.stage)
    if not fn: print(f"unknown stage {a.stage}", file=sys.stderr); sys.exit(2)
    sys.exit(fn(a))
