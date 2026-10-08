# Biome pipeline — one biome file, one automatic chain

Back to [METHOD.md](../METHOD.md). **Status: SPEC ONLY (2026-10-08)** — to be built by Grok Build next. Owner asked for one automatic chain so nothing decided on 2026-10-08 is forgotten.

**A new biome = one `biome.json`.** Everything else follows from it: prompts, cleanup, Blender bakes, QC, near / mid / far layers, and the game's fog, shadows and grain. (Earlier working name: `biome-light.json`. Keep it **one file**.)

**Who writes it:** Grok, automatically, when the player says "I want to explore". Players never pick biome types or write prompts. Grok fills the 5 groups below; the shared pipeline does the rest.

## The file: `biome.json` — 5 core params (Grok on X, 2026-10-08)

| # | Group | Holds |
|---|---|---|
| 1 | **Palette** | base + accent hex, saturation (plus the light-sheet colours: key, fill, shadow, haze, zenith, bounce, sampled horizon) |
| 2 | **Sun** | azimuth / elevation, colour temperature (K), intensity, exposure |
| 3 | **Haze** | density curve (FogExp2), warm → cool shift, near / far |
| 4 | **Object set** | asset pack + density / scale rules, streamed ahead of Bolt; near / mid / far LODs |
| 5 | **Ground** | material + displacement pattern |

**One-line form** (what Grok can emit first, then expand): `Name | palette | sun | haze | objects | ground`

```
CrystalVoid | - | 15°/low | dense-cool | shards | reflective-ice
EmberMesa | salmon-plum | 8°/low-right | warm-to-cool | mesas+rocks+arch | rippled-sand-pebbles
```

Filled example — Ember Mesa:

```json
{
  "biome": "ember-mesa",
  "palette": {
    "base": "#c49c6f",
    "accent": "#ffb089",
    "saturation": "TBD - placeholder",
    "key": "#ffb089", "fill": "#c47ad4", "shadow": "#4a2048",
    "haze": "#e8a0b4", "zenith": "#3a2468", "bounce": "#a85a48",
    "horizon": "#c49c6f",
    "rim": { "sun_side": "#ffb089", "planet_side": "#c47ad4" },
    "lut": "biome/kits/ember-mesa/lut/master.cube"
  },
  "sun": {
    "azimuth_deg": "TBD - read once from the sun disc in the 2:1 sky plate: (u - 0.5) * 360",
    "elevation_deg": 8,
    "side": "low right",
    "color_temp_k": "TBD - placeholder, same number in every prompt",
    "intensity": "TBD - placeholder",
    "exposure_ev": "TBD - placeholder, same number in every prompt"
  },
  "haze": {
    "curve": "exp2", "density": 0.0085, "near": 40, "far": 220,
    "warm": "#c49c6f", "cool": "#c47ad4", "cool_mix": 0.30
  },
  "objects": {
    "pack": "ember-mesa",
    "recipes": { "mesa": "A", "rock": "A", "anchor_arch": "B" },
    "near": { "range_m": [0, 40], "tris": [2000, 6000], "tex": 2048, "big_rocks_near_track": 20 },
    "mid":  { "range_m": [40, 120], "tris": [1500, 3000], "tex": 1024 },
    "far":  { "range_m": [120, "horizon"], "tris": [300, 800], "tex": 512, "billboards": false },
    "scale": "sparse size contrast: few 30 m mesas / 20 m arch vs 0.5-2 m rocks",
    "stream": "spawn ahead of Bolt, denser with speed",
    "contact_shadow": { "color": "#4a2048", "opacity": 0.45 },
    "cast_shadow": { "color": "#4a2048", "direction": "away from sun (toward left)", "soft": true },
    "ambient": ["heat-shimmer", "drifting-sand", "birds-3d", "dust-gusts"]
  },
  "ground": {
    "material": "rippled sand with pebbles, top-down seamless albedo",
    "displacement": "height from the same albedo",
    "bombing": { "grid": 3, "offset": 0.15 },
    "detail": { "tile_px": 256, "repeat": 8 },
    "macro": 0.08
  },
  "grain": 0.04,
  "bans": ["studio softbox", "noon sun", "neutral white", "black background fringe", "planet in sky plate", "flat cutout objects"]
}
```

`horizon` is **sampled** from the sky plate's horizon band (rule: fog colour is never typed). LUT, saturation, colour temperature, intensity and exposure are placeholders until the master is fixed. Per the palette rule (METHOD.md, "Biome names in docs"), the real per-biome file with prompt text may live as an untracked `*.local.json`; this example mirrors the hexes already in [lighting-coherence](lighting-coherence.md).

## Stages

| # | Stage | Does | Fails if |
|---|---|---|---|
| 1 | **Prompt generator** | Builds every Imagine prompt (sky 2:1, ground albedo, object 4 sides + top, details) and injects the light sheet from `biome.json` **word for word** (sun vector, colour temperature, exposure, colours, bans). | a prompt lacks the exact sheet |
| 2 | **Cleaner** | Cutout with Grok Build **1.0.50+**, edge bleed **2–4 px**, one premultiply, watermark removal (outpaint), applies the master **LUT**. | black fringe, watermark left |
| 3 | **Blender bake** | [Recipe A or B](blender-imagine-bake.md) → unlit GLB + baked texture, same LUT, near / mid / far LODs from the same bake (objects group), cast-shadow mask along the sun vector. | seams, > 6k tris near, flat object |
| 4 | **QC checker** | Colour delta vs the sky reference; **0** near-black fringe px; seam / wrap test (sky edges, ground 2×2 tile); **no flat objects** (every object is a mesh with volume). Rejects failures back to stage 1–3. | any row fails |

**The game reads the same file** for fog (haze group), object streaming and LOD ranges, contact + cast shadows, rim values and grain. No hex is retyped in game code.

## Re-runs

Existing plates (e.g. the 2026-10-08 Ember Mesa ground) pass through stage 2 + 4 only (seconds, no Grok credit). Regenerate only when QC finds a real light mismatch.

## Done when (for Grok Build)

1. [ ] `biome.json` schema (5 groups + one-line form) + Ember Mesa file; game reads fog / shadow / grain / LOD ranges from it.
2. [ ] Grok can expand a one-line form into a full `biome.json` when the player says "I want to explore".
3. [ ] Prompt generator outputs all prompts for one biome from the file.
4. [ ] Cleaner + LUT run on a folder of plates.
5. [ ] Blender stage calls `tools/blender/imagine_bake.py` per object set.
6. [ ] QC checker rejects a planted bad plate (fringe, seam, wrong colour, flat object).

Related: [lighting-coherence](lighting-coherence.md) · [blender-imagine-bake](blender-imagine-bake.md) · [sky-sphere](sky-sphere.md) · [ground-v2](ground-v2.md) · [aaa-look](aaa-look.md).
