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
  python3 fixloop.py keyloop spec.yaml                     # 2026-10-10: key-compare closed loop (shape / colour / detail)

Key-compare loop (SmiR 2026-10-10, `keyloop`): object-gate key-compare.mjs scores every key element (outline IoU,
lit / shadow CIEDE2000, structure SSIM) from the key camera; on any FAIL or below-target score the loop applies the
corrections below, re-renders and re-scores, until every target is met or progress stalls (no metric of any element
improves for `stallRounds` rounds) or `maxRounds`. It ALWAYS reports per element and metric: first, best, last, target,
gap, and the measurement ceiling (key vs itself after unavoidable render losses). Honest limit: a 3D object seen from
one angle cannot reach 100 % against a 2D painting; targets above the ceiling are reported as unreachable, not chased.
  shape  (iou)               -> shape-seed search toward the key mask (spec apply.shapeSeed), then silhouette warp
                                (per-column skyline delta key vs game written to kc-warp-<el>.json, spec apply.silhouetteWarp)
  colour (deLit / deShadow)  -> grade-match: accumulated render-measured CIELAB offset (key - game, lit and shadow
                                separately) written to kc-grade.json, applied to the element's Imagine plates by
                                palette.py shift (spec apply.colour) - Imagine pixels only
  detail (structure)         -> plate re-pick (existing plates ranked by style score vs the key crop, kc-plates-<el>.json,
                                spec apply.plateRepick), then relief strength sweep, then detail-layer sweep
                                (spec apply.relief / apply.detail: {cmd, values})
NEVER generates Imagine images: a missing element or a detail stall below the gate writes imagine-requests.json
(status NEEDS_APPROVAL). An action whose command is not in the spec is reported as NOT_WIRED (honest), never faked.
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
    # 2026-10-10 key-compare + consistency classes (keyloop applies them; plan/hook only list them)
    "kc-shape": ["shape_seed", "silhouette_warp", "shape_seed"],
    "kc-colour": ["grade_match", "grade_match"],
    "kc-detail": ["plate_repick", "relief_strength", "detail_tune", "imagine_request"],
    "kc-missing": ["imagine_request"],
    "consistency": ["regrade", "imagine_request"],
}
GATE_ACTION_CLASS = {   # object-gate FIX_ACTIONS.action -> failure class
    "plate-sections": "sharpness", "unique-plates": "repetition", "restore-native": "pipeline", "reunwrap": "pipeline",
    "texture-params": "pipeline", "declare-roles": "pipeline", "single-silhouette-lod": "pipeline", "static-shadow": "pipeline",
    "shadow-tint": "shadow", "cast-shadow": "pipeline", "sink": "pipeline", "heal-manifold": "pipeline", "add-relief": "pipeline",
    "rescale": "pipeline", "imagine-fx-texture": "colour", "verify-captures": "vision", "write-checklist": "vision",
    "fix-shader": "pipeline", "fix-runtime": "pipeline", "manual": "vision",
    "kc-shape": "kc-shape", "kc-colour": "kc-colour", "kc-detail": "kc-detail", "build-element": "kc-missing",
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


KC_CLASS = {"iou": "kc-shape", "deLit": "kc-colour", "deShadow": "kc-colour", "structure": "kc-detail"}


def collect_key_compare(path, include_gaps=False):
    """object-gate key-compare.json / report.json -> failures (FAIL rows; with include_gaps also below-target metrics)."""
    r = json.load(open(path)); F = []
    for e in r["elements"]:
        if e["verdict"] == "N/A" or e.get("reportOnly"): continue
        if e["verdict"] == "MISSING":
            F.append(dict(source="key-compare", key=f"kc|{e['id']}|missing", cls="kc-missing", element=e["id"], detail="missing in game")); continue
        for f in e.get("fails", []):
            m = f.split()[0]; F.append(dict(source="key-compare", key=f"kc|{e['id']}|{m}", cls=KC_CLASS.get(m, "vision"), element=e["id"], metric=m, detail=f, hard=True))
        if include_gaps:
            for g in e.get("gaps", []):
                if not any(x["key"] == f"kc|{e['id']}|{g['metric']}" for x in F):
                    F.append(dict(source="key-compare", key=f"kc|{e['id']}|{g['metric']}", cls=KC_CLASS[g["metric"]], element=e["id"], metric=g["metric"], detail=g, hard=False))
    return F


def collect_consistency(path):
    r = json.load(open(path)); F = []
    for row in r["rows"]:
        bad = row.get("verdict") in ("FLAG", "REJECT") or row.get("status") == "FAIL"
        if bad: F.append(dict(source="consistency", key=f"cons|{os.path.basename(row.get('image') or row.get('b'))}", cls="consistency", detail=row))
    return F


def collect(gate_plan=None, compare=None, pbr=None, views=None, plates=None, key_compare=None, consistency=None):
    """-> list of failures {source, key, cls, detail}. key identifies 'the same defect' across rounds."""
    F = []
    if key_compare: F += collect_key_compare(key_compare)
    for c in ([consistency] if isinstance(consistency, str) else consistency or []): F += collect_consistency(c)
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
        acts.append(dict(action=step, failure=f, attempt=len(tried) + 1, imagine=step in ("regen_section", "regen_view", "targeted_edit", "regen_albedo", "imagine_request"),
                         stuck=len(tried) >= max_iter))
    return acts


def plan(gate_plan=None, compare=None, pbr=None, views=None, out=None, obj_type="rock", history=None, key_compare=None, consistency=None):
    prof = C.load_profile(obj_type); max_iter = max(3, min(5, prof["fix"]["maxIterations"]))
    F = collect(gate_plan, compare, pbr, views, key_compare=key_compare, consistency=consistency)
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


# ---------------------------------------------------------------- key-compare closed loop (2026-10-10)
import subprocess, shutil, time
LOWER_BETTER = {"deLit", "deShadow"}
EPS = {"iou": 0.005, "deLit": 0.3, "deShadow": 0.3, "structure": 0.01}


def _kc_run(kc, out, url=None):
    cmd = ["node", os.path.join(C.OBJECT_GATE_DIR, "key-compare.mjs"), "--spec", kc["spec"], "--out", out, "--only", ",".join(kc["elements"])]
    if url: cmd += ["--url", url]
    if kc.get("camera"): cmd += ["--camera", kc["camera"]]
    if kc.get("gameImage"): cmd += ["--game", kc["gameImage"]]   # offline / self-test: score an image the apply commands rewrite
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=kc.get("timeoutS", 7200))
    if not os.path.exists(os.path.join(out, "key-compare.json")): raise RuntimeError(f"key-compare did not run: {r.stderr[-600:]}")
    return json.load(open(os.path.join(out, "key-compare.json")))


def _better(m, a, b):
    """is a better than b by more than EPS"""
    if b is None: return a is not None
    if a is None: return False
    return (b - a > EPS[m]) if m in LOWER_BETTER else (a - b > EPS[m])


def _sub(cmd, **kw):
    for k, v in kw.items(): cmd = cmd.replace("{" + k + "}", str(v))
    return cmd


def _skyline_warp(job_dir, el):
    """Per-column top edge (fraction of the frame) of the key mask vs the game mask: the silhouette warp target."""
    import numpy as np
    sil = os.path.join(job_dir, "crops", f"{el}-gamesil.png")   # occlusion-free silhouette when the element has one (mask render)
    km = C.load_mask(os.path.join(job_dir, "crops", f"{el}-keymask.png")); gm = C.load_mask(sil if os.path.exists(sil) else os.path.join(job_dir, "crops", f"{el}-gamemask.png"))
    H = km.shape[0]
    top = lambda m: [float(np.argmax(m[:, x]) / H) if m[:, x].any() else None for x in range(0, m.shape[1], 4)]
    k, g = top(km), top(gm)
    return dict(element=el, step=4, keyTop=k, gameTop=g, delta=[None if a is None or b is None else round(a - b, 4) for a, b in zip(k, g)],
                note="positive delta = the key edge is LOWER on screen than the game edge (lower the silhouette there)")


def _plate_rank(job_dir, el, plates):
    import consistency as CO
    kc = C.load_rgb(os.path.join(job_dir, "crops", f"{el}-key.png"))
    rank = sorted(({"plate": p, **CO.style_score(C.load_rgb(p), kc)} for p in plates), key=lambda r: -r["style"])
    return rank


def keyloop(spec_path, log=print):
    spec = C.read_yaml(spec_path); kc = spec["keyCompare"]; work = os.path.join(spec["work"], "keyloop"); os.makedirs(work, exist_ok=True)
    base = os.path.dirname(os.path.abspath(spec_path))
    kc["spec"] = kc["spec"] if os.path.isabs(kc["spec"]) else os.path.join(base, kc["spec"])
    apply = kc.get("apply", {}); max_rounds = kc.get("maxRounds", 6); stall_rounds = kc.get("stallRounds", 2)
    offsets = {}; tried = {}; hist = []; best = {}; stall = 0; requests = []; not_wired = set()
    rnd = 0
    while True:
        rnd += 1; out = os.path.join(work, f"round-{rnd}")
        R = _kc_run(kc, out, spec.get("stagingUrl") or kc.get("url"))
        els = {e["id"]: e for e in R["elements"] if e["verdict"] != "N/A"}
        snap = {i: {m: e.get(m) for m in EPS} for i, e in els.items()}
        hist.append(dict(round=rnd, dir=out, verdict=R["verdict"], metrics=snap, actions=[]))
        improved = False
        for i, mm in snap.items():
            for m, v in mm.items():
                b = best.get(i, {}).get(m)
                if _better(m, v, b[0] if b else None): best.setdefault(i, {})[m] = (v, rnd); improved = improved or b is not None
                elif b is None and v is not None: best.setdefault(i, {})[m] = (v, rnd)
        stall = 0 if improved or rnd == 1 else stall + 1
        F = collect_key_compare(os.path.join(out, "key-compare.json"), include_gaps=True)
        log(f"[keyloop] round {rnd}: {R['verdict']} {R['summary']} · {len(F)} below target · stall {stall}")
        if not F: status = "TARGETS_MET"; break
        if rnd >= max_rounds: status = "MAX_ROUNDS"; break
        if stall >= stall_rounds: status = "STALLED"; break
        acted = 0; done_now = set()
        for f in F:
            el = f["element"]
            if f["cls"] == "kc-missing":
                requests.append(dict(kind="imagine_request", status="NEEDS_APPROVAL", element=el, reason="element of the key missing in game", sources=[R["key"]])); continue
            lad = LADDER[f["cls"]]; n = tried.setdefault(f["key"], 0); step = lad[min(n, len(lad) - 1)]; tried[f["key"]] = n + 1
            if (el, step) in done_now: continue   # lit + shadow (or several metrics) -> one action per element per round
            done_now.add((el, step))
            e = els[el]; ctx = dict(work=work, element=el, round=rnd, job=out)
            if step == "grade_match":
                o = offsets.setdefault(el, {"lit": [0, 0, 0], "shadow": [0, 0, 0]}); g = kc.get("colourGain", 0.8)
                for half, kk, gg in (("lit", "labKeyLit", "labGameLit"), ("shadow", "labKeyShadow", "labGameShadow")):
                    if e.get(kk) and e.get(gg): o[half] = [round(o[half][c] + g * (e[kk][c] - e[gg][c]), 2) for c in range(3)]
                op = os.path.join(work, "kc-grade.json"); C.dump(offsets, op); ctx["offsets"] = op; cmd = apply.get("colour")
            elif step == "shape_seed": cmd = apply.get("shapeSeed")
            elif step == "silhouette_warp":
                wp = os.path.join(work, f"kc-warp-{el}.json"); C.dump(_skyline_warp(out, el), wp); ctx["warp"] = wp; cmd = apply.get("silhouetteWarp")
            elif step == "plate_repick":
                pl = sorted(glob_plates(kc.get("plates", {}).get(el)))
                if pl: rp = os.path.join(work, f"kc-plates-{el}.json"); C.dump(_plate_rank(out, el, pl), rp); ctx["ranking"] = rp
                cmd = apply.get("plateRepick")
            elif step in ("relief_strength", "detail_tune"):
                a = apply.get("relief" if step == "relief_strength" else "detail") or {}; vals = a.get("values", []); k = tried[f["key"]] - 1
                cmd = a.get("cmd") if vals else None; ctx["value"] = vals[min(k, len(vals) - 1)] if vals else ""
            elif step == "imagine_request":
                requests.append(dict(kind="imagine_edit", status="NEEDS_APPROVAL", element=el, reason=f"{f['metric']} stalled: {f['detail']}",
                                     sources=[os.path.join(out, "crops", f"{el}-key.png")], prompt=f"New Imagine plate for {el}: match the key crop's material, detail scale and lighting."))
                continue
            else: cmd = None
            if not cmd: not_wired.add(f"{step} ({el})"); hist[-1]["actions"].append(dict(element=el, action=step, status="NOT_WIRED")); continue
            c = _sub(cmd, **ctx); log(f"[keyloop]   {el}: {step} -> {c}")
            r = subprocess.run(c, shell=True, cwd=C.HERE, capture_output=True, text=True, timeout=kc.get("applyTimeoutS", 7200))
            hist[-1]["actions"].append(dict(element=el, action=step, cmd=c, exit=r.returncode, tail=(r.stdout + r.stderr)[-300:])); acted += 1
        if not acted: status = "NOTHING_TO_APPLY"; break
    # honest final report: first / best / last / target / gap / measurement ceiling, per element and metric
    last = {e["id"]: e for e in R["elements"]}; first = hist[0]["metrics"]; rows = []
    for i, e in last.items():
        if e["verdict"] == "N/A": continue
        tg = e.get("target") or {}
        for m, tk in (("iou", "iouTarget"), ("deLit", "deLitTarget"), ("deShadow", "deShadowTarget"), ("structure", "structureTarget")):
            if e.get(m) is None: continue
            b = best.get(i, {}).get(m, (None, None)); t = tg.get(tk); ceil = (e.get("ceiling") or {}).get(m)
            reach = None if t is None or ceil is None else ((ceil <= t) if m in LOWER_BETTER else (ceil >= t))
            gap = None if t is None or b[0] is None else round(max(0, (b[0] - t) if m in LOWER_BETTER else (t - b[0])), 3)
            rows.append(dict(element=i, metric=m, first=first.get(i, {}).get(m), best=b[0], bestRound=b[1], last=e.get(m), target=t, gap=gap, ceiling=ceil,
                             targetReachable=reach, bestAchievable=ceil if reach is False else t))
    rep = dict(tool="imagine-to-3d keyloop", status=status, rounds=rnd, history=hist, table=rows, notWired=sorted(not_wired),
               imagineRequests=requests, lastSheet=os.path.join(out, "sheet.jpg"))
    C.dump(rep, os.path.join(work, "keyloop-report.json")); C.dump(requests, os.path.join(work, "imagine-requests.json"))
    L = [f"# keyloop: {status} after {rnd} round(s)", "", f"last sheet `{rep['lastSheet']}`", "",
         "| element | metric | first | best (round) | last | target | gap | ceiling (estimate) | target reachable |", "|---|---|---|---|---|---|---|---|---|"]
    L += [f"| {r['element']} | {r['metric']} | {r['first']} | {r['best']} ({r['bestRound']}) | {r['last']} | {r['target']} | {r['gap']} | {r['ceiling']} | {r['targetReachable']} |" for r in rows]
    if not_wired: L += ["", "Not wired in this spec (no command, nothing faked): " + ", ".join(sorted(not_wired))]
    if requests: L += ["", f"{len(requests)} Imagine request(s) written (NOT run, need approval): `{os.path.join(work, 'imagine-requests.json')}`"]
    open(os.path.join(work, "KEYLOOP.md"), "w").write("\n".join(L) + "\n")
    return rep


def glob_plates(spec):
    import glob as G
    if not spec: return []
    if isinstance(spec, list): return [p for s in spec for p in G.glob(s)]
    return G.glob(spec)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("cmd", choices=["plan", "hook", "actions", "keyloop"]); ap.add_argument("plan_file", nargs="?")
    ap.add_argument("--gate-plan"); ap.add_argument("--compare"); ap.add_argument("--pbr"); ap.add_argument("--views"); ap.add_argument("--out")
    ap.add_argument("--key-compare"); ap.add_argument("--consistency", nargs="*")
    ap.add_argument("--state"); ap.add_argument("--type", default="rock")
    a = ap.parse_args()
    if a.cmd == "actions": print(json.dumps(gate_fix_actions()))
    elif a.cmd == "keyloop":
        r = keyloop(a.plan_file); print(json.dumps(dict(status=r["status"], rounds=r["rounds"], notWired=r["notWired"], requests=len(r["imagineRequests"]))))
        sys.exit(0 if r["status"] == "TARGETS_MET" else 1)
    elif a.cmd == "plan":
        r = plan(a.gate_plan, a.compare, a.pbr, a.views, a.out, a.type, key_compare=a.key_compare, consistency=a.consistency)
        for x in r["actions"]: print(x["action"], "<-", x["failure"]["key"])
    else:
        r = hook(a.plan_file, a.state or os.path.dirname(os.path.abspath(a.plan_file)), a.type)
        print(json.dumps(dict(actions=len(r["actions"]), review=len(r["needsReview"]))))
        sys.exit(3 if r["needsReview"] and len(r["needsReview"]) == len(r["actions"]) else 0)
