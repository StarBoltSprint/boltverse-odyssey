"""tools/13 self-tests: per-region no-grey + relief-scaled depth step.
python3 -m tools.gate.selftest_13 [pillar_v1_dir] [terrace_v35_reviews_dir]"""
import sys, glob, os
import numpy as np
from . import nogrey, volume

PILLAR = "/workspace/grokcli/wt/zd-rune-pillar-1013/steps/zone-d/02-rune-pillar/object-gate-v1"
TERR = "/workspace/grokcli/wt/zd-terrace-1012/steps/zone-d/01-terrace/object-gate-v3.5/reviews"


def plane(h=400, w=300, grooves=0.0, tilt=0.02):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    D = 8.0 + tilt * yy + 0.004 * xx
    if grooves:
        D = D + np.where((xx // 6) % 4 == 0, grooves, 0.0)
    N = np.zeros((h, w, 3), np.float32); N[..., 2] = 1
    N[(xx // 6) % 4 == 0] = [0.6, 0, 0.8] if grooves else [0, 0, 1]
    N[: h // 2, :, 0] = 0.7 if grooves else 0  # second facet so normSpread is not the limiter
    return D, N


def main(a):
    pdir = a[0] if a else PILLAR; tdir = a[1] if len(a) > 1 else TERR
    ok = True
    def t(name, cond, info=""):
        nonlocal ok; ok &= bool(cond); print(("PASS " if cond else "FAIL ") + name, info)
    views = [os.path.join(pdir, v) for v in ("front-19.7m.jpg", "front-8m.jpg", "oblique45.jpg", "grazing.jpg", "up-3m.jpg")]
    r = [nogrey.check(v) for v in views if os.path.exists(v)]
    t("no-grey: pillar v1 (grey plinth/cap) must FAIL", r and not all(x["pass_"] for x in r),
      str([(os.path.basename(x["image"]), x["worstRegionFrac"]) for x in r]))
    good = [p for p in glob.glob(os.path.join(tdir, "*.jpg"))]
    g = [nogrey.check(v) for v in good]
    t("no-grey: terrace v3.5 KEEP renders must PASS", g and all(x["pass_"] for x in g),
      str([(os.path.basename(x["image"]), x["worstRegionFrac"]) for x in g]))
    grey = glob.glob(os.path.join(tdir, "*-grey.png"))
    if grey:
        t("no-grey: terrace debug grey render must FAIL", not nogrey.check(grey[0])["pass_"])
    for depth in (0.03, 0.045, 0.06):
        D, N = plane(); rf = volume.oblique_arrays(D, N, depth)
        t(f"relief {depth} m: tilted flat face must FAIL", not rf["pass"], f"stepFrac {rf['stepFrac']}")
        D, N = plane(grooves=depth); rg = volume.oblique_arrays(D, N, depth)
        t(f"relief {depth} m: grooved face must PASS", rg["pass"], f"stepFrac {rg['stepFrac']}")
    D, N = plane(grooves=0.045); ra = volume.oblique_arrays(D, N)
    t("absolute mode unchanged: 4.5 cm grooves read below 0.25 m (old behaviour)", not ra["pass"], f"stepFrac {ra['stepFrac']}")
    print("SELFTEST", "PASS" if ok else "FAIL"); return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
