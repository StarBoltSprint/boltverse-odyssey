"""Bake the validated Howl loft into a seated wreck mesh. No new hull generator."""

import math
import subprocess
import sys
from pathlib import Path

from geom import Mesh, content_box, load_rgb, plate_mask

ROOT = Path(__file__).resolve().parents[2]
HOWL = ROOT / "tools" / "hard-objects"
LEN = 224.0


def ensure_howl():
    script = HOWL / "rebuild.py"
    proc = subprocess.run([sys.executable, str(script)], cwd=str(ROOT), capture_output=True, text=True)
    if proc.returncode != 0 or "PASS" not in proc.stdout:
        raise SystemExit("wreck: hard-objects rebuild failed\n" + proc.stderr[-500:])
    return HOWL / "out" / "frigate.obj", HOWL / "out" / "report.json"


def parse_obj(path):
    verts = []
    faces = []
    for line in path.read_text().splitlines():
        if line.startswith("v "):
            p = line.split()
            verts.append((float(p[1]), float(p[2]), float(p[3])))
        elif line.startswith("f "):
            faces.append(tuple(int(t.split("/")[0]) - 1 for t in line.split()[1:]))
    return verts, faces


def box_of(path):
    w, h, lum, _ = load_rgb(path)
    # These plates already pass the measure threshold of 16.
    stone, _ = __import__("geom").largest_mask(lum > 16)
    if int(stone.sum()) < 1000:
        stone, _, _ = plate_mask(lum)
    return (w, h, content_box(stone))


def build_wreck(numbers):
    obj_path, report_path = ensure_howl()
    import json

    report = json.loads(report_path.read_text())
    verts, faces = parse_obj(obj_path)
    images = HOWL / "images"
    skins = {
        "port": box_of(images / "port.jpg"),
        "stbd": box_of(images / "stbd.jpg"),
        "top": box_of(images / "top.jpg"),
        "belly": box_of(images / "belly.jpg"),
        "stern": box_of(images / "stern.jpg"),
    }
    xs = [v[0] for v in verts]
    ys = [v[1] for v in verts]
    zs = [v[2] for v in verts]
    xmin, xmax = min(xs), max(xs)
    ymin, ymax = min(ys), max(ys)
    zmin, zmax = min(zs), max(zs)

    def elev(x, y, key):
        iw, ih, (px0, py0, px1, py1) = skins[key]
        u = (px0 + (x - xmin) / max(1e-6, xmax - xmin) * (px1 - px0)) / max(1, iw - 1)
        img_y = py0 + (ymax - y) / max(1e-6, ymax - ymin) * (py1 - py0)
        v = 1.0 - img_y / max(1, ih - 1)
        return u, v

    def plan(x, z, key):
        iw, ih, (px0, py0, px1, py1) = skins[key]
        u = (px0 + (x - xmin) / max(1e-6, xmax - xmin) * (px1 - px0)) / max(1, iw - 1)
        img_y = py0 + (z - zmin) / max(1e-6, zmax - zmin) * (py1 - py0)
        v = 1.0 - img_y / max(1, ih - 1)
        return u, v

    def stern_uv(y, z):
        iw, ih, (px0, py0, px1, py1) = skins["stern"]
        # Viewer faces the stern: image right is starboard, which is -Z.
        img_x = px0 + (zmax - z) / max(1e-6, zmax - zmin) * (px1 - px0)
        img_y = py0 + (ymax - y) / max(1e-6, ymax - ymin) * (py1 - py0)
        return img_x / max(1, iw - 1), 1.0 - img_y / max(1, ih - 1)

    order = ("port", "stbd", "top", "belly", "stern")
    meshes = {name: Mesh(i) for i, name in enumerate(order)}
    for face in faces:
        pts = [verts[i] for i in face]
        a, b, c = pts[0], pts[1], pts[2]
        ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
        vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
        nx = uy * vz - uz * vy
        ny = uz * vx - ux * vz
        nz = ux * vy - uy * vx
        ax, ay, az = abs(nx), abs(ny), abs(nz)
        if ax >= ay and ax >= az:
            if nx >= 0:
                # Bow cap reuses the port plate's bow column. One skin, not a second part.
                uvs = [elev(p[0], p[1], "port") for p in pts]
                mesh = meshes["port"]
            else:
                uvs = [stern_uv(p[1], p[2]) for p in pts]
                mesh = meshes["stern"]
        elif ay >= az:
            key = "top" if ny >= 0 else "belly"
            uvs = [plan(p[0], p[2], key) for p in pts]
            mesh = meshes[key]
        else:
            key = "port" if nz >= 0 else "stbd"
            uvs = [elev(p[0], p[1], key) for p in pts]
            mesh = meshes[key]
        if len(pts) == 4:
            mesh.quad((
                (*pts[0], *uvs[0]),
                (*pts[1], *uvs[1]),
                (*pts[2], *uvs[2]),
                (*pts[3], *uvs[3]),
            ))
        elif len(pts) == 3:
            mesh.tri((*pts[0], *uvs[0]), (*pts[1], *uvs[1]), (*pts[2], *uvs[2]))

    length_m = float(numbers["wreck"]["lengthM"])
    scale = length_m / float(numbers["wreck"].get("howlLength", LEN))
    pitch = math.radians(float(numbers["wreck"]["pitchDeg"]))
    sp, cp = math.sin(pitch), math.cos(pitch)
    baked = []
    for name in order:
        mesh = meshes[name]
        out = Mesh(mesh.skin)
        arr = mesh.xyzuv
        for i in range(0, len(arr), 5):
            x, y, z, u, v = arr[i : i + 5]
            xr = (x * cp - y * sp) * scale
            yr = (x * sp + y * cp) * scale
            zr = z * scale
            out.xyzuv.extend((xr, yr, zr, u, v))
        out.idx = list(mesh.idx)
        baked.append(out)

    ys2 = []
    for mesh in baked:
        arr = mesh.xyzuv
        for i in range(1, len(arr), 5):
            ys2.append(arr[i])
    y0 = min(ys2) if ys2 else 0.0
    contact = [0.0, 0.0]
    ncontact = 0
    for mesh in baked:
        arr = mesh.xyzuv
        for i in range(0, len(arr), 5):
            arr[i + 1] -= y0
            if arr[i + 1] < 0.2:
                contact[0] += arr[i]
                contact[1] += arr[i + 2]
                ncontact += 1
    if ncontact:
        contact[0] /= ncontact
        contact[1] /= ncontact

    xs2, zs2, ymax2 = [], [], 0.0
    for mesh in baked:
        arr = mesh.xyzuv
        for i in range(0, len(arr), 5):
            xs2.append(arr[i])
            zs2.append(arr[i + 2])
            ymax2 = max(ymax2, arr[i + 1])
    # Texels along the length come from the port plate content width.
    _iw, _ih, (px0, _py0, px1, _py1) = skins["port"]
    texels = max(1.0, float(px1 - px0))
    texels_per_m = texels / length_m
    min_d = float(numbers["focalPx"]) / texels_per_m
    horiz = 0.0
    for mesh in baked:
        arr = mesh.xyzuv
        for i in range(0, len(arr), 5):
            horiz = max(horiz, math.hypot(arr[i], arr[i + 2]))
    parts = [
        {
            "id": "hull",
            "measure": "tools/hard-objects/images/measure/port.jpg",
            "spot": report["portBox"],
            "section": "tools/hard-objects/images/sec-mid.jpg",
            "skin": "port.jpg",
            "erasedFrom": "port.jpg",
            "inpaintCall": None,
            "note": "loft from the validated Howl rebuild; hangar gap stays a hole",
        },
        {
            "id": "hull-stbd",
            "measure": "tools/hard-objects/images/measure/stbd.jpg",
            "spot": report.get("skinPortBox"),
            "section": "tools/hard-objects/images/sec-shoulder.jpg",
            "skin": "stbd.jpg",
            "erasedFrom": None,
            "inpaintCall": None,
            "note": "starboard elevation of the same loft, read on its own plate",
        },
        {
            "id": "deck",
            "measure": "tools/hard-objects/images/measure/top.jpg",
            "spot": report["topBox"],
            "section": None,
            "skin": "top.jpg",
            "erasedFrom": "top.jpg",
            "inpaintCall": None,
            "note": "plan skin; nacelle pixels already absent on the sealed plate",
        },
        {
            "id": "belly",
            "measure": "tools/hard-objects/images/measure/belly.jpg",
            "spot": report.get("skinTopBox"),
            "section": None,
            "skin": "belly.jpg",
            "erasedFrom": "belly.jpg",
            "inpaintCall": None,
            "note": "underside of the same loft",
        },
        {
            "id": "stern-cap",
            "measure": "tools/hard-objects/images/measure/stern.jpg",
            "spot": None,
            "section": None,
            "skin": "stern.jpg",
            "erasedFrom": "stern.jpg",
            "inpaintCall": None,
            "note": "stern faces only; bells stay off this skin",
        },
        {
            "id": "nacelle-port",
            "measure": "tools/hard-objects/images/measure/top.jpg",
            "spot": report["nacelles"][0] if report.get("nacelles") else None,
            "section": "tools/hard-objects/images/nacelle.jpg",
            "skin": None,
            "erasedFrom": "top.jpg",
            "inpaintCall": None,
            "note": "measured once; not rebuilt here so it is not a second copy. skinNacelles is 0",
        },
        {
            "id": "nacelle-stbd",
            "measure": "tools/hard-objects/images/measure/top.jpg",
            "spot": report["nacelles"][1] if report.get("nacelles") and len(report["nacelles"]) > 1 else None,
            "section": "tools/hard-objects/images/nacelle.jpg",
            "skin": None,
            "erasedFrom": "top.jpg",
            "inpaintCall": None,
            "note": "measured once; not rebuilt here",
        },
        {
            "id": "hangar",
            "measure": "tools/hard-objects/images/measure/port.jpg",
            "spot": report["hole"],
            "section": None,
            "skin": None,
            "erasedFrom": "port.jpg",
            "inpaintCall": None,
            "note": "opening kept by the loft; no faces fill that gap",
        },
    ]
    info = {
        "faces": report["faces"],
        "verts": report["verts"],
        "hole": report["hole"],
        "lengthM": length_m,
        "heightM": round(ymax2, 3),
        "texelsPerM": round(texels_per_m, 2),
        "minApproachM": round(min_d, 3),
        "horizRadiusM": round(horiz, 3),
        "contact": [round(contact[0], 3), round(contact[1], 3)],
        "bounds": {
            "min": [round(min(xs2), 3), 0.0, round(min(zs2), 3)],
            "max": [round(max(xs2), 3), round(ymax2, 3), round(max(zs2), 3)],
        },
        "howlPass": True,
        "skinNacelles": report["skinNacelles"],
        "skinBells": report["skinBells"],
    }
    return baked, parts, info, [images / (name + ".jpg") for name in order]
