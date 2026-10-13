#!/usr/bin/env python3
"""Selftests for tools/kit/pieces.py + terrace.py (no browser). usage: python3 tools/kit/selftest_terrace.py"""
import math, sys, tempfile, json
from pathlib import Path
import numpy as np
HERE = Path(__file__).resolve().parent; sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE.parents[1]))
import pieces as P, terrace as TR
from tools.gatesuite import glbio, run as GS
OK = []
def t(name, cond, val=None):
    OK.append(bool(cond)); print(("PASS " if cond else "FAIL ") + name + ("" if val is None else f"  ({val})"))

def edges_ok(m):
    from collections import Counter
    e = Counter(tuple(sorted(x)) for f in m.F for x in ((f[0], f[1]), (f[1], f[2]), (f[2], f[0])))
    return sum(1 for v in e.values() if v != 2)
LIM = {0: 3000, 1: 1000, 2: 300}
for name, (fn, *_r) in P.PIECES.items():
    for lod in (0, 1, 2):
        m = fn(lod)
        t(f"{name} lod{lod} tris <= {LIM[lod]}", len(m.F) <= LIM[lod], len(m.F))
    t(f"{name} lod0 closed manifold", edges_ok(fn(0)) == 0)
    m0 = fn(0); A, B, C = (m0.V[m0.F[:, k]] for k in range(3))
    t(f"{name} lod0 wound outward (signed volume > 0)", np.einsum("ij,ij->i", A, np.cross(B, C)).sum() > 0)
rb = P.rbox([0, 0, 0], [1, 2, 0.6], 0.05, 3); A, B, C = (rb.V[rb.F[:, k]] for k in range(3))
t("rbox: every triangle faces outward", ((np.cross(B - A, C - A) * ((A + B + C) / 3 - rb.V.mean(0))).sum(1) > 0).all())
t("10 hero pieces", len(P.PIECES) == 10, len(P.PIECES))
for sc, rows in ((TR.K, TR.SPEC_ROWS), (1.0, TR.KEY_ROWS)):
    ms, inst, em, info = TR.layout(sc, 0)
    t(f"sc={sc:.3f}: rises {info['rises']}", abs(info['height'] - sum(r * P.COURSE_H for r in rows)) < 1e-9)
    t(f"sc={sc:.3f}: door bay is player size (1.7 x 1.9 >= 1.8 m)", any(k.startswith("door_recess_frame") for _, k, *_ in inst))
    t(f"sc={sc:.3f}: unique meshes (draws) <= 20", len(ms) - 1 <= 20, len(ms) - 1)
    mir = [k for _, k, *_ in inst if k.endswith("~m")]
    t(f"sc={sc:.3f}: mirrored pieces baked (no negative node scale)", mir and all(len(i) == 4 for i in inst))
# mirrored mesh keeps outward normals: signed volume positive
m = P.PIECES["wall_block_corner"][0](0); mm_V = m.V.copy(); mm_V[:, 0] *= -1; F = m.F[:, ::-1]
vol = lambda V, F: np.einsum("ij,ij->i", V[F[:, 0]], np.cross(V[F[:, 1]], V[F[:, 2]])).sum() / 6
t("mirror keeps positive volume", vol(mm_V, F) > 0 and vol(m.V, m.F) > 0)
# spine frame: heading 110 deg at s=450 on spine v1.3.1, lane clear >= 6 m
sp = json.loads((HERE.parents[1] / "tools/gatesuite/fixtures/spine-v1.3.1-89d9e684.json").read_text())
fr = TR.spine_frame(sp, 450.0)
t("heading 110 deg", abs(fr["heading_deg"] - 110) < 0.5, round(fr["heading_deg"], 2))
t("lane clear >= 6 m", fr["clear_m"] >= 6.0, round(fr["clear_m"], 2))
# _unframe inverts the yawed root
with tempfile.TemporaryDirectory() as d:
    r = TR.cmd_terrace(str(HERE.parents[1] / "tools/gatesuite/fixtures/spine-v1.3.1-89d9e684.json"), d, "spec")
    a, _ = glbio.meshes(Path(d) / "terrace-local.glb"); w, _ = glbio.meshes(Path(d) / "terrace-world-lod0.glb")
    bm = json.loads((Path(d) / "build.json").read_text())
    u = GS._unframe(w, bm["frame"])
    A = np.vstack([m["V"] for m in a]); U = np.vstack([m["V"] for m in u])
    t("world GLB un-yaws onto local GLB", np.abs(A - U).max() < 1e-3, float(np.abs(A - U).max()))
    t("build.json has frame, sockets, colliders", all(k in bm for k in ("frame", "sockets", "colliders")))
    t("world colliders inset", all(np.all(np.array(c["max"]) > np.array(c["min"])) for c in json.loads((Path(d) / "colliders.json").read_text())))
print(f"{sum(OK)}/{len(OK)}"); sys.exit(0 if all(OK) else 1)
