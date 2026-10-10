#!/usr/bin/env python3
"""Hard-surface building profile: flat and blobby maps FAIL, a sealed tower shell passes.
Does not call Depth Anything (the plate run is the auto.py shape stage). Mesa PROFILE numbers stay put.
"""
import os, sys, tempfile
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import depth_relief as DR
import hard_surface as HS
import i23d_common as C

def main():
    assert DR.PROFILE["mesa"]["amp"] == 1.5 and DR.PROFILE["rock"]["amp"] == 0.6, DR.PROFILE
    prof = C.load_profile("building")
    assert prof["geometry"]["relief"]["mode"] == "hard-surface"
    assert prof["geometry"]["relief"]["maxM"] == 0.3

    flat = np.zeros((64, 64), np.float32)
    assert DR.check_hard(flat)["ok"] is False

    step = np.zeros((80, 80), np.float32)
    step[:, 16:64] = 0.36
    step[20:60, 28:52] = 0.80
    good = DR.check_hard(step)
    assert good["ok"] and 2 <= good["planes"] <= 6 and good["p99M"] >= 0.30, good

    blob = np.linspace(0, 1.1, 80, dtype=np.float32)[None, :] * np.ones((80, 1), np.float32)
    blob = blob + np.linspace(0, 0.4, 80, dtype=np.float32)[:, None]
    bad = DR.check_hard(blob)
    assert bad["ok"] is False, bad

    out = tempfile.mkdtemp(prefix="hs-st-")
    rep = HS.build_all("", out, ["m2", "m6"])
    for mod, row in rep.items():
        st, sil = row["stats"], row["silhouette"]
        assert st["open"] == 0 and st["nonManifold"] == 0 and st["degenerate"] == 0, row
        assert sil["flat"] is False and sil["enclosed"] >= 3, sil
        assert row["bayMax"] >= 0.30
        assert row["reliefFaces"] >= 2, row
    print("PASS hard_surface_st", {m: (rep[m]["stats"]["tris"], rep[m]["silhouette"]["enclosed"]) for m in rep})

if __name__ == "__main__":
    main()
