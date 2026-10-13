#!/usr/bin/env python3
"""A fake step whose test fails must NOT count; a missing tool or no-test step must NOT count; a passing one counts."""
import json, os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import meter

ok = True
def check(name, cond):
    global ok; ok &= bool(cond); print(("OK  " if cond else "BAD ") + name)

with tempfile.TemporaryDirectory() as d:
    os.makedirs(f"{d}/tools/good"); os.makedirs(f"{d}/tools/bad"); os.makedirs(f"{d}/tools/notest")
    open(f"{d}/tools/good/t.py", "w").write("import sys; sys.exit(0)\n")
    open(f"{d}/tools/bad/t.py", "w").write("import sys; print('boom'); sys.exit(1)\n")
    open(f"{d}/failures.md", "w").write("# log\n\n### a\n| Guard | `python3 tools/good/t.py` |\n\n### b\n| Guard | None in the repo. |\n")
    open(f"{d}/timing.json", "w").write(json.dumps({"stages": [{"stage": "imagine", "seconds": 0.1, "status": "ok", "imagine": True}, {"stage": "play", "seconds": 30, "status": "ok"}]}))
    cfg = {"budgetSeconds": 480, "steps": [
        {"id": "good", "name": "good", "tools": ["tools/good"], "tests": [["python3", "tools/good/t.py"]]},
        {"id": "fake", "name": "fake failing", "tools": ["tools/bad"], "tests": [["python3", "tools/good/t.py"], ["python3", "tools/bad/t.py"]]},
        {"id": "gone", "name": "missing tool", "tools": ["tools/gone"], "tests": [["python3", "tools/gone/t.py"]]},
        {"id": "notest", "name": "no selftest", "tools": ["tools/notest"], "tests": []}],
        "resemblance": [{"zone": "z", "item": "x", "file": None}], "manualFixJournals": ["failures.md"]}
    open(f"{d}/steps.json", "w").write(json.dumps(cfg))
    r = meter.main(["--repo", d, "--steps", f"{d}/steps.json", "--out", f"{d}/out", "--timing", f"{d}/timing.json"])
    st = {s["id"]: s["status"] for s in r["steps"]}
    check("passing step counts", st["good"] == "PASS")
    check("fake step with a failing test is FAIL", st["fake"] == "FAIL")
    check("missing tool is MISSING", st["gone"] == "MISSING")
    check("tool without selftest is MISSING", st["notest"] == "MISSING")
    check("only 1 of 4 counted (25 %)", r["stepsDone"] == 1 and r["stepCompletionPercent"] == 25.0)
    check("resemblance with no tool output is MISSING", r["resemblance"]["rows"][0]["status"] == "MISSING")
    check("manual fix journal: 1 of 2 not automated", r["manualFixes"]["notYetAutomated"] == 1 and r["manualFixes"]["entries"] == 2)
    check("mocked-Imagine run is not a real end-to-end time", r["endToEnd"]["measured"] is False)
    check("report files written", os.path.exists(f"{d}/out/progress.json") and os.path.exists(f"{d}/out/REPORT.md"))
print("PASS" if ok else "FAIL"); sys.exit(0 if ok else 1)
