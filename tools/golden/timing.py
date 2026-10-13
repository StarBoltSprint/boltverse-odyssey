#!/usr/bin/env python3
"""golden timing: every stage writes start/end into timing.json; summary = total vs the 8 min budget + slowest stage.

  python3 tools/golden/timing.py start   <timing.json> <stage>
  python3 tools/golden/timing.py end     <timing.json> <stage> [--status ok|fail|skip] [--imagine]
  python3 tools/golden/timing.py summary <timing.json> [--budget 480]     # exit 0 within budget, 4 over, 2 bad file
Stages flagged --imagine are also summed apart (non-Imagine time = what the tools cost on their own).
"""
import json, os, sys, time, argparse


def load(p):
    if not os.path.exists(p): return {"stages": []}
    d = json.load(open(p))
    if not isinstance(d.get("stages"), list): raise ValueError("timing.json: no stages list")
    return d


def save(p, d):
    tmp = p + ".tmp"; json.dump(d, open(tmp, "w"), indent=1); os.replace(tmp, p)


def start(p, st):
    d = load(p); d.setdefault("startedAt", time.time())
    d["stages"] = [s for s in d["stages"] if s["stage"] != st] + [{"stage": st, "start": time.time()}]; save(p, d)


def end(p, st, status="ok", imagine=False):
    d = load(p); s = next((s for s in d["stages"] if s["stage"] == st and "end" not in s), None)
    if not s: raise ValueError(f"stage {st} was never started")
    s.update(end=time.time(), seconds=round(time.time() - s["start"], 2), status=status, imagine=imagine); save(p, d)


def summary(p, budget=480.0):
    d = load(p); S = d["stages"]
    for s in S:
        if "end" not in s: raise ValueError(f"stage {s['stage']} has no end")
        if s["end"] < s["start"]: raise ValueError(f"stage {s['stage']} ends before it starts")
    tot = round(sum(s["seconds"] for s in S), 2); im = round(sum(s["seconds"] for s in S if s.get("imagine")), 2)
    slow = max(S, key=lambda s: s["seconds"]) if S else None
    r = {"totalSeconds": tot, "imagineSeconds": im, "nonImagineSeconds": round(tot - im, 2), "budgetSeconds": budget,
         "withinBudget": tot <= budget, "slowest": slow and {"stage": slow["stage"], "seconds": slow["seconds"]},
         "failed": [s["stage"] for s in S if s.get("status") == "fail"]}
    d["summary"] = r; save(p, d); return r


def fmt(r):
    m = lambda x: f"{int(x//60)} min {x%60:04.1f} s"
    return (f"Total {m(r['totalSeconds'])} / budget {m(r['budgetSeconds'])} -> {'OK' if r['withinBudget'] else 'OVER'}"
            f" | Imagine {m(r['imagineSeconds'])}, tools {m(r['nonImagineSeconds'])}"
            + (f" | slowest: {r['slowest']['stage']} ({r['slowest']['seconds']} s)" if r["slowest"] else ""))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("cmd", choices=["start", "end", "summary"]); ap.add_argument("file")
    ap.add_argument("stage", nargs="?"); ap.add_argument("--status", default="ok"); ap.add_argument("--imagine", action="store_true")
    ap.add_argument("--budget", type=float, default=480.0); a = ap.parse_args()
    try:
        if a.cmd == "start": start(a.file, a.stage)
        elif a.cmd == "end": end(a.file, a.stage, a.status, a.imagine)
        else:
            r = summary(a.file, a.budget); print(fmt(r)); sys.exit(0 if r["withinBudget"] else 4)
    except ValueError as e: print(f"[timing] BAD: {e}", file=sys.stderr); sys.exit(2)
