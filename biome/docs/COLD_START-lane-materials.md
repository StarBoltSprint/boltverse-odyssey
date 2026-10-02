# COLD START — lane materials (paste before P0 stills)

**Tool feedback (law 66):** if a repo tool let a defect through, reported a wrong number, or was hard to use, finish the take, write `feedback/<date>-<tool>.md`, and open it upstream. [`66-tool-feedback-loop.md`](66-tool-feedback-loop.md).

Read `biome/docs/35-lane-materials.md`. Grammar stays Pack: 3 lanes, 1-point lock-off, ZERO dog. Law 20 measures the frame (width ~0.75–0.82, sky ~45%, plant ~0.80). Those numbers are not asphalt.

**Before empty first/last stills:** if `{PAINT}` already names a road material, use it. Otherwise propose this menu and do not cook P0 on a silent default.

| Key | Name | Look |
|---|---|---|
| A | Obsidian glass | Black mirror / obsidian road; cyan luminous edges or dashes in the reflection; pale ground beside |
| B | Crystal quartz | THREE translucent crystal/quartz lane ribbons; light refracts through; soft luminous edges (not painted asphalt dashes); pale ground |
| C | Luminous ribbon | Road = solidified light / Pack ribbon path (law 12 vibe); not concrete |
| D | Mix vault | Obsidian or crystal path + volumetric nebula-as-sky (thick 3D gas ceiling lighting the world) — not flat black night, not storm-grey clouds only |

**BAN** as silent default: grey concrete asphalt highway, MS-Paint dashes on béton, boring moderne nationale with no biome paint.

Swap `{LANE_MATERIAL}` in `biome/prompts/image-empty-plate.txt` (and the same token in `video-empty-plate.txt`) before Imagine. `{PAINT}` includes that lane material. Do not leave the token in the paste. No extra follow-path on top of the surface. Hang ≠ wipe. Do not invent a gallop.
