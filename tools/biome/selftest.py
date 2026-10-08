#!/usr/bin/env python3
"""selftest.py - proves every biome tool runs, on images already in the repo (zone A) - no Grok, no Imagine.

  python3 tools/biome/selftest.py [--no-bake] [--blender PATH] [--keep]

Checks: schema + tracked/local split round trip, deterministic fill, 35 prompts with lock sentence + cache keys
(a bible bump changes every key), manifest ingest -> hits, qc decisions on real plates and on planted bad plates
(tinted -> lut, blurred -> grain fail, shrunk object -> bbox fail, mismatched sky -> regenerate), sky stitch of the
13 zone A horizon slices (wrap seam dE < 1), Blender hull bake of the zone A boulder views (LOD tris within 10 %
of 4000/800/180), runtime node tests. Writes tools/biome/out/selftest/ (untracked).
"""
import argparse, glob, json, os, shutil, subprocess, sys, tempfile

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
import biome_lib as bl  # noqa: E402

OUT = os.path.join(HERE, "out", "selftest")
RESULTS = []


def ok(name, cond, detail=""):
    RESULTS.append({"test": name, "ok": bool(cond), "detail": detail})
    print(f"  [{'PASS' if cond else 'FAIL'}] {name} {detail}")
    return cond


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    return r.returncode, r.stdout + r.stderr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-bake", action="store_true")
    ap.add_argument("--blender", default=os.environ.get("BLENDER") or shutil.which("blender") or "/home/box/.local/bin/blender")
    ap.add_argument("--keep", action="store_true")
    A = ap.parse_args()
    if os.path.exists(OUT) and not A.keep:
        shutil.rmtree(OUT)
    os.makedirs(OUT, exist_ok=True)
    py = sys.executable
    sky_dir = os.path.join(REPO, "packs/zone-a/src/sky")
    rock = os.path.join(REPO, "packs/zone-a/src/rocks/boulder/views")

    print("1 bible")
    bid = "selftest-biome"
    full = os.path.join(OUT, "bible.full.json")
    c1, o1 = run([py, f"{HERE}/fill_bible.py", "--id", bid, "--lore", "eclipse wreck field under a nebula", "--player", "I want to explore the wreck", "--seed", "42", "--out", full])
    c2, _ = run([py, f"{HERE}/fill_bible.py", "--id", bid, "--lore", "eclipse wreck field under a nebula", "--player", "I want to explore the wreck", "--seed", "42", "--out", full + ".2"])
    ok("fill_bible runs + schema OK", c1 == 0 and "schema: OK" in o1, o1.strip().splitlines()[0] if o1 else "")
    ok("fill_bible deterministic (same lore + seed = same bible)", open(full).read() == open(full + ".2").read())
    b = bl.read_json(full)
    ok("fallback picks archetype from the lore", b["archetype"] == "void-nebula", b["archetype"])
    t, l = bl.split_biome(b)
    merged = bl.merge_local_lists(t, l)
    tracked_txt = json.dumps(t)
    ok("split: tracked part carries no hex colour", "#" not in tracked_txt.replace('"$schema"', ""))
    ok("split: merge(tracked, local) == full bible", json.dumps(merged, sort_keys=True) == json.dumps(b, sort_keys=True))
    em, info = bl.load_biome("ember-mesa")
    ok("ember-mesa tracked bible validates", not bl.validate(bl.read_json(info["tracked"])), info["tracked"].split("tools/")[-1])
    ok("ember-mesa merged bible validates", not bl.validate(em), "local " + ("present" if info["local"] else "absent (placeholders)"))

    print("2 prompts")
    bp = os.path.join(OUT, bid + ".json")
    bl.write_json(bp, b)
    c, o = run([py, f"{HERE}/prompts.py", "--biome", bp, "--out", os.path.join(OUT, "prompts.json")])
    P = bl.read_json(os.path.join(OUT, "prompts.json"))
    ok("prompts: 35 slots = Grok budget (1 key + 8 sky + 8 ground + 2 planet + 8 hero + 2x4 rocks)", P["count"] == 35 and not P["overBudget"], f"{P['count']} slots")
    ok("prompts: key still is slot #1", P["slots"][0]["slot"] == "key")
    ok("prompts: every prompt carries the lock sentence + avoid list", all("Same world and same moment as the anchor still" in s["prompt"] and "Avoid:" in s["prompt"] for s in P["slots"]))
    ok("prompts: sky plates never ask for a planet", all("No planet" in s["prompt"] for s in P["slots"] if s["slot"].startswith("sky-H")))
    keys = [s["cacheKey"] for s in P["slots"]]
    ok("prompts: cache keys unique", len(set(keys)) == len(keys))
    b2 = dict(b); b2["bibleVersion"] = b["bibleVersion"] + 1
    bl.write_json(bp, b2)
    run([py, f"{HERE}/prompts.py", "--biome", bp, "--out", os.path.join(OUT, "prompts2.json")])
    P2 = bl.read_json(os.path.join(OUT, "prompts2.json"))
    ok("prompts: bibleVersion bump changes every cache key", not set(keys) & {s["cacheKey"] for s in P2["slots"]})
    bl.write_json(bp, b)

    print("3 manifest")
    inbox = os.path.join(OUT, "inbox"); cat = os.path.join(OUT, "catalogue"); os.makedirs(inbox, exist_ok=True)
    shutil.copy(os.path.join(sky_dir, "sky-0.jpg"), os.path.join(inbox, "sky-H0.jpg"))
    shutil.copy(os.path.join(rock, "yaw-000.png"), os.path.join(inbox, "obj-hero-front.png"))
    os.makedirs(os.path.join(HERE, "out", bid), exist_ok=True)
    shutil.copy(os.path.join(OUT, "prompts.json"), os.path.join(HERE, "out", bid, "prompts.json"))
    c, o = run([py, f"{HERE}/manifest.py", "--biome", bp, "--catalogue", cat, "--ingest", inbox])
    M = bl.read_json(os.path.join(HERE, "out", bid, "manifest.json"))
    ok("manifest: ingest -> 2 hits, 33 misses", M["hits"] == 2 and M["misses"] == 33, f"{M['hits']} hit / {M['misses']} miss")
    c, o = run([py, f"{HERE}/manifest.py", "--biome", bp, "--catalogue", cat])
    ok("manifest: second run hits the catalogue without ingest", bl.read_json(os.path.join(HERE, "out", bid, "manifest.json"))["hits"] == 2)

    print("4 qc")
    q = os.path.join(OUT, "qc"); os.makedirs(q, exist_ok=True)
    # anchor = one zone A horizon slice; plates = the other slices + planted bad ones
    slices = sorted(glob.glob(os.path.join(sky_dir, "sky-*.jpg")), key=lambda p: int(os.path.basename(p)[4:-4]))
    for i, s in enumerate(slices[:6]):
        shutil.copy(s, os.path.join(q, f"sky-H{i}.jpg"))
    shutil.copy(slices[4], os.path.join(q, "sky-H5.jpg"))   # planted copy of H4 -> duplicate
    plant = os.path.join(OUT, "planted"); os.makedirs(plant, exist_ok=True)
    im = Image.open(slices[3]).convert("RGB"); a = np.asarray(im, np.float32) / 255      # slice 3 = the anchor
    Image.fromarray((np.clip(a * [1.3, 1.0, 0.72] + [0.03, 0.0, 0.0], 0, 1) * 255).astype(np.uint8)).save(os.path.join(plant, "sky-tinted.jpg"))   # warm cast -> lut
    Image.fromarray((np.clip(1.0 - a[..., [1, 2, 0]], 0, 1) * 255).astype(np.uint8)).save(os.path.join(plant, "sky-wrongworld.jpg"))        # inverted, hue-rotated world -> regenerate
    g = Image.open(os.path.join(rock, "yaw-090.png")).convert("RGBA")
    g.save(os.path.join(q, "obj-hero-front.png"))
    g.filter(ImageFilter.GaussianBlur(6)).save(os.path.join(q, "obj-hero-right.png"))                                                # mush -> grain fail
    small = Image.new("RGBA", g.size, (0, 0, 0, 0)); small.paste(g.resize((g.width // 2, g.height // 2)), (g.width // 4, g.height // 4))
    small.save(os.path.join(q, "obj-hero-back.png"))                                                                                 # tiny -> bbox fail
    anchor = os.path.join(OUT, "anchor.jpg"); shutil.copy(slices[3], anchor)
    lp = bp[:-5] + ".local.json"
    if os.path.exists(lp):
        os.remove(lp)
    c, o = run([py, f"{HERE}/qc.py", "anchor", "--biome", bp, "--image", anchor])
    ok("qc anchor: samples the key still", c == 0 and os.path.exists(lp), o.strip()[:120])
    rep = os.path.join(OUT, "qc-report.json")
    c, o = run([py, f"{HERE}/qc.py", "check", "--biome", bp, "--slots", q, "--report", rep, "--no-attempts"])
    R = bl.read_json(rep)["plates"]
    dec = {k: v["decision"] for k, v in R.items()}
    ok("qc: report written (6 sky slices + 3 object plates)", c == 0 and len(R) == 9, json.dumps(bl.read_json(rep)["counts"]))
    ok("qc: the anchor's own slice passes its colour checks", not [f for f in R["sky-H3"]["fails"]], str(R["sky-H3"]["fails"]))
    dd = bl.read_json(rep).get("duplicates", [])
    ok("qc: copied sky plate is flagged as a duplicate (no other sky pair)", [d["pair"] for d in dd if d["pair"][0].startswith("sky")] == [["sky-H4", "sky-H5"]], str(dd))
    rep2 = os.path.join(OUT, "qc-planted.json")
    c, o = run([py, f"{HERE}/qc.py", "check", "--biome", bp, "--image", os.path.join(plant, "sky-tinted.jpg"), "--image", os.path.join(plant, "sky-wrongworld.jpg"),
                "--profile", "sky", "--report", rep2, "--no-attempts"])
    R2 = bl.read_json(rep2)["plates"]
    ok("qc: tinted copy of the anchor -> lut (fitted grade fixes it)", R2["sky-tinted"]["decision"] == "lut", R2["sky-tinted"]["decision"] + " " + str(R2["sky-tinted"].get("correction")))
    ok("qc: inverted, hue-rotated plate -> regenerate", R2["sky-wrongworld"]["decision"] == "regenerate", R2["sky-wrongworld"]["decision"])
    ok("qc: blurred object -> grain fail", any(f["check"] == "grain" for f in R["obj-hero-right"]["fails"]), str([f["check"] for f in R["obj-hero-right"]["fails"]]))
    ok("qc: half-size object -> bbox fail", any(f["check"] == "bbox" for f in R["obj-hero-back"]["fails"]), str(R["obj-hero-back"]["metrics"]["bbox"]["fill"]))
    c, o = run([py, f"{HERE}/qc.py", "cube", "--biome", bp, "--out", os.path.join(OUT, "master.cube"), "--size", "17"])
    ok("qc cube: 17^3 LUT written", c == 0 and sum(1 for _ in open(os.path.join(OUT, "master.cube"))) == 17 ** 3 + 2)

    print("5 sky stitch (zone A, 13 horizon slices)")
    # slice rail: 13 slices per band, ~27.7 deg each, display overlap -> hfov 32
    c, o = run([py, f"{HERE}/stitch_sky.py", "--biome", bp, "--h", ",".join(slices[:13]), "--hfov", "32", "--heading0", "0",
                "--size", "2048x1024", "--out-dir", os.path.join(OUT, "sky")])
    S = bl.read_json(os.path.join(OUT, "sky", "sky-stitch.json")) if c == 0 else {}
    ok("stitch: runs, 2:1 output", c == 0 and S.get("size") == [2048, 1024], o.strip().splitlines()[-1][:160] if o else "")
    ok("stitch: wrap seam dE < 1 (left edge == right edge)", S.get("wrapDE", 99) < 1.0, str(S.get("wrapDE")))
    ok("stitch: pole is one colour (no pinch)", S.get("zenithRowStd", 1) < 0.01, str(S.get("zenithRowStd")))

    if not A.no_bake and os.path.exists(A.blender):
        print("6 hull bake (zone A boulder, 4 ortho + 4 three-quarter views)")
        bo = os.path.join(OUT, "bake")
        args = [A.blender, "--background", "--factory-startup", "--python", f"{HERE}/bake_hull.py", "--",
                "--front", f"{rock}/yaw-000.png", "--right", f"{rock}/yaw-090.png", "--back", f"{rock}/yaw-180.png", "--left", f"{rock}/yaw-270.png",
                "--q045", f"{rock}/yaw-045.png", "--q135", f"{rock}/yaw-135.png", "--q225", f"{rock}/yaw-225.png", "--q315", f"{rock}/yaw-315.png",
                "--out", bo, "--name", "boulder", "--height", "2.5", "--tex", "512", "--vox", "0.03", "--hires", "20000", "--displace", "0.03"]
        c, o = run(args)
        st = os.path.join(bo, "boulder_stats.json")
        Sx = bl.read_json(st) if os.path.exists(st) else {}
        lt = Sx.get("lod_tris", [])
        ok("bake: GLB + stats written", c == 0 and os.path.exists(os.path.join(bo, "boulder.glb")), f"{Sx.get('glb_bytes')} bytes, {Sx.get('total_s')} s")
        ok("bake: LODs ~4000/800/180 tris", len(lt) == 3 and all(abs(x - y) <= 0.1 * y for x, y in zip(lt, [4000, 800, 180])), str(lt))
        ok("bake: no mirrored flank, fallback texels < 5 %", Sx.get("mirrored_flanks") == 0 and Sx.get("fallback_pct", 100) < 5, f"{Sx.get('fallback_pct')} %")
    else:
        print("6 hull bake skipped (--no-bake or no blender)")

    print("7 runtime")
    c, o = run(["node", "--test", os.path.join(HERE, "runtime")])
    ok("runtime: node tests", c == 0, [l for l in o.splitlines() if l.startswith("# pass") or l.startswith("# fail")].__str__())
    c, o = run(["bash", f"{HERE}/pack-ktx2.sh", os.path.join(OUT, "sky"), os.path.join(OUT, "ktx2"), "--allow-missing"])
    ok("pack-ktx2: runs (encodes when toktx/basisu exist, else lists)", c == 0, o.strip().splitlines()[0] if o else "")

    shutil.rmtree(os.path.join(HERE, "out", bid), ignore_errors=True)
    for f in glob.glob(os.path.join(OUT, bid + "*.json")):
        pass
    nf = sum(not r["ok"] for r in RESULTS)
    bl.write_json(os.path.join(OUT, "selftest.json"), {"pass": len(RESULTS) - nf, "fail": nf, "results": RESULTS})
    print(f"\nselftest: {len(RESULTS) - nf} pass, {nf} fail -> {OUT}/selftest.json")
    return 1 if nf else 0


if __name__ == "__main__":
    sys.exit(main())
