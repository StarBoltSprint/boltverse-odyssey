"""imagine-to-3d pipeline: hull -> proj -> relief -> blender -> qc -> GATE (mandatory final stage) -> package.
On FAIL the gate's auto-fixable rows are fixed and re-gated (max 3 rounds); only PASS is packaged/exported.
  python3 run.py --plates plates.json --type mesa --height 45 --name mesaA --work DIR --dest DIR --placements layout.json [--force-export]
Gate stage: uses tools/object-gate (gateObject CLI) when OBJECT_GATE_CLI is set or the CLI exists, else gate_local.py."""
import argparse, json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); PY = sys.executable
def sh(*a): print("+", " ".join(a)); subprocess.run(a, check=True)
OBJECT_GATE_CLI = os.environ.get("OBJECT_GATE_CLI") or next((p for p in [
    "/workspace/grokcli/wt/object-gate/tools/object-gate/cli.mjs", "/workspace/zb-preview-1008-tools/object-gate/cli.mjs"] if os.path.exists(p)), None)
def run_gate(spec, work):
    sp = f"{work}/gate-spec.json"; json.dump(spec, open(sp, "w"), indent=1)
    if OBJECT_GATE_CLI:
        r = subprocess.run(["node", OBJECT_GATE_CLI, "--spec", sp, "--json"], capture_output=True, text=True)
        try: return json.loads(r.stdout)
        except Exception: print("object-gate CLI output unreadable, falling back to gate_local", r.stderr[-400:])
    sys.path.insert(0, HERE); import gate_local
    return gate_local.gate(spec)
def main():
    ap = argparse.ArgumentParser()
    for k in ("plates", "type", "name", "work", "dest", "placements"): ap.add_argument("--" + k, required=True)
    ap.add_argument("--height", type=float, default=45); ap.add_argument("--blender", default="{}"); ap.add_argument("--force-export", action="store_true")
    ap.add_argument("--skip-build", action="store_true")
    a = ap.parse_args(); pre = f"{a.work}/{a.name}"; glb = f"{a.work}/glb"; os.makedirs(glb, exist_ok=True)
    plates = json.load(open(a.plates)); views = {k: v for k, v in plates.items() if k != "detail"}
    json.dump(views, open(f"{a.work}/views.json", "w"))
    bcfg = json.loads(a.blender); lodSwitch = bcfg.pop("lodSwitch", [0, 95, 320])
    placements = json.load(open(a.placements))
    for rnd in range(4):
        if not (a.skip_build and rnd == 0):
            sh(PY, f"{HERE}/hull.py", "--plates", f"{a.work}/views.json", "--out", pre, "--height", str(a.height))
            sh(PY, f"{HERE}/proj.py", pre + "-meta.json", f"{a.work}/views.json", pre + "-proj.json")
            sh(PY, f"{HERE}/relief.py", f"{a.work}/views.json", pre)
            sh("blender", "-b", "-P", f"{HERE}/blender_mesa.py", "--", pre, glb, json.dumps(bcfg))
            sh(PY, f"{HERE}/qc.py", f"{glb}/mesa.glb", f"{glb}/qc.json")
        sys.path.insert(0, HERE); import gate_local
        meta = json.load(open(pre + "-meta.json")); qcj = json.load(open(f"{glb}/qc.json"))
        spec = dict(type=a.type, name=a.name, meta=meta, qc=qcj, placements=placements, lodSwitch=lodSwitch,
                    radiusM=meta["half_w"], lodDev=gate_local.lod_dev(f"{glb}/mesa.glb"),
                    runtime=json.load(open(f"{a.work}/runtime-gate.json")) if os.path.exists(f"{a.work}/runtime-gate.json") else None)
        res = run_gate(spec, a.work)
        json.dump(res, open(f"{a.work}/gate-round{rnd}.json", "w"), indent=1)
        for r in res["rows"]: print(("PASS" if r["pass"] else "FAIL"), r["name"], r["value"], "limit", r["limit"])
        if res["pass_all"]: break
        fixed = False
        for r in res["rows"]:
            if r["pass"]: continue
            if r["name"].startswith("approach morph"):
                lodSwitch = [lodSwitch[0]] + [round(x * 1.35) for x in lodSwitch[1:]]; fixed = True
            elif r["name"].startswith("no repetition"):
                for t in r["value"]:
                    later = t.split("~")[1].split(" ")[0]
                    for p in placements:
                        if p["id"] == later and not p.get("face"): p["yaw"] = (p["yaw"] + 97) % 360; p["mirror"] = not p["mirror"]; fixed = True
            elif r["name"] == "LOD0 tris":
                bcfg.setdefault("lods", [60000, 12000, 2500]); bcfg["lods"][0] = int(bcfg["lods"][0] * 0.8); fixed = True
        json.dump(placements, open(a.placements, "w"), indent=1)
        a.skip_build = not any((not r["pass"]) and r["name"] == "LOD0 tris" for r in res["rows"]); 
        if not fixed: break
        print(f"--- auto-fix round {rnd + 1}: lodSwitch {lodSwitch}")
    json.dump(dict(lodSwitch=lodSwitch, gate=res), open(f"{a.work}/gate-final.json", "w"), indent=1)
    if res["pass_all"] or a.force_export:
        sh(PY, f"{HERE}/package.py", pre, a.plates, glb, a.dest, a.name)
        info = json.load(open(f"{a.dest}/{a.name}.json")); info["lodSwitch"] = lodSwitch; info["gate"] = res
        info["exportedOnFail"] = not res["pass_all"]; json.dump(info, open(f"{a.dest}/{a.name}.json", "w"))
        print("EXPORTED" + (" (FORCED, gate FAIL)" if not res["pass_all"] else " (gate PASS)"))
    else:
        print("NOT EXPORTED: gate FAIL"); sys.exit(1)

def main_strata():
    """v2 (blocky strata) pipeline for mesas/rock: hull -> depth_fuse -> depth_relief -> strata (+auto-fix seeds) -> GATE.
    python3 run.py strata --views views.json --sections sections.json --type mesa --name mesaA --work DIR --height 45 --out DIR"""
    ap = argparse.ArgumentParser(prog="run.py strata")
    for k in ("views", "sections", "type", "name", "work", "out"): ap.add_argument("--" + k, required=True)
    ap.add_argument("--height", type=float, default=45); ap.add_argument("--pxm", type=float, default=80)
    a = ap.parse_args(sys.argv[2:]); pre = f"{a.work}/{a.name}"; views = json.load(open(a.views)); secs = json.load(open(a.sections))
    sh(PY, f"{HERE}/hull.py", "--plates", a.views, "--out", pre, "--height", str(a.height))
    # stage depth_fuse: Depth Anything V2-Small on EVERY accepted view, TSDF fusion, cross-view consistency check
    sh(PY, f"{HERE}/fuse.py", pre, a.views, pre + "F")
    fz = json.load(open(pre + "F-fuse-report.json"))
    if not fz["consistency"]["ok"]: print("FAIL depth_fuse consistency", fz["consistency"]); sys.exit(1)
    # stage depth_relief: per section plate relief (shell displacement only), variance / spike check
    sh(PY, f"{HERE}/depth_relief.py", a.type, str(a.pxm), f"{a.work}/depth", *[secs[k] for k in secs["walls"]])
    dr = json.load(open(f"{a.work}/depth/depth-report.json"))
    bad = [k for k, v in dr["plates"].items() if not v["ok"]]
    if bad: print("WARN depth_relief plates below the variance/spike target (kept, gradient-limited):", bad)
    # stage strata (geometry + plate windows) with its own auto-fix loop (re-seed until repetition/manifold/stretch pass)
    env = dict(os.environ, HULL=a.name + "F", RELIEF_DIR=f"{a.work}/depth")
    os.makedirs(a.out, exist_ok=True)
    subprocess.run([PY, f"{HERE}/gen_strata_all.py", a.work, views["front"], views["top"], a.out], check=True, env=env)
    res = json.load(open(f"{a.out}/gen-summary.json"))
    ok = all(r[3] for r in res)
    print("GATE(strata stage):", "PASS" if ok else "FAIL", res)
    print("next: runtime gate (preview-gate.mjs mesa rows + object-gate CLI on the STAGING page), export only on PASS")
    sys.exit(0 if ok else 1)

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "strata": main_strata()
    else: main()
