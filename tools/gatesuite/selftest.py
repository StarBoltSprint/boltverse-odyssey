"""gatesuite --selftest: every named must-fail fixture must FAIL (whole report and the named section),
and the controls must PASS their named section (so the suite is not FAIL-everything)."""
import json, shutil, tempfile
from pathlib import Path
import numpy as np
from tools.gatesuite import glbio
from tools.gatesuite.run import run, STEPS

FX = Path(__file__).resolve().parent / "fixtures"
V4_GLB = Path("/workspace/kitrelief-out/zd-tier-v4port/kit-lod0.glb")
TIER_GLB = Path("/workspace/kitrelief-out/zd-tier-v11/kit-lod0.glb")
rows = []


def row(name, ok, info=""):
    rows.append(bool(ok)); print(("PASS " if ok else "FAIL ") + name + (f"  [{info}]" if info else ""))


def mk(d, build, files=None):
    d.mkdir(parents=True, exist_ok=True)
    for k, v in (files or {}).items():
        if isinstance(v, (dict, list)):
            (d / k).write_text(json.dumps(v))
        else:
            shutil.copy(v, d / k)
    (d / "build.json").write_text(json.dumps(build))
    return str(d)


def box_glb(path, h=7.5, w=4.0, extra=(), uv=None, uv_u16=False, ext=None):
    V, F = glbio.box([-w / 2, 0, -0.5], [w / 2, h, 0.5])
    parts = [{"name": "tier1", "V": V, "F": F, "uv": uv if uv is not None else V[:, [0, 1]] / max(w, h) * 0 + np.array([[0, 0], [0, 1], [1, 0], [1, 1]] * 2), "uv_u16": uv_u16}]
    parts += list(extra)
    glbio.write(path, parts, ext_used=ext)


def marker():
    V, F = glbio.box([3, 0, 2], [3.3, 1.8, 2.3]); return {"name": "marker_1.8m", "V": V, "F": F}


def expect_fail(name, url, section):
    r = run(url)
    st = r["sections"][section]["status"]
    bad = [c for c in r["sections"][section]["checks"] if not c["ok"]][:2]
    row(f"must-fail {name}: report FAIL and section '{section}' FAIL", r["verdict"] == "FAIL" and st == "FAIL",
        json.dumps([(c["check"], c["value"]) for c in bad], default=str)[:220])
    return r


def main():
    T = Path(tempfile.mkdtemp(prefix="gatesuite-selftest-"))
    s131 = json.loads((FX / "spine-v1.3.1-89d9e684.json").read_text())
    s12 = json.loads((FX / "spine-v1.2-3e8dce00.json").read_text())
    s11 = json.loads(json.dumps(s12)); s11["version"] = "zd-spine.v1.1"; s11.get("climb", {})["pitch_blend_m"] = 0
    for p in s11["points"]:   # v1.1: no pitch blend, descent pitch snaps at s = 670 m
        if p["s"] >= 670:
            p["cam_pitch_deg"] = -10.0
    good = T / "good.glb"; box_glb(good, extra=[marker()])

    # 1 dd80963f: door dark plane + wall-end pale slabs drawn, not in the mesh list
    inv = {"inventory": [{"name": "tier1", "source": "build"}, {"name": "door_plane_dark", "source": "build"},
                         {"name": "wall_end_slab_L", "source": "build"}, {"name": "collider_wall_end_R", "source": "build"}], "probe": {}}
    expect_fail("dd80963f (drawn door plane + wall-end slabs)", mk(T / "dd80963f", {"kind": "tier", "glbs": {"lod0": "m.glb"}, "inventory": "inv.json"},
                {"spine.json": s131, "m.glb": good, "inv.json": inv}), "playgate")
    # 2 3e8dce00: meshopt UV range [0,0.25] vs unpacked [0,1]  (+ its v1.2 spine)
    packed = T / "packed.glb"
    box_glb(packed, uv=np.array([[0, 0], [0, 1], [1, 0], [1, 1]] * 2) * 0.25, uv_u16=True, ext=["KHR_mesh_quantization"])
    u = mk(T / "3e8dce00", {"kind": "tier", "glbs": {"lod0": "p.glb"}, "glb_ref": {"lod0": "u.glb"}}, {"spine.json": s12, "p.glb": packed, "u.glb": good})
    r = expect_fail("3e8dce00 (UV range [0,0.25] after packing)", u, "pack")
    row("3e8dce00 also fails spine (v1.2)", r["sections"]["spine"]["status"] == "FAIL")
    # 3 spine v1.1 / v1.2
    expect_fail("spine v1.1 (version)", mk(T / "s11", {"glbs": {"lod0": "m.glb"}}, {"spine.json": s11, "m.glb": good}), "spine")
    expect_fail("spine v1.1 (pitch snap at 670 m in the walk)", str(T / "s11"), "walk")
    expect_fail("spine v1.2 (version)", mk(T / "s12", {"glbs": {"lod0": "m.glb"}}, {"spine.json": s12, "m.glb": good}), "spine")
    # 4 12 %-tall box vs 7.5 m Reader spec
    small = T / "small.glb"; box_glb(small, h=0.12 * 7.5, extra=[marker()])
    expect_fail("12%-tall box", mk(T / "box12", {"kind": "tier", "glbs": {"lod0": "m.glb"}, "expect": {"height_m": 7.5}}, {"spine.json": s131, "m.glb": small}), "depthmeasure")
    # 5 10 cm collider (face 10 cm outside the visible mesh)
    cols = [{"id": "col_tier1", "mesh": "tier1", "min": [-2.0, 0, -0.6], "max": [2.1, 7.5, 0.5]}]
    expect_fail("10 cm collider", mk(T / "col10", {"kind": "tier", "glbs": {"lod0": "m.glb"}, "colliders": "c.json"}, {"spine.json": s131, "m.glb": good, "c.json": cols}), "layout")
    # 6 v4 tier (cornice on a single support block -> floats) and v9 tier views (chevron side, dark square chase)
    if V4_GLB.exists():
        r = expect_fail("zd-tier-v4 cornice (float)", mk(T / "v4", {"kind": "tier", "glbs": {"lod0": "m.glb"}, "expect": {"height_m": 7.5, "overhang": True}}, {"spine.json": s131, "m.glb": V4_GLB}), "depthmeasure")
        fl = [c for c in r["sections"]["depthmeasure"]["checks"] if c["check"].startswith("0 m float")]
        row("zd-tier-v4: the float check itself fails", fl and not fl[0]["ok"], fl[0]["value"] if fl else None)
        if TIER_GLB.exists():
            r = run(mk(T / "v11f", {"kind": "tier", "glbs": {"lod0": "m.glb"}, "expect": {"height_m": 7.5, "overhang": True}}, {"spine.json": s131, "m.glb": TIER_GLB}))
            fl = [c for c in r["sections"]["depthmeasure"]["checks"] if c["check"].startswith("0 m float")]
            row("control zd-tier-v11 (seated cornice): float check PASS", fl and fl[0]["ok"], fl[0]["value"] if fl else None)
    else:
        row("zd-tier-v4 fixture GLB present (build with tools/kit/specs/zd-tier-outline.json)", False, str(V4_GLB))
    r = expect_fail("zd-tier-v9 views (side chevron, chase dark square) + v9 judge", mk(T / "v9", {"kind": "tier", "glbs": {"lod0": "m.glb"}, "judge": {"score": "j.json"},
                    "views": {"side": "side.jpg", "chase": "chase.jpg"}}, {"spine.json": s131, "m.glb": good, "j.json": FX / "judge-v9.json",
                    "side.jpg": FX / "v9-side.jpg", "chase.jpg": FX / "v9-chase.jpg"}), "kitjudge")
    ck = {c["check"]: c["ok"] for c in r["sections"]["kitjudge"]["checks"]}
    row("v9 chase: dark hard rectangle detected", ck.get("chase: no dark hard rectangle") is False)
    row("v9 side: chevron/stripe repeat detected", ck.get("side: stripe/chevron repeat (FFT) < 9.0") is False)
    for v in ("v10", "v11"):
        expect_fail(f"judge score {v} (< 50)", mk(T / f"j{v}", {"glbs": {"lod0": "m.glb"}, "judge": {"score": "j.json"}, "views": {}},
                    {"spine.json": s131, "m.glb": good, "j.json": FX / f"judge-{v}.json"}), "kitjudge")
    # 7 missing / skipped sections are FAIL
    r = run(str(T / "box12"), only=["spine"])
    row("skipped sections count as FAIL", all(r["sections"][s]["status"] == "FAIL" for s in STEPS[1:]) and r["verdict"] == "FAIL")
    row("missing build.json -> every section FAIL", run(str(T / "nope"))["verdict"] == "FAIL")
    # controls (must PASS their section)
    r = run(mk(T / "ctl", {"kind": "tier", "glbs": {"lod0": "m.glb"}, "expect": {"height_m": 7.5},
                          "colliders": "c.json"}, {"spine.json": s131, "m.glb": good, "c.json": [{"id": "col", "mesh": "tier1", "min": [-1.98, 0, -0.48], "max": [1.98, 7.48, 0.48]}]}))
    row("control spine v1.3.1: spine PASS", r["sections"]["spine"]["status"] == "PASS")
    row("control spine v1.3.1 + inset collider: layout PASS", r["sections"]["layout"]["status"] == "PASS",
        json.dumps([c for c in r["sections"]["layout"]["checks"] if not c["ok"]])[:200])
    row("control 7.5 m box + 1.8 m marker: depthmeasure PASS", r["sections"]["depthmeasure"]["status"] == "PASS")
    print(f"{sum(rows)}/{len(rows)} rows pass")
    return 0 if all(rows) else 1
