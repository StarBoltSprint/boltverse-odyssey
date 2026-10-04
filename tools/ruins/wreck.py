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


def find_plate_rect(lum):
    """A mid-tone window of the same plate. Empty margin and holes are rejected.

    A few dark panel marks are allowed. A window that is mostly empty is not.
    """
    import numpy as np

    height, width = lum.shape
    sizes = ((320, 160), (256, 128), (192, 96), (128, 64), (96, 48))
    for rw, rh in sizes:
        if rw >= width or rh >= height:
            continue
        step = 16
        for y in range(0, height - rh, step):
            band = lum[y : y + rh]
            for x in range(0, width - rw, step):
                win = band[:, x : x + rw]
                if float(win[::4, ::4].mean()) < 45:
                    continue
                if float((win < 20).mean()) > 0.02:
                    continue
                if float(np.percentile(win, 5)) < 28:
                    continue
                mean = float(win.mean())
                if mean < 50 or mean > 175:
                    continue
                return (x, y, rw, rh)
    return None


def retile_black(mesh, image_path, tpm):
    """Faces that land in the empty margin get new vertices.

    UVs tile a mid-tone rect of this same plate at its native texel rate.
    Shared vertices of faces that already hit the plate are left alone, so a
    painted face is not drawn twice and is not stretched.
    """
    width, height, lum, _arr = load_rgb(image_path)
    rect = find_plate_rect(lum)
    xyz = mesh.xyzuv
    idx = mesh.idx
    tris = len(idx) // 3
    if rect is None or tris == 0 or tpm <= 0:
        return {"tris": tris, "dark": 0, "left": tris, "rect": None}

    def sample(u, v):
        px = int(min(width - 1, max(0, round(u * (width - 1)))))
        py = int(min(height - 1, max(0, round((1.0 - v) * (height - 1)))))
        return float(lum[py, px])

    dark = []
    for t in range(0, len(idx), 3):
        us, vs = [], []
        for k in range(3):
            i = idx[t + k] * 5
            us.append(xyz[i + 3])
            vs.append(xyz[i + 4])
        cu, cv = sum(us) / 3.0, sum(vs) / 3.0
        samples = [sample(cu, cv)]
        for k in range(3):
            samples.append(sample(us[k], vs[k]))
            samples.append(sample((us[k] + cu) * 0.5, (vs[k] + cv) * 0.5))
        if sample(cu, cv) < 12.0 or sum(1 for s in samples if s < 12.0) >= 3:
            dark.append(t)
    if not dark:
        return {"tris": tris, "dark": 0, "left": 0, "rect": list(rect)}

    rx, ry, rw, rh = rect
    inner_w = max(1.0, float(rw - 4))
    inner_h = max(1.0, float(rh - 4))

    def mode_of(i0, i1, i2):
        ax, ay, az = xyz[i0 * 5], xyz[i0 * 5 + 1], xyz[i0 * 5 + 2]
        bx, by, bz = xyz[i1 * 5], xyz[i1 * 5 + 1], xyz[i1 * 5 + 2]
        cx, cy, cz = xyz[i2 * 5], xyz[i2 * 5 + 1], xyz[i2 * 5 + 2]
        ux, uy, uz = bx - ax, by - ay, bz - az
        vx, vy, vz = cx - ax, cy - ay, cz - az
        nx = abs(uy * vz - uz * vy)
        ny = abs(uz * vx - ux * vz)
        nz = abs(ux * vy - uy * vx)
        if nz >= nx and nz >= ny:
            return 0
        if ny >= nx:
            return 1
        return 2

    def metres(i, mode):
        x, y, z = xyz[i * 5], xyz[i * 5 + 1], xyz[i * 5 + 2]
        if mode == 0:
            return x, y
        if mode == 1:
            return x, z
        return z, y

    def span_ok(i0, i1, i2, mode):
        ums, vms = zip(*(metres(i, mode) for i in (i0, i1, i2)))
        return (max(ums) - min(ums)) * tpm <= inner_w - 1 and (max(vms) - min(vms)) * tpm <= inner_h - 1

    def midpoint(a, b):
        xyz.extend((
            (xyz[a * 5] + xyz[b * 5]) * 0.5,
            (xyz[a * 5 + 1] + xyz[b * 5 + 1]) * 0.5,
            (xyz[a * 5 + 2] + xyz[b * 5 + 2]) * 0.5,
            0.0,
            0.0,
        ))
        return len(xyz) // 5 - 1

    produced = []
    stack = [(idx[t], idx[t + 1], idx[t + 2], 0) for t in dark]
    while stack:
        i0, i1, i2, depth = stack.pop()
        mode = mode_of(i0, i1, i2)
        if depth >= 6 or span_ok(i0, i1, i2, mode):
            produced.append((i0, i1, i2, mode))
            continue
        m01, m12, m20 = midpoint(i0, i1), midpoint(i1, i2), midpoint(i2, i0)
        stack.append((i0, m01, m20, depth + 1))
        stack.append((m01, i1, m12, depth + 1))
        stack.append((m20, m12, i2, depth + 1))
        stack.append((m01, m12, m20, depth + 1))

    # The first written tri reuses each dark slot. Further pieces are new tris.
    write_at = list(dark)
    extra_idx = []
    for n, (i0, i1, i2, mode) in enumerate(produced):
        ums, vms = zip(*(metres(i, mode) for i in (i0, i1, i2)))
        min_u, max_u = min(ums), max(ums)
        min_v, max_v = min(vms), max(vms)
        span_u = (max_u - min_u) * tpm
        span_v = (max_v - min_v) * tpm
        phase_u = (min_u * tpm) % inner_w
        phase_v = (min_v * tpm) % inner_h
        if phase_u + span_u > inner_w:
            phase_u = 0.0
        if phase_v + span_v > inner_h:
            phase_v = 0.0
        ids = []
        for i, um, vm in zip((i0, i1, i2), ums, vms):
            px = rx + 2.0 + phase_u + (um - min_u) * tpm
            py = ry + 2.0 + phase_v + (vm - min_v) * tpm
            u = px / max(1, width - 1)
            v = 1.0 - py / max(1, height - 1)
            xyz.extend((xyz[i * 5], xyz[i * 5 + 1], xyz[i * 5 + 2], u, v))
            ids.append(len(xyz) // 5 - 1)
        if n < len(write_at):
            at = write_at[n]
            idx[at], idx[at + 1], idx[at + 2] = ids
        else:
            extra_idx.extend(ids)
    idx.extend(extra_idx)

    left = 0
    for t in range(0, len(idx), 3):
        us, vs = [], []
        for k in range(3):
            i = idx[t + k] * 5
            us.append(xyz[i + 3])
            vs.append(xyz[i + 4])
        cu, cv = sum(us) / 3.0, sum(vs) / 3.0
        if sample(cu, cv) < 12.0:
            left += 1
    return {"tris": tris, "dark": len(dark), "left": left, "rect": [rx, ry, rw, rh]}


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
    contact_y = 0.0

    # Hangar opening in the baked frame: the port ring samples nearest the hole's sill and lintel
    # on every hole station (same rings as the loft, NU x NS). Measure only, no new faces.
    nu, ns = 84, 64
    u0, u1, s0, s1 = [float(v) for v in report["hole"][:4]]

    def bake(v):
        x, y, z = v
        return ((x * cp - y * sp) * scale, (x * sp + y * cp) * scale - y0, z * scale)

    sills, lintels = [], []
    for i in range(int(math.ceil(u0 * (nu - 1))), int(math.floor(u1 * (nu - 1))) + 1):
        ring = verts[i * ns:(i + 1) * ns]
        lo = min(v[1] for v in ring)
        hi = max(v[1] for v in ring)
        port = [v for v in ring if v[2] > 0]
        if not port or hi - lo < 1e-6:
            continue
        sill = min(port, key=lambda v: abs((v[1] - lo) / (hi - lo) - s0))
        lintel = min(port, key=lambda v: abs((v[1] - lo) / (hi - lo) - s1))
        sills.append(bake(sill))
        lintels.append(bake(lintel))
    hangar = None
    if sills:
        mid = sills[len(sills) // 2]
        hangar = {
            "x": [round(min(p[0] for p in sills), 3), round(max(p[0] for p in sills), 3)],
            "sillY": [round(min(p[1] for p in sills), 3), round(max(p[1] for p in sills), 3)],
            "lintelY": [round(min(p[1] for p in lintels), 3), round(max(p[1] for p in lintels), 3)],
            "portZ": round(sum(p[2] for p in sills) / len(sills), 3),
            "clearM": round(min(t[1] - b[1] for t, b in zip(lintels, sills)), 3),
            "mid": [round(mid[0], 3), round(mid[1], 3), round(mid[2], 3)],
        }
        if numbers["wreck"].get("seat") == "sill":
            # Seat the hangar sill on the relief (minus sinkM), so Bolt walks in on the ground.
            contact = [mid[0], mid[2]]
            contact_y = mid[1]

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
    retiled = []
    for name, mesh in zip(order, baked):
        stat = retile_black(mesh, images / (name + ".jpg"), texels_per_m)
        stat["skin"] = name
        retiled.append(stat)
        print("wreck retile", name, stat["dark"], "of", stat["tris"], "left", stat["left"])
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
        "contactY": round(contact_y, 3),
        "seat": numbers["wreck"].get("seat", "lowest"),
        "hangar": hangar,
        "bounds": {
            "min": [round(min(xs2), 3), 0.0, round(min(zs2), 3)],
            "max": [round(max(xs2), 3), round(ymax2, 3), round(max(zs2), 3)],
        },
        "howlPass": True,
        "skinNacelles": report["skinNacelles"],
        "skinBells": report["skinBells"],
        "retile": retiled,
    }
    return baked, parts, info, [images / (name + ".jpg") for name in order]
