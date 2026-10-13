"""python3 -m tools.gate.selftest_playgate [broken_url] [fixed_url]
The current play build must FAIL on both door defects; the fixed build must PASS the scene checks.
(Camera-vs-spine is reported, not asserted: the page chase cam is a known open diff.)"""
import sys
from tools.gate import playgate
B = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8935"; F = sys.argv[2] if len(sys.argv) > 2 else "http://127.0.0.1:8947"
def has(errs, s): return any(s in e for e in errs)
ok = True
b = playgate.run(B, "/tmp/pg-selftest-broken", views=["door-3m"])["scene"]["errors"]
for name, s in (("(a) ground uses object plate", "uses object plate top.jpg"), ("(b) doubleSided culled", "GLB doubleSided but page side=0")):
    c = has(b, s); ok &= c; print("PASS" if c else "FAIL", "broken build flags", name)
f = playgate.run(F, "/tmp/pg-selftest-fixed", views=["door-3m"])
c = f["scene"]["pass_"]; ok &= c; print("PASS" if c else "FAIL", "fixed build scene checks", f["scene"]["errors"][:3])
print("camera vs spine (fixed):", "PASS" if f["camera"]["pass_"] else f"FAIL {sorted(f['camera']['diffs'])}")
print("ALL PASS" if ok else "SELFTEST FAIL"); sys.exit(0 if ok else 1)
