#!/usr/bin/env python3
"""tools/scenebuild/optimize.py - per-element optimiser on top of the first-try build (v2, batched CMA-ES).
Stages in order FORM (s, sy, dz) -> EDGES (rg, jv) -> WEAR/SNOW (cg, sn). In each stage the worst-N elements (their
auto_check row = worst metric) each get their own CMA-ES (popsize 4); candidate i of EVERY active element is put in
the same scene, so one render evaluates all of them (elements are spatially separate). ~40 evals per element over
the three stages (16 / 12 / 12).
Before rendering, each candidate pays a cheap geometric loss (no render): relative depth offset vs the MoGe median
and the projected size change vs the measured mask size (point-to-depth / size consistency).
Acceptance per stage (net gain, v3): the stage's best candidates are kept if the SUM of worst-metric rows over all
elements improves, no single element drops by > MAX_DROP (10), the held-out DINO term (judge 'perceptual') is no more than 0.5
worse and the phone budget (<= 12 draws, <= TRI_BUDGET tris) holds; otherwise non-gaining / dropping candidates are
removed and the check repeats (3 tries). Elements that never improve over a zone go to the ledger as
'expressiveness gap' rows (the recipe cannot express what the key shows).
usage: optimize.py SHEET OUT PORT [--n 24]"""
import argparse, json, shutil, sys, time
from pathlib import Path
import numpy as np, cma
sys.path.insert(0, str(Path(__file__).resolve().parent))
import score as S  # noqa: E402

TRI_BUDGET, DRAW_BUDGET, MAX_DROP, DINO_TOL = 200_000, 12, 10.0, 0.5   # DINO holdout tolerance (user decision)
STAGES = [("form", {"s": (1.0, 0.25, 0.6, 1.6), "sy": (1.0, 0.2, 0.6, 1.5), "dz": (0.0, 0.04, -0.12, 0.12)}, 4),
          ("edges", {"rg": (1.0, 0.5, 0.2, 2.5), "jv": (0.2, 0.15, 0.0, 0.6)}, 3),
          ("wear", {"cg": (1.0, 0.12, 0.7, 1.4), "sn": (1.0, 0.5, 0.0, 2.5)}, 3)]
POP = 4


def geo_loss(o):
    return 2.0 * abs(o.get("dz", 0.0)) + 0.5 * abs(np.log(o.get("s", 1.0))) + 0.5 * abs(np.log(o.get("sy", 1.0)))


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("sheet"); ap.add_argument("out"); ap.add_argument("port"); ap.add_argument("--n", type=int, default=24)
    a = ap.parse_args(); out = Path(a.out); opt = {}; t0 = time.time()
    s0, rows, info = S.score(a.sheet, out, a.port, opt, "first"); gain = info["exposure_gain"]; shutil.copy(out / "render-first.png", out / "render-best.png")
    keys = ("judge", "L1_median", "L1_pass", "L2_median", "L2_pass", "draws", "tris", "too_regular")
    hist = [{"stage": "first", **{k: s0[k] for k in keys}}]; print(json.dumps(hist[-1]), flush=True)
    best, renders, improved = s0, 2, set()
    for stage, P, gens in STAGES:
        names = list(P); built = [k for k in rows if k in info["elements"] and len(info["elements"][k]) == 2 and info["elements"][k][0] != "sky"]
        # improvable elements: worst rows that are not stuck at 0 (a 0 row = a metric the recipe cannot move -> ledger)
        imp = sorted([k for k in built if 1.0 <= rows[k] < 50.0], key=lambda k: rows[k])
        # + elements the render check cannot find ('present' = 0): appearance/size can bring them back
        miss = sorted([k for k in built if rows[k] < 1.0 and info["rows_full"].get(k, {}).get("sub", {}).get("present", 100) < 1],
                      key=lambda k: -rows[k])
        act = (imp[: a.n // 2] + miss)[: a.n]
        es = {k: cma.CMAEvolutionStrategy([0.0] * len(names), 1.0, {"popsize": POP, "verbose": -9, "seed": 7}) for k in act}
        bestc = {k: (rows[k], None) for k in act}
        dec = lambda x: {n: float(np.clip(P[n][0] + x[i] * P[n][1], P[n][2], P[n][3])) for i, n in enumerate(names)}
        for g in range(gens):
            X = {k: es[k].ask() for k in act}; fit = {k: [] for k in act}
            for i in range(POP):
                trial = {k: dict(v) for k, v in opt.items()}
                for k in act:
                    trial[k] = {**trial.get(k, {}), **dec(X[k][i])}
                s1, r1, i1 = S.score(a.sheet, out, a.port, trial, "trial", gain); renders += 1
                ok_budget = s1["draws"] <= DRAW_BUDGET and s1["tris"] <= TRI_BUDGET
                for k in act:
                    v = r1.get(k, 0.0) - 2 * geo_loss(trial[k]) - (1000 if not ok_budget else 0)
                    fit[k].append(-v)
                    if v > bestc[k][0] + 0.05:
                        bestc[k] = (v, trial[k])
            for k in act:
                es[k].tell(X[k], fit[k])
        cand = {k: c for k, (v, c) in bestc.items() if c is not None}
        new = {k: dict(v) for k, v in opt.items()}; new.update(cand)
        kept = []; diag = {"candidates": len(cand)}
        if cand:   # NET-GAIN keep rule (v3)
            for attempt in range(3):
                s1, r1, i1 = S.score(a.sheet, out, a.port, new, "trial", gain); renders += 1
                gain_sum = sum(r1.get(k, 0) for k in rows) - sum(rows.values())
                drops = [k for k in rows if r1.get(k, 0) < rows[k] - MAX_DROP]
                ok = (gain_sum > 0 and not drops and s1["scores"]["perceptual"] >= best["scores"]["perceptual"] - DINO_TOL
                      and s1["draws"] <= DRAW_BUDGET and s1["tris"] <= TRI_BUDGET)
                diag[f"try{attempt}"] = {"sum_gain": round(gain_sum, 1), "drops_gt10": len(drops), "dino": s1["scores"]["perceptual"], "n": len(cand)}
                if ok:
                    break
                # drop candidates that did not gain themselves, then the ones whose element (or neighbours) dropped
                bad = [k for k in cand if r1.get(k, 0) <= rows.get(k, 0)] or [k for k in cand if k in drops] or list(cand)[: max(1, len(cand) // 2)]
                for k in bad:
                    cand.pop(k, None); new.pop(k, None)
                    if k in opt:
                        new[k] = opt[k]
                if not cand:
                    break
            if ok and cand:
                opt, rows, info, best = new, r1, i1, s1; kept = list(cand); improved |= set(cand)
                shutil.copy(out / "render-trial.png", out / "render-best.png")
        (out / "opt.json").write_text(json.dumps(opt, indent=1))   # checkpoint after every stage
        hist.append({"stage": stage, "active": len(act), "evals_per_element": gens * POP, "kept": len(kept), "diag": diag, "renders": renders,
                     "min": round((time.time() - t0) / 60, 1), **{k: best[k] for k in keys}}); print(json.dumps(hist[-1]), flush=True)
    S.score(a.sheet, out, a.port, opt, "after", gain)
    worst_rows = sorted(rows, key=lambda k: rows[k])[:40]
    ledger = [{"id": k, "type": info["elements"].get(k, ["?"])[0], "row": round(rows[k], 1), "gap": "expressiveness"} for k in worst_rows if k not in improved and k in info["elements"]]
    (out / "opt.json").write_text(json.dumps(opt, indent=1))
    (out / "optimize.json").write_text(json.dumps({"first": s0, "after": best, "history": hist, "ledger": ledger, "renders": renders}, indent=1))


if __name__ == "__main__":
    main()
