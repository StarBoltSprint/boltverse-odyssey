# Biome bible — one plan before any asset (IN TEST, 2026-10-08)

**Status: IN TEST.** Tools merged only when SmiR validates. Code: [`tools/biome/`](../../tools/biome/README.md).
Source: eight grok.com answers asked on 2026-10-08 (sky, ground, objects, biome bible, art direction, ambient depth,
AAA feel, auto-chain), plus the earlier Grok-on-X answers summarised in PR #188. Nothing here replaces a VALIDATED
recipe: the zone A sky stays locked ([`sky.md`](sky.md)), the frigate loft stays the method for hard objects
([`hard-objects.md`](hard-objects.md)).

## 1. Idea

Stop patching biomes after the fact. **One biome bible is decided first**; every Imagine prompt, every Blender bake
and every runtime setting is *derived* from it by code. A biome is coherent by construction because all its assets
read the same numbers, and every generated plate is checked against one anchor image.

```
bible (biome/1 JSON) ─┬─> prompts.py  (35 slots: lock sentence + per-asset clause, cache key per slot)
                      ├─> manifest.py (catalogue hit / miss, fallback after 2 fails)
   Imagine (manual)  ─┤
                      ├─> qc.py anchor (key still sampled)  ─> qc.py check (pass / LUT / regenerate / fallback)
                      ├─> stitch_sky.py (6 level plates + zenith + nadir -> 2:1 equirect, fog colour written back)
                      ├─> bake_hull.py  (ortho silhouettes carve the hull, three-quarter plates paint it, LOD after bake)
                      ├─> pack-ktx2.sh  (ETC1S, UASTC for normals / hero)
                      └─> runtime/biome-runtime.js (fog bands, grade, sky, camera — read from the same JSON)
```

One command: `bash tools/biome/run-biome.sh <id> [--slots DIR]`. It stops at the Imagine step (exit 10) and lists the
slots still missing.

## 2. The key still is the anchor

- Slot #1 is the **key still**: a wide establishing shot of the biome at the planned moment (sun, haze, ground,
  hero in the distance). It is generated **first**.
- `qc.py anchor` samples it: horizon haze, sky fill, shadow, highlight, ground, saturation. The horizon row is
  detected (0.15–0.85 of the height); a mismatch with the planned row is reported, not hidden.
- Every later plate is measured against those samples. If the key still is wrong, regenerate it before anything else.

## 3. Bible fields (schema `tools/biome/schema/biome.schema.json`, `biome/1`)

| Group | Fields |
|---|---|
| identity | `id`, `bibleVersion` (bump = every cache key changes), `seed`, `archetype`, `styleId` |
| sun | azimuth (deg, 0 = run direction, clockwise), elevation, kelvin, colour, intensity, side |
| palette | key, fill, shadow (never black, L > 8), horizon, zenith, ground, accent |
| fog | colour + **3 bands** near / mid / far (distance, amount, colour) warm near → cool far, desaturation, height falloff |
| exposure | EV, white balance (daylight 5500 K by default so the warm sun stays warm) |
| lut | lift / gamma / gain + saturation + contrast (offline master grade; runtime LUT off by default) |
| sky | plate count (6), plate HFOV, cap FOV, out size (≥ 4096×2048 supported), optional wide band, `planetInSky: false` |
| planet | separate mesh: azimuth opposite the sun, size, ring, spin |
| ground | 8 materials (subject, role, tile metres) |
| objects | hero + rocks: kind, height, views (4 ortho + 4 three-quarter at 45/135/225/315), LODs 4000/800/180, texture 2048 |
| camera | FOV 58 → 70 at sprint, damping, pixel-ratio cap 1.5, trauma **disabled** (no-shake rule) |
| post | `toneMapping: none`, `sceneFog: false`, grain 4 %, vignette |
| budgets | 35 images, drawCalls 12, tris 150 k, texMB 64, 2 attempts per slot |
| qc | ΔE thresholds (§5) |
| style | `styleBlock` + `avoid` list (local only) |

### Repo rule 2026-10-03 (palettes and prompts stay out of tracked files)

The bible is **split**. The tracked `tools/biome/biomes/<id>.json` holds numbers, ids and `"$local"` marks. The
untracked `<id>.local.json` holds every palette hex, the fog colours, every subject phrase, the style block and the
avoid list (`*.local.*` is in `.gitignore`). `biome_lib.load_biome()` merges the two; `fill_bible.py --split` writes
both. Slot templates in `templates/slots.json` are colour-free, as the 2026-10-03 hard-object rule allows. The style
block and the avoid list live in `tools/biome/style/<styleId>.local.txt` / `.avoid.local.txt`.

## 4. Prompts = lock sentence + per-asset clause

Every prompt starts with the same **lock sentence**, filled from the bible: one sun only, its elevation, its side
*relative to that slot's camera heading*, kelvin and key colour, sky fill, shadow colour (never black), horizon haze,
zenith, ground bounce, exposure and white balance. Then the slot clause (sky plate at heading h, ground tile, ortho
silhouette, three-quarter colour plate...), then the style block, then the avoid list.

- 35 slots = 1 key + 6 horizon + zenith + nadir + 8 ground + planet map + ring + 8 hero views + 2 rocks × 4 views.
- Cache key = `sha256(bibleVersion ␟ styleBlock ␟ slotPrompt)`. Same plan → same keys → catalogue hits, no credit.
- Sky prompts never mention a planet (the planet is its own mesh).

## 5. QC numbers (CIEDE2000 against the anchor)

| Check | Threshold | Where it is measured |
|---|---|---|
| horizon haze | ΔE < 6 | band just above the detected horizon |
| shadow | ΔE < 10 and L > 8 | 2–8 / 2–10 percentile pixels |
| highlight | ΔE < 12 | 99–99.9 percentile when the sun is in frame |
| saturation | within 0.08 | mean chroma ratio; outside → LUT |
| object lit face | ΔE < 14 | 80–97 percentile inside the segmented object |
| seam / overlap | ΔE < 8 | overlap strips of neighbour sky plates, wrap edges of ground and planet maps |
| content bbox | ≥ 70 % | object fill of the frame |
| grain | Laplacian variance > 80 | ground and object plates (mush detector) |
| duplicate | thumbnail mean abs diff ≥ 0.012 | plates of one family (sky ring, ground set, one object's views); a copy is regenerated |

**Decision.** All pass → *pass*. Colour-only fails that one global grade (gain 3 + lift 3 + saturation, Nelder-Mead
on the same pixel regions, gain within ×2) brings under threshold → *LUT* (the corrected plate is written to
`graded/`). Shape, texture, seam, bbox or grain fails, or colour beyond the LUT range → *regenerate*. **Two fails on
one slot → catalogue fallback** (`catalogue/fallback/<archetype>/`). A bad seam regenerates the right-hand plate.

## 6. Sky

Six level horizon plates at heading = sun azimuth + i·60°, 75° HFOV (15° overlap), plus a zenith and a nadir cap,
stitched by `stitch_sky.py` to one 2:1 equirect (default 4096×2048; `--band 8192x1024` writes a high-res horizon
band). Per-plate exposure gains are solved from the overlaps, vignetting is flattened (not on the sun plate), seams
are smoothstep-feathered, and latitudes no plate covers are bridged with a blur whose radius grows with distance (no
vertical streaks). The sampled horizon, near haze and far cool band are written back into the local bible as the fog
colours (`--write-back`) — fog is sampled, never typed. **No planet in the sky plate.**

This is an **alternative** offline path for new biomes (it matches the 2:1 sky-sphere test of PR #188). The VALIDATED
zone A sky (13 slices per band, shader crossfade) is untouched.

## 7. Objects

`bake_hull.py` (headless Blender 5.2.1, CPU): 4 ortho silhouettes (front/right/back/left, optional top) carve a voxel
visual hull → voxel remesh + smooth → ~60 k tris → smart UV → bake position / normal → every real view is projected
per texel, weighted by facing³ × alpha × visibility; the three-quarter plates fill the corners; **no mirrored flank**
(a missing view is blended from its neighbours and counted as fallback) → displacement from the high-pass texture →
**decimate after the bake** to LOD 4000 / 800 / 180 → one 2048 albedo → unlit GLB. Stats JSON reports the dominant
view per texel and the fallback %.

## 8. Runtime (module only, not wired)

`runtime/biome-runtime.js`: engine-agnostic uniforms + GLSL for the raw WebGL2 game, optional three.js adapters.
`NoToneMapping`, no scene fog; a 3-band distance fog from the bible applied in linear before output; one grade pass
(vignette + 4 % grain; runtime LUT identity unless enabled); equirect sky lookup with `textureGrad` (no wrap seam);
camera FOV 58 → 70 with damping, trauma off by default.

## 9. Known conflicts (owner call)

- Camera trauma vs "zero camera shake" — implemented but **disabled** by default.
- drawCalls 12 (standing rule 9) vs Grok's 30 — the bible uses 12.
- Grain + vignette vs law 67 (fog, one grade, capped bloom) — still IN TEST in PR #188.
- Game VFOV 48.1° vs Grok's 58° base FOV — not changed in the game.
- PR #188 also edits `docs/METHOD.md`; this PR only appends a section at the end to avoid a conflict.
