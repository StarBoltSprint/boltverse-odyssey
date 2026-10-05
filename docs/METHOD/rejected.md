# Rejected approaches — what failed and why

Back to [METHOD.md](../METHOD.md). Do not retry these without a new owner decision. Details and guards:
[`learn/failures.md`](../../learn/failures.md), [`learn/taste.md`](../../learn/taste.md).

| Date | Approach | Why it was rejected | Use instead |
|---|---|---|---|
| 2026-09-26 | Three.js / Babylon / Unity / procedural shader world, mesh or noise generators for terrain, paths, vegetation, details | Not Imagine pixels; classic 3D game look (PRs #114, #117, #118). | Imagine pixels on invisible shape (law 59). Simplex = placement only. |
| 2026-09-26 | A different hero (manta, ray, ship, mesh player) or a newly cooked Bolt sprint | Bolt is an Imagine video of the wolf (PR #116, AGENTS Bolt lock). | `lock/bolt-gallop-cycle.mp4` + `lock/bolt-idle-breath.mp4`. |
| 2026-09-29 | Imagine plate video with baked drift / rotation used as a texture; asking Imagine to pan | Snaps back on loop; pan returns a dolly; crossfades ghost a second hull. | One locked still + depth relief; living parts as separate seamless loops. |
| 2026-09-30 | Orbit views cooked without a silhouette lock | Lobes; the 8 views were not one object. | V0 + edit chain every 45°, `tools/objsheet`. |
| 2026-10-01 | One relief / ring still as the walkable floor | Upscaled after ~4 cm; ground froze (HUD mag 0.406 vs claimed 0.990). | World-locked top-down tiles on invisible relief. |
| 2026-10-01 | Stone circles / ring layouts, ring-wall colliders | Ring not rendered, invisible stops; owner: "no circles" (take 8). | Large organic zones, natural boundaries, `no_ring`. |
| 2026-10-01 | Code-drawn shadows | Code never draws a pixel (doc 62, take 8). | Shadow baked in the Imagine pixels / half-bury. |
| 2026-10-01/02 | Spherical / blob rocks, identical capsule views, safe rounded shapes to pass a check | Owner: "demo"; wants sharp edges, distinctive silhouettes. | 8-view carving of natural irregular shapes. |
| 2026-10-01/02 | Rounded egg-pod ship; round paw emblem pasted like a sticker | Owner: ugly / sticker. | Black angular ship with etched, angular, weathered emblem (LOVE). |
| 2026-10-02 | `NEAREST` sampling, no mipmaps on world textures (take 10c) | Aliasing; law 65. | `LINEAR_MIPMAP_LINEAR` + mipmaps, video `LINEAR`. |
| 2026-10-02 | Flat billboard / camera-facing cards for static solids; 3–4 view sprite swap; object-class pack | Owner wants real 3D objects (`learn/object-classes.md`, `learn/ship-turnaround.md` drafts rejected). | Organic: 8-view hull. Hard: real 3D (IN TEST). |
| 2026-10-02 | Flat angle-switching impostors as the main solution for ships / gates / wrecks | Not real 3D the player can walk around. | Hard-object method (VALIDATED 2026-10-03). Impostors only as far LOD. |
| 2026-10-02 | Sky slices finished by cloning / mirroring columns | Code-made pixels, hard-law breach (take 10d). | Real chained slices, `tools/sky/check.py`. |
| 2026-10-02 | One short sky loop shared by every slice | Same flash returns on a fixed period; feels repetitive. | Layers ~13 / 17 / 29 s, per-slice offsets. |
| 2026-10-02 | Oversize steps (10 items, 79 rows) in one headless run | 419 / 290 turns, no final answer (take 10d). | ~1 h steps, ≤ 8 rows, stop after 2. |
| 2026-10-02 | TripoSR / single-image mesh networks (`tools/mesh3d`) | Invents unseen sides; IoU 0.445, ~30% of the orbit without an Imagine texel (holes). Golden rule bans TripoSR-style generators. | Shapes measured from Imagine images (hard objects, VALIDATED 2026-10-03) or 8-view carving. |
| 2026-10-02 | Real-time lights, shadows, reflections, AO, code particles, non-Imagine models | Law 67: only fog, grade, capped bloom are computed. | Light baked in Imagine; living light = keyed Imagine loops. |
| (date not recorded) | Code-coloured corvette (hull coloured by code) | Code-drawn colour; not an Imagine skin (owner report; no repo record). | One unlit Imagine skin per part. |
| 2026-10-03 | One plain dirt texture for a whole zone | Owner: ugly, "carpet" look. | Several Imagine materials by relief + anti-carpet rules. |
| 2026-09-18 | Wiping hung masters / replacing the playlist with a new biome | Hang ≠ wipe. | Add beside existing masters. |
| 2026-10-04 | Pale 7.4 m round arch as the Eclipse Gate | Owner rejected it. It read as a small classical arch. | A 25–30 m monolith, veins, a ring in the arch, a real passage, colliders from the mesh. |
| 2026-10-05 | Flat cards, billboards, or sprites for canyon walls, mesas, rocks, shards, and details, including at far range | Owner: everything visible is a real solid. Supersedes the "impostors only as far LOD" clause of the 2026-10-02 impostor row. | Frigate / hard-object loft. Far LOD is a cheaper solid. Only the sky is a backdrop. |
| 2026-10-05 | One Imagine video laid over an already-full still sky | Reads as a moving screen on a picture. | Nearly empty base (gradient + distant stars), then one looping video per animated element. |
| 2026-10-05 | A planet clip that is drawn, small in the frame, or not checked frame by frame | Upscale and a still planet were called "working". | Highest resolution, planet fills the frame, photoreal, rotation confirmed on the frames. |
| 2026-10-05 | Invisible walls and keep-out boxes around a gate or a hangar | The player cannot walk the opening that the picture shows. | Colliders from the drawn faces. Walk under the arch. Enter the hangar. |
| 2026-10-05 | Stone doors and gothic halls as menu backgrounds | Owner rejected the old plate (2026-10-04, "moche"). | High-tech Citadel: dark metal, glass, cyan/violet holograms. |
| 2026-10-05 | A per-zone Echo Shards / Archives module | Splits progress and the paw. | One shared module. The zone writes a manifest only. Local progress first. |
| 2026-10-05 | Crude stepped LOD boxes in place of a good near or mid frigate rock | Looks 3D-printed. `stair_crown` is the same class on a silhouette. | Near and mid stay the loft. Cheaper solids are far only. |
| 2026-10-05 | Another Imagine cook aimed at view drift or specks | Known generator defects. Quota already paid. | Accept them. Stop after 2. |
