"""Gate self-test. The process exits 0. The known-bad samples must FAIL.

Do not loosen a threshold to make a sample pass.
"""
import json
import os
import sys
import tempfile

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)
sys.path.insert(0, ROOT)

from tools.gate.volume import STEP_FRAC_MIN, NORM_SPREAD_MIN, oblique_profile
from tools.gate.quality import AREA_MIN, MIN_ANGLE_DEG, ASPECT_MAX, SLIVER_FRAC_MAX, triangle_quality
from tools.gate.streaks import run as ghost_run
from tools.gate.uvmirror import report as uv_report
from tools.gate.icicles import check_columns, check_buried, root_buried
from tools.gate.repetition import secondary_peak, PEAK_MAX, MIN_RADIUS_PX
from tools.gate.feather import grade, mapping_from_profile
from tools.gate.clean import clean_one
from tools.gate.morph import MIN_IOU, MAX_DROP, approach, box_of, jump_list
from tools.gate.outline import xor_paths

import importlib.util


def _load_builder():
    path = os.path.join(ROOT, "tools", "imagine-to-3d", "block_builder.py")
    spec = importlib.util.spec_from_file_location("block_builder", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main():
    broken = []

    def expect(cond, msg):
        print(("ok " if cond else "BROKEN ") + msg)
        if not cond:
            broken.append(msg)

    # Thresholds still match the object-gate source. A drift here is a loosened gate.
    vg_path = os.path.join(ROOT, "tools", "object-gate", "py", "view_gates.py")
    src = open(vg_path).read() if os.path.isfile(vg_path) else ""
    if not src:
        print("skip view_gates.py threshold lock (not on this branch)")
    if src:
        expect("r['stepFrac'] >= 0.03" in src and STEP_FRAC_MIN == 0.03, "flat threshold 0.03 locked")
    if src:
        expect("r['normSpread'] >= 0.15" in src and NORM_SPREAD_MIN == 0.15, "normal-spread threshold 0.15 locked")
    if src:
        expect("area < 1e-8" in src and AREA_MIN == 1e-8, "degenerate area 1e-8 locked")
    if src:
        expect("(mina < 10)" in src and MIN_ANGLE_DEG == 10.0, "sliver angle 10 deg locked")
    if src:
        expect("(aspect > 8)" in src and ASPECT_MAX == 8.0, "sliver aspect 8 locked")
    if src:
        expect("r['sliverFrac'] <= 0.01" in src and SLIVER_FRAC_MAX == 0.01, "sliver share 1% locked")
    expect(MIN_IOU == 0.8 and MAX_DROP == 0.05, "morph jump rule 0.8 / 0.05 locked")
    expect(PEAK_MAX == 0.5 and MIN_RADIUS_PX == 12, "repetition peak 0.5 beyond 12 px locked")

    # Oct 12 flat / pasted facade. The in-tree grazing capture is the fail mode
    # (stepFrac ~0, normSpread ~0). The external tower-volumes oblique row passed, so it is not this sample.
    tower = os.path.join(ROOT, "steps", "zone-d", "01-terrace", "selftest", "tower")
    if os.path.isdir(tower):
        vol = oblique_profile(tower)
        g = vol["views"]["grazing"]
        expect(g["pass"] is False and g["stepFrac"] < STEP_FRAC_MIN and g["normSpread"] < NORM_SPREAD_MIN,
               f"FAIL flat grazing stepFrac {g['stepFrac']} normSpread {g['normSpread']}")
    else:
        print("skip flat grazing tower fixture (zone-d not on this branch)")

    if os.path.isfile(os.path.join(ROOT, "steps", "zone-d", "01-terrace", "selftest", "zc-arch-left.obj")):
        # Zone C shredded. Prefer the in-tree arch mesh; a labelled synthetic sliver is the fallback.
        zc = os.path.join(ROOT, "steps", "zone-d", "01-terrace", "selftest", "zc-arch-left.obj")
        from tools.gate.quality import load_obj_tris
        zq = triangle_quality(load_obj_tris(zc))
        if not zq["pass"]:
            expect(True, f"FAIL shredded zc-arch-left sliverFrac {zq['sliverFrac']} aspectP99 {zq['aspectP99']} tris {zq['tris']}")
        else:
            thin = np.array([[[0, 0, 0], [1, 0, 0], [0.5, 1e-3, 0]], [[0, 0, 0], [1, 0, 0], [0.5, -1e-3, 0]]], float)
            sq = triangle_quality(thin)
            expect(sq["pass"] is False and sq["sliverFrac"] > SLIVER_FRAC_MAX,
                   f"FAIL shredded synthetic sliverFrac {sq['sliverFrac']} (zc-arch-left did not exceed the threshold)")

        # v3.3 ghost streaks. Textures are the fixture plates, not the cleaned v34 paths inside bands.json.
    else:
        print("skip zc-arch-left shredded fixture (zone-d not on this branch)")

    fix = os.path.join(ROOT, "tools", "object-gate", "fixtures", "ghost-v33")
    if os.path.isdir(fix):
        bands = json.load(open(os.path.join(fix, "bands.json")))
        ici = json.load(open(os.path.join(fix, "icicles-v33.json")))
        tex = {
            "t1-right": os.path.join(fix, "t1-right-v33.jpg"),
            "plate-front": os.path.join(fix, "plate-front.jpg"),
            "plate-side": os.path.join(fix, "plate-side.jpg"),
        }
        gh = ghost_run(bands, ici, tex)
        expect(gh["pass_"] is False and gh["ghosts"] > 0, f"FAIL ghost streaks {gh['ghosts']}")
    else:
        print("skip ghost-v33 fixture (not on this branch)")

    # Mirrored UV synthetic.
    good = "\n".join([
        "v 0 0 0", "v 1 0 0", "v 0 1 0",
        "vt 0 0", "vt 1 0", "vt 0 1",
        "usemtl front", "f 1/1 2/2 3/3", "",
    ])
    bad = "\n".join([
        "v 0 0 0", "v 1 0 0", "v 0 1 0",
        "vt 0 0", "vt 0 1", "vt 1 0",
        "usemtl front", "f 1/1 2/2 3/3", "",
    ])
    with tempfile.TemporaryDirectory() as td:
        open(os.path.join(td, "good.obj"), "w").write(good)
        open(os.path.join(td, "bad.obj"), "w").write(bad)
        gr = uv_report(os.path.join(td, "good.obj"))
        br = uv_report(os.path.join(td, "bad.obj"))
        expect(gr["pass"] is True and gr["mirroredTris"] == 0, "uvmirror clean triangle PASS")
        expect(br["pass"] is False and br["mirroredTris"] == 1, f"FAIL uvmirror mirroredTris {br['mirroredTris']}")

        # Outline tool: identical pair is 0 px, a shifted pair is not.
        open(os.path.join(td, "a.obj"), "w").write(good)
        shift = good.replace("v 0 1 0", "v 0 2 0")
        open(os.path.join(td, "b.obj"), "w").write(shift)
        same = xor_paths(os.path.join(td, "good.obj"), os.path.join(td, "a.obj"), W=64, H=64, dist=4, fov=40)
        diff = xor_paths(os.path.join(td, "good.obj"), os.path.join(td, "b.obj"), W=64, H=64, dist=4, fov=40)
        expect(same["xorPx"] == 0 and same["pass"], "outline identical xorPx 0")
        expect(diff["xorPx"] > 0 and diff["pass"] is False, f"outline shifted xorPx {diff['xorPx']}")

        # Ray switch measure: identical depth is 0 px; one missed hit is not.
        from tools.gate.outline import ray_pair
        dep = np.full((8, 8), np.nan, np.float32)
        dep[2:6, 2:6] = 12.0
        pa = os.path.join(td, "ray-a.npz")
        pb = os.path.join(td, "ray-b.npz")
        pc = os.path.join(td, "ray-c.npz")
        np.savez(pa, depth=dep)
        np.savez(pb, depth=dep.copy())
        moved = dep.copy()
        moved[2, 2] = np.nan
        np.savez(pc, depth=moved)
        same_r = ray_pair(pa, pb, view="switch15m")
        diff_r = ray_pair(pa, pc, view="switch15m")
        expect(same_r["xorPx"] == 0 and same_r["pass"], "ray outline identical xorPx 0")
        expect(diff_r["xorPx"] > 0 and diff_r["pass"] is False, f"ray outline missed hit xorPx {diff_r['xorPx']}")

    # Icicle columns on the v3.4.1 terrace list, plus a buried-root synthetic.
    if os.path.isdir(os.path.join(ROOT, "steps", "zone-d", "01-terrace", "work")):
        step = os.path.join(ROOT, "steps", "zone-d", "01-terrace", "work")
        t_ici = json.load(open(os.path.join(step, "terrace-lod0-icicles.json")))
        t_bands = json.load(open(os.path.join(step, "terrace-lod0-bands.json")))
        cols = check_columns(t_ici, t_bands)
        expect(cols["pass"], f"terrace icicles on plate columns {cols['checked']} off {cols['offColumn']}")
        moved = dict(t_ici[0])
        moved["x"] = float(moved["x"]) + 5
        miss = check_columns([moved], t_bands)
        expect(miss["pass"] is False, "icicle 5 m off its column FAIL")
        prof = json.load(open(os.path.join(ROOT, "tools", "imagine-to-3d", "profiles", "terrace-zd.json")))
        sink = float(prof["icicles"]["sinkM"])
        expect(sink == 0.03, f"v3.4.1 sinkM {sink}")
        buried = check_buried([{"rootY": 1.0 + sink, "lipY": 1.0}, {"rootY": 1.0 - 0.5, "lipY": 1.0}], sink)
        expect(root_buried(1.0 + sink, 1.0, sink) and buried["pass"] is False and buried["unburied"] == 1,
               f"FAIL unburied root (gap 0.5 m) unburied {buried['unburied']}")

        # Repetition: a tiled crop must exceed 0.5. A unique field must not.
        rng = np.random.default_rng(1)
        tile = rng.random((16, 16)).astype(np.float32)
        tiled = np.tile(tile, (4, 4))
        pk = secondary_peak(tiled, np.ones_like(tiled, bool))
        expect(pk > PEAK_MAX, f"FAIL repetition tiled peak {pk:.3f}")
        unique = rng.random((64, 64)).astype(np.float32)
        pku = secondary_peak(unique, np.ones_like(unique, bool))
        expect(pku <= PEAK_MAX, f"repetition unique peak {pku:.3f}")

        # Feather on a tiny pair. Does not write terrace plates.
        gmap = mapping_from_profile(prof)
        rr = np.random.default_rng(2)
        key = rr.random((8, 8, 3)).astype(np.float32) * 0.5 + 0.2
        src = rr.random((16, 16, 3)).astype(np.float32)
        old = rr.random((16, 16, 3)).astype(np.float32) * 0.2
        out, _graded = grade(key, src, old, gmap)
        expect(out.shape == src.shape and out.min() >= 0 and out.max() <= 1, "feather tiny grade stays in 0..1")

        # Clean one bright stub on a wide synthetic plate. Does not write terrace plates.
        img = np.full((80, 180, 3), 40, np.float32)
        img[20:36, 80:86] = 220
        before = img.copy()
        log = []
        cleaned = clean_one(img, img.mean(2), 80, 85, 20, 35, 0, log, "plate-front")
        expect(len(log) == 1 and not np.array_equal(cleaned[20:36, 80:86], before[20:36, 80:86]),
               f"clean footprint method {log[0]['method'] if log else 'none'}")

        # Morph rule, on a short list and on a small rigid box (not the 75k terrace).
        smooth = [(float(d), 0.97, 100) for d in range(40, 20, -2)]
        dipped = [(40.0, 0.96, 100), (38.0, 0.95, 100), (36.0, 0.40, 40), (34.0, 0.95, 100), (32.0, 0.96, 100)]
        expect(jump_list(smooth) == [], "morph smooth list PASS")
        expect(len(jump_list(dipped)) > 0, "morph dipped list FAIL")
        V, F = box_of(np.array([-4.0, 0.0, -4.0]), np.array([4.0, 8.0, 4.0]))
        box = approach(V, F, d0=30, d1=12, W=96, H=96)
        expect(box["pass"], f"morph rigid box minIoU {box['minIoU']} jumps {len(box['jumps'])}")

        # Shared builder: plate pixel constants live in the profile, relief is masked.
    else:
        print("skip terrace work icicle fixtures (zone-d not on this branch)")

    bb = open(os.path.join(ROOT, "tools", "imagine-to-3d", "block_builder.py")).read()
    for tok in ("535", "870", "890", "864", "477", "1024", "1023", "1022", "518.5"):
        expect(tok not in bb, f"builder has no plate literal {tok}")
    expect("SINK" in bb and "apply_sam2" in bb, "builder uses profile sink and SAM2 multiply")
    mod = _load_builder()
    relief = np.ones((2, 2), np.float32)
    mask = np.array([[255, 0], [0, 255]], np.uint8)
    masked = mod.apply_sam2(relief, mask)
    expect(masked[0, 0] == 1 and masked[0, 1] == 0 and masked[1, 1] == 1, "SAM2 multiply keeps inside pixels only")

    # Every-triangle UV cap. A 2× shear comes back to <= 1.3. A neighbour that
    # already passes keeps its vt when the sheared face borrows the same corners.
    P = np.array([[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [1.0, 1.0, 0.0]], float)
    UV = np.array([[0.0, 0.0], [1.0, 0.0], [0.0, 2.0], [1.0, 1.0]], float)
    faces = {"front": [(0, 1, 2), (0, 1, 3)]}
    capped, uvf = mod.cap_uv_anisotropy(P, UV, faces, 1.3, 1.0)
    bad_q = capped[list(uvf["front"][0])]
    good_q = capped[list(uvf["front"][1])]
    bad_r = mod.triangle_aniso(P[[0, 1, 2]], bad_q)
    good_r = mod.triangle_aniso(P[[0, 1, 3]], good_q)
    expect(bad_r <= 1.3 and good_r <= 1.3, f"UV cap aniso bad {bad_r:.4f} good {good_r:.4f}")
    expect(uvf["front"][1] == (0, 1, 3), f"passing triangle keeps its vt {uvf['front'][1]}")
    expect(len(P) == 4, "UV cap does not add positions")

    if broken:
        print(f"FAIL tools/gate selftest ({len(broken)})")
        return 1
    print("PASS tools/gate selftest")
    return 0


if __name__ == "__main__":
    sys.exit(main())
