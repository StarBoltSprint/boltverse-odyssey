# Jade LOD — volume stack remix

Does **not** thicken the mp4. Picks **how much twin** a spawned thing gets as you close in.

## Bands

| Band | Distance (enter / leave) | Picture | Volume |
|---|---|---|---|
| Near | `< 12` / leave `14` | full card + shadow | yes |
| Mid | `< 40` / leave `44` | bole-only, smaller | yes |
| Far | `< 72` / leave `80` | planted cross | no |
| Cull | beyond | ground film only | no |

Leave is farther than enter so a tree on the line does not flicker. Near capped at **24** cards; extras drop to mid and **keep** their capsule.

## Wire

```ts
import { tickField } from "./field";
import { applyLodToKit, applyCheapAlpha } from "./billboard";

const { rows, volumes } = tickField(cam.x, cam.z, 1);
const kits = applyLodToKit(rows, cam.x, cam.z);
const drawn = applyCheapAlpha(kits, nowMs);
// volumes → SprintCore obstacles this frame (capsule snaps; it never fades)
```

Far trees are allowed to be ghosts: they live in the ground film. Near/mid must thud.

## Cheap alpha

Resting trees are **cutout**. Blend only while a band change is dissolving. Fill rate is the enemy. The curve is not.

| State | GPU path |
|---|---|
| Idle near / mid / far | **cutout** (`alphaTest 0.45`, `transparent: false`, `depthWrite: true`) |
| Mid-fade only | **blend** (`transparent: true`, `depthWrite: false`, premultiplied `rgb * a, a`) |
| `a < 0.02` | skip the draw (`discard` / `visible = false`) |

Cap **8** concurrent fades. A ninth snaps the farthest slot. The nearest 24 have priority. Duration **250 ms** on a plain card (allowed 220–280). Near ↔ mid is the crown, 220 ms, one slot. A promote reverses that fade from the current `t` and does not require `dist < 12`. A different edge on the same id snaps. Closer kits take the slots first (`applyLod` sorts by distance). While coverage is still 1, the card stays cutout. The blend path starts once `a` drops.

Front side only. The 70/30 yaw already faces the camera.

The capsule never fades. Soft alpha is look only. The hit follows `bandDraw` in `lod.ts`, not `prev`.

Policy: [`fade.ts`](fade.ts) (`requestFade`, `tickFades`, `activeFadeCount`). Flags: `applyCheapAlpha` in [`billboard.ts`](billboard.ts). Fragment: [`card.frag.glsl`](card.frag.glsl). This folder does not import `three`.

Flattened chain in the fragment: sample → multiply fade → discard cutoff → premultiply. The node stack, the two material instances, and the ground/sky graph are law [45](../../docs/45-shader-graph-look-kitchen.md). The graph shades a card the CPU already posed. `billboardYaw` owns yaw. `bandDraw` in [`lod.ts`](lod.ts) owns meshLod. `holdBand` stays the sticky meters. The capsule stays `volumes`.

Not hung yet: InstancedMesh per kind+band, an atlas, impostor mip bias, one opaque cutout pass then the ≤8 fades back-to-front. Skip OIT. Far ↔ cull shrink is hung: planted cross only, 180 ms, scale 1.00 ↔ 0.35. At `t = 0.5` the scale is 0.675.

## Four picture jobs

Law [46](../../docs/46-four-picture-jobs.md). Same seed, same ids. The film still has no thickness. No sheet or plate binaries in this folder.

**Sheets.** Cutouts, not places. Folder `public/decor/jade/sheets/` (names only, no binaries). `bole_v0..v3`, `crown_v0..v3`, `bole_imp_v0..v3`, optional `crown_imp`, plus `ruin` / `crystal` / `fern` and their `_imp`. Same `N` on bole+crown is one pair. Wire: `TEX.bole[2].bole / .crown / .imp` via `texOf(kind, variant)`. Missing file → v0, the row still draws. Cook rail: law [47](../../docs/47-jade-sheet-cook.md) · prompts [`SHEETS.md`](SHEETS.md).

**Plates.** The room, not the furniture. Folder `public/decor/jade/plates/` (names only). `jade_ground.mp4` + poster, `jade_sky.mp4` + poster. Optional `jade_ground_still.jpg`, same UV. `TILE` 24 m. `u = worldX/TILE + 0.02*sin(pictureTime*0.15)`. `pictureTime` is the sim clock. Never `Date.now`. Sky yaws with the camera and does not nod. Kits are siblings of the plane. Cook: law [48](../../docs/48-jade-plate-cook.md) · prompts [`PLATES.md`](PLATES.md) · [`plates.ts`](plates.ts).

**Two planes.** [`twoPlane.ts`](twoPlane.ts). Law [49](../../docs/49-two-plane-tree.md). One address, two jobs. Bole is the mask. Crown may dissolve. They do not share a material. Near = bole + crown + shadow. Mid = bole. Far = planted cross only (two planes at 90°, spawn yaw, no hidden bole, no face-cam). Cull = nothing. Near↔mid is **one** slot, 220 ms, crown `a` 1↔0, shadow `0.28 * a`, bole stays cutout, volume stays. Mid↔far is 280 ms: bole may go translucent on that edge only, the cross fades in, crown already 0. Volume snaps off at the 44 m leave, and snaps on at the 40 m enter even if bole `a` is still 0.3. Far↔cull scales both planes of the cross, 180 ms, scale 1.00 ↔ 0.35 on X and Y together (`t = 0.5` → 0.675), no volume. The bole is not scaled. The idle impostor pool stays at scale 1. Yaw is per child (bole 0.55, crown 0.85 and may face the camera, impostor planted, shadow none). The group does not yaw. A far lean of 0.9 is a card fence. Cylinder on the bole: bole `r` 0.28, elder `r` 0.55 (thicker bole, not the crown). Sizes: bole 2.4 / 2.0, elder 4.2 / 3.2. Ruin has no crown.

**Height.** [`height.ts`](height.ts). Law [50](../../docs/50-heightfield-posture.md). Posture only. `h0 = 0.20 + 0.20 * fbm(x/28, z/28, s+101)` with 3 octaves. The valley (law [54](../../docs/54-path-noise-valley.md), [`path.ts`](path.ts)) flattens toward 0.20 with one `d`, shoulders `0.55`–`1.15` of `pathHalf`. Not `abs(x)`. The keyed plant sits on `h`. The card offset is `h + 0.45`. A kit stores `groundY` once. The cylinder base is that `groundY`, never 0. The sol film stays `y = 0`.

**Octaves.** Law [51](../../docs/51-octave-map.md). [`noise.ts`](noise.ts) `OCTAVE_LOCK`. Page and `L` stay put. Height 3 at `s+101` / 28 m. Spawn in [`spawn.ts`](spawn.ts): n1 bole 3 at `s+0` / 14 m, n2 ruin **2** at `s+17` / 40 m, n3 shard 3 at `s+31` / 22 m. Do not copy the height count onto ruins.

**Engine vs Play.** Law [52](../../docs/52-engine-vs-play.md). Engine draws. Play is the paws. [`field.ts`](field.ts): `geoRing` 1 is a 3×3 (`chunksAround`, spawn, kits, volumes). `memRing` 2 is a 5×5 (`prev.band`, `groundY`, optional `memKits` fade/lod). Cap 512 evicts the farthest chunk-center and never an on-screen id. `forgetIds` runs only when the chunk leaves mem. A missing kit is not missing memory: rebuild from `holdBand`, `groundY[id] ?? h(x, z)`. [`lod.ts`](lod.ts): law [55](../../docs/55-budget-banddraw.md). `prev` is `holdBand` only. `bandDraw` is the chair after near 24 / mid 64 / far 96. `promoteLod` does not write `prev`. [`fade.ts`](fade.ts): far ↔ cull shrinks to 0.35 over 180 ms. Path valley is law 54: page `s+7`, two octaves, wander 18 m, one `d` for spawn, height, and tint. No magnet. [`play.ts`](play.ts): block pushes, a fern tuft slows once (`r` 0.45, no push), a crystal walk does not shatter. Plates stay empty. Bolt is the sealed gallop `lock/bolt-gallop-cycle.mp4` (same bytes as `public/master/bolt.mp4`), keyed by `makeCompositor`. Disc `PAWN_R` 0.32. Paws on `h`. Gait is a clock on that file (`stepGait`). A glb is an optional 0.6 m withers note, not the picture. Howl KEEP rings stay `biome/fx/howl/howl-attack.mp4`. Howl is one press: cone 8 m, half-angle 12.5°, origin 0.4 m ahead. One shard. The id stays shattered with the mem ring. Burst films are names under `public/decor/jade/fx/` (no mp4 in this folder). This folder does not import `three` and does not draw a second wolf.

**Particles.** Law [53](../../docs/53-gpu-particles.md). [`particles.ts`](particles.ts). A playback tape, not a particle-physics engine. One Points draw, 1400 slots. The CPU writes births. The vertex shader integrates them. They do not see each other, trunks, or SprintCore. **Imagine texture obligatoire:** mote `moss_dust_v0` (or `pollen_v0`) every 0.18 s, paw `ember_v0` while sprinting past 3.2, Howl points `spark_dust_v0` (80 stand-in, or 40 when `crystal_burst_vN.mp4` is bound). Primary shatter picture is `public/decor/jade/fx/crystal_burst_vN.mp4`. A missing sheet hides that kind (`fxVisible` → `hide`). A flat colored disc is FAIL. HUD `fx GPU`. Sparks are an overlay. They do not spawn trees. Sheets are cutouts, law [47](../../docs/47-jade-sheet-cook.md), under `public/decor/jade/sheets/fx/` (names only). Snippets: [`particles.vert.glsl`](particles.vert.glsl), [`particles.frag.glsl`](particles.frag.glsl).

**Instance pools (remix contract).** One mesh per `bole`, `elder`, `ruin`, `crystal`, `fern`, and `impostor`. `crown` is the idle-near channel. A fade, at most 8, leaves the pool as its own kit. Nothing in the pool is transparent. Zero fades: the woods, the plates, and Bolt are about six draws. Do not build that pool in this folder.

Frame: picture-time → `tickField` → snap kits to `h` → pawn `(x, h, z)` and volumes at `y = h`.

## Pack law

- Imagine videos stay the world (sol/ciel). Cards are keyed Imagine sheets.
- Simplex / seed placement only — does not draw terrain.
- Do not rewrite pyre-stage into a Three.js world. Remix ports this into the existing composite.
- Capsule dies with the card band (far/cull → no volume).

## Remix next

Point cards at Jade Imagine sheets and hook `volumes` into the existing obstacle query.

## Earlier companion

One-file tick, before this stack: [`../jade-billboard/jadeBillboard.ts`](../jade-billboard/jadeBillboard.ts). This folder is the LOD hang. That file stays the companion. LOD here picks how much twin as you close in. It does not thicken the mp4.
