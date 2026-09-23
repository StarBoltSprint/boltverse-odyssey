# COLD START — biome cook (paste this, then follow one file)

Open `biome/scripts/biome-cook/README.md` and follow **only** that order (steps 1→17). Do not invent a cook. Do not invent QC math. Do not rewrite script bodies. Do not hunt the rest of `biome/docs/` first.

**Before step 3 (empty first/last stills):** choose a lane material. Read `biome/docs/35-lane-materials.md`. Paste `biome/docs/COLD_START-lane-materials.md`.

**Before that still and before Video A (law 36):** densify stays one continuous plate. GPU zones are keyed layers over it. Do not chop one densify plate into spatial GPU tiles. Read `biome/docs/36-gpu-zones-lena-procedural.md`. Paste `biome/docs/COLD_START-gpu-zones.md`. Runtime: `biome/scripts/lena-lod/lenaLod.js` (`lenaFrame`). Bib: `biome/docs/COLD_START-lena-bib.md`.

**Path beat (law 37):** do not bake the target lane into that plate. The chemin reveals one lane ~3 s ahead of contact. SIDES, then hit/miss. Same Howl cone as Lena. Read `biome/docs/37-path-beat.md`. Paste `biome/docs/COLD_START-path-beat.md`. Runtime: `biome/scripts/path-beat/pathBeat.js` (`pathBeatFrame`).

**Light layers + openables (law 38):** do not bake playable lights or open states into that plate. Imagine cooks light-only keyed plates and closed / open / transition bibs. GPU owns intensity, tint, hit, and open/close. Same Howl cone. Not raytracing. Read `biome/docs/38-gpu-light-openable.md`. Paste `biome/docs/COLD_START-gpu-light-openable.md`. Runtime: `biome/scripts/gpu-light/gpuLight.js` (`lightLayerFrame`) · `biome/scripts/gpu-openable/gpuOpenable.js` (`openableFrame`).

If `{PAINT}` already names the road material, use that. Otherwise propose this menu and do not cook P0 on a silent default:

| Key | Name | Look |
|---|---|---|
| A | Obsidian glass | Black mirror / obsidian road; cyan luminous edges or dashes in the reflection; pale ground beside |
| B | Crystal quartz | THREE translucent crystal/quartz lane ribbons; light refracts through; soft luminous edges (not painted asphalt dashes); pale ground |
| C | Luminous ribbon | Road = solidified light / Pack ribbon path (law 12 vibe); not concrete |
| D | Mix vault | Obsidian or crystal path + volumetric nebula-as-sky (thick 3D gas ceiling lighting the world) — not flat black night, not storm-grey clouds only |

**BAN** as silent default: grey concrete asphalt highway, MS-Paint dashes on béton, boring moderne nationale with no biome paint. Law 20 (width ~0.75–0.82, sky ~45%, plant ~0.80, 1-point, ZERO dog) is the frame, not “must be asphalt”. Swap `{LANE_MATERIAL}` in `biome/prompts/image-empty-plate.txt`. `{PAINT}` includes that lane material.

Hang ≠ wipe. ADD `road-<biome>*.mp4` beside canyon→cars→duel→night→war. Never wipe hung masters.

Pack auto-embed: `window.BOLTVERSE_PACK_ORIGIN=https://boltverse-pack.vercel.app` and load `pack.js` from that origin (or ship `client/pack.js`, which POSTs there). The game play URL is not the Pack API.

Play URL hang = **Live only**. Never a Build convo. Never `grok.com/share`. Never a `/c/` conversation link.

**Video A (every plate, including P4 after P3):** extract the last frame of the previous plate (that file is this plate’s `first`; P0 uses the empty first still) → cook the `last` still (advanced world, same camera) → Imagine Video with **both** stills pinned. Primary = SuperGrok session (no API key). Optional = `imagineBiomeClip` when `XAI_API_KEY` is set. Then `python3 biome/scripts/plate-mae-qc/plate-mae-qc.py <previous.mp4> <this.mp4>` (P0 has no seam). Exit non-zero = recook. Missing key is not a stop. BAN one-still I2V, “forcé localement”, and MAE PASS without the script.

Worked example (play URL only): https://boltboltverse-odyssey.grok.me

Law 34 is step 14 in that README. Copy `biome/scripts/howl-live/` (`howlLive.js`, `howlWet.glsl`). REUSE `biome/fx/howl/howl-attack.mp4`. Do not recook it. Do not invent a laser or a ring shader. The noun is biome-variable. The math is fixed.

Checklist (wrapper only): `bash biome/scripts/biome-cook/biome-cook.sh`  
Inventory: `biome/scripts/biome-cook/MANIFEST.md`
