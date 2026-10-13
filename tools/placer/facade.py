"""tools/placer/facade.py - facade block layout measured from the AUTO key sheet (generic props, any key).
Every in-scope stone L2 element with >= 2 sub-parts contributes its parts.* props (block w/h px, joint width px,
bond, part protrusion). Pixel sizes become metres through the exact key camera on the assembled kit (ray hit
distance / focal), so render and key agree in the same frame; protrusion is taken scale-free from MoGe
(part_protrusion / block height in the key) and re-applied to the kit block height."""
import json, math, sys
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
import placer as PL


def measure(sheet_dir, meshes, inst, ks, scope=None):
    import cv2
    sd = Path(sheet_dir); sh = json.loads((sd / "sheet.json").read_text())
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "keysheet"))
    from auto_check import l2masks
    M2 = list(l2masks(sd)); els = [e for e in sh["elements"] if e["level"] == 2]
    L1 = cv2.imread(str(sd / "L1.png"), 0); e1 = [e for e in sh["elements"] if e["level"] == 1]
    els = e1 + els; M2 = [L1 == i for i in range(1, len(e1) + 1)] + M2      # big forms first: most blocks per sample
    S = None if scope is None else cv2.resize(cv2.imread(str(scope), 0), (1024, 1024)) > 127
    T = PL.kit_tris(meshes, inst); cam = PL.camera(ks)
    W, H, J, B, PR, WT = [], [], [], [], [], []
    for e, m in zip(els, M2):
        p = e.get("props") or {}
        if e["class"] != "stone" or p.get("parts.n", 0) < 2 or (S is not None and e["level"] == 2 and (m & S).sum() < 0.5 * m.sum()) or (S is not None and (m & S).sum() < 50):
            continue
        d = PL.ray(cam, p["_cx"], p["_cy"]); dist, n = PL.hit(T, cam[0], d)
        if e["level"] == 1:   # big form: cast at the centre of its in-scope part
            mm = m if S is None else (m & S)
            if mm.sum() < 50:
                continue
            ys, xs = np.nonzero(mm); d = PL.ray(cam, float(np.median(xs)), float(np.median(ys))); dist, n = PL.hit(T, cam[0], d)
        if not np.isfinite(dist) or abs(n[1]) < 0.5:          # facade = surface facing the camera (-y kit front)
            continue
        pxm = dist * float(d @ cam[1]) / cam[4]
        bw = max(p["parts.w_px"], p.get("parts.period_x_px", 0)); bh = max(p["parts.h_px"], p.get("parts.period_y_px", 0))
        WT.append(p["outline.area_px"]); W.append(bw * pxm); H.append(bh * pxm); J.append(p["parts.joint_w_px"] * pxm); B.append(p["parts.bond"])
        if "parts.part_protrusion_m" in p and p.get("size.h_m"):
            PR.append(p["parts.part_protrusion_m"] / max(p["parts.h_px"] * p["size.h_m"] / max(p["outline.h_px"], 1), 1e-3))
    def q(a):   # one vote per element (quartiles)
        return [round(float(v), 3) for v in np.percentile(a, [25, 50, 75])] if a else None
    return {"n_elements": len(W), "block_w_m": q(W), "block_h_m": q(H), "joint_w_m": q(J), "bond": q(B), "protrusion_rel_h": q(PR)}
