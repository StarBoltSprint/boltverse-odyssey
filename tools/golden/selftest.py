#!/usr/bin/env python3
"""Selftest for tools/golden (imagine-auto, run.sh, timing). Offline: mock Imagine + a fake `grok` binary.
Proves bad input FAILS and good input PASSES. Fixture = one 96x54 synthetic key; everything in a temp dir, removed after."""
import json, os, shutil, subprocess, sys, tempfile, time
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H)
import fixture_key
R = []
def ok(name, cond, info=""):
    R.append(bool(cond)); print(f"{'PASS' if cond else 'FAIL'}  {name}" + (f"  ({info})" if info and not cond else ""))
def py(*a, env=None): return subprocess.run([sys.executable, *a], capture_output=True, text=True, env={**os.environ, **(env or {})})
def sh(*a, env=None): return subprocess.run(["bash", *a], capture_output=True, text=True, env={**os.environ, **(env or {})})

T = tempfile.mkdtemp(prefix="golden-st-")
try:
    key = fixture_key.make(os.path.join(T, "key.png")); IA = os.path.join(H, "imagine_auto.py"); TM = os.path.join(H, "timing.py")
    # ---------------- imagine-auto
    P = os.path.join(T, "p.json"); json.dump({"slots": [{"slot": "sky-S00", "prompt": "sky a", "aspect": "16:9"},
                                                        {"slot": "obj-x", "prompt": "rock", "aspect": "1:1", "refs": [key]}]}, open(P, "w"))
    out = os.path.join(T, "plates"); r = py(IA, "run", "--prompts", P, "--out", out, "--backend", "mock")
    m = json.load(open(os.path.join(out, "manifest.json")))
    ok("imagine-auto good prompts -> exit 0, 2 plates made", r.returncode == 0 and all(m["plates"][s]["status"] == "made" for s in ("sky-S00", "obj-x")), r.stderr)
    mt = os.path.getmtime(os.path.join(out, "sky-S00.png")); time.sleep(0.05)
    r = py(IA, "run", "--prompts", P, "--out", out, "--backend", "mock"); m = json.load(open(os.path.join(out, "manifest.json")))
    ok("imagine-auto resumable: rerun keeps existing files", r.returncode == 0 and m["plates"]["sky-S00"]["status"] == "kept" and os.path.getmtime(os.path.join(out, "sky-S00.png")) == mt)
    for nm, bad in [("duplicate slot", [{"slot": "a", "prompt": "x"}, {"slot": "a", "prompt": "y"}]), ("empty prompt", [{"slot": "a", "prompt": " "}]),
                    ("missing ref", [{"slot": "a", "prompt": "x", "refs": ["/nope.png"]}]), ("bad slot name", [{"slot": "../a", "prompt": "x"}]),
                    ("4 refs", [{"slot": "a", "prompt": "x", "refs": [key] * 4}]), ("no slots", [])]:
        json.dump({"slots": bad}, open(P + ".bad", "w")); r = py(IA, "run", "--prompts", P + ".bad", "--out", os.path.join(T, "b"), "--backend", "mock")
        ok(f"imagine-auto bad input ({nm}) -> exit 2", r.returncode == 2, r.stdout + r.stderr)
    json.dump({"slots": [{"slot": "ground-a", "prompt": "g"}]}, open(P + ".f", "w"))
    r = py(IA, "run", "--prompts", P + ".f", "--out", os.path.join(T, "f"), "--backend", "mock", env={"GOLDEN_MOCK_FAIL": "ground-a"})
    ok("imagine-auto generation failure -> exit 3 + listed missing", r.returncode == 3 and json.load(open(os.path.join(T, "f", "manifest.json")))["missing"] == ["ground-a"])
    # fake grok CLI: proves the grok backend drives `grok -p ... --always-approve` and only trusts a real image on disk
    fake = os.path.join(T, "grok-fake"); open(fake, "w").write("#!/bin/bash\n# args: -p PROMPT --always-approve --cwd DIR\n"
        "[ \"$1\" = -p ] && [ \"$3\" = --always-approve ] || exit 9\n"
        "dest=$(printf '%s' \"$2\" | grep -o \"cp <returned path> [^ ]*\" | awk '{print $4}' | tr -d '\`')\n"
        "python3 -c \"from PIL import Image;Image.new('RGB',(8,8),(9,9,9)).save('$dest','JPEG')\"; echo DONE $dest\n"); os.chmod(fake, 0o755)
    liar = os.path.join(T, "grok-liar"); open(liar, "w").write("#!/bin/bash\necho DONE /tmp/nothing.jpg\n"); os.chmod(liar, 0o755)
    json.dump({"slots": [{"slot": "sky-S01", "prompt": "night sky", "aspect": "16:9"}]}, open(P + ".g", "w"))
    r = py(IA, "run", "--prompts", P + ".g", "--out", os.path.join(T, "g"), "--backend", "grok", env={"GROK_BIN": fake})
    ok("imagine-auto grok backend (fake CLI writes image) -> exit 0", r.returncode == 0 and os.path.exists(os.path.join(T, "g", "sky-S01.jpg")), r.stdout + r.stderr)
    r = py(IA, "run", "--prompts", P + ".g", "--out", os.path.join(T, "h"), "--backend", "grok", env={"GROK_BIN": liar})
    ok("imagine-auto grok backend claims DONE but no file -> exit 3", r.returncode == 3)
    # ---------------- timing
    tj = os.path.join(T, "t.json"); py(TM, "start", tj, "a"); py(TM, "end", tj, "a"); py(TM, "start", tj, "b"); time.sleep(0.2); py(TM, "end", tj, "b", "--imagine")
    r = py(TM, "summary", tj); s = json.load(open(tj))["summary"]
    ok("timing good -> within budget, slowest=b, imagine split", r.returncode == 0 and s["slowest"]["stage"] == "b" and s["imagineSeconds"] > 0 and "slowest: b" in r.stdout, r.stdout)
    ok("timing over budget -> exit 4", py(TM, "summary", tj, "--budget", "0.1").returncode == 4)
    ok("timing end of a never-started stage -> exit 2", py(TM, "end", tj, "zzz").returncode == 2)
    json.dump({"stages": [{"stage": "x", "start": 10, "end": 5, "seconds": -5}]}, open(tj, "w")); ok("timing end before start -> exit 2", py(TM, "summary", tj).returncode == 2)
    json.dump({"stages": [{"stage": "x", "start": 10}]}, open(tj, "w")); ok("timing unfinished stage -> exit 2", py(TM, "summary", tj).returncode == 2)
    # ---------------- run.sh (one command)
    RS = os.path.join(H, "run.sh"); W = os.path.join(T, "w")
    r = sh(RS, key, "mini", "--work", W, "--imagine", "mock")
    z = os.path.join(W, "zone.json"); t = json.load(open(os.path.join(W, "timing.json"))) if os.path.exists(os.path.join(W, "timing.json")) else {}
    stages = [s["stage"] for s in t.get("stages", [])]
    ok("run.sh good key -> exit 0, zone.json, play URL, 11 timed stages", r.returncode == 0 and os.path.exists(z) and os.path.exists(os.path.join(W, "PLAY_URL.txt"))
       and stages == ["prompts", "imagine", "sky", "ground", "terrain", "objects", "placement", "gate", "worldgraph", "play"], r.stdout[-800:])
    if os.path.exists(z):
        zj = json.load(open(z)); ok("run.sh zone.json is zone.v1 with every gate PASS", zj["schema"] == "zone.v1" and set(zj["qualityGates"].values()) == {"PASS"})
    # bad sky: one plate of a different colour -> seam FAIL, run stops at sky, no zone.json
    sl = [{"slot": f"sky-S{i:02d}", "prompt": "s", "aspect": "16:9", **({"mockColor": [250, 20, 200]} if i == 5 else {})} for i in range(6)]
    sl += [{"slot": "ground-a", "prompt": "g", "aspect": "1:1"}, {"slot": "obj-hero", "prompt": "o", "aspect": "1:1"}]
    json.dump({"slots": sl}, open(P + ".sky", "w")); W2 = os.path.join(T, "w2"); r = sh(RS, key, "mini", "--work", W2, "--imagine", "mock", "--prompts", P + ".sky")
    ok("run.sh mismatched sky plate -> exit 1 at sky, seam named in REPORT.md, no zone.json", r.returncode == 1 and "STOPPED at `sky`" in r.stdout
       and "sky-S04.png|sky-S05.png" in open(os.path.join(W2, "REPORT.md")).read() and not os.path.exists(os.path.join(W2, "zone.json")), r.stdout[-600:])
    # bad object: blank plate (nothing to cut) -> objects FAIL
    sl2 = [s for s in sl if not s.get("mockColor")] + [{"slot": "obj-blank", "prompt": "b", "aspect": "1:1", "mockColor": [0, 0, 0]}]
    sl2 = [s for s in sl2 if s["slot"] != "obj-hero"]
    W3 = os.path.join(T, "w3"); json.dump({"slots": sl2}, open(P + ".o", "w"))
    shutil.os.makedirs(os.path.join(W3, "plates"), exist_ok=True)
    from PIL import Image; Image.new("RGB", (40, 40), (5, 5, 5)).save(os.path.join(W3, "plates", "obj-blank.png"))
    r = sh(RS, key, "mini", "--work", W3, "--imagine", "mock", "--prompts", P + ".o")
    ok("run.sh blank object plate -> exit 1 at objects", r.returncode == 1 and "STOPPED at `objects`" in r.stdout, r.stdout[-500:])
    sl3 = [s for s in sl if not s.get("mockColor") and s["slot"] != "ground-a"] + [{"slot": "ground-a", "prompt": "g", "aspect": "1:1", "mockColor": [255, 255, 255]}]
    W5 = os.path.join(T, "w5"); json.dump({"slots": sl3}, open(P + ".gr", "w")); r = sh(RS, key, "mini", "--work", W5, "--imagine", "mock", "--prompts", P + ".gr")
    ok("run.sh ground plate far from the key's ground light -> exit 1 at ground", r.returncode == 1 and "STOPPED at `ground`" in r.stdout and "keyDeltaL" in r.stdout, r.stdout[-500:])
    ok("run.sh missing key -> exit 2", sh(RS, os.path.join(T, "nokey.png"), "mini").returncode == 2)
    ok("run.sh bad zone id -> exit 2", sh(RS, key, "Bad Zone!").returncode == 2)
    r = sh(RS, key, "mini", "--work", os.path.join(T, "w4"), "--imagine", "manual")
    ok("run.sh --imagine manual with missing plates -> exit 10 (manual fallback)", r.returncode == 10, r.stdout[-300:])
    # resumable: re-running the good work dir makes no new plate
    r = sh(RS, key, "mini", "--work", W, "--imagine", "mock"); m = json.load(open(os.path.join(W, "plates", "manifest.json")))
    ok("run.sh rerun is resumable (all plates kept)", r.returncode == 0 and {p["status"] for p in m["plates"].values() if isinstance(p, dict)} == {"kept"})
    # ---------------- run-biome.sh step 4 wiring
    rb = open(os.path.join(H, "..", "biome", "run-biome.sh")).read()
    ok("run-biome.sh step 4 calls imagine-auto, keeps --manual exit 10", "golden/imagine_auto.py\" run" in rb and "--manual) MANUAL=1" in rb and "exit 10" in rb)
finally:
    shutil.rmtree(T, ignore_errors=True)
print(f"\n{sum(R)}/{len(R)} checks passed"); sys.exit(0 if all(R) else 1)
