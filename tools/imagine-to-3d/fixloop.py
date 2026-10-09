"""Stage 'fixloop' (q16 #3): the smart auto-fix loop. Every failure is mapped to ONE concrete action; the loop
regenerates only what failed, re-checks, escalates when the same defect survives, and HARD-FAILS after the profile's
fix.maxIterations (clamped 3..5). It never relaxes a threshold and never ships on FAIL.

Failure sources (all read as-is, no duplication of the gate):
  - tools/object-gate fix-plan.json (hooks/imagine-to-3d.mjs fixPlan(): {items:[{object, check, action, auto, detail}]})
  - compare.py compare-report.json (rows), pbr.py *-pbr-report.json (rows), views.py views-state.json (failed views),
    section plate sharpness (check_plates()).
Action ladder (failure -> action, escalation on repeat):
  low sharpness / native px/m      -> regen_section (split the section 2x2 => 2x px/m, Imagine edit per child)
  silhouette / view IoU            -> regen_view (new attempt, stronger prompt)  => refine_depth (coarse refit / fuse.py)
  missing checklist feature        -> targeted_edit (Imagine edit of the plate owning the item region, key crop as ref)
  colour / dE / histogram / LPIPS  -> regen_albedo (pbr 'albedo' edit, flat neutral light) => regen_section
  shadow tint / violet             -> regen_albedo (neutral dark shadows) + gate runtime action shadow-tint
  object-gate pipeline actions     -> pipeline (sink, heal-manifold, reunwrap, static-shadow, ... run by the build stage)
  verify-captures/write-checklist  -> vision (Grok vision step; NEEDS_REVIEW if it cannot run)

  python3 fixloop.py plan --gate-plan fix-plan.json --compare compare-report.json --views views-state.json --out actions.json
  python3 fixloop.py hook <fix-plan.json> --state DIR      # usable as object-gate --fix-cmd "python3 fixloop.py hook {plan} --state DIR"
"""
import argparse, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import i23d_common as C

LADDER = {   # failure class -> ordered actions (escalate to the next after the same defect survives a round)
    "sharpness": ["regen_section"],
    "silhouette": ["regen_view", "refine_depth", "regen_view"],
    "checklist": ["targeted_edit", "regen_view"],
    "colour": ["regen_albedo", "regen_section"],
    "shadow": ["regen_albedo", "pipeline:shadow-tint"],
    "perceptual": ["regen_albedo", "regen_view"],
    "repetition": ["regen_section"],
    "pipeline": ["pipeline"],
    "vision": ["vision"],
}
GATE_ACTION_CLASS = {   # object-gate FIX_ACTIONS.action -> failure class
    "plate-sections": "sharpness", "unique-plates": "repetition", "restore-native": "pipeline", "reunwrap": "pipeline",
    "texture-params": "pipeline", "declare-roles": "pipeline", "single-silhouette-lod": "pipeline", "static-shadow": "pipeline",
    "shadow-tint": "shadow", "cast-shadow": "pipeline", "sink": "pipeline", "heal-manifold": "pipeline", "add-relief": "pipeline",
    "rescale": "pipeline", "imagine-fx-texture": "colour", "verify-captures": "vision", "write-checklist": "vision",
    "fix-shader": "pipeline", "fix-runtime": "pipeline", "manual": "vision",
}
ROW_CLASS = [   # compare / pbr / views row name -> class
    (r"^LPIPS", "perceptual"), (r"^SSIM", "perceptual"), (r"^colour", "colour"), (r"^silhouette", "silhouette"),
    (r"^shadow", "shadow"), (r"^feature checklist", "checklist"), (r"^albedo delit", "colour"), (r"^dark areas", "shadow"),
    (r"native size|byte-identical", "pipeline"), (r"sharpness|px/m", "sharpness"), (r"^relight|normals", "pipeline"),
]


def gate_fix_actions():
    """Action names declared by object-gate hooks/imagine-to-3d.mjs FIX_ACTIONS (read from the source, no node needed)."""
    p = os.path.join(C.OBJECT_GATE_DIR or "", "hooks", "imagine-to-3d.mjs")
    return sorted(set(re.findall(r'action:\s*"([a-z0-9-]+)"', open(p).read()))) if os.path.exists(p) else []


def classify_row(name):
    for rx, cl in ROW_CLASS:
        if re.search(rx, name): return cl
    return "vision"


def collect(gate_plan=None, compare=None, pbr=None, views=None, plates=None):
    """-> list of failures {source, key, cls, detail}. key identifies 'the same defect' across rounds."""
    F = []
    if gate_plan:
        for it in json.load(open(gate_plan)).get("items", []):
            F.append(dict(source="object-gate", key=f"gate|{it['object']}|{it['check']}", cls=GATE_ACTION_CLASS.get(it["action"], "vision"),
                          gateAction=it["action"], auto=it.get("auto", False), detail=it.get("detail"), object=it["object"]))
    for src, path in (("compare", compare), ("pbr", pbr)):
        if not path: continue
        r = json.load(open(path))
        for row in r["rows"]:
            if row["status"] != "FAIL": continue
            if row["check"].startswith("feature checklist") and r.get("checklist"): continue   # handled per item below
            F.append(dict(source=src, key=f"{src}|{r['name']}|{row['check']}", cls=classify_row(row["check"]), detail=row["value"], limit=row["limit"],
                          report=os.path.abspath(path)))
        if src == "compare":
            for it in r.get("checklist", []):
                if it["status"] != "PASS":
                    unseen = "needs Grok vision" in it.get("how", "") or "re-verify" in it.get("how", "")
                    F.append(dict(source="compare-checklist", key=f"checklist|{it['id']}", cls="vision" if unseen else "checklist",
                                  item=it, report=os.path.abspath(path)))
    if views:
        for name, st in json.load(open(views)).items():
            if st["status"] == "failed" or (st["attempts"] and st["status"] != "accepted"):
                F.append(dict(source="views", key=f"view|{name}", cls="silhouette", view=name,
                              detail=[a["iou"] for a in st["attempts"]], hardFailed=st["status"] == "failed"))
    for p in plates or []:
        if not p["ok"]:
            F.append(dict(source="plates", key=f"plate|{p['plate']}", cls="sharpness", plate=p["plate"], detail=p))
    return F


def check_plates(plates, req_pxm, min_sharp=None):
    """Section plate check: native px/m >= required and Laplacian sharpness (Imagine soft outputs) >= min_sharp."""
    out = []
    for p in plates:
        img = C.load_rgb(p["path"]); sh = C.laplacian_sharpness(img)
        pxm = img.shape[1] / p["metresWide"]
        ok = pxm >= req_pxm and (min_sharp is None or sh >= min_sharp)
        out.append(dict(plate=p["path"], pxPerM=round(pxm, 1), sharpness=round(sh, 3), ok=ok, metresWide=p["metresWide"]))
    return out


def decide(failures, history, max_iter):
    """history: {key: [actions tried...]} -> actions for this round (escalating along the ladder)."""
    acts = []
    for f in failures:
        tried = history.get(f["key"], [])
        lad = LADDER[f["cls"]]
        if f["cls"] == "pipeline" and f.get("gateAction"): lad = [f"pipeline:{f['gateAction']}"]
        if f.get("hardFailed") and f["cls"] == "silhouette": lad = ["refine_depth", "regen_view"]   # view out of retries: fix the scaffold first
        step = lad[min(len(tried), len(lad) - 1)]
        acts.append(dict(action=step, failure=f, attempt=len(tried) + 1, imagine=step in ("regen_section", "regen_view", "targeted_edit", "regen_albedo"),
                         stuck=len(tried) >= max_iter))
    return acts


def plan(gate_plan=None, compare=None, pbr=None, views=None, out=None, obj_type="rock", history=None):
    prof = C.load_profile(obj_type); max_iter = max(3, min(5, prof["fix"]["maxIterations"]))
    F = collect(gate_plan, compare, pbr, views)
    A = decide(F, history or {}, max_iter)
    res = dict(type=obj_type, maxIterations=max_iter, failures=len(F), actions=A,
               needsReview=[a for a in A if a["action"] == "vision"], verdict="PASS" if not F else "FIX")
    if out: C.dump(res, out)
    return res


def run(check, apply, obj_type, max_iter=None, log=print):
    """Generic loop. check() -> failures list (collect() format); apply(actions) performs them (Imagine batches through
    imagine.py + stage re-runs). Same defect after its ladder is exhausted or iteration limit -> HARD FAIL."""
    prof = C.load_profile(obj_type); max_iter = max_iter or max(3, min(5, prof["fix"]["maxIterations"]))
    history, rounds = {}, []
    for it in range(1, max_iter + 1):
        F = check()
        rounds.append(dict(iteration=it, failures=[f["key"] for f in F]))
        if not F:
            log(f"iteration {it}: PASS"); return dict(status="PASS", iterations=it, rounds=rounds, history=history)
        if it == max_iter: break
        A = decide(F, history, max_iter)
        for a in A: history.setdefault(a["failure"]["key"], []).append(a["action"])
        rounds[-1]["actions"] = [(a["failure"]["key"], a["action"]) for a in A]
        log(f"iteration {it}: {len(F)} failures -> " + ", ".join(f"{a['action']}" for a in A))
        if any(a["action"] == "vision" for a in A) and all(a["action"] == "vision" for a in A):
            return dict(status="NEEDS_REVIEW", iterations=it, rounds=rounds, history=history)
        apply(A)
    log(f"HARD FAIL after {max_iter} iterations: {[f['key'] for f in F]}")
    return dict(status="FAIL", iterations=max_iter, rounds=rounds, history=history, remaining=[f["key"] for f in F])


def hook(fix_plan_path, state_dir, obj_type="rock"):
    """object-gate --fix-cmd entry: map the gate's fix plan to actions, write them (Imagine batches are emitted by the
    owning stage: views.py / pbr.py / section planner) and keep the history so escalation works across gate rounds."""
    os.makedirs(state_dir, exist_ok=True); hp = os.path.join(state_dir, "fix-history.json")
    hist = json.load(open(hp)) if os.path.exists(hp) else {}
    res = plan(gate_plan=fix_plan_path, obj_type=obj_type, history=hist, out=os.path.join(state_dir, f"actions-{len(hist)}.json"))
    for a in res["actions"]: hist.setdefault(a["failure"]["key"], []).append(a["action"])
    C.dump(hist, hp)
    return res


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("cmd", choices=["plan", "hook", "actions"]); ap.add_argument("plan_file", nargs="?")
    ap.add_argument("--gate-plan"); ap.add_argument("--compare"); ap.add_argument("--pbr"); ap.add_argument("--views"); ap.add_argument("--out")
    ap.add_argument("--state"); ap.add_argument("--type", default="rock")
    a = ap.parse_args()
    if a.cmd == "actions": print(json.dumps(gate_fix_actions()))
    elif a.cmd == "plan":
        r = plan(a.gate_plan, a.compare, a.pbr, a.views, a.out, a.type)
        for x in r["actions"]: print(x["action"], "<-", x["failure"]["key"])
    else:
        r = hook(a.plan_file, a.state or os.path.dirname(os.path.abspath(a.plan_file)), a.type)
        print(json.dumps(dict(actions=len(r["actions"]), review=len(r["needsReview"]))))
        sys.exit(3 if r["needsReview"] and len(r["needsReview"]) == len(r["actions"]) else 0)
