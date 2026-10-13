#!/usr/bin/env python3
"""tools/placer/loop.py - keep/revert loop: toggle placer groups (and the snow gain) one at a time, render the key
view, run judge.py + auto_check (L1/L2, no DINO for speed), keep a change only if it helps.
usage: python3 tools/placer/loop.py VARIANT PORT SHEETDIR [--rounds 1]
Accept rule: judge total +0.3, or auto L2 pass_frac +0.02 with judge not lower than -0.3 (any key: no hand lists)."""
import argparse, json, shutil, subprocess, sys, time
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]; OUT = Path("/workspace/kitrelief-out")
SPINE = ROOT / "tools/gatesuite/fixtures/spine-v1.3.1-89d9e684.json"


def evaluate(v, port, sheet, groups, q, tag):
    D = OUT / f"terrace-{v}"; G = D / "gate"; tmp = Path(f"/tmp/loop-{v}")
    t0 = time.time()
    subprocess.run([sys.executable, str(ROOT / "tools/kit/pieces.py"), "terrace", "--variant", v, "--spine", str(SPINE), "--out", str(tmp),
                    "--placer", str(sheet), "--placer-groups", ",".join(groups), "--placer-scope", str(G / "mask.png")], check=True, capture_output=True)
    shutil.copy(tmp / "terrace-local.glb", D / "cand.glb")
    png = f"/tmp/loop-{v}-{tag}.png"
    subprocess.run([sys.executable, str(ROOT / "tools/kit/viewer/keyshot.py"), f"http://127.0.0.1:{port}", "cand.glb", png, "--chrome", "/usr/bin/google-chrome", "--q", q], capture_output=True)
    j = json.loads(subprocess.run([sys.executable, str(ROOT / "tools/kit/judge.py"), png, str(G / "key.jpg"), str(G / "mask.png")], capture_output=True, text=True).stdout)
    a = subprocess.run([sys.executable, str(ROOT / "tools/keysheet/auto_check.py"), png, str(sheet), "--scope", str(G / "mask.png"), "--no-dino"], capture_output=True, text=True)
    aj = json.loads(a.stdout.strip().splitlines()[-1])
    return {"tag": tag, "groups": groups, "q": q, "judge": j["total"], "scores": j["scores"], "L1_min": aj["L1"]["min"],
            "L2_pass": aj["L2"]["pass_frac"], "facade_pass": aj["facade_snow"]["pass_frac"], "drips_pass": aj["drips"]["pass_frac"],
            "png": png, "sec": round(time.time() - t0, 1)}


def better(c, b):
    return c["judge"] >= b["judge"] + 0.3 or (c["L2_pass"] >= b["L2_pass"] + 0.02 and c["judge"] >= b["judge"] - 0.3)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("variant"); ap.add_argument("port"); ap.add_argument("sheet"); ap.add_argument("--out")
    a = ap.parse_args()
    hist = []; best = evaluate(a.variant, a.port, a.sheet, [], "", "base"); hist.append({**best, "kept": True}); print(json.dumps(hist[-1]), flush=True)
    for g in ("facade_snow", "drips", "rubble", "snow"):
        c = evaluate(a.variant, a.port, a.sheet, best["groups"] + [g], best["q"], f"+{g}"); k = better(c, best)
        hist.append({**c, "kept": k}); print(json.dumps(hist[-1]), flush=True)
        if k:
            best = c
    for sg in ("1.0,1.15,1.25", "1.2,1.35,1.45", "1.45,1.6,1.7"):
        c = evaluate(a.variant, a.port, a.sheet, best["groups"], f"&sg={sg}", f"sg{sg}"); k = better(c, best)
        hist.append({**c, "kept": k}); print(json.dumps(hist[-1]), flush=True)
        if k:
            best = c
    res = {"best": best, "history": hist}
    if a.out:
        Path(a.out).write_text(json.dumps(res, indent=1))
    print(json.dumps({"best": best}))


if __name__ == "__main__":
    main()
