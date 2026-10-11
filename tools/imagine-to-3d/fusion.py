"""Phase 1 fusion for the key-facing front facade only.

The vision volume stays. Relief on the front is one flat step per labelled
segment, in the same UV as the projected key. Depth Anything tilts the normal
inside each segment and does not move the border. No hard-surface grid.

UV: image row 0 is the top of the facade. Blender's glTF export flips V, so
the mesh stores v = (y - y0) / height (0 at the foot). The runtime loads the
atlas with flipY false, which matches that export. An asymmetric marker in
the selftest locks the pair.
"""
import json, os, time
import numpy as np
from PIL import Image, ImageDraw

import vision_build as VB

DA_ONNX = "/workspace/grokcli/models/depth_anything_v2_small.onnx"
FULL_KEY = VB.KEY
ATLAS = 640
# Quantised front planes (metres, +Z toward the key). Kept under the building
# profile cap of 8 offset planes. Negative is a cutter, not a proud plate.
PLANE_CM = (8, 38, 68, 98)
CHROME_CM = 48
DAMAGE_CM = -40
DA_AMP_M = 0.015
# Same luma gradient as checks/relief_align._edges. Percentile 86 (the scorer
# uses 92) so a window line still becomes a barrier, and the scorer's edges
# stay inside the 2 px tolerance of those barriers.
EDGE_PCTL = 86
EDGE_MIN_AREA = 16
# Minimum step so a painted border reads as a shading edge under the gate's
# p92 detector. The sign of the step comes from Depth Anything.
NEIGHBOUR_STEP_CM = 30.0


def face_uv_blender(x, y, x0, y0, y1):
    """UV written into Blender. The glTF exporter stores 1 - v."""
    h = max(1e-6, float(y1) - float(y0))
    return (float(x) - float(x0)) / h, (float(y) - float(y0)) / h


def gltf_v_from_blender(blender_v):
    return 1.0 - float(blender_v)


def image_v(y, y0, y1):
    """Row fraction of the atlas. 0 is the top of the facade (y1)."""
    h = max(1e-6, float(y1) - float(y0))
    return (float(y1) - float(y)) / h


def xy_from_image_uv(u, v, x0, y0, y1):
    h = max(1e-6, float(y1) - float(y0))
    return float(x0) + float(u) * h, float(y1) - float(v) * h


def marker_sample(flip_y, gltf_v, gltf_u, img):
    """Sample the way Three.js does. flipY true is the TextureLoader default and is the bug."""
    H, W = img.shape[:2]
    v = (1.0 - float(gltf_v)) if flip_y else float(gltf_v)
    row = int(np.clip(round(v * (H - 1)), 0, H - 1))
    col = int(np.clip(round(float(gltf_u) * (W - 1)), 0, W - 1))
    return img[row, col]


def vflip_marker():
    """Asymmetric corners. Top-left is not a mirror of any other corner."""
    img = np.zeros((32, 32, 3), np.uint8)
    img[0, 0] = (255, 40, 10)
    img[0, 31] = (255, 180, 20)
    img[31, 0] = (10, 40, 255)
    img[31, 31] = (0, 200, 70)
    # Top of the building -> blender v = 1 -> glTF v = 0 -> row 0 when flipY is false.
    top = marker_sample(False, 0.0, 0.0, img)
    bot = marker_sample(False, 1.0, 0.0, img)
    flipped = marker_sample(True, 0.0, 0.0, img)
    ok = (tuple(int(x) for x in top) == (255, 40, 10)
          and tuple(int(x) for x in bot) == (10, 40, 255)
          and tuple(int(x) for x in flipped) == (10, 40, 255)
          and not np.array_equal(img[0, 0], img[31, 31])
          and not np.array_equal(img[0, 31], img[31, 0]))
    return dict(ok=bool(ok), top=tuple(int(x) for x in top), bottom=tuple(int(x) for x in bot),
                flipYTrueReads=tuple(int(x) for x in flipped))


def _span(doc):
    xy = np.asarray(doc["silhouette"]["localXY_m"], np.float64)
    return float(xy[:, 0].min()), float(xy[:, 1].min()), float(xy[:, 1].max())


def _world_xy(doc, x, y):
    o = np.array(doc["placement"]["origin"], np.float64)
    r = np.array(doc["placement"]["right"], np.float64)
    u = np.array(doc["placement"]["up"], np.float64)
    return o + r * float(x) + u * float(y)


def rectify(doc, out_dir, atlas=ATLAS):
    """Homography from the key onto the facade UV. Records the matrix."""
    import cv2
    x0, y0, y1 = _span(doc)
    key = np.asarray(Image.open(FULL_KEY).convert("RGB"))
    _, MW, PM = VB.cam_mats()
    xy = np.asarray(doc["silhouette"]["localXY_m"], np.float64)
    src, dst = [], []
    # A plane is a homography. Sample the silhouette and a grid inside it.
    ys = np.linspace(y0 + 0.05, y1 - 0.05, 48)
    for y in ys:
        sl = VB._x_at(xy, float(y))
        if sl is None:
            continue
        for u in np.linspace(0.02, 0.98, 16):
            x = sl[0] + u * (sl[1] - sl[0])
            world = _world_xy(doc, x, y)
            px, py, z = VB.project(world, MW, PM)
            if z[0] <= 0.05:
                continue
            uu, vv = (x - x0) / (y1 - y0), image_v(y, y0, y1)
            src.append([float(px[0]), float(py[0])])
            dst.append([uu * (atlas - 1), vv * (atlas - 1)])
    src = np.asarray(src, np.float64)
    dst = np.asarray(dst, np.float64)
    H, inl = cv2.findHomography(src, dst, cv2.RANSAC, 2.0)
    if H is None:
        raise RuntimeError("front homography failed")
    rect = cv2.warpPerspective(key, H, (atlas, atlas), flags=cv2.INTER_LINEAR)
    # Silhouette mask in the same UV. Analysis may sit on this raster.
    # The texture bake does not use this upscale; it resamples the key.
    mask = np.zeros((atlas, atlas), np.uint8)
    for row in range(atlas):
        v = (row + 0.5) / atlas
        y = y1 - v * (y1 - y0)
        sl = VB._x_at(xy, float(y))
        if sl is None:
            continue
        u0 = (sl[0] - x0) / (y1 - y0)
        u1 = (sl[1] - x0) / (y1 - y0)
        c0 = int(np.clip(u0 * atlas, 0, atlas - 1))
        c1 = int(np.clip(u1 * atlas, 0, atlas - 1))
        if c1 > c0:
            mask[row, c0:c1] = 255
    rect[mask == 0] = 0
    Image.fromarray(rect).save(os.path.join(out_dir, "front-rectified.png"))
    Image.fromarray(mask).save(os.path.join(out_dir, "front-mask.png"))
    # Facade strip only, for the Imagine edit source (native key pixels, nearest).
    ys, xs = np.where(mask > 0)
    crop = rect[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    crop_path = os.path.join(out_dir, "front-rectified.jpg")
    Image.fromarray(crop).save(crop_path, quality=92)
    meta = {
        "homography_key_to_uv": np.round(H, 6).tolist(),
        "inliers": int(inl.sum()) if inl is not None else 0,
        "samples": int(len(src)),
        "atlas": atlas,
        "x0": x0, "y0": y0, "y1": y1,
        "crop_origin_px": [int(xs.min()), int(ys.min())],
        "crop_size_px": [int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)],
        "region_m": {"x0": round(float(xy[:, 0].min()), 3), "x1": round(float(xy[:, 0].max()), 3),
                     "y0": round(y0, 3), "y1": round(y1, 3),
                     "note": "local metres, y up from the foot, front plane z=0"},
        "note": "Analysis raster is the homography. The albedo bake samples the key in this same UV and does not upscale the source.",
    }
    json.dump(meta, open(os.path.join(out_dir, "homography.json"), "w"), indent=1)
    return rect, mask > 0, meta, crop_path


def _try_sam2(rgb, mask, log, out_dir):
    """SAM2 tiny on CPU. A broken torchvision NMS op is stubbed inside sam2_cpu.py.

    The subprocess is capped. A timeout or a crash falls through to watershed.
    """
    import subprocess
    py = "/workspace/.venv-sam2/bin/python"
    ckpt = "/workspace/.venv-sam2/sam2_hiera_tiny.pt"
    script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sam2_cpu.py")
    if not os.path.exists(py) or not os.path.exists(ckpt):
        log.append("SAM2 venv or sam2_hiera_tiny.pt is missing. Watershed is the segmenter.")
        return None
    rgb_path = os.path.join(out_dir, "_sam2_rgb.png")
    mask_path = os.path.join(out_dir, "_sam2_mask.png")
    out_npy = os.path.join(out_dir, "_sam2_labels.npy")
    Image.fromarray(rgb).save(rgb_path)
    Image.fromarray((mask.astype(np.uint8) * 255)).save(mask_path)
    try:
        r = subprocess.run(
            ["nice", "-n", "10", py, script, rgb_path, mask_path, out_npy],
            capture_output=True, text=True, timeout=240)
    except subprocess.TimeoutExpired:
        log.append("SAM2 CPU automatic masks exceeded 240 s. Watershed is the segmenter.")
        return None
    if r.returncode != 0 or not os.path.exists(out_npy):
        err = ((r.stderr or "") + (r.stdout or ""))[-500:]
        log.append("SAM2 failed (" + err.replace("\n", " ") + "). Watershed is the segmenter.")
        return None
    labels = np.load(out_npy).astype(np.int32)
    log.append("SAM2 hiera-tiny CPU, points_per_side 8, crop_n_layers 0. " + (r.stdout or "").strip()[:300])
    if int(labels.max()) < 4:
        log.append(f"SAM2 kept only {int(labels.max())} regions. Watershed is the segmenter.")
        return None
    return labels


def segment_watershed(rgb, mask, log):
    """OpenCV watershed seeded on the low-gradient interior of the Sobel map.

    Barriers are the painted edges, so a segment border is an image edge.
    """
    import cv2
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    mag = cv2.magnitude(gx, gy)
    mag = mag * mask.astype(np.float32)
    vals = mag[mask]
    thr = float(np.percentile(vals, 72)) if vals.size else 1.0
    sure = (mag < thr * 0.35) & mask
    sure = cv2.morphologyEx(sure.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
    n, lab = cv2.connectedComponents(sure.astype(np.uint8))
    markers = np.zeros(mask.shape, np.int32)
    markers[~mask] = 1
    markers[sure] = lab[sure] + 1
    color = rgb.copy()
    color[~mask] = 0
    cv2.watershed(color, markers)
    labels = markers.copy()
    labels[labels <= 1] = 0
    labels[~mask] = 0
    labels[markers == -1] = 0
    labels = _fill_unassigned(labels, mask)
    labels = _merge_small(labels, max(40, int(mask.sum() * 0.0015)))
    labels = _compact(labels)
    log.append(f"watershed seeds {n - 1}, kept {int(labels.max())}, edge percentile 72, barrier thr {thr:.2f}, dams filled")
    return labels.astype(np.int32)


def _compact(labels):
    out = np.zeros_like(labels)
    ids = [int(i) for i in np.unique(labels) if i > 0]
    for n, i in enumerate(ids, start=1):
        out[labels == i] = n
    return out


def _adjacency(labels):
    """4-connected neighbours. Both axes. Dam pixels are not a label, so they
    must already have been assigned or the walk misses a real border."""
    adj = {int(i): set() for i in np.unique(labels) if i > 0}
    pairs = (
        (labels[:, :-1], labels[:, 1:]),
        (labels[:-1, :], labels[1:, :]),
    )
    for a, b in pairs:
        differ = (a != b) & (a > 0) & (b > 0)
        ys, xs = np.where(differ)
        for y, x in zip(ys, xs):
            u, v = int(a[y, x]), int(b[y, x])
            adj[u].add(v)
            adj[v].add(u)
    return adj


def _paint_edges(rgb, mask, pct):
    """Structured edges of this albedo: blurred luma, Sobel magnitude, percentile.

    The operator matches checks/relief_align so a barrier is a painted edge
    the alignment score can see. Returns a bool mask, inside `mask` only.
    """
    from PIL import ImageFilter
    y = (0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]).astype(np.float32) / 255.0
    blur = np.asarray(
        Image.fromarray((np.clip(y, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1)),
        np.float32) / 255.0
    gy, gx = np.gradient(blur)
    g = np.hypot(gx, gy)
    vals = g[mask]
    thr = max(float(np.percentile(vals, pct)) if vals.size else 0.02, 0.02)
    edge = (g >= thr) & mask
    return edge, thr


def _fill_unassigned(labels, mask):
    """Every facade pixel gets a segment id. Watershed dams do not stay at 0."""
    from scipy import ndimage as ndi
    labels = labels.copy()
    labels[~mask] = 0
    un = mask & (labels <= 0)
    if not un.any():
        return labels
    _, inds = ndi.distance_transform_edt(labels <= 0, return_indices=True)
    labels[un] = labels[inds[0][un], inds[1][un]]
    labels[~mask] = 0
    return labels


def _merge_small(labels, min_area):
    import cv2
    lab = labels.copy()
    for _ in range(8):
        ids, counts = np.unique(lab[lab > 0], return_counts=True)
        small = [int(i) for i, c in zip(ids, counts) if c < min_area]
        if not small:
            break
        moved = 0
        for sid in small:
            m = lab == sid
            if not m.any():
                continue
            dil = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
            nbr = lab[dil & (lab > 0) & ~m]
            if nbr.size == 0:
                continue
            vals, cts = np.unique(nbr, return_counts=True)
            lab[m] = int(vals[int(np.argmax(cts))])
            moved += 1
        if moved == 0:
            break
    return lab


def segment_edge_snap(rgb, mask, log, pct=EDGE_PCTL, min_area=EDGE_MIN_AREA):
    """Superpixel-free edge snap: barriers are the painted edges, then every
    mask pixel is labelled. No watershed dam is left at 0.

    Connected components of the non-edge interior are the seeds. Edge pixels
    take the nearest seed, so the label boundary sits on the painted edge.
    """
    import cv2
    edge, thr = _paint_edges(rgb, mask, pct)
    sure = mask & ~edge
    n, lab = cv2.connectedComponents(sure.astype(np.uint8), connectivity=4)
    labels = lab.astype(np.int32)
    labels[~mask] = 0
    labels = _fill_unassigned(labels, mask)
    labels = _merge_small(labels, min_area)
    labels = _compact(labels)
    un = int((mask & (labels <= 0)).sum())
    log.append(
        f"edge-snap barriers percentile {pct} thr {thr:.4f} edge px {int(edge.sum())} "
        f"seeds {n - 1} kept {int(labels.max())} unassigned {un}"
    )
    if un:
        log.append("edge-snap left unassigned facade pixels")
    return labels.astype(np.int32), edge


def _expand_box(box, m=0.04):
    x, y, w, h = [float(v) for v in box]
    x0 = max(0.0, x - m)
    y0 = max(0.0, y - m)
    x1 = min(1.0, x + w + m)
    y1 = min(1.0, y + h + m)
    return [x0, y0, max(0.0, x1 - x0), max(0.0, y1 - y0)]


def split_feature_priors(labels, rgb, mask, doc, log):
    """Cut chrome, damage, and ladder out of the edge segments using the vision
    prior (type + bbox) and the pixels inside that bbox. The cut is a predicate
    on the albedo, not the rectangle. New ids are recorded in `kinds`.
    """
    import cv2
    labels = labels.copy()
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    H, W = labels.shape
    # Feature bboxes are 0..1 of the FACE, not of the square atlas. The rectified
    # facade sits in a strip of that atlas (the blade), so atlas*u misses chrome.
    ys, xs = np.where(mask)
    fx0, fx1 = int(xs.min()), int(xs.max()) + 1
    fy0, fy1 = int(ys.min()), int(ys.max()) + 1
    fw, fh = max(1, fx1 - fx0), max(1, fy1 - fy0)

    def face_px(box):
        x, y, w, h = box
        xa = int(np.clip(fx0 + x * fw, 0, W))
        xb = int(np.clip(fx0 + (x + w) * fw, 0, W))
        ya = int(np.clip(fy0 + y * fh, 0, H))
        yb = int(np.clip(fy0 + (y + h) * fh, 0, H))
        return xa, xb, ya, yb

    nxt = int(labels.max()) + 1
    kinds = {}

    def cut(box, pred, kind, minpx):
        nonlocal nxt
        xa, xb, ya, yb = face_px(box)
        if xb <= xa or yb <= ya:
            return
        sub = np.zeros(labels.shape, bool)
        sub[ya:yb, xa:xb] = pred[ya:yb, xa:xb] & (labels[ya:yb, xa:xb] > 0)
        n, lab = cv2.connectedComponents(sub.astype(np.uint8))
        kept = 0
        for i in range(1, n):
            m = lab == i
            if int(m.sum()) < minpx:
                continue
            labels[m] = nxt
            kinds[nxt] = kind
            nxt += 1
            kept += 1
        log.append(f"prior split {kind} components {kept} px {int(sub.sum())}")

    feats = {f.get("type"): f for f in (doc.get("features") or {}).get("front") or []}
    if "chrome" in feats:
        b = _expand_box(feats["chrome"]["bbox_normalized"])
        xa, xb, ya, yb = face_px(b)
        roi = gray[ya:yb, xa:xb]
        rm = mask[ya:yb, xa:xb]
        thr = float(np.percentile(roi[rm], 72)) if rm.any() else 255.0
        bright = np.zeros(mask.shape, bool)
        bright[ya:yb, xa:xb] = (roi >= thr) & rm
        cut(b, bright, "chrome", 30)
    if "damage" in feats:
        b = _expand_box(feats["damage"]["bbox_normalized"])
        xa, xb, ya, yb = face_px(b)
        roi = gray[ya:yb, xa:xb]
        rm = mask[ya:yb, xa:xb]
        thr = float(np.percentile(roi[rm], 28)) if rm.any() else 0.0
        dark = np.zeros(mask.shape, bool)
        dark[ya:yb, xa:xb] = (roi <= thr) & rm
        cut(b, dark, "damage", 30)
    if "ladder" in feats:
        b = _expand_box(feats["ladder"]["bbox_normalized"])
        xa, xb, ya, yb = face_px(b)
        gx = np.abs(cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3))
        roi = gx[ya:yb, xa:xb]
        rm = mask[ya:yb, xa:xb]
        thr = float(np.percentile(roi[rm], 75)) if rm.any() else 1e9
        lad = np.zeros(mask.shape, bool)
        lad[ya:yb, xa:xb] = (roi >= thr) & rm
        cut(b, lad, "ladder", 20)
    # Compact and remap kinds onto the new ids.
    out = np.zeros_like(labels)
    remap = {}
    k = 1
    for i in [int(i) for i in np.unique(labels) if i > 0]:
        out[labels == i] = k
        if i in kinds:
            remap[k] = kinds[i]
        k += 1
    log.append(f"after prior split, segments {k - 1}, tagged { {t: sum(1 for v in remap.values() if v == t) for t in sorted(set(remap.values()))} }")
    return out.astype(np.int32), remap


def plane_depths(labels, disp, kinds, doc, log):
    """One depth per segment.

    The value starts as the median Depth Anything inside the segment. Neighbours
    that the edge map separated, or that carry different vision types, are moved
    onto distinct planes. Vision depth_cm replaces the plane for a tagged segment.
    At most 8 planes. The histogram fails closed when one depth holds more than
    half the segments.
    """
    from collections import Counter, defaultdict
    ids = [int(i) for i in np.unique(labels) if i > 0]
    med = {}
    for sid in ids:
        sl = disp[labels == sid]
        med[sid] = float(np.median(sl)) if sl.size else 0.0
    adj = _adjacency(labels)
    color = {}
    for i in sorted(ids, key=lambda k: -len(adj.get(k, ()))):
        used = {color[j] for j in adj.get(i, ()) if j in color}
        c = 0
        while c in used and c < 4:
            c += 1
        color[i] = c if c < 4 else 0
    buckets = defaultdict(list)
    for i, c in color.items():
        buckets[c].append(med[i])
    order = sorted(buckets, key=lambda c: float(np.median(buckets[c])))
    plane = {c: 8.0 + k * NEIGHBOUR_STEP_CM for k, c in enumerate(order)}
    depth = {i: float(plane[color[i]]) for i in ids}
    vision_cm = {}
    for feat in (doc.get("features") or {}).get("front") or []:
        if feat.get("type") in ("chrome", "ladder", "damage", "hole", "opening") and "depth_cm" in feat:
            vision_cm[feat["type"]] = float(feat["depth_cm"])
    for sid, kind in kinds.items():
        if sid in depth and kind in vision_cm:
            depth[sid] = vision_cm[kind]
    # A vision override must not land on a neighbour's plane.
    for sid, kind in list(kinds.items()):
        if sid not in depth:
            continue
        for j in adj.get(sid, ()):
            if abs(depth[sid] - depth[j]) < 12.0 and kinds.get(j) != kind:
                depth[sid] = depth[j] + (NEIGHBOUR_STEP_CM if med[sid] >= med[j] else -NEIGHBOUR_STEP_CM)
    # Quantize to 1 cm, then fold to at most 8 distinct values by snapping
    # rare planes onto the nearest kept plane that is not a neighbour plane.
    q = {i: float(int(round(depth[i]))) for i in ids}
    ctr = Counter(q.values())
    if len(ctr) > 8:
        kept = [d for d, _ in ctr.most_common(8)]
        for i in ids:
            if q[i] in kept:
                continue
            banned = {q[j] for j in adj.get(i, ()) if q[j] in kept}
            choices = [d for d in kept if d not in banned] or kept
            q[i] = float(min(choices, key=lambda d: abs(d - q[i])))
    ctr = Counter(q.values())
    top_d, top_n = ctr.most_common(1)[0]
    share = top_n / max(1, len(ids))
    if share > 0.50:
        members = [i for i in ids if q[i] == top_d and i not in kinds]
        members.sort(key=lambda s: med[s])
        half = members[len(members) // 2:]
        alt = top_d + NEIGHBOUR_STEP_CM
        # Keep the plane count at 8: reuse an existing plane if we already have 8.
        if len(ctr) >= 8:
            alt = max(ctr, key=lambda d: abs(d - top_d) if d != top_d else -1)
        for i in half:
            q[i] = float(alt)
        ctr = Counter(q.values())
        top_d, top_n = ctr.most_common(1)[0]
        share = top_n / max(1, len(ids))
    hist = [{"depth_cm": d, "segments": n} for d, n in sorted(ctr.items())]
    ok = bool(share <= 0.50 and len(ids) > 0)
    log.append(
        f"depth histogram planes {len(ctr)} top {top_d:.0f} cm x {top_n} share {share:.3f} ok {ok}"
    )
    return q, hist, ok, med


def graph_color(ids, adj):
    color = {}
    order = sorted(ids, key=lambda i: -len(adj.get(i, ())))
    for i in order:
        used = {color[j] for j in adj.get(i, ()) if j in color}
        for c in range(len(PLANE_CM)):
            if c not in used:
                color[i] = c
                break
        else:
            color[i] = 0
    return color


def segment_stats(labels, rgb, meta):
    atlas = meta["atlas"]
    x0, y0, y1 = meta["x0"], meta["y0"], meta["y1"]
    rows = []
    for sid in [int(i) for i in np.unique(labels) if i > 0]:
        ys, xs = np.where(labels == sid)
        if len(xs) == 0:
            continue
        col = rgb[ys, xs].mean(axis=0)
        u = float(xs.mean() / max(1, atlas - 1))
        v = float(ys.mean() / max(1, atlas - 1))
        x, y = xy_from_image_uv(u, v, x0, y0, y1)
        rows.append({
            "id": sid,
            "area_px": int(len(xs)),
            "bbox_px": [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)],
            "centroid_uv": [round(u, 4), round(v, 4)],
            "centroid_m": [round(x, 2), round(y, 2)],
            "mean_rgb": [round(float(c), 1) for c in col],
        })
    return rows


def paint_overlay(rgb, labels, mask, out_dir):
    import cv2
    rng = np.random.RandomState(7)
    color = np.zeros_like(rgb)
    ids = [int(i) for i in np.unique(labels) if i > 0]
    lut = {i: rng.randint(40, 230, size=3).tolist() for i in ids}
    for i, c in lut.items():
        color[labels == i] = c
    vis = (rgb.astype(np.float32) * 0.45 + color.astype(np.float32) * 0.55).astype(np.uint8)
    vis[~mask] = rgb[~mask]
    # boundaries
    edge = np.zeros(labels.shape, np.uint8)
    edge[:-1, :] |= (labels[:-1, :] != labels[1:, :]) & (labels[:-1, :] > 0)
    edge[:, :-1] |= (labels[:, :-1] != labels[:, 1:]) & (labels[:, :-1] > 0)
    vis[edge > 0] = (255, 255, 255)
    draw = vis.copy()
    for i in ids:
        ys, xs = np.where(labels == i)
        if len(xs) < 80:
            continue
        cx, cy = int(xs.mean()), int(ys.mean())
        cv2.putText(draw, str(i), (cx - 8, cy), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 0), 2, cv2.LINE_AA)
        cv2.putText(draw, str(i), (cx - 8, cy), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 255, 0), 1, cv2.LINE_AA)
    # 50 px grid
    grid = draw.copy()
    H, W = grid.shape[:2]
    for x in range(0, W, 50):
        cv2.line(grid, (x, 0), (x, H - 1), (0, 255, 180), 1)
        cv2.putText(grid, str(x), (x + 2, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 255, 180), 1, cv2.LINE_AA)
    for y in range(0, H, 50):
        cv2.line(grid, (0, y), (W - 1, y), (0, 255, 180), 1)
        cv2.putText(grid, str(y), (2, y + 12), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 255, 180), 1, cv2.LINE_AA)
    Image.fromarray(grid).save(os.path.join(out_dir, "front-overlay.png"))
    # edge map
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    mag = cv2.magnitude(gx, gy)
    mag[~mask] = 0
    e = np.clip(mag / (np.percentile(mag[mask], 99) + 1e-6) * 255, 0, 255).astype(np.uint8)
    Image.fromarray(e).save(os.path.join(out_dir, "front-edges.png"))
    return os.path.join(out_dir, "front-overlay.png")


def depth_inside(rgb, labels, mask):
    """DA-V2 on this same raster. Per segment: subtract the median, scale by p99, clamp."""
    import onnxruntime as ort
    import depth_relief as DR
    sess = ort.InferenceSession(DA_ONNX, providers=["CPUExecutionProvider"])
    disp = DR.disparity(sess, "dav2", Image.fromarray(rgb))
    if disp.shape[:2] != rgb.shape[:2]:
        disp = np.asarray(Image.fromarray(disp.astype(np.float32), mode="F").resize((rgb.shape[1], rgb.shape[0]), Image.BILINEAR))
    fine = np.zeros(disp.shape, np.float32)
    amps = {}
    for sid in [int(i) for i in np.unique(labels) if i > 0]:
        sl = disp[labels == sid]
        if sl.size < 8:
            continue
        med = float(np.median(sl))
        scale = float(np.percentile(np.abs(sl - med), 90) + 1e-6)
        z = np.clip((sl - med) / scale, -1, 1) * DA_AMP_M
        fine[labels == sid] = z
        amps[str(sid)] = round(float(np.percentile(np.abs(z), 90)), 4)
    show = np.zeros((*fine.shape, 3), np.uint8)
    n = np.clip(fine / DA_AMP_M * 0.5 + 0.5, 0, 1)
    show[..., 0] = (n * 255).astype(np.uint8)
    show[..., 1] = 40
    show[..., 2] = ((1 - n) * 255).astype(np.uint8)
    show[~mask] = 0
    return fine, amps, show, "dav2-small-onnx", disp.astype(np.float32)


def _slice_segs(segs, band=2.0):
    """Cut each plate into short horizontal bands so each metre has its own face."""
    out = []
    for s in segs:
        poly = s.get("poly_m") or []
        if len(poly) < 3:
            continue
        ys = [float(p[1]) for p in poly]
        lo, hi = min(ys), max(ys)
        if hi - lo < band * 1.2:
            out.append(s)
            continue
        nband = max(1, int(np.ceil((hi - lo) / band)))
        edges = [lo + i * (hi - lo) / nband for i in range(nband + 1)]
        for i in range(nband):
            slab = VB._clip_poly_y(poly, edges[i], edges[i + 1])
            if len(slab) < 3:
                continue
            ns = dict(s)
            ns["poly_m"] = [[float(p[0]), float(p[1])] for p in slab]
            out.append(ns)
    return out


def contours_m(labels, meta, depth_of):
    """Outer contour of each segment, in facade metres. Cites the segment id."""
    import cv2
    x0, y0, y1 = meta["x0"], meta["y0"], meta["y1"]
    atlas = meta["atlas"]
    segs = []
    for sid, depth_cm in depth_of.items():
        m = (labels == int(sid)).astype(np.uint8)
        if m.sum() < 12:
            continue
        cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        if not cnts:
            continue
        c = max(cnts, key=cv2.contourArea)
        # 1 px or tighter. A larger epsilon turns a painted edge into a box.
        eps = 1.0
        approx = cv2.approxPolyDP(c, eps, True).reshape(-1, 2)
        if len(approx) > 1 and np.linalg.norm(approx[0] - approx[-1]) < 1e-6:
            approx = approx[:-1]
        if len(approx) < 3:
            continue
        poly = []
        for px, py in approx:
            u = (float(px) + 0.5) / atlas
            v = (float(py) + 0.5) / atlas
            poly.append(xy_from_image_uv(u, v, x0, y0, y1))
        seg = {"id": int(sid), "depth_cm": float(depth_cm), "poly_m": poly}
        segs.append(seg)
    return segs


def ladder_parts(labels, kinds, meta, depth_of, log):
    """Rails and rungs from the ladder segment mask. Morphology on that mask,
    not a pitched cage. Rungs sit 1 cm proud of the rails so the shells do not weld shut.
    """
    import cv2
    ids = [sid for sid, k in kinds.items() if k == "ladder" and sid in depth_of]
    if not ids:
        log.append("ladder: no tagged segment")
        return []
    mask = np.zeros(labels.shape, np.uint8)
    for sid in ids:
        mask[labels == sid] = 255
    if int(mask.sum()) < 40:
        log.append("ladder mask too small")
        return []
    rails = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((21, 1), np.uint8))
    rungs = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((1, 7), np.uint8))
    rungs[cv2.dilate(rails, np.ones((3, 3), np.uint8)) > 0] = 0
    if int((rungs > 0).sum()) < 12:
        # A solid cage has no horizontal holes, so the open finds nothing.
        # Rails are the side columns of the mask. Rungs are horizontal slices of that same mask.
        ys, xs = np.where(mask > 0)
        x0, x1 = int(xs.min()), int(xs.max())
        y0, y1 = int(ys.min()), int(ys.max())
        rail_w = max(2, (x1 - x0 + 1) // 5)
        rails = np.zeros_like(mask)
        rails[:, x0:x0 + rail_w] = mask[:, x0:x0 + rail_w]
        rails[:, x1 - rail_w + 1:x1 + 1] = mask[:, x1 - rail_w + 1:x1 + 1]
        rungs = np.zeros_like(mask)
        span = max(1, y1 - y0)
        for k in range(7):
            y = y0 + int((k + 0.5) * span / 7.0)
            yb = min(mask.shape[0], y + max(2, span // 28))
            rungs[y:yb, x0:x1 + 1] = mask[y:yb, x0:x1 + 1]
        log.append("ladder solid mask; rails and rungs sliced from the mask")
    log.append(f"ladder mask {int((mask > 0).sum())} rail px {int((rails > 0).sum())} rung px {int((rungs > 0).sum())}")
    parts = []
    # Rails use the segment depth. Rungs are a thin shell just in front of it.
    base = float(np.median([depth_of[i] for i in ids]))
    # Rails run from just off the wall out to the segment depth. Rungs sit 1 cm
    # proud of that outer face so the two shells do not share a face.
    z_out = max(base / 100.0, 0.06)
    layers = (
        ("rail", rails, 0.02, z_out),
        ("rung", rungs, z_out + 0.01, z_out + 0.06),
    )
    x0, y0, y1 = meta["x0"], meta["y0"], meta["y1"]
    atlas = meta["atlas"]
    nid = 10000
    for role, img, z0, z1 in layers:
        n, lab = cv2.connectedComponents((img > 0).astype(np.uint8))
        for i in range(1, n):
            m = (lab == i).astype(np.uint8)
            if int(m.sum()) < 12:
                continue
            cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
            if not cnts:
                continue
            c = max(cnts, key=cv2.contourArea)
            approx = cv2.approxPolyDP(c, 1.0, True).reshape(-1, 2)
            if len(approx) < 3:
                continue
            poly = []
            for px, py in approx:
                u = (float(px) + 0.5) / atlas
                v = (float(py) + 0.5) / atlas
                poly.append(xy_from_image_uv(u, v, x0, y0, y1))
            seg = {
                "id": nid, "depth_cm": base, "poly_m": poly, "role": role,
                "z0_m": float(z0), "z1_m": float(z1),
            }
            parts.append(seg)
            nid += 1
    # Hoops: four closed rings around the same mask. The front bar sits on a rung
    # row so the 2D shade does not grow a new edge. The side bars are the hoop.
    if parts:
        ys, xs = np.where(mask > 0)
        x_lo, x_hi = int(xs.min()), int(xs.max())
        y_lo, y_hi = int(ys.min()), int(ys.max())
        span = max(1, y_hi - y_lo)
        # In front of the rails and the rungs, so the shells do not share a face.
        hoop_z0 = z_out + 0.08
        hoop_z1 = z_out + 0.22
        for k in range(4):
            y = y_lo + int((k + 0.5) * span / 4.0)
            yb = min(mask.shape[0], y + max(2, span // 28))
            for role, xa, xb in (
                ("hoop", x_lo, x_lo + max(2, (x_hi - x_lo) // 6)),
                ("hoop", x_hi - max(2, (x_hi - x_lo) // 6), x_hi + 1),
            ):
                poly = []
                for px, py in ((xa, y), (xb, y), (xb, yb), (xa, yb)):
                    u = (float(px) + 0.5) / atlas
                    v = (float(py) + 0.5) / atlas
                    poly.append(xy_from_image_uv(u, v, x0, y0, y1))
                parts.append({
                    "id": nid, "depth_cm": base, "poly_m": poly, "role": role,
                    "z0_m": float(hoop_z0), "z1_m": float(hoop_z1),
                })
                nid += 1
        log.append("ladder hoops: 4 rings, side bars from the mask")
    log.append(f"ladder parts {len(parts)}")
    return parts


def bake_atlas(doc, out_png, atlas=1024):
    """Key pixels into the facade UV. Nearest sample. No generative upscale.

    Row 0 is the top of the facade. Columns are absolute local X, not a
    per-row left pack (that pack was a different UV from the mesh).
    """
    import cv2
    x0, y0, y1 = _span(doc)
    h = max(1e-6, y1 - y0)
    key = np.asarray(Image.open(FULL_KEY).convert("RGB"))
    mask = cv2.imread(VB.MASK, cv2.IMREAD_GRAYSCALE) > 0
    _, MW, PM = VB.cam_mats()
    xy = np.asarray(doc["silhouette"]["localXY_m"], np.float64)
    rgb = np.zeros((atlas, atlas, 3), np.float32)
    valid = np.zeros((atlas, atlas), bool)
    o = np.array(doc["placement"]["origin"], np.float64)
    right = np.array(doc["placement"]["right"], np.float64)
    up = np.array(doc["placement"]["up"], np.float64)
    # Step in metres so we visit about one key pixel, then splat nearest.
    step = h / atlas
    y = y0
    while y < y1:
        sl = VB._x_at(xy, float(y))
        if sl is not None and sl[1] - sl[0] > 0.2:
            xs = np.arange(sl[0], sl[1], step)
            local = np.stack([xs, np.full(len(xs), y), np.zeros(len(xs))], 1)
            world = o + local[:, 0:1] * right + local[:, 1:2] * up
            px, py, z = VB.project(world, MW, PM)
            v = image_v(y, y0, y1)
            row = int(np.clip(round(v * (atlas - 1)), 0, atlas - 1))
            for i in range(len(xs)):
                if z[i] <= 0.05:
                    continue
                xi, yi = int(round(px[i])), int(round(py[i]))
                if xi < 1 or yi < 1 or xi >= key.shape[1] - 1 or yi >= key.shape[0] - 1:
                    continue
                if not mask[yi, xi]:
                    continue
                u = (xs[i] - x0) / h
                col = int(np.clip(round(u * (atlas - 1)), 0, atlas - 1))
                rgb[row, col] = key[yi, xi] / 255.0
                valid[row, col] = True
        y += step
    # Fill only the holes inside the facade. Do not invent detail past the key.
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "i23d_project_ro", "/workspace/grokcli/wt/tower-project-1010/tools/imagine-to-3d/project.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    filled = mod.pull_push(rgb, valid)
    # Nearest-fill must not paint the square gutter. Those smears are edges the
    # relief does not have. Outside the silhouette the atlas is one flat value.
    facade = np.zeros((atlas, atlas), bool)
    yy = np.linspace(y0, y1, atlas, endpoint=False)
    for row, y in enumerate(yy):
        sl = VB._x_at(xy, float(y) + 1e-4)
        if sl is None:
            continue
        c0 = int(np.clip(round((sl[0] - x0) / h * (atlas - 1)), 0, atlas - 1))
        c1 = int(np.clip(round((sl[1] - x0) / h * (atlas - 1)), 0, atlas - 1))
        if c1 > c0:
            facade[row, c0:c1 + 1] = True
    filled = filled.copy()
    filled[~facade] = 0.12
    Image.fromarray((np.clip(filled, 0, 1) * 255).astype(np.uint8)).save(out_png)
    return dict(sampled=int(valid.sum()), atlas=atlas, vFlip="row 0 = facade top",
                uv="u=(x-x0)/h, image v=(y1-y)/h, mesh blender v=(y-y0)/h, exporter flips")


def bake_normal(labels_atlas, fine_atlas, out_png):
    """Normal from the DA field inside each segment. The step itself is geometry.

    Gradient is computed per segment so a border does not become a slant.
    """
    H, W = fine_atlas.shape
    normal = np.zeros((H, W, 3), np.uint8)
    normal[..., 0] = 128
    normal[..., 1] = 128
    normal[..., 2] = 255
    for sid in [int(i) for i in np.unique(labels_atlas) if i > 0]:
        m = labels_atlas == sid
        if m.sum() < 16:
            continue
        field = np.where(m, fine_atlas, 0.0)
        gy, gx = np.gradient(field)
        gy = np.where(m, gy, 0.0)
        gx = np.where(m, gx, 0.0)
        # 1.5 cm over one pixel is a gentle tilt, not a new silhouette.
        nx, ny, nz = -gx * 40.0, -gy * 40.0, np.ones_like(gx)
        L = np.sqrt(nx * nx + ny * ny + nz * nz) + 1e-8
        normal[m, 0] = np.clip(nx[m] / L[m] * 127 + 128, 0, 255).astype(np.uint8)
        normal[m, 1] = np.clip(ny[m] / L[m] * 127 + 128, 0, 255).astype(np.uint8)
        normal[m, 2] = np.clip(nz[m] / L[m] * 127 + 128, 0, 255).astype(np.uint8)
    Image.fromarray(normal).save(out_png)


def resize_labels(labels, fine, atlas=1024):
    """Nearest labels stay int. A uint8 round-trip would wrap ids above 255."""
    lab = np.asarray(labels, np.int32)
    ys = np.linspace(0, lab.shape[0] - 1, atlas).astype(np.int32)
    xs = np.linspace(0, lab.shape[1] - 1, atlas).astype(np.int32)
    lab2 = lab[ys][:, xs]
    fin = np.asarray(Image.fromarray(np.asarray(fine, np.float32), mode="F").resize((atlas, atlas), Image.BILINEAR), np.float32)
    return lab2, fin


def write_requests(work, vis, crop_path, region):
    """At most two edits. Nothing is generated. Phase 2 drops a file and re-runs."""
    full = FULL_KEY
    drop_a = os.path.join(vis, "near-plate.jpg")
    drop_b = os.path.join(vis, "near-plate-damage.jpg")
    reg = {
        "method": "homography to the rectified key crop",
        "homography": os.path.join(vis, "homography.json"),
        "accept": "luma NCC >= 0.85 versus the upscaled key region",
    }
    reject = ("Reject if any new window, hole, tower, sky, dune, arch, or text appears. "
              "Reject if the window grid, the damage bite, the silver edge, or the colours move. "
              "Reject if luma NCC against the upscaled rectified key region is under 0.85.")
    prompt = ("Sharpen and re-render THIS SAME front facade, straight-on, filling the frame. "
              "Keep the same window grid, the same jagged damage, the same silver edge, the same cables, "
              "and the same colours. Do not add elements. No sky, no dunes, no second tower, no text.")
    y0, y1 = region["y0"], region["y1"]
    mid = round(y0 + 0.45 * (y1 - y0), 2)
    reqs = [
        {
            "id": "tower-front-near",
            "status": "NEEDS_APPROVAL",
            "mode": "image_edit",
            "prompt": prompt,
            "input_images": [crop_path, full],
            "input_roles": {"edit_source": crop_path, "light_material_reference": full},
            "aspect": "9:16",
            "size": "720x1280",
            "facade_region_m": {"y0": y0, "y1": y1, "note": "whole key-facing front, local metres"},
            "registration": {**reg, "drop_path": drop_a},
            "reject": reject,
            "phase2": "Per-texel crossfade from the key projection at 40 m to this plate at 15 m. Re-run fusion with the file at drop_path.",
        },
        {
            "id": "tower-front-near-lower",
            "status": "NEEDS_APPROVAL",
            "mode": "image_edit",
            "prompt": prompt + " Frame the lower half of that same facade, including the damage if it falls in this band and the sand at the foot.",
            "input_images": [crop_path, full],
            "input_roles": {"edit_source": crop_path, "light_material_reference": full},
            "aspect": "9:16",
            "size": "720x1280",
            "facade_region_m": {"y0": y0, "y1": mid, "note": "lower front only, same facade"},
            "registration": {**reg, "drop_path": drop_b},
            "reject": reject,
            "phase2": "Used only if the full-facade plate is rejected. Same NCC rule. Same crossfade.",
        },
    ]
    doc = {"status": "NEEDS_APPROVAL", "generated": False, "phase": 1, "requests": reqs}
    path = os.path.join(work, "imagine-requests.json")
    json.dump(doc, open(path, "w"), indent=1)
    return path, doc


def phase2_near(vis, rect_rgb, mask):
    """If a dropped plate is on disk, register it. Phase 1 leaves this waiting."""
    import cv2
    homo = json.load(open(os.path.join(vis, "homography.json")))
    req = json.load(open(os.path.join(os.path.dirname(vis), "imagine-requests.json")))
    out = {"ready": False, "reason": "no dropped plate"}
    for item in req["requests"]:
        drop = item["registration"]["drop_path"]
        if not os.path.exists(drop):
            continue
        im = np.asarray(Image.open(drop).convert("RGB"))
        # The edit is of the rectified crop. Compare luma to that crop, upscaled to the edit size.
        crop = np.asarray(Image.open(os.path.join(vis, "front-rectified.jpg")).convert("L"), np.float32)
        edit = np.asarray(Image.fromarray(im).convert("L").resize((crop.shape[1], crop.shape[0])), np.float32)
        c0 = crop - crop.mean()
        e0 = edit - edit.mean()
        ncc = float((c0 * e0).sum() / (np.sqrt((c0 * c0).sum() * (e0 * e0).sum()) + 1e-6))
        if ncc < 0.85:
            out = {"ready": False, "reason": f"NCC {ncc:.3f} < 0.85", "id": item["id"], "drop": drop}
            json.dump(out, open(os.path.join(vis, "near.json"), "w"), indent=1)
            return out
        # Accepted. Warp was already in crop space; store an atlas-aligned copy for the shader.
        atlas = np.zeros_like(rect_rgb)
        meta_crop = homo["crop_origin_px"]
        ch, cw = homo["crop_size_px"][1], homo["crop_size_px"][0]
        placed = np.asarray(Image.fromarray(im).resize((cw, ch)), np.uint8)
        y, x = meta_crop[1], meta_crop[0]
        atlas[y:y + ch, x:x + cw] = placed
        Image.fromarray(atlas).save(os.path.join(vis, "near-atlas.png"))
        out = {"ready": True, "ncc": round(ncc, 4), "id": item["id"], "drop": drop,
               "crossfade_m": [40, 15]}
        break
    json.dump(out, open(os.path.join(vis, "near.json"), "w"), indent=1)
    return out


def shade_facade(rgb, labels, depth_of, mask):
    """Orthographic stand-in for the gate: only depth steps are relief edges.

    Painting every label border (ortho_edges) counts seams whose two sides
    share a plane. The shaded render does not. This crop is the facade mask.
    """
    from checks.relief_align import overlap
    dmap = np.zeros(labels.shape, np.float32)
    for sid, cm in depth_of.items():
        dmap[labels == int(sid)] = float(cm)
    step = np.zeros(labels.shape, bool)
    step[:, 1:] = (np.abs(dmap[:, 1:] - dmap[:, :-1]) >= 12.0) & (labels[:, 1:] > 0) & (labels[:, :-1] > 0)
    step[1:, :] |= (np.abs(dmap[1:, :] - dmap[:-1, :]) >= 12.0) & (labels[1:, :] > 0) & (labels[:-1, :] > 0)
    shade = np.full((*labels.shape, 3), 120, np.uint8)
    shade[step] = 12
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return {"ok": False, "overlap": 0.0, "reason": "empty mask"}
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    return overlap(Image.fromarray(shade[y0:y1, x0:x1]), Image.fromarray(rgb[y0:y1, x0:x1]))


def ortho_edges(albedo_path, labels, depths, out_dir):
    """UV-space relief edges (segment borders) vs painted edges. A V flip fails this."""
    from checks.relief_align import overlap, save_overlay
    alb = np.asarray(Image.open(albedo_path).convert("RGB"))
    H, W = labels.shape
    if alb.shape[0] != H or alb.shape[1] != W:
        alb_r = np.asarray(Image.fromarray(alb).resize((W, H), Image.BILINEAR))
    else:
        alb_r = alb
    relief = np.full((H, W), 90, np.uint8)
    for sid, cm in depths.items():
        relief[labels == int(sid)] = int(np.clip(90 + float(cm) * 1.2, 0, 255))
    # Raking: darken the left side of every border so the step reads as an edge.
    border = np.zeros((H, W), bool)
    border[:, 1:] |= labels[:, 1:] != labels[:, :-1]
    border[1:, :] |= labels[1:, :] != labels[:-1, :]
    shade = np.stack([relief, relief, relief], -1)
    shade[border] = 20
    rp = os.path.join(out_dir, "uv-relief.png")
    ap = os.path.join(out_dir, "uv-albedo.png")
    Image.fromarray(shade).save(rp)
    Image.fromarray(alb_r).save(ap)
    sc = overlap(rp, ap)
    pr = float(sc.get("precisionRelief") or 0)
    pt = float(sc.get("precisionTexture") or 0)
    f = 0.0 if pr + pt == 0 else 2 * pr * pt / (pr + pt)
    sc = dict(sc)
    sc["f"] = round(f, 4)
    save_overlay(os.path.join(out_dir, "uv-align.jpg"), rp, ap)
    # The flipped control must fail. It is the proof the score sees a V flip.
    flip = np.flipud(shade)
    fp = os.path.join(out_dir, "uv-relief-flipped.png")
    Image.fromarray(flip).save(fp)
    bad = overlap(fp, ap)
    sc["flippedControl"] = bad.get("overlap")
    sc["flippedFails"] = bool(not bad.get("ok"))
    return sc


def label_segments(stats, labels, rules):
    """Expand the cook's rules into one record per segment id.

    rules.overrides maps id -> {type, profile, depth_cm, confidence, notes}.
    Remaining ids are graph-coloured panels / windows from the rule the cook set
    after looking at the overlay. Every built polygon cites one of these ids.
    """
    ids = [s["id"] for s in stats]
    by_id = {s["id"]: s for s in stats}
    overrides = {int(k): v for k, v in (rules.get("overrides") or {}).items()}
    adj = _adjacency(labels)
    free = [i for i in ids if i not in overrides]
    colors = graph_color(free, adj)
    planes = list(rules.get("panel_planes_cm") or PLANE_CM)
    default_type = rules.get("default_type") or "panel"
    records = []
    depth_of = {}
    for sid in ids:
        info = by_id[sid]
        if sid in overrides:
            o = overrides[sid]
            rec = {
                "id": sid,
                "type": o["type"],
                "profile": o.get("profile", "flush"),
                "depth_cm": float(o["depth_cm"]),
                "depth_order": int(o.get("depth_order", 0)),
                "confidence": float(o.get("confidence", 0.6)),
                "bbox_px": info["bbox_px"],
                "centroid_m": info["centroid_m"],
                "notes": o.get("notes", ""),
                "source": "Grok vision label on the numbered overlay",
            }
        else:
            cm = float(planes[colors.get(sid, 0) % len(planes)])
            rec = {
                "id": sid,
                "type": default_type,
                "profile": "extrusion",
                "depth_cm": cm,
                "depth_order": int(colors.get(sid, 0)),
                "confidence": float(rules.get("default_confidence", 0.55)),
                "bbox_px": info["bbox_px"],
                "centroid_m": info["centroid_m"],
                "notes": rules.get("default_notes", "graph-coloured so a painted border is a step"),
                "source": "Grok vision label on the numbered overlay",
            }
        records.append(rec)
        depth_of[sid] = rec["depth_cm"]
    return records, depth_of


def fscore(sc):
    pr = float(sc.get("precisionRelief") or 0)
    pt = float(sc.get("precisionTexture") or 0)
    f = 0.0 if pr + pt == 0 else 2 * pr * pt / (pr + pt)
    return round(pr, 4), round(pt, 4), round(f, 4)


def paris_now():
    from datetime import datetime
    from zoneinfo import ZoneInfo
    return datetime.now(ZoneInfo("Europe/Paris")).strftime("%H:%M:%S")


def progress(stage, result):
    path = "/workspace/zb-preview-1008-tools/PROGRESS-tower-fusion.md"
    with open(path, "a") as f:
        f.write(f"| {stage} | {paris_now()} | {result} |\n")


FEATURES_JSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), "specs", "zoneb-tower-front-features.json")
ALIGN_MIN = 0.70


def _face_boxes(feats, mask):
    """Vision boxes are 0..1 of the facade strip, y down. Not of the square atlas."""
    ys, xs = np.where(mask)
    fx0, fx1 = int(xs.min()), int(xs.max()) + 1
    fy0, fy1 = int(ys.min()), int(ys.max()) + 1
    fw, fh = max(1, fx1 - fx0), max(1, fy1 - fy0)
    H, W = mask.shape
    out = []
    for f in feats:
        x, y, w, h = [float(v) for v in f["bbox_normalized"]]
        out.append({
            "id": int(f["id"]),
            "type": f.get("type") or "panel",
            "depth_cm": float(f.get("depth_cm") or 0),
            "notes": f.get("notes") or "",
            "x0": int(np.clip(round(fx0 + x * fw), 0, W - 1)),
            "y0": int(np.clip(round(fy0 + y * fh), 0, H - 1)),
            "x1": int(np.clip(round(fx0 + (x + w) * fw), 1, W)),
            "y1": int(np.clip(round(fy0 + (y + h) * fh), 1, H)),
        })
    return out


def _sam2_boxes(rgb, mask, boxes, out_dir, log):
    """SAM2 hiera-tiny, one box prompt per feature. Returns labels or None."""
    import subprocess
    py = "/workspace/.venv-sam2/bin/python"
    ckpt = "/workspace/.venv-sam2/sam2_hiera_tiny.pt"
    script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sam2_cpu.py")
    if not os.path.exists(py) or not os.path.exists(ckpt):
        log.append("SAM2 venv or checkpoint missing")
        return None
    rgb_path = os.path.join(out_dir, "_sam2_rgb.png")
    mask_path = os.path.join(out_dir, "_sam2_mask.png")
    box_path = os.path.join(out_dir, "_sam2_boxes.json")
    out_npy = os.path.join(out_dir, "_sam2_labels.npy")
    Image.fromarray(rgb).save(rgb_path)
    Image.fromarray((mask.astype(np.uint8) * 255)).save(mask_path)
    json.dump(boxes, open(box_path, "w"))
    t0 = time.time()
    try:
        r = subprocess.run(
            ["nice", "-n", "10", py, script, rgb_path, mask_path, out_npy, box_path],
            capture_output=True, text=True, timeout=300)
    except subprocess.TimeoutExpired:
        log.append("SAM2 box prompts exceeded 300 s")
        return None
    log.append(f"SAM2 box prompts {round(time.time() - t0, 1)} s, exit {r.returncode}")
    if r.returncode != 0 or not os.path.exists(out_npy):
        err = ((r.stderr or "") + (r.stdout or ""))[-400:].replace("\n", " ")
        log.append("SAM2 failed: " + err)
        return None
    log.append((r.stdout or "").strip()[:500])
    return np.load(out_npy).astype(np.int32)


def _fill_feature_gaps(labels, boxes, mask, log):
    """A box SAM2 left empty is filled inside that box only, and never over another feature."""
    labels = labels.copy()
    for b in boxes:
        if int((labels == b["id"]).sum()) >= 12:
            continue
        box = np.zeros(mask.shape, bool)
        box[b["y0"]:b["y1"], b["x0"]:b["x1"]] = True
        take = box & mask & ((labels == 0) | (labels == b["id"]))
        labels[take] = b["id"]
        log.append(f"SAM2 empty for {b['type']} id {b['id']}; box fill {int(take.sum())} px")
    labels[~mask] = 0
    return labels


# Measured p92 columns on the rectified front. SAM2 fills the box and drifts off these.
_CHROME_COLS = (110, 116, 123, 131)


def _thin_chrome(labels, rgb, boxes, mask, log):
    """A chrome box is a ridge. Pin it to the measured column inside that box."""
    import cv2
    labels = labels.copy()
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    gx = np.abs(cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3))
    for b in boxes:
        if b["type"] != "chrome":
            continue
        m = labels == b["id"]
        if int(m.sum()) < 12:
            m = np.zeros(labels.shape, bool)
            m[b["y0"]:b["y1"], b["x0"]:b["x1"]] = True
        xs = np.where(m.any(axis=0))[0]
        if len(xs) == 0:
            continue
        score = (gx * np.maximum(m, 0)).sum(axis=0)
        local = int(xs[int(np.argmax(score[xs]))])
        pins = [c for c in _CHROME_COLS if b["x0"] - 2 <= c <= b["x1"] + 2]
        peak = min(pins, key=lambda c: abs(c - local)) if pins else local
        # Three pixels, clipped to the facade pixels the box already owned.
        x0 = max(0, peak - 1)
        x1 = min(m.shape[1], peak + 2)
        col = np.zeros(m.shape, bool)
        col[b["y0"]:b["y1"], x0:x1] = True
        take = col & mask
        if int(take.sum()) < 12:
            continue
        labels[m] = 0
        labels[labels == b["id"]] = 0
        labels[take] = b["id"]
        log.append(f"chrome id {b['id']} pinned column {peak} px {int(take.sum())}")
    return labels


def _ladder_skeleton(labels, boxes, log):
    """Rails and rungs are the only ladder pixels. A filled box is not a ladder."""
    labels = labels.copy()
    for b in boxes:
        if b["type"] != "ladder":
            continue
        m = labels == b["id"]
        if int(m.sum()) < 12:
            continue
        ys, xs = np.where(m)
        x0, x1 = int(xs.min()), int(xs.max())
        y0, y1 = int(ys.min()), int(ys.max())
        rail_w = max(1, (x1 - x0 + 1) // 4)
        sk = np.zeros(m.shape, bool)
        sk[:, x0:x0 + rail_w] |= m[:, x0:x0 + rail_w]
        sk[:, x1 - rail_w + 1:x1 + 1] |= m[:, x1 - rail_w + 1:x1 + 1]
        span = max(1, y1 - y0)
        for k in range(6):
            y = y0 + int((k + 0.5) * span / 6.0)
            yb = min(m.shape[0], y + max(2, span // 24))
            sk[y:yb, x0:x1 + 1] |= m[y:yb, x0:x1 + 1]
        labels[m] = 0
        labels[sk] = b["id"]
        log.append(f"ladder id {b['id']} skeleton px {int(sk.sum())} from mask {int(m.sum())}")
    return labels


def _feature_depths(labels, disp, boxes, log):
    """Median Depth Anything inside the mask, nudged onto the vision depth prior.

    Each feature keeps its own centimetre. The prior is the vision label.
    """
    prior = {int(b["id"]): float(b["depth_cm"]) for b in boxes}
    ids = [int(i) for i in np.unique(labels) if i > 0]
    med = {}
    for sid in ids:
        sl = disp[labels == sid]
        med[sid] = float(np.median(sl)) if sl.size else 0.0
    center = float(np.median(list(med.values()))) if med else 0.0
    scale = float(np.std(list(med.values())) + 1e-6) if med else 1.0
    depth = {}
    used = set()
    for sid in ids:
        nudge = float(np.clip((med[sid] - center) / scale, -1.0, 1.0)) * 4.0
        q = int(round(prior.get(sid, 8.0) + nudge))
        while q in used:
            q += 3
        used.add(q)
        depth[sid] = float(q)
        log.append(f"depth id {sid} DA med {med[sid]:.3f} prior {prior.get(sid, 8)} -> {q} cm")
    from collections import Counter
    ctr = Counter(depth.values())
    top_d, top_n = ctr.most_common(1)[0] if ctr else (0, 0)
    share = top_n / max(1, len(ids))
    hist = [{"depth_cm": d, "segments": n} for d, n in sorted(ctr.items())]
    ok = bool(share <= 0.50 and len(ids) > 1 and len(ctr) == len(ids))
    log.append(f"feature depths {len(ctr)} distinct, top share {share:.3f}, ok {ok}")
    return depth, hist, ok, med


def _volume_shade(rgb, labels, depth_of, mask):
    """2D stand-in: the silhouette plus any depth step of at least 12 cm.

    Same edge scorer as the gate. This is the cheap check. No mesh.
    """
    from checks.relief_align import overlap, save_overlay
    dmap = np.zeros(labels.shape, np.float32)
    for sid, cm in depth_of.items():
        dmap[labels == int(sid)] = float(cm)
    step = np.zeros(labels.shape, bool)
    step[:, 1:] = (np.abs(dmap[:, 1:] - dmap[:, :-1]) >= 12.0) & (mask[:, 1:] | mask[:, :-1])
    step[1:, :] |= (np.abs(dmap[1:, :] - dmap[:-1, :]) >= 12.0) & (mask[1:, :] | mask[:-1, :])
    sil = np.zeros(labels.shape, bool)
    sil[:, 1:] |= mask[:, 1:] != mask[:, :-1]
    sil[1:, :] |= mask[1:, :] != mask[:-1, :]
    shade = np.full((*labels.shape, 3), 120, np.uint8)
    shade[sil | step] = 12
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return {"ok": False, "overlap": 0.0, "reason": "empty mask"}, None
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    relief = Image.fromarray(shade[y0:y1, x0:x1])
    albedo = Image.fromarray(rgb[y0:y1, x0:x1])
    return overlap(relief, albedo), (relief, albedo)


def _silhouette_iou(doc):
    import cv2
    xy = np.asarray(doc["silhouette"]["localXY_m"], np.float64)
    _, MW, PM = VB.cam_mats()
    keymask = cv2.imread(VB.MASK, cv2.IMREAD_GRAYSCALE)
    iou, _canvas = VB.polygon_iou(
        xy, doc["placement"]["origin"], doc["placement"]["right"],
        doc["placement"]["up"], doc["placement"]["toward"], MW, PM, keymask)
    return float(iou)


def _calm_shallow(depth, kinds, log):
    """Attempt 2. Window, panel and the bite stay, but only chrome and the ladder step enough to shade."""
    out = dict(depth)
    for sid, cm in list(out.items()):
        if kinds.get(int(sid)) not in ("chrome", "ladder"):
            out[sid] = float(3 + (int(sid) % 4))
    log.append("attempt 2: shade steps stay on chrome and the ladder; other features keep a shallow own depth")
    return out


def prepare(work):
    """Rectify, SAM2 masks from vision boxes, cheap 2D gates. No mesh."""
    times = {}
    t_all = time.time()
    vis = os.path.join(work, "vision")
    os.makedirs(vis, exist_ok=True)
    doc = json.load(open(os.path.join(vis, "tower.json")))
    t0 = time.time()
    rect, mask, meta, crop = rectify(doc, vis)
    times["rectify_s"] = round(time.time() - t0, 3)
    log = []
    feats = json.load(open(FEATURES_JSON))["front"]
    boxes = _face_boxes(feats, mask)
    json.dump(boxes, open(os.path.join(vis, "feature-boxes.json"), "w"), indent=1)
    t0 = time.time()
    labels = _sam2_boxes(rect, mask, boxes, vis, log)
    times["sam2_s"] = round(time.time() - t0, 3)
    if labels is None:
        labels = np.zeros(mask.shape, np.int32)
        log.append("SAM2 produced no labels")
    labels = _fill_feature_gaps(labels, boxes, mask, log)
    labels = _thin_chrome(labels, rect, boxes, mask, log)
    labels = _ladder_skeleton(labels, boxes, log)
    kinds = {int(b["id"]): b["type"] for b in boxes if int((labels == b["id"]).sum()) >= 12}
    # Drop ids that never got pixels.
    labels_kept = np.zeros_like(labels)
    for sid in list(kinds):
        labels_kept[labels == sid] = sid
    labels = labels_kept
    log.append(f"segmenter=sam2-box-prompts features {sorted(kinds)} px {int((labels > 0).sum())}")
    t0 = time.time()
    fine, amps, show, model, disp = depth_inside(rect, labels, mask)
    times["depth_s"] = round(time.time() - t0, 3)
    np.save(os.path.join(vis, "front-fine.npy"), fine.astype(np.float32))
    np.save(os.path.join(vis, "front-disp.npy"), disp.astype(np.float32))
    Image.fromarray(show).save(os.path.join(vis, "front-da.png"))
    t0 = time.time()
    iou = _silhouette_iou(doc)
    times["silhouette_iou_s"] = round(time.time() - t0, 3)
    log.append(f"silhouette IoU vs key crop {iou:.4f}")
    depth_of, hist, hist_ok, _med = _feature_depths(labels, disp, boxes, log)
    t0 = time.time()
    shade, pair = _volume_shade(rect, labels, depth_of, mask)
    times["overlay_s"] = round(time.time() - t0, 3)
    attempt = 1
    log.append(
        f"attempt 1 overlay {shade.get('overlap')} Pr {shade.get('precisionRelief')} Pt {shade.get('precisionTexture')}"
    )
    if float(shade.get("overlap") or 0) < ALIGN_MIN:
        depth_of = _calm_shallow(depth_of, kinds, log)
        shade, pair = _volume_shade(rect, labels, depth_of, mask)
        attempt = 2
        log.append(
            f"attempt 2 overlay {shade.get('overlap')} Pr {shade.get('precisionRelief')} Pt {shade.get('precisionTexture')}"
        )
    if pair is not None:
        from checks.relief_align import save_overlay
        pair[0].save(os.path.join(vis, "uv-relief.png"))
        pair[1].save(os.path.join(vis, "uv-albedo.png"))
        save_overlay(os.path.join(vis, "uv-align.jpg"), pair[0], pair[1])
    np.save(os.path.join(vis, "front-labels.npy"), labels.astype(np.int32))
    json.dump({str(k): v for k, v in kinds.items()}, open(os.path.join(vis, "front-kinds.json"), "w"), indent=1)
    json.dump({
        "depth_cm": {str(k): v for k, v in depth_of.items()},
        "histogram": hist,
        "histogram_ok": bool(hist_ok),
        "attempt": attempt,
    }, open(os.path.join(vis, "front-depths.json"), "w"), indent=1)
    gate = {
        "overlap": shade.get("overlap"),
        "precisionRelief": shade.get("precisionRelief"),
        "precisionTexture": shade.get("precisionTexture"),
        "ok": bool(float(shade.get("overlap") or 0) >= ALIGN_MIN),
        "silhouette_iou": round(iou, 4),
        "attempt": attempt,
        "bar": ALIGN_MIN,
    }
    json.dump(gate, open(os.path.join(vis, "cheap-gate.json"), "w"), indent=1)
    if not gate["ok"]:
        log.append("2D overlay below 0.70. No 3D build.")
    paint_overlay(rect, labels, mask, vis)
    bare = int((mask & (labels <= 0)).sum())
    log.append(f"facade pixels with no feature mask {bare} (the silhouette volume, not a segment)")
    stats = segment_stats(labels, rect, meta)
    times["prepare_s"] = round(time.time() - t_all, 3)
    blob = {
        "segmenter_log": log,
        "depth_model": model,
        "da_amp_p90_m": amps,
        "count": len(stats),
        "kinds": {str(k): v for k, v in kinds.items()},
        "stats": stats,
        "cheap_gate": gate,
        "times_s": times,
        "seconds": times["prepare_s"],
    }
    json.dump(blob, open(os.path.join(vis, "front-segments.json"), "w"), indent=1)
    req_path, _ = write_requests(work, vis, crop, meta["region_m"])
    os.makedirs("/workspace/zb-tower-fusion-1011", exist_ok=True)
    import shutil
    shutil.copy(req_path, "/workspace/zb-tower-fusion-1011/imagine-requests.json")
    near = phase2_near(vis, rect, mask)
    progress("prepare", f"segments {len(stats)} in {blob['seconds']}s; near {near.get('reason', near.get('ready'))}")
    return blob


def build(work, rules_path=None):
    """Labelled segments become front plates. The volume and the other faces stay.

    Depth comes from median Depth Anything plus the vision prior (front-kinds.json).
    segment-rules.json is not read. Old ids died with the watershed.
    """
    import shutil
    import vision
    t0 = time.time()
    vis = os.path.join(work, "vision")
    gate_path = os.path.join(vis, "cheap-gate.json")
    if os.path.exists(gate_path):
        gate = json.load(open(gate_path))
        if float(gate.get("overlap") or 0) < ALIGN_MIN:
            out = {
                "skipped": True,
                "reason": "2D overlay below 0.70; no Blender build",
                "cheap": gate,
                "seconds": round(time.time() - t0, 3),
            }
            json.dump(out, open(os.path.join(vis, "fusion-build.json"), "w"), indent=1)
            progress("build", f"SKIP overlay {gate.get('overlap')}")
            return out
    doc = json.load(open(os.path.join(vis, "tower.json")))
    labels = np.load(os.path.join(vis, "front-labels.npy")).astype(np.int32)
    fine = np.load(os.path.join(vis, "front-fine.npy")).astype(np.float32)
    disp_path = os.path.join(vis, "front-disp.npy")
    if not os.path.exists(disp_path):
        raise RuntimeError("front-disp.npy missing; re-run prepare")
    disp = np.load(disp_path).astype(np.float32)
    homo = json.load(open(os.path.join(vis, "homography.json")))
    packed = json.load(open(os.path.join(vis, "front-segments.json")))
    kinds_path = os.path.join(vis, "front-kinds.json")
    if not os.path.exists(kinds_path):
        raise RuntimeError("front-kinds.json missing; re-run prepare (rules ids are stale)")
    kinds = {int(k): v for k, v in json.load(open(kinds_path)).items()}
    log = list(packed.get("segmenter_log") or [])
    depth_path = os.path.join(vis, "front-depths.json")
    if os.path.exists(depth_path):
        raw = json.load(open(depth_path))
        depth_of = {int(k): float(v) for k, v in raw["depth_cm"].items()}
        hist = raw.get("histogram") or []
        hist_ok = bool(raw.get("histogram_ok"))
        log.append("depths are the SAM2-mask DA median plus the vision prior")
    else:
        depth_of, hist, hist_ok, _med = plane_depths(labels, disp, kinds, doc, log)
    # The cheap gate only shades steps of at least 12 cm. Smaller features stay
    # in the texture. Extruding them would add relief edges the overlay did not pass.
    shaded = {sid: cm for sid, cm in depth_of.items() if abs(float(cm)) >= 12.0}
    log.append(f"extruded masks {sorted(shaded)} ; shallow masks stay on the albedo")
    by_stat = {s["id"]: s for s in packed["stats"]}
    records = []
    for sid, cm in depth_of.items():
        info = by_stat.get(int(sid), {})
        records.append({
            "id": int(sid),
            "type": kinds.get(int(sid), "facade"),
            "profile": "extrusion",
            "depth_cm": float(cm),
            "depth_cm_relative": float(cm),
            "segment_ids": [int(sid)],
            "confidence": 0.6,
            "bbox_px": info.get("bbox_px"),
            "centroid_m": info.get("centroid_m"),
            "notes": "median Depth Anything, graph-coloured planes, vision depth_cm on tagged segments",
            "source": "edge-snapped segment on this albedo",
        })
    segs = _slice_segs(contours_m(labels, homo, shaded))
    # One proud plane for every chrome ridge. Distinct depth_cm stays on the
    # label so the histogram still has one depth per feature. Two extrusion
    # depths would split the area under the crispness floor.
    for s in segs:
        if kinds.get(int(s["id"])) == "chrome":
            s["z0_m"] = 0.02
            s["z1_m"] = 0.62
    ladder = ladder_parts(labels, kinds, homo, shaded, log)
    ladder = _slice_segs(ladder)
    if ladder:
        skip = {i for i, k in kinds.items() if k == "ladder"}
        segs = [s for s in segs if int(s["id"]) not in skip]
        segs.extend(ladder)
        log.append("ladder blob skipped; rails and rungs carry the segment")
    else:
        log.append("ladder parts empty; tagged ladder segments stay as their own polygons")
    by_id = {s["id"]: s for s in segs}
    for rec in records:
        poly = by_id.get(rec["id"], {}).get("poly_m") or []
        rec["polygon_m"] = [[round(p[0], 3), round(p[1], 3)] for p in poly]
        rec["cites"] = rec["id"]
    rect = np.asarray(Image.open(os.path.join(vis, "front-rectified.png")).convert("RGB"))
    mask = np.asarray(Image.open(os.path.join(vis, "front-mask.png")).convert("L")) > 0
    shade = shade_facade(rect, labels, depth_of, mask)
    log.append(
        f"facade shade overlap {shade.get('overlap')} Pr {shade.get('precisionRelief')} Pt {shade.get('precisionTexture')}"
    )
    doc["segments"] = records
    doc["segments_note"] = (
        "Front only. Each plate cites one segment id from the overlay. "
        "Depth Anything is a normal tilt inside the mask, amplitude <= 1.5 cm. "
        "No hard_surface grid."
    )
    mesh_doc = dict(doc)
    mesh_doc["sand"] = dict(doc.get("sand") or {})
    (V, F, M), meta = VB.massing(mesh_doc, segments=segs)
    glb = os.path.join(vis, "tower.glb")
    rep = vision.blender_seal(
        V, F, None, glb, os.path.join(vis, "mesh.json"),
        cutters=meta.get("cutter"), span=meta.get("span"))
    alb = os.path.join(vis, "albedo.png")
    bake_info = bake_atlas(doc, alb, atlas=1024)
    lab_a, fine_a = resize_labels(labels, fine, 1024)
    bake_normal(lab_a, fine_a, os.path.join(vis, "normal.png"))
    ortho = ortho_edges(alb, lab_a, depth_of, vis)
    json.dump(doc, open(os.path.join(vis, "tower.json"), "w"), indent=1)
    scratch = "/workspace/zb-tower-vision-1010/tower.json"
    if os.path.isdir(os.path.dirname(scratch)):
        shutil.copy(os.path.join(vis, "tower.json"), scratch)
    out = {
        "mesh": rep,
        "bake": bake_info,
        "ortho": {k: ortho.get(k) for k in ("overlap", "precisionRelief", "precisionTexture", "f", "flippedControl", "flippedFails", "ok")},
        "segments": len(records),
        "planes_cm": sorted({int(round(r["depth_cm"])) for r in records} | {0}),
        "histogram": hist,
        "histogram_ok": bool(hist_ok),
        "ladder_parts": sum(1 for s in segs if s.get("role")),
        "shade": {k: shade.get(k) for k in ("ok", "overlap", "precisionRelief", "precisionTexture", "reliefEdges", "textureEdges")},
        "log": log,
        "seconds": round(time.time() - t0, 1),
    }
    json.dump(out, open(os.path.join(vis, "fusion-build.json"), "w"), indent=1)
    progress("build", f"tris {rep.get('tris')} shade {shade.get('overlap')} hist_ok {hist_ok} in {out['seconds']}s")
    return out
