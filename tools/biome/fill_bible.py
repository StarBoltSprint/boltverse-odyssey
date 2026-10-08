#!/usr/bin/env python3
"""fill_bible.py - lore row + player line -> one biome bible JSON (biome/1), decided before any asset exists.

  python3 tools/biome/fill_bible.py --id ember-mesa --lore "..." --player "I want to explore the red mesas" \
      [--seed 7] [--archetype mesa-desert] [--split] [--out path.json]
  python3 tools/biome/fill_bible.py --id X --lore ... --grok-request out/X/grok-request.json   # writes the Grok ask
  python3 tools/biome/fill_bible.py --id X --lore ... --grok-response reply.json             # merges Grok's JSON

Grok path is a STUB here: this script never calls the network. --grok-request writes the exact ask (rules + schema)
for an external step (grok.com chat or the player's BYOK call); --grok-response merges and validates what came back.
Anything missing or invalid falls back to the deterministic seeded generator, so the same (lore, player, seed) always
gives the same bible.

--split writes tools/biome/biomes/<id>.json (tracked: numbers, ids, budgets) and <id>.local.json (untracked: palette
hex, subject words, style block, avoid list) - repo rule 2026-10-03. Without --split, one full file goes to --out.
"""
import argparse, hashlib, json, math, os, random, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import biome_lib as bl  # noqa: E402

# Six base archetypes (each has a ready phone pack in the catalogue - Grok answer 8). Numbers only + plain nouns.
# hue = Lab hue angle (deg) of the key light; fillShift = hue offset of the sky fill; kelvin/elev = sun ranges.
ARCHETYPES = {
    "mesa-desert": dict(words=["mesa", "desert", "dune", "canyon", "butte", "sand", "ember", "redrock"],
                        hue=55, fillShift=255, kelvin=(2600, 3600), elev=(5, 14), chroma=34, groundHue=50,
                        ground=["rippled sand", "wind-packed sand with pebbles", "cracked clay plates", "rubble scree",
                                "dune crest sand", "stone pavement", "dry wash gravel", "talus at a cliff foot"],
                        hero="giant rock arch", rocks=["sandstone butte", "wind-cut boulder"]),
    "ice-tundra": dict(words=["ice", "frost", "snow", "glacier", "tundra", "frozen", "aurora"],
                       hue=250, fillShift=60, kelvin=(6500, 9500), elev=(3, 18), chroma=18, groundHue=240,
                       ground=["wind-carved snow", "glacier ice", "frost-shattered rock", "snow over scree",
                               "pressure-ridge ice", "frozen lake crust", "rime-coated gravel", "drift snow"],
                       hero="frozen monolith", rocks=["ice-capped boulder", "glacier block"]),
    "volcanic": dict(words=["lava", "volcano", "ash", "magma", "obsidian", "fire", "basalt"],
                     hue=40, fillShift=200, kelvin=(1900, 2800), elev=(2, 10), chroma=40, groundHue=30,
                     ground=["cooled pahoehoe lava", "ash dunes", "obsidian shards", "basalt columns tops",
                             "cinder gravel", "cracked crust over glow", "sulfur crust", "scoria rubble"],
                     hero="shattered caldera spire", rocks=["basalt column stack", "obsidian boulder"]),
    "verdant": dict(words=["jungle", "forest", "moss", "cascade", "verdance", "river", "fern", "green"],
                    hue=110, fillShift=150, kelvin=(4800, 6200), elev=(15, 40), chroma=30, groundHue=95,
                    ground=["mossy forest floor", "wet river stones", "root-woven earth", "fern litter",
                            "mud with puddles", "flower meadow", "lichen rock", "leaf litter"],
                    hero="overgrown ancient tree arch", rocks=["mossy boulder", "waterfall rock"]),
    "crystal": dict(words=["crystal", "shard", "prism", "geode", "quartz", "gem", "cave"],
                    hue=300, fillShift=120, kelvin=(5500, 8000), elev=(10, 35), chroma=36, groundHue=280,
                    ground=["crystal gravel", "geode floor", "quartz sand", "prism shards in rock",
                            "salt flats", "glass-smooth stone", "mineral crust", "gem rubble"],
                    hero="giant crystal cluster", rocks=["crystal outcrop", "geode boulder"]),
    "void-nebula": dict(words=["space", "void", "nebula", "asteroid", "star", "orbit", "eclipse", "wreck"],
                        hue=285, fillShift=75, kelvin=(7000, 11000), elev=(0, 25), chroma=28, groundHue=270,
                        ground=["asteroid regolith", "glassy rock", "meteor-pitted plates", "dust over basalt",
                                "fractured slate", "impact ejecta", "ancient metal plating in rock", "fine dust"],
                        hero="crashed starship hull", rocks=["asteroid fragment", "slate monolith"]),
}

# Local override (untracked): style/archetypes.local.json may replace or extend any archetype (richer subject words).
_ovr = os.path.join(os.path.dirname(os.path.abspath(__file__)), "style", "archetypes.local.json")
if os.path.exists(_ovr):
    for _k, _v in bl.read_json(_ovr).items():
        ARCHETYPES[_k] = {**ARCHETYPES.get(_k, {}), **_v}

DEFAULTS = {
    "schema": "biome/1",
    "bibleVersion": 1,
    "anchor": {"slot": "key", "aspect": "16:9", "horizonRow": 0.52},
    "exposure": {"ev": 0.0},
    "sky": {"horizonPlates": 6, "plateHFovDeg": 75, "plateAspect": "16:9", "zenith": True, "nadir": True,
            "capFovDeg": 100, "outSize": [4096, 2048], "bandSize": [8192, 1024], "planetInSky": False},
    "ground": {"tiles": 8, "tileMeters": 8.0, "heightFromAlbedo": True, "heightMeters": 0.35,
               "bombing": {"grid": 3, "offset": 0.15, "rotate": True}, "macroScale": 0.08, "bigRocks": 20},
    # camera numbers: Grok chat answer 7 (base FOV 58 -> 70 sprint, damp 4). Trauma OFF by owner rule (no shake, ever).
    "camera": {"fovBase": 58, "fovSprint": 70, "fovDamp": 4, "near": 0.2, "far": 400, "pixelRatioCap": 1.5,
               "trauma": {"enabled": False, "landing": 0.35, "decayPerSec": 1.6, "rollRad": 0.004, "liftM": 0.02}},
    "post": {"toneMapping": "none", "runtimeLut": False, "contrast": 1.06, "gamma": 0.95, "grain": 0.04, "vignette": {"start": 0.72, "end": 1.15, "strength": 0.28},
             "sceneFog": False, "bloom": {"enabled": False, "threshold": 0.85, "radius": 0.4, "strength": 0.25, "skyOnly": True}},
    # 1 key + 8 sky + 8 ground + 2 planet + 8 hero + 4 per rock x2 = 35 (Grok answer 8)
    "budgets": {"imagineImages": 35, "drawCalls": 12, "trisOnScreen": 150000, "texMB": 64, "attemptsPerSlot": 2},
    "qc": {"deltaE": "2000", "horizonDE": 6, "shadowDE": 10, "shadowLMin": 8, "highlightDE": 12, "satTol": 0.08,
           "objectLitDE": 14, "seamDE": 8, "bboxMin": 0.70, "grainLapVarMin": 80, "lutMaxFactor": 2.0, "maxFails": 2},
    "styleId": "aaa-2026",
}


def lch_hex(L, C, h):
    import numpy as np
    for _ in range(40):  # pull chroma in until the colour is inside sRGB
        a, b = C * math.cos(math.radians(h)), C * math.sin(math.radians(h))
        rgb = bl.lab_to_rgb(np.array([L, a, b]))
        lin_ok = True
        # lab_to_rgb clips; check round trip error to detect clipping
        back = bl.rgb_to_lab(rgb)
        if float(np.linalg.norm(back - np.array([L, a, b]))) < 1.0:
            return bl.rgb01_to_hex(rgb)
        C *= 0.9
    return bl.rgb01_to_hex(rgb)


def mix_hex(h1, h2, t):
    import numpy as np
    l1 = bl.rgb_to_lab(np.array(bl.hex_to_rgb01(h1))); l2 = bl.rgb_to_lab(np.array(bl.hex_to_rgb01(h2)))
    return bl.rgb01_to_hex(bl.lab_to_rgb(l1 * (1 - t) + l2 * t))


def pick_archetype(text, forced=None):
    if forced:
        return forced
    t = text.lower()
    best, score = "mesa-desert", -1
    for k, a in ARCHETYPES.items():
        s = sum(t.count(w) for w in a["words"])
        if s > score:
            best, score = k, s
    return best


def fallback(bid, lore, player, seed, archetype=None):
    text = f"{lore}\n{player}"
    h = int(hashlib.sha256(f"{bid}|{text}|{seed}".encode()).hexdigest()[:12], 16)
    R = random.Random(h)
    arch = pick_archetype(text, archetype)
    A = ARCHETYPES[arch]
    kel = round(R.uniform(*A["kelvin"]) / 50) * 50
    elev = round(R.uniform(*A["elev"]), 1)
    az = round(R.uniform(0, 360), 1)
    side = R.choice(["left", "right"])
    hk = (A["hue"] + R.uniform(-12, 12)) % 360
    hf = (hk + A["fillShift"] + R.uniform(-15, 15)) % 360
    C = A["chroma"]
    key = lch_hex(82, C * 1.0, hk)
    fill = lch_hex(58, C * 0.9, hf)
    shadow = lch_hex(R.uniform(13, 19), C * 0.55, (hf + R.uniform(-10, 10)) % 360)   # never black (L > 8)
    horizon = mix_hex(lch_hex(76, C * 0.75, hk), fill, 0.30)
    zenith = lch_hex(R.uniform(20, 28), C * 0.8, (hf + 15) % 360)
    ground = lch_hex(R.uniform(48, 60), C * 0.7, (A["groundHue"] + R.uniform(-10, 10)) % 360)
    accent = lch_hex(65, C * 1.2, (hk + R.choice([-40, 40, 180])) % 360)
    near, far = 40, 220
    b = json.loads(json.dumps(DEFAULTS))
    b.update({
        "id": bid, "name": bid.replace("-", " ").title(), "archetype": arch, "seed": seed,
        "lore": {"row": lore, "playerLine": player},
        "sun": {"azimuthDeg": az, "elevationDeg": elev, "kelvin": kel, "hex": key, "side": side, "intensity": 1.0},
        "palette": {"key": key, "fill": fill, "shadow": shadow, "horizon": horizon, "zenith": zenith, "ground": ground,
                    "accent": accent, "rim": mix_hex(key, horizon, 0.3)},
        "fog": {"color": horizon, "near": near, "far": far, "desat": 0.25, "heightFalloff": 0.06,
                "bands": [{"dist": near, "color": mix_hex(ground, horizon, 0.5), "amount": 0.15},
                          {"dist": (near + far) / 2, "color": horizon, "amount": 0.45},
                          {"dist": far, "color": mix_hex(horizon, fill, 0.35), "amount": 0.85}]},
        "lut": {"lift": [round(x * 0.03, 4) for x in bl.hex_to_rgb01(shadow)], "gamma": [1.0, 1.0, 1.0],
                "gain": [round(0.97 + 0.06 * x, 4) for x in bl.hex_to_rgb01(key)], "saturation": 1.0, "contrast": 1.04},
        "planet": {"subject": f"ringed gas giant seen from the {arch} world", "radius": 80, "distance": 600,
                   "azimuthDeg": round((az + 180 + R.uniform(-40, 40)) % 360, 1), "elevationDeg": round(R.uniform(12, 30), 1),
                   "spinDegPerSec": 0.86, "ring": {"inner": 108, "outer": 150, "tiltDeg": round(R.uniform(10, 28), 1), "spinDegPerSec": 2.3}},
        "objects": [
            {"id": "hero", "kind": "hero", "subject": "one " + A["hero"], "count": 1, "heightM": 22, "layer": "landmark",
             "views": {"ortho": ["front", "right", "back", "top"], "threeQuarter": [45, 135, 225, 315]},
             "lods": [4000, 800, 180], "tex": 2048, "displaceM": 0.25},
        ] + [
            {"id": f"rock-{i}", "kind": "rock", "subject": "one " + r, "count": 10, "heightM": [28, 3][i] if arch == "mesa-desert" else [6, 2.5][i],
             "layer": ["mid", "near"][i], "views": {"ortho": ["front", "right", "top"], "threeQuarter": [45]},
             "lods": [4000, 800, 180], "tex": 2048 if i == 0 else 1024, "displaceM": 0.15}
            for i, r in enumerate(A["rocks"])
        ],
        "ambient": ["heat-shimmer", "drifting-sand", "birds-3d", "dust-gusts"] if arch == "mesa-desert" else ["drifting-dust", "birds-3d"],
        "catalogueFallback": arch,
    })
    b["anchor"]["subject"] = f"wide establishing shot of {bid.replace('-', ' ')}, runner path leading to the {A['hero']}"
    b["sky"]["subject"] = f"{arch} sky"
    b["ground"]["materials"] = [{"id": f"g{i}", "subject": m, "weight": round(1.0 if i == 0 else 0.6 - 0.05 * i, 2)} for i, m in enumerate(A["ground"])]
    b["exposure"]["whiteBalanceK"] = 5500  # daylight WB: the sun keeps its own colour (WB = kelvin would neutralise it)
    b["tone"] = {"$note": "free tone words for this biome (local only)"}
    b["styleBlock"] = bl.LOCAL_MARK
    b["avoid"] = bl.LOCAL_MARK
    return b


GROK_ASK = """You are filling the biome bible for Boltverse Odyssey (endless 3D runner, Bolt the wolf, phone WebGL).
Return ONLY one JSON object matching the schema below (biome/1). Decide everything BEFORE any image exists:
one sun (azimuth, elevation, kelvin), one palette (key, fill, shadow never black, horizon, zenith, ground), fog with
3 bands warm near -> cool far, exposure + white balance, LUT lift/gamma/gain, ground materials (8), objects (one hero
with 4 ortho + 4 three-quarter views, rocks with 4 views), budgets (35 Imagine images total). No planet in the sky.
Keep numbers inside the schema ranges. Lore row: {lore}
Player line: {player}
Seed (keep): {seed}
Schema:
{schema}
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--id", required=True)
    ap.add_argument("--lore", default="")
    ap.add_argument("--player", default="I want to explore")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--archetype", choices=sorted(ARCHETYPES))
    ap.add_argument("--grok-request", help="write the Grok ask (stub, no network) to this path and continue with the fallback")
    ap.add_argument("--grok-response", help="JSON reply from Grok to merge over the fallback")
    ap.add_argument("--keep", help="existing full or local bible to merge over the fallback (hand-curated values win)")
    ap.add_argument("--split", action="store_true", help="write biomes/<id>.json (tracked) + biomes/<id>.local.json")
    ap.add_argument("--out", help="full JSON output path (default out/<id>/biome.full.json)")
    A = ap.parse_args()

    b = fallback(A.id, A.lore, A.player, A.seed, A.archetype)
    src = ["fallback"]
    if A.grok_request:
        ask = GROK_ASK.format(lore=A.lore, player=A.player, seed=A.seed, schema=open(bl.SCHEMA).read())
        os.makedirs(os.path.dirname(os.path.abspath(A.grok_request)), exist_ok=True)
        bl.write_json(A.grok_request, {"model": "grok (external step)", "messages": [{"role": "user", "content": ask}],
                                       "note": "STUB - fill_bible.py never sends this. Paste in grok.com or a BYOK call."})
        print(f"[fill] Grok ask written (not sent): {A.grok_request}")
    if A.grok_response:
        raw = open(A.grok_response, encoding="utf-8").read()
        j = json.loads(raw[raw.index("{"): raw.rindex("}") + 1])
        g = bl.merge_local_lists(b, j)
        errs = bl.validate(g)
        if errs:
            print(f"[fill] Grok reply rejected ({len(errs)} schema errors) -> fallback kept. First: {errs[:3]}")
        else:
            b, src = g, ["grok", "fallback-for-missing"]
    if A.keep:
        b = bl.merge_local_lists(b, bl.read_json(A.keep)); src.append(f"keep:{os.path.basename(A.keep)}")
    b.setdefault("$source", src)
    b.pop("$source", None)
    errs = [e for e in bl.validate(b) if True]
    full_out = A.out or os.path.join(bl.HERE, "out", A.id, "biome.full.json")
    bl.write_json(full_out, b)
    print(f"[fill] {A.id}: archetype {b.get('archetype')} sun az {b['sun']['azimuthDeg']} el {b['sun']['elevationDeg']} "
          f"{b['sun']['kelvin']}K source {'+'.join(src)} -> {full_out}")
    if A.split:
        t, l = bl.split_biome(b)
        tp, lp = bl.biome_paths(A.id)
        bl.write_json(tp, t); bl.write_json(lp, l)
        print(f"[fill] tracked {tp}\n[fill] local   {lp} (untracked: palette, words, style, avoid)")
    print(f"[fill] schema: {'OK' if not errs else str(len(errs)) + ' errors: ' + '; '.join(errs[:5])}")
    return 0 if not errs else 1


if __name__ == "__main__":
    sys.exit(main())
