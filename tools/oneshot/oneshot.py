#!/usr/bin/env python3
"""bolt oneshot <key-image|object-dir>: key image -> playable world, timed per stage.
Statuses: PASS, FAIL, NOT_IMPLEMENTED (stub, never a pass), ADOPTED (existing validated artifact reused,
not re-run, does not count as PASS), STOP (approval point), BLOCKED (input missing), SKIPPED (after STOP/FAIL)."""
import argparse, json, os, subprocess, sys, time, glob, math, datetime
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
VALIDATOR = os.environ.get("BOLT_TICKET_CLI", "/workspace/tools-09-validator/tools/build-ticket/cli.mjs")

def R(status, **kw): d = {"status": status}; d.update(kw); return d
def stub(why="not built yet"): return lambda c: R("NOT_IMPLEMENTED", note=why)
def adopt(*rels):
    def f(c):
        miss = [r for r in rels if not glob.glob(os.path.join(c["obj"], r))]
        return R("BLOCKED", missing=miss) if miss else R("ADOPTED", artifacts=list(rels))
    return f

def imagine_hook(c):
    # Stub hook: Imagine runs only through Grok Build's built-in Imagine, never the API. Nothing generated here.
    return R("NOT_IMPLEMENTED", note="hook only; Grok Build built-in Imagine, never the API; plates adopted from input")

def plate_gate(c):
    p = os.path.join(REPO, "learn/proposals/plate-precheck.json")
    if not os.path.exists(p): return R("NOT_IMPLEMENTED", note="learn/proposals/plate-precheck.json not present yet")
    return R("NOT_IMPLEMENTED", note="proposal present; checks not wired yet")

def plate_sheet(c):
    from PIL import Image
    fs = sorted(glob.glob(os.path.join(c["obj"], "plates", "*.jpg")))
    if not fs: return R("BLOCKED", missing=["plates/*.jpg"])
    W = 400; ims = []
    for f in fs:
        im = Image.open(f).convert("RGB"); im.thumbnail((W, W)); ims.append(im)  # sheet is a preview only
    cols = 4; rows = math.ceil(len(ims) / cols)
    sh = Image.new("RGB", (cols * W, rows * W), (20, 20, 20))
    for i, im in enumerate(ims): sh.paste(im, ((i % cols) * W, (i // cols) * W))
    out = os.path.join(c["out"], "plates-sheet.jpg"); sh.save(out, quality=90)
    c["t"]["t_plates_sheet"] = time.time() - c["t0"]
    return R("PASS", sheet=out, plates=[os.path.relpath(f, c["obj"]) for f in fs])

def approval_stop(c):
    if c["approved_plates"] or os.path.exists(os.path.join(c["obj"], "plates.approved")):
        return R("PASS", note="plates approved")
    return R("STOP", note="waiting for Art Director plate approval (plates.approved or --approved-plates)")

def lod_outline(c):
    p = os.path.join(c["obj"], "object-gate-v3.5", "lod-outline.json")
    if not os.path.exists(p): return R("NOT_IMPLEMENTED", note="no lod-outline report")
    d = json.load(open(p)); s = json.dumps(d)
    return R("ADOPTED", report=p, note="existing report read, not re-measured at 15/40 m")

def budget_gate(c):
    hits = glob.glob("/workspace/**/zone-d-perfbudget.v1.json", recursive=False) + glob.glob(os.path.join(REPO, "**/zone-d-perfbudget.v1.json"), recursive=True)
    if not hits: return R("NOT_IMPLEMENTED", note="zone-d-perfbudget.v1.json not found; limits 600k/850k vis tris, ground<=150k, per-object LOD0, 150/200 draws, 384 MB tex, UV stretch<=1.3")
    return R("NOT_IMPLEMENTED", note="budget file found at %s; gate not wired" % hits[0])

def spine_check(c):
    p = os.path.join(c["obj"], "spine.json")
    if not os.path.exists(p): return R("BLOCKED", missing=["spine.json"])
    d = json.load(open(p)); pts = d.get("points", []); errs = []
    if not str(d.get("schema", d.get("version", ""))).endswith("1.2"): errs.append("schema not spine v1.2 (%r)" % d.get("schema", d.get("version")))
    if not pts or any("xy" not in q for q in pts): errs.append("xy not filled")
    ss = [q.get("s", 0) for q in pts]
    if any(abs((b - a) - 5) > 1e-6 for a, b in zip(ss, ss[1:])): errs.append("points not every 5 m")
    for a, b in zip(pts, pts[1:]):
        ds = b.get("s", 0) - a.get("s", 0)
        if ds > 0 and abs(b.get("y", 0) - a.get("y", 0)) / ds > 0.14 + 1e-9: errs.append("grade > 14%% at s=%s" % b.get("s")); break
    return R("FAIL" if errs else "PASS", errors=errs, points=len(pts))

def ticket_validate(c):
    t = os.path.join(c["obj"], "ticket.json")
    if not os.path.exists(t) or not os.path.exists(VALIDATOR): return R("BLOCKED", missing=[t, VALIDATOR])
    tmp = os.path.join(c["out"], "ticket.copy.json"); open(tmp, "w").write(open(t).read())  # never edit the real ticket
    commit = json.load(open(t)).get("build", {}).get("commit", "")
    r = subprocess.run(["node", VALIDATOR, "validate", tmp, "--commit", commit], capture_output=True, text=True)
    try: j = json.loads(r.stdout)
    except Exception: return R("FAIL", stderr=r.stderr[-400:])
    return R("PASS" if j.get("ok") else "FAIL", reasons=j.get("reasons"), fields=j.get("fields"))

def final_sheet(c):
    return R("BLOCKED", note="needs a play build with spine camera (4.5 m back, 2.6 m up, 48 deg) + sky dome; current build has 58 deg camera")

STAGES = [  # (id, fn, stop_on_fail)
 ("reader_spec_sheet", adopt("spec.md"), True),
 ("imagine_hook", imagine_hook, False),
 ("plates", adopt("plates/*.jpg"), True),
 ("plate_gate", plate_gate, False),
 ("plate_contact_sheet", plate_sheet, True),
 ("plates_approval", approval_stop, True),
 ("depth_moge2", adopt("work"), True),
 ("segmentation_sam2", adopt("work"), True),
 ("mesh_build", adopt("glb/terrace-lod0.glb"), True),
 ("lod_generation", adopt("glb/terrace-lod1.glb", "glb/terrace-lod2.glb"), True),
 ("lod_outline_15_40m", lod_outline, False),
 ("budget_gate", budget_gate, False),
 ("packing_meshopt_ktx2", stub("meshopt uv>=14 bit, sky KTX2 reuse ktx2-final5-mip1-star mip1, LOD2 first"), False),
 ("object_gates", adopt("object-gate-v3.5/report.json"), False),
 ("ticket_validate", ticket_validate, False),
 ("zone_json_world_graph", adopt("placement-draft.json"), False),
 ("spine_from_key", spine_check, False),
 ("colliders_fit", stub("2 cm inset, <=5 cm outside visible, door plane flush to back face"), False),
 ("placement_gate", stub("0 m ground, >=2.5 m clear lane along spine"), False),
 ("colliders_never_drawn", stub(), False),
 ("play_build", stub("page must read camera+route from spine.json"), False),
 ("play_build_gate", stub("from executor 12134bcc"), False),
 ("bench", stub("&bench=1 result line"), False),
 ("first_frame", stub("t_first_frame"), False),
 ("scripted_walk", stub("sprint walk: LOD pop>0px, off-spine>5cm, pitch>1deg/frame, frametime at swaps; clips"), False),
 ("final_contact_sheet", final_sheet, False),
]

def run(target, out, approved_plates=False, counter=None):
    obj = target if os.path.isdir(target) else os.path.dirname(os.path.abspath(target))
    os.makedirs(out, exist_ok=True)
    c = {"obj": obj, "out": out, "approved_plates": approved_plates, "t0": time.time(), "t": {}}
    rows, halted = [], None
    for sid, fn, hard in STAGES:
        if halted: rows.append({"id": sid, "status": "SKIPPED", "after": halted, "s": 0}); continue
        t = time.time()
        try: r = fn(c)
        except Exception as e: r = R("FAIL", error=repr(e))
        r.update(id=sid, s=round(time.time() - t, 3)); rows.append(r)
        if r["status"] == "STOP" or (hard and r["status"] in ("FAIL", "BLOCKED")): halted = sid
    tot = time.time() - c["t0"]
    rep = {"schema": "oneshot.run.v1", "target": target, "started": datetime.datetime.fromtimestamp(c["t0"]).astimezone().isoformat(timespec="seconds"),
           "stages": rows, "total_s": round(tot, 3), "budget_s": 480,
           "timer": {"t_plates_sheet": c["t"].get("t_plates_sheet"), "t_first_frame": None, "t_sheet_ready": None, "t_keep": None},
           "counts": {k: sum(1 for r in rows if r["status"] == k) for k in ("PASS","FAIL","NOT_IMPLEMENTED","ADOPTED","STOP","BLOCKED","SKIPPED")},
           "world_done": False, "note": "world done only after play-build gate PASS and Art Director KEEP (t_keep)"}
    json.dump(rep, open(os.path.join(out, "oneshot-run.json"), "w"), indent=1)
    if counter: append_counter(counter, rep)
    return rep

def append_counter(path, rep):
    d = json.load(open(path)) if os.path.exists(path) else {"schema": "progress-counter.v1", "percent": 49, "percent_source": "Director room 2026-10-13 (meter in wt/tools-14-progress-meter, untracked)", "runs": []}
    d["runs"].append({k: rep[k] for k in ("started", "target", "total_s", "timer", "counts")})
    json.dump(d, open(path, "w"), indent=1)

def record_keep(run_json, counter, when=None):
    rep = json.load(open(run_json)); t0 = datetime.datetime.fromisoformat(rep["started"])
    now = datetime.datetime.fromisoformat(when) if when else datetime.datetime.now().astimezone()
    rep["timer"]["t_keep"] = round((now - t0).total_seconds(), 1); json.dump(rep, open(run_json, "w"), indent=1)
    if counter and os.path.exists(counter):
        d = json.load(open(counter))
        for r in d["runs"]:
            if r["started"] == rep["started"]: r["timer"]["t_keep"] = rep["timer"]["t_keep"]
        json.dump(d, open(counter, "w"), indent=1)
    return rep

if __name__ == "__main__":
    ap = argparse.ArgumentParser(prog="bolt oneshot"); sp = ap.add_subparsers(dest="cmd", required=True)
    a = sp.add_parser("run"); a.add_argument("target"); a.add_argument("--out", required=True); a.add_argument("--approved-plates", action="store_true"); a.add_argument("--counter")
    k = sp.add_parser("keep"); k.add_argument("run_json"); k.add_argument("--counter"); k.add_argument("--when")
    x = ap.parse_args()
    if x.cmd == "run":
        r = run(x.target, x.out, x.approved_plates, x.counter)
        for s in r["stages"]: print("%-24s %-16s %6.3fs" % (s["id"], s["status"], s["s"]))
        print("total %.3fs" % r["total_s"], r["counts"])
    else: print(json.dumps(record_keep(x.run_json, x.counter, x.when)["timer"]))
