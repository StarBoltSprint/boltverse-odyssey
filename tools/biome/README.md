# tools/biome — biome bible pipeline (IN TEST, 2026-10-08)

Method: [`docs/METHOD/biome-bible.md`](../../docs/METHOD/biome-bible.md) ·
[`art-direction-aaa.md`](../../docs/METHOD/art-direction-aaa.md) · [`aaa-feel.md`](../../docs/METHOD/aaa-feel.md).
Objects: [`docs/METHOD/objects-from-key-crops.md`](../../docs/METHOD/objects-from-key-crops.md) — cut every object
out of the key still (APPROVED 2026-10-08, every biome).

One bible per biome → every prompt, bake and runtime setting is derived from it. CPU only; needs Python 3 with
numpy, scipy, Pillow; Blender 5.x on PATH (or `BLENDER=`) for the bake; node ≥ 18 for the runtime tests.

| File | Does |
|---|---|
| `schema/biome.schema.json` | `biome/1` schema (draft-07) |
| `biome_lib.py` | JSON io, tracked/local split + merge, schema validator, Lab / CIEDE2000, kelvin → RGB, cache key |
| `fill_bible.py` | fills a bible: Grok request **stub** (`--grok-request` writes the ask, `--grok-response` merges a reply) or a seeded fallback from 6 archetypes; `--keep` curated values; `--split` writes tracked + local |
| `biomes/ember-mesa.json` | filled example (tracked part: numbers + `$local` marks) |
| `templates/slots.json` | colour-free lock sentence + slot clauses |
| `prompts.py` | 35 slot prompts + cache keys → `out/<id>/prompts.json` (`--md` for a readable copy) |
| `manifest.py` | catalogue hit / miss, `--ingest DIR`, fallback after `maxFails`, `--strict` |
| `qc.py` | `anchor` (sample the key still), `check` (pass / lut / regenerate / fallback, `--apply` writes graded plates), `apply-lut`, `cube` (.cube export) |
| `stitch_sky.py` | 6 level plates + zenith + nadir → 2:1 equirect (+ `--band WxH --band-lat=-15,30`), `--write-back` fog colours |
| `bake_hull.py` | Blender: ortho silhouettes → hull, views projected, displacement, decimate after bake → LOD GLB + stats |
| `preview_glb.py` | Blender: contact sheet of a baked GLB |
| `pack-ktx2.sh` | KTX2 ETC1S (UASTC for `--uastc` names) with toktx or basisu; `--allow-missing` lists only |
| `runtime/biome-runtime.js` | fog / grade / sky GLSL + uniforms, camera rig, three.js adapters (not wired) |
| `run-biome.sh` | the chain: bible → prompts → manifest → (Imagine) → QC → stitch → bake → pack |
| `selftest.py` | end-to-end checks on images already in the repo (zone A) |
| `proof/` | small outputs from the 2026-10-08 runs |

## Local (untracked) files — repo rule 2026-10-03

`biomes/<id>.local.json` (palette, fog colours, subjects), `style/<styleId>.local.txt` (style block),
`style/<styleId>.avoid.local.txt` (avoid list), optional `style/archetypes.local.json`. `out/` and `catalogue/`
are ignored too. Without the local files the prompts carry visible `<... from the local file>` placeholders.

## Quick start

```bash
python3 tools/biome/fill_bible.py --id my-biome --lore "..." --player "I want to explore ..." --split
bash tools/biome/run-biome.sh my-biome            # stops with exit 10 and the list of missing Imagine slots
bash tools/biome/run-biome.sh my-biome --slots DIR # DIR holds <slot>.png/jpg named after prompts.json
python3 tools/biome/selftest.py                   # ~30 s, Blender optional (--no-bake)
```
