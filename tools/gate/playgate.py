"""tools/13 play-build gate. python3 -m tools.gate.playgate <play_url> <out_dir> [--spine spine.json] [--glb-dir DIR]
Checks on the SERVED page: (1) scene inventory vs declared nodes; (2) object material side vs GLB doubleSided and
unexpected transparency; (3) per-region no-grey on door-3m / threshold / wall-end renders; (4) camera vs spine.json."""
import json, os, struct, subprocess, sys
from tools.gate import nogrey
HERE = os.path.dirname(__file__)
CFG = json.load(open(os.path.join(HERE, "playgate.views.json")))
SPINE = "/workspace/grokcli/wt/zd-terrace-1012/steps/zone-d/01-terrace/spine.json"

def glb_materials(path):
    b = open(path, "rb").read(); n = struct.unpack("<I", b[12:16])[0]; j = json.loads(b[20:20 + n])
    return {m.get("name"): dict(doubleSided=bool(m.get("doubleSided")), alphaMode=m.get("alphaMode", "OPAQUE")) for m in j.get("materials", [])}

def scene_checks(inv, glb_mats):
    errs = []; plates = set(CFG["object"]["plates"]); obj = [m for m in inv if m["lodLevel"] is not None and m["lodLevel"] >= 0]
    n_lod = len(CFG["object"]["glb"])
    if len(obj) != n_lod: errs.append(f"object LOD meshes {len(obj)} != declared {n_lod}")
    rings = [m for m in inv if m["type"] == "RingGeometry"]; caps = [m for m in inv if m["type"] == "CapsuleGeometry"]
    ground = [m for m in inv if m["name"] == "ground"]
    other = [m for m in inv if m not in obj and m not in rings and m not in caps and m not in ground]
    for m in other: errs.append(f"undeclared node '{m['name'] or '?'}' ({m['type']})")
    for g in ground:
        for mt in g["materials"]:
            if mt["map"] and mt["map"] in plates: errs.append(f"ground node 'ground' uses object plate {mt['map']} (pictures the object: doorway shadows land on the ground)")
    for m in inv:
        for mt in m["materials"]:
            if (mt["transparent"] or mt["opacity"] < 1) and mt["name"] not in CFG["transparent_allowed"]:
                errs.append(f"unexpected transparent material '{mt['name']}' on '{m['name'] or m['type']}'")
    for m in obj:
        for mt in m["materials"]:
            g = glb_mats.get(mt["name"])
            if g and g["doubleSided"] and mt["side"] != 2:
                errs.append(f"LOD{m['lodLevel']} material '{mt['name']}': GLB doubleSided but page side={mt['side']} (back faces culled -> see-through)")
    return sorted(set(errs))

def camera_check(cam, spine_path):
    sp = json.load(open(spine_path))["camera"]; t = CFG["camera_tolerance"]
    want = dict(fov_deg=sp["vfov_deg"], boom_m=sp["behind"], height_m=sp["above"], pitch_deg=sp["pitch_deg"])
    have = dict(fov_deg=cam["fov0"], boom_m=cam["BOOM"], height_m=cam["EYE"], pitch_deg=round(cam["pitch_deg"], 3))
    diffs = {k: dict(page=have[k], spine=want[k]) for k in want if abs(have[k] - want[k]) > t[k]}
    return dict(page=have, spine=want, tolerance=t, diffs=diffs, pass_=not diffs)

def run(url, out, spine=SPINE, glb_dir=None, views=None):
    os.makedirs(out, exist_ok=True)
    cmd = ["node", os.path.join(HERE, "playgate.mjs"), url, out] + (["--views", ",".join(views)] if views else [])
    r = json.loads(subprocess.run(cmd, capture_output=True, text=True, timeout=1200, check=True).stdout.strip().splitlines()[-1])
    glb = os.path.join(glb_dir or "/workspace/zd-play-1012", CFG["object"]["glb"][0])
    sc = scene_checks(r["inventory"], glb_materials(glb)) + [f"page error in {n}: {e}" for n, v in r["views"].items() for e in v["errors"]]
    ng = {n: nogrey.check(v["png"]) for n, v in r["views"].items()}
    cam = camera_check(r["camera"], spine)
    rep = dict(gate="play-build", url=url, scene=dict(errors=sc, pass_=not sc), nogrey={n: dict(pass_=g["pass_"], worst=g["worstRegionFrac"], flat=g["flatGreyFrac"]) for n, g in ng.items()},
               camera=cam, renders={n: v["png"] for n, v in r["views"].items()}, inventory=r["inventory"])
    rep["pass_"] = rep["scene"]["pass_"] and all(g["pass_"] for g in rep["nogrey"].values()) and cam["pass_"]
    return rep

if __name__ == "__main__":
    a = sys.argv[1:]; sp = a[a.index("--spine") + 1] if "--spine" in a else SPINE
    rep = run(a[0], a[1], sp)
    s = json.dumps(rep, indent=1).replace('"pass_"', '"pass"'); open(os.path.join(a[1], "playgate.json"), "w").write(s)
    print(json.dumps(dict(scene=rep["scene"], nogrey=rep["nogrey"], camera={k: rep["camera"][k] for k in ("diffs", "pass_")}, pass_=rep["pass_"]), indent=1))
    sys.exit(0 if rep["pass_"] else 1)
