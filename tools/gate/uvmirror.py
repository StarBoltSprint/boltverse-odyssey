"""Negative UV scale (mirrored island) on a builder OBJ.

Sign of (dP/du × dP/dv) · n. Negative means the plate is mirrored on that triangle.
PASS iff every counted triangle has a non-negative scale.
"""
import json
import sys
import numpy as np


def report(path):
    V, T, F, M = [], [], [], []
    cur = None
    for l in open(path):
        if l.startswith("v "):
            V.append([float(x) for x in l.split()[1:4]])
        elif l.startswith("vt "):
            T.append([float(x) for x in l.split()[1:3]])
        elif l.startswith("usemtl"):
            cur = l.split()[1]
        elif l.startswith("f "):
            p = [t.split("/") for t in l.split()[1:4]]
            F.append([(int(a) - 1, int(b) - 1) for a, b in p])
            M.append(cur)
    V = np.array(V)
    T = np.array(T)
    out = {}
    jneg = jn = 0
    mirrored = 0
    counted = 0
    for f, m in zip(F, M):
        P = V[[a for a, _ in f]]
        Q = T[[b for _, b in f]]
        e1, e2 = P[1] - P[0], P[2] - P[0]
        d1, d2 = Q[1] - Q[0], Q[2] - Q[0]
        det = d1[0] * d2[1] - d1[1] * d2[0]
        if abs(det) < 1e-14:
            continue
        n = np.cross(e1, e2)
        dPu = (e1 * d2[1] - e2 * d1[1]) / det
        dPv = (e2 * d1[0] - e1 * d2[0]) / det
        s = np.dot(np.cross(dPu, dPv), n)
        o = out.setdefault(m, [0, 0])
        o[1] += 1
        o[0] += s < 0
        counted += 1
        mirrored += int(s < 0)
        nn = n / np.linalg.norm(n)
        c = P.mean(0)
        if abs(nn[0]) > 0.9 and c[2] < 0.01 and c[2] > -1.6 and abs(c[0]) < 3 and c[1] < 4:
            jn += 1
            jneg += s < 0
    r = dict(
        perMaterial={k: dict(mirroredTris=int(v[0]), tris=v[1]) for k, v in out.items()},
        tier1JambTris=jn,
        tier1JambMirrored=int(jneg),
        mirroredTris=int(mirrored),
        tris=int(counted),
    )
    r["pass"] = mirrored == 0 and counted > 0
    return r


def main(argv=None):
    a = list(sys.argv[1:] if argv is None else argv)
    if not a:
        print("usage: uvmirror <obj> [out.json]", file=sys.stderr)
        return 2
    r = report(a[0])
    print(json.dumps(r))
    if len(a) > 1:
        json.dump(r, open(a[1], "w"), indent=1)
    return 0 if r["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
