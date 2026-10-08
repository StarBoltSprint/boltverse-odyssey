#!/usr/bin/env python3
"""prompts.py - biome bible -> every Imagine prompt for that biome, one per slot.

  python3 tools/biome/prompts.py --biome ember-mesa [--out tools/biome/out/ember-mesa/prompts.json] [--md]

Prompt = slot clause (templates/slots.json, colour-free) + lock sentence (sun / palette / exposure from the bible)
+ style block (style/<styleId>.local.txt or bible.styleBlock) + avoid list. Every slot gets
cacheKey = sha256(bibleVersion + styleBlock + slotPrompt). Output lands in tools/biome/out/ (untracked): the filled
prompts carry palette words, so they never go into git (repo rule 2026-10-03).

Slots (Grok answer 8 budget, 35 by default): key, sky-H0..H{n-1}, sky-Z, sky-N, ground-g0..g7, planet-map,
planet-ring, obj-<id>-<view> (ortho front/right/back/left/top + three-quarter q045/q135/q225/q315).
"""
import argparse, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import biome_lib as bl  # noqa: E402

COMPASS = ["front", "front-right", "right", "back-right", "back", "back-left", "left", "front-left"]


def rel_words(rel):
    """rel = sun azimuth minus camera heading (deg). Camera looks along its heading."""
    r = (rel + 360) % 360
    if r < 22.5 or r >= 337.5: return "in front of the camera, backlighting the subject"
    if r < 67.5: return "ahead and to the right of the camera"
    if r < 112.5: return "from the right of the camera"
    if r < 157.5: return "behind and to the right of the camera"
    if r < 202.5: return "behind the camera, lighting the subject face-on"
    if r < 247.5: return "behind and to the left of the camera"
    if r < 292.5: return "from the left of the camera"
    return "ahead and to the left of the camera"


def fill(t, d):
    out = t
    for k, v in d.items():
        out = out.replace("{" + k + "}", str(v))
    return out


def build(b):
    T = bl.read_json(os.path.join(bl.TEMPLATES, "slots.json"))
    S = T["slots"]
    style = bl.style_block(b)
    avoid = bl.avoid_list(b)
    pal = b.get("palette") if isinstance(b.get("palette"), dict) else {}
    P = lambda k: pal.get(k, f"<{k.upper()} from the local file>")  # noqa: E731
    sun = b["sun"]
    run_heading = 0.0  # the run direction is world heading 0; the anchor camera looks along it
    sky_avoid_extra = []

    def lock(cam_heading):
        return fill(T["lock"], {"EL": sun["elevationDeg"], "SUN_REL": "sun " + rel_words(sun["azimuthDeg"] - cam_heading),
                                "KELVIN": int(sun["kelvin"]), "KEY": P("key"), "FILL": P("fill"), "SHADOW": P("shadow"),
                                "HORIZON": P("horizon"), "ZENITH": P("zenith"), "GROUND": P("ground"),
                                "EV": f"{b['exposure']['ev']:+.1f}", "WB": int(b["exposure"]["whiteBalanceK"])})

    def words(v, key):
        return v if isinstance(v, str) and v != bl.LOCAL_MARK else f"<{key} from the local file>"

    slots = []

    def add(slot, tpl, clause_vars, cam_heading, extra=None):
        t = S[tpl]
        clause = fill(t["clause"], clause_vars)
        av = avoid + (extra or [])
        prompt = f"{clause} {lock(cam_heading)} Style: {style} Avoid: {', '.join(av)}."
        aspect = fill(t["aspect"], clause_vars)
        slots.append({"slot": slot, "template": tpl, "qc": t["qc"], "aspect": aspect, "px": t["px"],
                      "camHeadingDeg": round(cam_heading % 360, 2), "prompt": prompt,
                      "cacheKey": bl.cache_key(b["bibleVersion"], style, prompt)})

    # 1. anchor first
    add("key", "key", {"ANCHOR_SUBJECT": words(b["anchor"].get("subject"), "ANCHOR SUBJECT"),
                       "HORIZON_PCT": int(round(100 * b["anchor"].get("horizonRow", 0.5)))}, run_heading)
    # 2. sky: n level plates, H0 centred on the sun, then zenith + nadir
    sky = b["sky"]; n = sky["horizonPlates"]; step = 360.0 / n
    for i in range(n):
        hd = (sun["azimuthDeg"] + i * step) % 360
        rel = (sun["azimuthDeg"] - hd + 540) % 360 - 180
        if abs(rel) <= sky["plateHFovDeg"] / 2:
            sif = f"The sun disc sits {abs(rel):.0f} degrees {'right' if rel > 0 else 'left'} of centre, {sun['elevationDeg']} degrees up." if abs(rel) > 0.5 else f"The sun disc is centred, {sun['elevationDeg']} degrees up."
        else:
            sif = "No sun disc in this frame; the light comes from " + rel_words(rel) + "."
        add(f"sky-H{i}", "sky-h", {"SKY_SUBJECT": words(sky.get("subject"), "SKY SUBJECT"), "HFOV": sky["plateHFovDeg"],
                                   "PLATE_ASPECT": sky.get("plateAspect", "16:9"),
                                   "HEADING_WORDS": f"toward heading {hd:.0f} degrees ({rel:+.0f} degrees from the sun)",
                                   "SUN_IN_FRAME": sif}, hd)
    if sky.get("zenith", True):
        add("sky-Z", "sky-z", {"SKY_SUBJECT": words(sky.get("subject"), "SKY SUBJECT"), "CAPFOV": sky.get("capFovDeg", 100)}, sun["azimuthDeg"])
    if sky.get("nadir", True):
        add("sky-N", "sky-n", {"SKY_SUBJECT": words(sky.get("subject"), "SKY SUBJECT"), "CAPFOV": sky.get("capFovDeg", 100)}, sun["azimuthDeg"])
    # 3. ground tiles. Top-down: frame-up = run direction (heading 0); sun side from azimuth.
    g = b["ground"]
    sd = COMPASS[int(((sun["azimuthDeg"] + 22.5) % 360) // 45)]
    opp = COMPASS[int(((sun["azimuthDeg"] + 180 + 22.5) % 360) // 45)]
    topdown = {"front": "top", "front-right": "top-right", "right": "right", "back-right": "bottom-right", "back": "bottom",
               "back-left": "bottom-left", "left": "left", "front-left": "top-left"}
    mats = g.get("materials") or []
    for i in range(g["tiles"]):
        m = mats[i % len(mats)] if mats else {"id": f"g{i}", "subject": bl.LOCAL_MARK}
        add(f"ground-{m.get('id', 'g%d' % i)}", "ground", {"MATERIAL": words(m.get("subject"), "MATERIAL"), "TILE_M": g["tileMeters"],
                                                         "MAX_CM": 30, "SUN_TOPDOWN": topdown[sd], "SHADOW_TOPDOWN": topdown[opp],
                                                         "EL": sun["elevationDeg"]}, run_heading)
    # 4. planet (real sphere + ring mesh; never painted in the sky)
    pl = b["planet"]
    add("planet-map", "planet-map", {"PLANET_SUBJECT": words(pl.get("subject"), "PLANET SUBJECT")}, pl["azimuthDeg"])
    if pl.get("ring"):
        add("planet-ring", "planet-ring", {"PLANET_SUBJECT": words(pl.get("subject"), "PLANET SUBJECT")}, pl["azimuthDeg"])
    # 5. objects: ortho silhouettes carve the hull, three-quarter plates colour the flanks (never a mirrored flank)
    vh = {"front": 0, "right": 90, "back": 180, "left": 270}
    for o in b.get("objects", []):
        subj = words(o.get("subject"), "SUBJECT")
        fillpct = 86 if o["kind"] in ("hero", "wreck") else 80
        for v in o["views"].get("ortho", []):
            if v == "top":
                light = f"from the {topdown[sd]} of the frame, {sun['elevationDeg']} degrees above the horizon"
                add(f"obj-{o['id']}-top", "obj-top", {"SUBJECT": subj, "FILL": fillpct, "LIGHT_IN_VIEW": light}, 0)
                continue
            # "front" = the face the runner sees while approaching (camera heading 0 = run direction);
            # a camera orbiting to view azimuth v (front 0, right 90, back 180, left 270) looks along heading -v.
            cam = (-vh[v]) % 360
            light = rel_words(sun["azimuthDeg"] - cam) + f", {sun['elevationDeg']} degrees above the horizon"
            add(f"obj-{o['id']}-{v}", "obj-ortho", {"VIEW": v, "SUBJECT": subj, "HEIGHT": o["heightM"], "FILL": fillpct,
                                                    "OBJ_ASPECT": "3:4" if o["kind"] in ("mesa",) else "1:1", "LIGHT_IN_VIEW": light}, cam)
        for az in o["views"].get("threeQuarter", []):
            cam = (-az) % 360
            light = rel_words(sun["azimuthDeg"] - cam) + f", {sun['elevationDeg']} degrees above the horizon"
            azw = {45: "between the front and the right side", 135: "between the right side and the back",
                   225: "between the back and the left side", 315: "between the left side and the front"}[int(az)]
            add(f"obj-{o['id']}-q{int(az):03d}", "obj-q", {"SUBJECT": subj, "AZ": int(az), "AZ_WORDS": azw, "FILL": fillpct,
                                                          "LIGHT_IN_VIEW": light}, cam)
    budget = b.get("budgets", {}).get("imagineImages")
    return {"biome": b["id"], "bibleVersion": b["bibleVersion"], "styleId": b.get("styleId"),
            "styleIsPlaceholder": style.startswith("<"), "slots": slots, "count": len(slots), "budget": budget,
            "overBudget": bool(budget and len(slots) > budget), "order": "key first; everything else is QC'd against it"}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--biome", required=True, help="id under tools/biome/biomes or a path to a bible JSON")
    ap.add_argument("--out")
    ap.add_argument("--md", action="store_true", help="also write prompts.md (human copy-paste sheet)")
    A = ap.parse_args()
    b, info = bl.load_biome(A.biome)
    errs = bl.validate(b)
    if errs:
        print("[prompts] schema errors:", errs[:8]); return 1
    style_ok = not bl.style_block(b).startswith("<") and not bl.avoid_list(b)[0].startswith("<")
    miss = [m for m in info["missing_local"] if not (style_ok and m in ("styleBlock", "avoid"))]
    if miss:
        print(f"[prompts] WARNING: no local values for {len(miss)} fields -> visible placeholders "
              f"({', '.join(miss[:6])}...)")
    res = build(b)
    out = A.out or os.path.join(bl.HERE, "out", b["id"], "prompts.json")
    bl.write_json(out, res)
    if A.md:
        with open(out[:-5] + ".md", "w", encoding="utf-8") as f:
            f.write(f"# Imagine prompts - {b['id']} (bible v{b['bibleVersion']}) - LOCAL, do not commit\n\n")
            for s in res["slots"]:
                f.write(f"## {s['slot']}  ({s['aspect']}, {s['px'][0]}x{s['px'][1]}, qc {s['qc']})\n\n{s['prompt']}\n\n`{s['cacheKey'][:16]}`\n\n")
    print(f"[prompts] {b['id']}: {res['count']} slots (budget {res['budget']}{', OVER' if res['overBudget'] else ''}) -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
