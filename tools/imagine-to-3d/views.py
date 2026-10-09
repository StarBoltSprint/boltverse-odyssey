"""Stage 'views' (q16 #2 + #4 + #5): plan and gate 8-12 CONSISTENT Imagine views of one object.

Every view is an Imagine EDIT (image_edit, <= 3 sources) conditioned on:
  <IMAGE_1> the key crop (identity, materials, colours),
  <IMAGE_2> the previously accepted view one axis away (yaw-only or elevation-only change, q15 "one axis change"),
  <IMAGE_3> the coarse scaffold rendered from the SAME target camera (coarse-to-fine: the silhouette to match).
The front view (yaw 0) is the key crop re-rendered at native size with no change (IoU vs the key silhouette).
Gate per view: silhouette IoU >= profile threshold (0.87) vs the expected coarse render (height-normalised,
base-centred, so framing does not matter) and native size == the Imagine output (no resize). Rejected views are
regenerated with a stronger prompt, max `viewRetries` (3) attempts; then the view hard-fails (fixloop: refine coarse).

Plate resolution is PRE-COMPUTED (q16 #5), not looped: Imagine output size is fixed per aspect (720x1280 ...), so the
plan fixes the METRES each plate covers. required px/m = max(profile target 128, phone px/m at the closest approach
= f/d), never below 64. A view whose native px/m is below that gets split into sections; each section is its own
Imagine edit of that view region at full native size. Nothing is ever downscaled.

  python3 views.py plan     --profile type-profile.json|--type rock --height-m 45 --coarse DIR --crop key.png --out DIR
  python3 views.py requests --plan DIR/views-plan.json      -> DIR/batch-views-<n>.json (next views whose neighbour is accepted)
  python3 views.py accept   --plan DIR/views-plan.json --view y090 --image out.jpg   -> PASS/FAIL row, state updated
  python3 views.py sections --plan DIR/views-plan.json      -> batch of section-plate edits for the accepted views
"""
import argparse, json, math, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import i23d_common as C
from imagine import Request, write_batch

VFOV = 40.0          # coarse.render / fit_distance framing (the Imagine view prompt asks for the same framing)
USABLE = 0.9         # section plates overlap 10 % (blend seam), so only 90 % of the native pixels count


def required_pxm(profile):
    T = profile["texel"]
    phone = C.PHONE_FOCAL_PX / max(0.5, T["closestApproachM"])
    return max(T["targetPxPerM"], T["minPxPerM"], phone)


def aspect_for(w_m, h_m, elev):
    if abs(elev) >= 80: return "1:1"
    r = h_m / max(1e-6, w_m)
    return "9:16" if r >= 1.25 else ("16:9" if r <= 0.8 else "1:1")


def neighbour(cam, accepted_names, cams):
    """The accepted view one axis away: same elevation & nearest yaw, else same yaw at elevation 0..."""
    by = {c["name"]: c for c in cams}
    cand = []
    for n in accepted_names:
        o = by[n]; dy = abs((o["yaw"] - cam["yaw"] + 180) % 360 - 180); de = abs(o["elev"] - cam["elev"])
        if de < 1e-6 and dy > 0: cand.append((0, dy, n))           # yaw-only change
        elif dy < 1e-6 and de > 0: cand.append((1, de, n))         # elevation-only change
    if abs(cam["elev"]) >= 80:                                     # top/bottom: from the front equatorial view (elev-only)
        cand += [(1, abs(by[n]["elev"] - cam["elev"]), n) for n in accepted_names if abs(by[n]["yaw"]) < 1e-6 and by[n]["name"] != cam["name"]]
    cand.sort()
    return cand[0][2] if cand else None


def order(cams):
    """Grow outward from the key side: equatorial ring by |yaw| distance, then high/low/top views."""
    def key(c):
        dy = abs((c["yaw"] + 180) % 360 - 180)
        return (0 if abs(c["elev"]) < 30 else (1 if abs(c["elev"]) < 80 else 2), dy, c["yaw"])
    return sorted(cams, key=key)


def plan(profile, height_m, coarse_dir, crop, out, closest=None, vfov=VFOV, cameras=None, near_m=None):
    """cameras: override the profile camera set (e.g. to describe views that already exist); vfov: lens of the views."""
    import coarse as CO
    C.assert_not_video_frame(crop)
    if closest: profile["texel"]["closestApproachM"] = closest
    rep_src = coarse_dir; rep = json.load(open(os.path.join(coarse_dir, "coarse-report.json")))
    req = required_pxm(profile); req_far = profile["texel"]["minPxPerM"]; thr = profile["thresholds"]
    near_m = near_m if near_m is not None else (profile.get("gateResolved", {}).get("texel", {}).get("nearM") or 30)
    dist = CO.fit_distance(rep, vfov)
    cams = order([dict(c, distM=round(dist, 2), vfov=vfov, heightM=height_m) for c in (cameras or profile["views"]["cameras"])])
    for c in cams:   # aspect from the scaffold extents seen from that side (refined below from the render)
        c["aspect"] = "1:1" if abs(c["elev"]) >= 80 else aspect_for(max(rep["widthM"], rep["depthM"]) if c["yaw"] % 180 else rep["widthM"], rep["heightM"], 0)
    coarse_dir = os.path.join(out, "coarse-r0"); rep = CO.rerender(rep_src, coarse_dir, cams)   # renders for THESE cameras
    info, V = CO.load(coarse_dir); Pts, Nrm = CO.surface_points(V); area = V["vox"] ** 2
    dirs = np.array([[math.sin(math.radians(c["yaw"])) * math.cos(math.radians(c["elev"])), math.sin(math.radians(c["elev"])),
                      math.cos(math.radians(c["yaw"])) * math.cos(math.radians(c["elev"]))] for c in cams])
    facing = Nrm @ dirs.T; best = facing.argmax(1); bestv = facing.max(1)
    near = Pts[:, 1] <= near_m                       # surface the player can reach within nearM (ground band)
    views = []
    for vi, c in enumerate(cams):
        c = dict(c)
        mpath = (rep.get("renders") or {}).get(c["name"], {}).get("mask")
        if mpath and os.path.exists(mpath):
            m = C.load_mask(mpath); x0, y0, x1, y1 = C.bbox(m); Hpx = m.shape[0]
            mpp = 2 * dist * math.tan(math.radians(vfov) / 2) / Hpx
            w_m, h_m = (x1 - x0) * mpp, (y1 - y0) * mpp
        else:
            w_m, h_m = max(rep["widthM"], rep["depthM"]), rep["heightM"]
        asp = c["aspect"]; W, H = C.IMAGINE_NATIVE[asp]
        fill = 0.8; view_pxm = min(W * fill / max(w_m, 1e-6), H * fill / max(h_m, 1e-6))
        # surface this view owns (most frontal, n.d >= 0.35 so the plate stretch stays <= 1/0.35 before the
        # projection set of proj.py splits it further) -> plates needed at the near / far px/m
        own = (best == vi) & (bestv >= 0.35)
        a_near = float((own & near).sum() * area); a_far = float((own & ~near).sum() * area)
        px_needed = a_near * req ** 2 + a_far * req_far ** 2
        plates = int(math.ceil(px_needed / (W * H * USABLE ** 2))) if px_needed > 0 else 0
        cell_w, cell_h = W * USABLE / req, H * USABLE / req          # metres one native plate covers at the near px/m
        # which cells of the view actually contain owned surface (only those are requested)
        cells = []
        if own.any():
            u, vv, _ = CO.project_points(Pts[own], c, (W, H))
            mpp_v = 2 * dist * math.tan(math.radians(vfov) / 2) / H   # metres per view pixel at the target
            nx = max(1, math.ceil((u.max() - u.min()) * mpp_v / cell_w)); ny = max(1, math.ceil((vv.max() - vv.min()) * mpp_v / cell_h))
            ci = np.clip(((u - u.min()) / max(1e-6, u.max() - u.min()) * nx).astype(int), 0, nx - 1)
            cj = np.clip(((vv - vv.min()) / max(1e-6, vv.max() - vv.min()) * ny).astype(int), 0, ny - 1)
            occ_cells = np.zeros((ny, nx), int); np.add.at(occ_cells, (cj, ci), 1)
            nearc = np.zeros((ny, nx), int); np.add.at(nearc, (cj[near[own]], ci[near[own]]), 1)
            cells = [dict(i=int(i), j=int(j), near=bool(nearc[j, i] > 0)) for j in range(ny) for i in range(nx) if occ_cells[j, i] > 0]
        else: nx = ny = 0
        sec_pxm = min(W * USABLE / cell_w, H * USABLE / cell_h)
        assert not cells or sec_pxm >= req - 1e-6, "section plan below the required px/m"
        views.append(dict(c, aspect=asp, nativeSize=[W, H], visibleM=[round(w_m, 2), round(h_m, 2)],
                          viewPxPerM=round(view_pxm, 2), requiredPxPerM=round(req, 1),
                          ownedAreaM2=dict(near=round(a_near, 1), far=round(a_far, 1)),
                          sections=dict(nx=nx, ny=ny, count=len(cells), platesByArea=plates, metresEach=[round(cell_w, 2), round(cell_h, 2)],
                                        pxPerM=round(sec_pxm, 1), cells=cells),
                          expectedMask=mpath, expectedShade=(rep.get("renders") or {}).get(c["name"], {}).get("shade")))
    P = dict(type=profile["type"], crop=os.path.abspath(crop), heightM=height_m, coarse=os.path.abspath(coarse_dir),
             requiredPxPerM=round(req, 1), farPxPerM=req_far, nearM=near_m, closestApproachM=profile["texel"]["closestApproachM"], vfov=vfov,
             iouMin=thr["silhouetteIoU"], retries=thr["viewRetries"], views=views,
             totals=dict(views=len(views), sectionPlates=sum(v["sections"]["count"] for v in views),
                         surfaceM2=round(float(len(Pts) * area), 0),
                         imagineCallsMin=len(views) + sum(v["sections"]["count"] for v in views),
                         imagineCallsMax=len(views) * thr["viewRetries"] + sum(v["sections"]["count"] for v in views)),
             rules=["every view = image_edit of the key crop + accepted neighbour + coarse render (<= 3 sources)",
                    "one axis change per view (yaw OR elevation) vs <IMAGE_2>", "plates kept byte-identical: no resize, no re-encode",
                    f"sections precomputed: {round(req, 1)} px/m on surface within {near_m} m of the ground band, >= {req_far} px/m elsewhere; "
                    "each section is a full-size Imagine edit owning the most frontal surface"])
    os.makedirs(out, exist_ok=True)
    C.dump(P, os.path.join(out, "views-plan.json"))
    state = os.path.join(out, "views-state.json")
    if not os.path.exists(state): C.dump({v["name"]: dict(status="pending", attempts=[]) for v in views}, state)
    return P


def view_prompt(v, nb, attempt, last_iou=None):
    if nb is None:
        return ("Re-render <IMAGE_1> exactly: same object, same camera, same framing and proportions, same materials and "
                "colours, full detail at native resolution. No redesign, no new parts, no text. Plain uniform background.")
    axis = "elevation" if abs(nb["yaw"] - v["yaw"]) < 1e-6 else "yaw"
    s = (f"Same object as <IMAGE_1> and <IMAGE_2> (identical identity, proportions, materials, colours, damage). "
         f"<IMAGE_2> is the camera at yaw {nb['yaw']:.0f} deg, elevation {nb['elev']:.0f} deg. Change ONLY the camera {axis}: "
         f"new camera yaw {v['yaw']:.0f} deg, elevation {v['elev']:.0f} deg, orbiting the object, same distance and lens. "
         f"<IMAGE_3> is a grey clay render of the object from exactly this new camera: match its silhouette and proportions. "
         "Neutral even daylight, soft neutral dark shadows (never violet), whole object in frame, centred, base visible, "
         "plain uniform background. No redesign, no new damage, no text.")
    if attempt > 0:
        s += (f" Attempt {attempt + 1}: the previous result drifted (silhouette IoU {last_iou:.2f} < required). "
              "Follow the outline of <IMAGE_3> exactly; keep the mass, height/width ratio and the top shape.")
    return s


def load_state(P, out):
    return json.load(open(os.path.join(out, "views-state.json")))


def requests(plan_path, out_dir=None):
    P = json.load(open(plan_path)); out = out_dir or os.path.dirname(plan_path); S = load_state(P, out)
    acc = [n for n, s in S.items() if s["status"] == "accepted"]
    by = {v["name"]: v for v in P["views"]}; reqs = []
    for v in P["views"]:
        st = S[v["name"]]
        if st["status"] in ("accepted", "failed"): continue
        att = len(st["attempts"])
        if att >= P["retries"]: st["status"] = "failed"; continue
        is_front = abs(v["yaw"]) < 1e-6 and abs(v["elev"]) < 30 and not acc
        nbn = None if is_front else neighbour(v, acc, P["views"])
        if not is_front and nbn is None: continue          # wait until a one-axis neighbour is accepted
        nb = by.get(nbn)
        refs = [P["crop"]] + ([S[nbn]["accepted"]] if nb else []) + ([v["expectedShade"]] if nb and v.get("expectedShade") else [])
        last = st["attempts"][-1]["iou"] if st["attempts"] else None
        reqs.append(Request(id=f"{v['name']}-a{att + 1}", kind="edit", prompt=view_prompt(v, nb, att, last), refs=refs,
                            aspect=v["aspect"], out=os.path.join(out, "views", f"{v['name']}-a{att + 1}.jpg"), purpose="view",
                            meta=dict(view=v["name"], neighbour=nbn, attempt=att + 1)))
        if is_front: break                                   # everything else needs the accepted front first
    C.dump(S, os.path.join(out, "views-state.json"))
    if not reqs: return None, S
    n = len([f for f in os.listdir(out) if f.startswith("batch-views-")])
    return write_batch(reqs, os.path.join(out, f"batch-views-{n + 1}.json"), note="views (one-axis neighbours)"), S


def gate_view(image, expected_mask, iou_min, mask=None):
    """Silhouette IoU of an Imagine view vs the expected coarse render (or key mask for the front)."""
    img = C.load_rgb(image)
    vm = C.load_mask(mask, (img.shape[1], img.shape[0])) if mask else C.object_mask(img)
    em = C.load_mask(expected_mask)
    v = C.silhouette_iou(vm, em)
    return dict(iou=round(v, 4), pass_=v >= iou_min, size=list(Image.open(image).size))


def axis_kind(v):
    if abs(v["elev"]) >= 80: return "top"
    if abs(v["elev"]) < 30 and abs(abs((v["yaw"] + 180) % 360 - 180) - 90) < 1e-6: return "side"
    return None


def axis_gate(view_mask, front_mask, kind, profile_type):
    """An axis-DEFINING view (first side, first top) cannot be IoU-gated against a guessed depth. Instead:
    (1) it must not be a copy of the front (Imagine often returns the front again: m4-side 10-08), IoU < 0.93;
    (2) its width / front width must be a plausible depth ratio for the type (0.12..1.6)."""
    iou_front = C.silhouette_iou(view_mask, front_mask)
    nb, fb = C.bbox(view_mask), C.bbox(front_mask)
    ratio = ((nb[2] - nb[0]) / (nb[3] - nb[1])) / max(1e-6, (fb[2] - fb[0]) / (fb[3] - fb[1])) if kind == "side" else 1.0
    ok = (iou_front < 0.93 or profile_type in ("rock", "ice", "vegetation", "creature")) and 0.12 <= ratio <= 1.6
    if kind == "side" and iou_front >= 0.93 and profile_type not in ("rock", "ice", "vegetation", "creature"): ok = False
    return dict(ok=ok, iouVsFront=round(iou_front, 4), widthRatio=round(ratio, 3))


def accept(plan_path, view, image, mask=None, out_dir=None):
    P = json.load(open(plan_path)); out = out_dir or os.path.dirname(plan_path); S = load_state(P, out)
    vs = {x["name"]: x for x in P["views"]}; v = vs[view]
    if S[view]["status"] in ("accepted", "failed"):
        return dict(view=view, status=S[view]["status"], note="already decided; start a new attempt series via fixloop")
    exp = v["expectedMask"]; first = not any(s["status"] == "accepted" for s in S.values())
    C.assert_not_video_frame(image)
    img = C.load_rgb(image); vm = C.load_mask(mask, (img.shape[1], img.shape[0])) if mask else C.object_mask(img)
    size = list(Image.open(image).size)
    native_ok = tuple(size) == tuple(v["nativeSize"]) or tuple(size) == tuple(v["nativeSize"][::-1])
    kind = axis_kind(v); done_axes = P.get("axesDefined", [])
    if abs(v["yaw"]) < 1e-6 and abs(v["elev"]) < 30 and first:
        km = C.object_mask(C.load_rgb(P["crop"])); p = os.path.join(out, "key-mask.png")
        Image.fromarray(km.astype(np.uint8) * 255).save(p)
        iou_v = C.silhouette_iou(vm, km); ok = iou_v >= P["iouMin"]; how = "vs key silhouette"
        np.save(os.path.join(out, "front-mask.npy"), vm)
    elif kind and kind not in done_axes:
        fm = np.load(os.path.join(out, "front-mask.npy"))
        ag = axis_gate(vm, fm, kind, P["type"]); ok = ag["ok"]; iou_v = ag["iouVsFront"]; how = f"axis-defining {kind}: {ag}"
    else:
        iou_v = C.silhouette_iou(vm, C.load_mask(exp)); ok = iou_v >= P["iouMin"]; how = "vs coarse render"
    ok = ok and native_ok
    rec = C.provenance_record(image, request=f"{view}-a{len(S[view]['attempts']) + 1}")
    S[view]["attempts"].append(dict(path=os.path.abspath(image), iou=round(iou_v, 4), gate=how, nativeOk=native_ok, pass_=ok, provenance=rec))
    if ok:
        S[view]["status"] = "accepted"; S[view]["accepted"] = os.path.abspath(image)
        np.save(os.path.join(out, f"{view}-mask.npy"), vm)
        if kind and kind not in done_axes and not first:
            import coarse as CO   # coarse-to-fine: carve the scaffold with this view, re-render every camera
            nd = os.path.join(out, f"coarse-r{len(done_axes) + 1}")
            info = CO.refit(P["coarse"], vm, v, nd, P["views"])
            P["coarse"] = nd; P.setdefault("axesDefined", []).append(kind)
            for x in P["views"]:
                x["expectedMask"] = info["renders"][x["name"]]["mask"]; x["expectedShade"] = info["renders"][x["name"]]["shade"]
            C.dump(P, plan_path)
    elif len(S[view]["attempts"]) >= P["retries"]: S[view]["status"] = "failed"
    C.dump(S, os.path.join(out, "views-state.json"))
    return dict(view=view, status=S[view]["status"], gate=how, iou=round(iou_v, 4), iouMin=P["iouMin"], nativeOk=native_ok, attempts=len(S[view]["attempts"]))


def section_requests(plan_path, out_dir=None):
    """Section plates for every accepted view whose plan needs nx*ny > 1 (or 1 = the view plate itself is enough)."""
    P = json.load(open(plan_path)); out = out_dir or os.path.dirname(plan_path); S = load_state(P, out); reqs = []
    for v in P["views"]:
        if S[v["name"]]["status"] != "accepted" or not v["sections"]["cells"]: continue
        src = S[v["name"]]["accepted"]; nx, ny = v["sections"]["nx"], v["sections"]["ny"]
        for cell in v["sections"]["cells"]:
            i, j = cell["i"], cell["j"]
            if True:
                reqs.append(Request(id=f"{v['name']}-s{j}{i}", kind="edit", aspect=v["aspect"], refs=[P["crop"], src],
                    out=os.path.join(out, "sections", f"{v['name']}-s{j}{i}.jpg"), purpose="section",
                    meta=dict(view=v["name"], cell=[i, j], grid=[nx, ny], metres=v["sections"]["metresEach"], pxPerM=v["sections"]["pxPerM"]),
                    prompt=(f"Close-up of the region column {i + 1}/{nx}, row {j + 1}/{ny} (from top-left) of <IMAGE_2>, filling the whole frame: "
                            f"the same surface of the same object as <IMAGE_1>, about {v['sections']['metresEach'][0]:.1f} m wide x "
                            f"{v['sections']['metresEach'][1]:.1f} m tall, straight-on from the same camera, full native detail, same lighting, "
                            "no repetition, no new features, no text. Its borders must continue seamlessly into the neighbouring regions.")))
    if not reqs: return None
    return write_batch(reqs, os.path.join(out, "batch-sections.json"), note="section plates at the precomputed px/m")


def legacy_views_json(plan_path, out_json, out_dir=None):
    """Bridge to the v2 stages (hull.py / fuse.py, owned by the mesa pipeline): accepted views -> the plates.json shape
    they read today ({front, side, back, top}) + every other accepted view under "extra" with its camera, so fuse.py can
    fuse ALL 8-12 views once it iterates cameras instead of the four fixed names (see INTEGRATION.md)."""
    P = json.load(open(plan_path)); out = out_dir or os.path.dirname(plan_path); S = load_state(P, out)
    names = {"y000": "front", "y090": "side", "y180": "back", "top": "top"}
    res, extra = {}, {}
    for v in P["views"]:
        st = S[v["name"]]
        if st["status"] != "accepted": continue
        cam = dict(yaw=v["yaw"], elev=v["elev"], distM=v["distM"], vfov=v["vfov"], nativeSize=v["nativeSize"])
        if v["name"] in names: res[names[v["name"]]] = st["accepted"]
        else: extra[v["name"]] = dict(path=st["accepted"], camera=cam)
    res["extra"] = extra
    C.dump(res, out_json)
    return res


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("cmd", choices=["plan", "requests", "accept", "sections", "legacy"])
    ap.add_argument("--profile"); ap.add_argument("--type"); ap.add_argument("--height-m", type=float); ap.add_argument("--coarse")
    ap.add_argument("--crop"); ap.add_argument("--out"); ap.add_argument("--plan"); ap.add_argument("--view"); ap.add_argument("--image")
    ap.add_argument("--mask"); ap.add_argument("--closest", type=float)
    a = ap.parse_args()
    if a.cmd == "plan":
        prof = json.load(open(a.profile))["profile"] if a.profile else C.load_profile(a.type)
        P = plan(prof, a.height_m, a.coarse, a.crop, a.out, a.closest)
        print(json.dumps(P["totals"]), "required px/m", P["requiredPxPerM"])
    elif a.cmd == "requests": print(requests(a.plan)[0])
    elif a.cmd == "accept": print(json.dumps(accept(a.plan, a.view, a.image, a.mask)))
    elif a.cmd == "sections": print(section_requests(a.plan))
    elif a.cmd == "legacy": print(json.dumps(legacy_views_json(a.plan, a.out)))
