"""Offline self-test of fixloop.py keyloop (no browser): a synthetic key, a 'game' frame whose sand and tower are off
in colour; the loop's colour action (palette.py shift with the render-measured offsets) must drive ΔE under the gate,
report best / gap / ceiling, mark unwired actions NOT_WIRED and never create an Imagine image."""
import sys, os, json, tempfile, subprocess
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, H)
import numpy as np, yaml, fixloop, i23d_common as C
from PIL import Image
d = tempfile.mkdtemp(); os.makedirs(f"{d}/src"); os.makedirs(f"{d}/game")
y, x = np.mgrid[0:180, 0:320]; a = np.zeros((180, 320, 3), np.uint8)
a[..., 0] = 120 + y // 3; a[..., 1] = 90 + y // 4; a[..., 2] = 170 - y // 3
a[60:180, 40:90] = (30, 28, 32); a[100:180, 200:320] = (190, 130, 95)
rng = np.random.default_rng(1); a = np.clip(a.astype(int) + rng.integers(-6, 7, a.shape), 0, 255).astype(np.uint8)
Image.fromarray(a).save(f"{d}/key.png")
b = a.astype(int); b[100:180, 200:320] = (b[100:180, 200:320] * [0.8, 0.85, 1.05]).astype(int)
Image.fromarray(b.clip(0, 255).astype(np.uint8)).save(f"{d}/src/game.png"); Image.fromarray(b.clip(0, 255).astype(np.uint8)).save(f"{d}/game/game.png")
kspec = dict(title="keyloop self-test", key=f"{d}/key.png", camera={}, elements=[dict(id="sand", type="terrain", key=dict(rect=[0.6, 0.55, 1, 1], mask="sand"))])
open(f"{d}/kc.yaml", "w").write(yaml.safe_dump(kspec))
spec = dict(object="st", work=d, keyCompare=dict(spec=f"{d}/kc.yaml", elements=["sand"], gameImage=f"{d}/game/game.png", maxRounds=5, stallRounds=2,
            apply=dict(colour=f"python3 palette.py shift {d}/src --offsets {{offsets}} --element {{element}} --out {d}/game")))
open(f"{d}/spec.yaml", "w").write(yaml.safe_dump(spec))
r = fixloop.keyloop(f"{d}/spec.yaml", log=print)
t = {x["metric"]: x for x in r["table"]}
print(open(f"{d}/keyloop/KEYLOOP.md").read())
ok = t["deLit"]["best"] < t["deLit"]["first"] and t["deLit"]["best"] <= 6 and r["status"] in ("STALLED", "MAX_ROUNDS", "TARGETS_MET", "NOTHING_TO_APPLY")
print("PASS keyloop selftest" if ok else "FAIL keyloop selftest", r["status"], r["notWired"]); sys.exit(0 if ok else 1)
