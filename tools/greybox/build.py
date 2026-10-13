#!/usr/bin/env python3
"""tools/greybox/build.py spine.json [--spec greybox-spec.json] --out DIR
Zone D terrace greybox at true scale from spine.json (single source of truth): grey boxes, inset world colliders,
snap sockets (named empties), a 1.8 m marker. Writes DIR/{greybox.glb, colliders.json, spine.json, build.json}."""
import argparse, json, shutil, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from tools.gatesuite import glbio  # noqa: E402


def spine_at(spine, s):
    P = spine["points"]
    S = np.array([p["s"] for p in P], float)
    xy = np.array([p["xy"] for p in P], float)
    y = np.array([p["y"] for p in P], float)
    i = int(np.clip(np.searchsorted(S, s), 1, len(S) - 1))
    t = (s - S[i - 1]) / (S[i] - S[i - 1])
    pos = xy[i - 1] + t * (xy[i] - xy[i - 1]); h = y[i - 1] + t * (y[i] - y[i - 1])
    d = xy[i] - xy[i - 1]
    return pos, h, d / np.linalg.norm(d), xy, y


def lane_dist(xy, x0, x1, n0, n1):
    """min distance from spine polyline points to the footprint rectangle (spine x, spine y)."""
    dx = np.maximum(np.maximum(x0 - xy[:, 0], xy[:, 0] - x1), 0)
    dy = np.maximum(np.maximum(n0 - xy[:, 1], xy[:, 1] - n1), 0)
    return float(np.hypot(dx, dy).min())


def build(spine_path, spec, out):
    spine = json.loads(Path(spine_path).read_text())
    v = tuple(int(x) for x in str(spine["version"]).split("v")[-1].split("."))
    assert v >= (1, 3, 1), f"spine {spine['version']} < 1.3.1"
    T = spec["terrace"]
    pos, gy, d, xy, ys = spine_at(spine, T["place_at_s"])
    left = np.array([-d[1], d[0]])                        # left of travel
    R, Tr, W = T["rise_m"], T["tread_m"], T["width_m"]
    depth = T["tiers"] * Tr + T["back_extra_m"]
    # axis-aligned footprint, front edge parallel to x (faces south = +z); push north until the lane is clear
    cx = pos[0]
    off = T["min_offset_from_spine_m"]
    while True:
        front_n = pos[1] + max(left[1], 0.3) * off
        if lane_dist(xy, cx - W / 2, cx + W / 2, front_n, front_n + depth) >= T["min_offset_from_spine_m"]:
            break
        off += 0.5
        assert off < 200, "no clear placement"
    off = round(lane_dist(xy, cx - W / 2, cx + W / 2, front_n, front_n + depth), 2)
    parts, cols, socks = [], [], []
    Z = lambda north: -north                               # glTF z
    def solid(name, lo, hi, collide=True):
        V, F = glbio.box(lo, hi)
        parts.append({"name": name, "V": V, "F": F})
        if collide:
            i = spec["colliders"]["inset_m"]
            cols.append({"id": f"col_{name}", "mesh": name, "world": True,
                         "min": (np.array(lo) + i).round(4).tolist(), "max": (np.array(hi) - i).round(4).tolist()})
    x0, x1 = cx - W / 2, cx + W / 2
    for k in range(T["tiers"]):
        n_front = front_n + k * Tr
        lo = [x0, gy + (0 if k == 0 else k * R - 0.0), Z(front_n + depth)]
        hi = [x1, gy + (k + 1) * R, Z(n_front)]
        if k > 0:
            lo[1] = gy + k * R          # tier k sits on tier k-1 tread top
        solid(f"tier{k + 1}", lo, hi)
        socks += [{"name": f"socket_tier{k + 1}_front_L", "translation": [x0, gy + (k + 1) * R, Z(n_front)]},
                  {"name": f"socket_tier{k + 1}_front_R", "translation": [x1, gy + (k + 1) * R, Z(n_front)]},
                  {"name": f"socket_tier{k + 1}_base_L", "translation": [x0, gy + k * R, Z(n_front)]}]
    c = T["cornice"]
    top1 = gy + c["on_tier"] * R
    solid("cornice", [x0, top1, Z(front_n + c["seat_m"])], [x1, top1 + c["thickness_m"], Z(front_n - c["overhang_m"])])
    socks += [{"name": "socket_cornice_end_L", "translation": [x0, top1, Z(front_n)]}, {"name": "socket_cornice_end_R", "translation": [x1, top1, Z(front_n)]}]
    x = x0 + c["corbel_step_m"] / 2
    i = 0
    while x < x1 - c["corbel_w_m"]:
        solid(f"corbel_{i}", [x - c["corbel_w_m"] / 2, top1 - 0.6, Z(front_n + 0.1)], [x + c["corbel_w_m"] / 2, top1, Z(front_n - c["overhang_m"] + 0.05)])
        x += c["corbel_step_m"]; i += 1
    dr = T["door"]
    socks += [{"name": "socket_door_jamb_L", "translation": [cx - dr["w_m"] / 2, gy, Z(front_n)]},
              {"name": "socket_door_jamb_R", "translation": [cx + dr["w_m"] / 2, gy, Z(front_n)]}]
    # door: drawn as a dark-grey inset panel (visual only), the tier-1 collider already ends at the wall face,
    # i.e. "flush with door back face" for a door that is not walkable
    mk = spec["marker"]
    mpos = pos + left * 1.5
    V, F = glbio.box([mpos[0] - 0.15, gy, Z(mpos[1]) - 0.15], [mpos[0] + 0.15, gy + mk["height_m"], Z(mpos[1]) + 0.15])
    parts.append({"name": mk["name"], "V": V, "F": F})
    for s_ in socks:
        parts.append({"name": s_["name"], "translation": s_["translation"], "extras": {"socket": True}})
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    glbio.write(out / "greybox.glb", parts, extras={"spine": spine["version"], "place_at_s": T["place_at_s"], "lane_clear_m": off})
    (out / "colliders.json").write_text(json.dumps(cols, indent=1))
    shutil.copy(spine_path, out / "spine.json")
    tris = sum(len(p["F"]) for p in parts if p.get("F") is not None)
    bj = {"name": "zd-terrace-greybox", "kind": "greybox", "spine": "spine.json", "glbs": {"lod0": "greybox.glb"}, "colliders": "colliders.json",
          "expect": {"height_m": T["total_height_m"], "tol": 0.10, "overhang": True}, "textures": [], "draws": 1,
          "note": "untextured greybox: kitjudge and texel density are expected to FAIL"}
    (out / "build.json").write_text(json.dumps(bj, indent=1))
    return {"out": str(out), "tris": tris, "colliders": len(cols), "sockets": len(socks), "lane_clear_m": off, "ground_y": round(gy, 2)}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("spine"); ap.add_argument("--spec", default=str(Path(__file__).parent / "greybox-spec.json")); ap.add_argument("--out", required=True)
    a = ap.parse_args()
    print(json.dumps(build(a.spine, json.loads(Path(a.spec).read_text()), a.out), indent=1))
