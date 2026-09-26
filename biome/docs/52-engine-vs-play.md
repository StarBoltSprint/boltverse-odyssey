# 52 — Engine vs Play

**Go 2026-09-26 (SmiR).** Kitchen only. Do not read this to the player.

Engine draws, and it remembers. Play is what the paws mean. They stay apart the way fade stays apart from hysteresis.

Laws behind this page: [44](44-imagine-volume-stack.md) volume, [45](45-shader-graph-look-kitchen.md) look, [46](46-four-picture-jobs.md) pictures, [47](47-jade-sheet-cook.md) sheets, [48](48-jade-plate-cook.md) plates, [49](49-two-plane-tree.md) the two-plane tree, [50](50-heightfield-posture.md) posture, [51](51-octave-map.md) octaves. Howl rings stay the KEEP in [32](32-howl-gpu-targets.md) and [34](34-howl-live-aim.md): [`../fx/howl/howl-attack.mp4`](../fx/howl/howl-attack.mp4). Do not recook them.

The player is the sealed Bolt. The pawn mesh is the Hybrid KEEP `game/public/assets/bolt.glb` (white coat, four legs, withers 0.6 m). The bytes live in StarBoltSprint/bolt-hybrid. This repo does not copy them and does not cook a second wolf. Motion teacher stays [`../../lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4). Style teacher stays [`../../lock/bolt-back.jpg`](../../lock/bolt-back.jpg). The cycle is not drawn beside the pawn.

Stubs: [`../scripts/jade-lod/field.ts`](../scripts/jade-lod/field.ts), [`lod.ts`](../scripts/jade-lod/lod.ts), [`fade.ts`](../scripts/jade-lod/fade.ts), [`noise.ts`](../scripts/jade-lod/noise.ts), [`spawn.ts`](../scripts/jade-lod/spawn.ts), [`height.ts`](../scripts/jade-lod/height.ts), [`play.ts`](../scripts/jade-lod/play.ts). No `three` import. The instance pools are a remix contract.

---

## Build order

1. Path noise and flatten.
2. Budget versus `prev`.
3. Memory ring 2.
4. Far shrink.
5. Soft gait.
6. Howl burst.
7. InstancedMesh.
8. Pawn KEEP (`game/public/assets/bolt.glb`).

Steps 1–8 are the play spine. Atlas UVs and `M_CardJade` are not this spine.

---

## Engine

### 1. InstancedMesh per kind

Idle cutouts are one draw per pool: `inst.bole`, `inst.elder`, `inst.ruin`, `inst.crystal`, `inst.fern`, and `inst.impostor`. Crowns are a second channel, `inst.crown`, and only while idle near. A fade leaves the pool as its own kit. At most 8 of those. No per-instance transparent material. Blend is the kit that left.

Done-when: with zero fades, the woods, the plates, and Bolt are about six draws.

### 2. Chunk memory — geoRing versus memRing

`holdBand` is sticky only if `prev` outlives the mesh. Geometry can forget a tree. Memory cannot, until that chunk is two rings away.

```
chunk = 32 m
geoRing = 1  → 3×3 spawn, kits, volumes, cards
memRing = 2  → 5×5 prev.band, kit.groundY, kit.fade, kit.lod
```

`geo = chunksAround(x, z, 1)`. `mem = chunksAround(x, z, 2)`.

Spawn, instances, and volumes read geo only. `prev.get` is allowed while the id's chunk is inside mem. `forgetIds` runs only when that chunk is outside mem. A geo drop is not a forget.

| Store | Dies when |
|---|---|
| spawn rows in the cache | chunk ∉ geo |
| kit mesh | chunk ∉ geo (hide, then remove) |
| volumes | rebuilt every tick from geo |
| `prev[id].band` | chunk ∉ mem |
| `kit.fade` / `kit.lod` | stashed in `memKits` when the mesh goes; die with mem |
| `kit.groundY` sidecar | chunk ∉ mem |
| shattered crystal ids | chunk ∉ mem. The cap does not spend them inside mem |

The minimum that survives the geo drop is `prev` plus `groundY`. The kit rebuilds from `holdBand` on the way back in. `memKits` is optional: it resumes a fade that was mid-flight. It does not pick a new band.

Cap 512. Evict the farthest chunk-center from the pawn. Never evict an id whose chunk is still in geo. Evict `prev`, `groundY`, and `memKits` together. A chunk still inside mem is remembered when the store is under the cap. This spawn's live 3×3 is already past 512, so the cap spends the trail outside geo and the live ring stays whole. It does not eat on-screen ids to force the count under 512.

Re-enter. `holdBand(id)` is still there, so the band stays sticky. Do not use the enter distances just because the kit was missing. A missing kit is not missing memory. `groundY[id] ?? h(x, z)`.

Do not keep instance matrices, GPU particle births, volume objects, or Imagine textures in this ring. Textures stay shared. Particle look stays law [53](53-gpu-particles.md). A shattered id is the exception that lives here: it leaves when the chunk leaves mem, and a geo re-enter does not mint that crystal again.

`bandDraw` is the budget ticket in section 3. It is not stored in `prev`.

Done-when: orbit a bole on the chunk seam at 32.0. The crown stays. After a long sprint, every id still in `prev` has its chunk inside geo once the live ring is past 512, and none of those on-screen ids were the ones dropped. Walk 80 m away and back. That chunk has left mem. The forget is legal. The seam orbit is not that forget.

### 3. Budget must not overwrite holdBand

This ticket is law [55](55-budget-banddraw.md). Section 2 stores `prev` only. `holdBand` is meters. `bandDraw` is the chair: near 24, mid 64, far 96. `promoteLod` writes the draw fields and does not write `prev`. A crown fade is one slot, 220 ms, cap 8, and it follows `bandDraw`.

Done-when: 30 boles inside 10 m show 24 crowns and 6 bare trunks. Cull 6 crowned ones outward. The bare trunks take the crowns in place. Their `prev.band` never went mid.

### 4. Far → cull shrink

Far ↔ cull is the last LOD edge. Soft gait is section 6. The Howl verb is section 5. The pawn KEEP is section 8.

`holdBand` still gates. Leave far is 80 m. Enter far is 72 m. The shrink is the fade on that gate. It is not a second hysteresis.

```
far → cull   180 ms   scale 1.00 → 0.35, alpha 1 → 0
cull → far   180 ms   scale 0.35 → 1.00, alpha 0 → 1
t = smoothstep(elapsed / 180)
far → cull:  s = mix(1.00, 0.35, t);  a = 1 - t
cull → far:  s = mix(0.35, 1.00, t);  a = t
```

Not mid ↔ far. Not near ↔ mid. Those keep world size. The bole and the impostor still handshake there. Shrink only on far ↔ cull. Scale never goes to 0. 0.35 keeps a 128 px impostor readable for one frame.

Only the impostor quad scales, and it scales on X and Y together. The bole and the crown are already hidden on far. Do not scale them. Do not scale the group. Do not scale the contact shadow. It is already off on far.

The same cap of 8. A 9th tree snaps: hide the impostor, scale 1, no smear. The idle impostor pool stays scale 1. A shrinking tree leaves `inst.impostor` and draws as its own kit for 180 ms.

The belt is 8 m. A sprint of 5.2 m/s covers about 0.9 m during the fade, so the fade finishes inside the belt. One tick that jumps 72 → 90 does not fade. It snaps to cull.

Turn around inside the belt. At t = 0.4 on the way out, swap the ends and set `ms = 180 * (1 - t)`. Scale grows from the current size. It does not jump to 1.

Depth write is off for this edge only. Cutoff still discards below 0.02. The blend is premultiplied. Fill at mid-fade is about `0.35² × 0.5`, a few percent of a full fading quad.

Done-when: sprint out of a far grove. The specks shrink, then vanish. No cards slide across the sky. Turn at 76 m. They grow back. Mid boles are there at 40 m.

---

## Play

### 5. Howl / shatter

Howl is a verb. H, one press (`howlArmed`). A hold is not a laser. During that press the cone is tested once. At most one target. Shatter only when `hit === "shatter"` and the shard is inside the cone. A miss elsewhere is the Howl pose and the muzzle sparks. Nothing is deleted.

The howl oneshot is 0.4–0.6 s on the pawn mesh (section 8). H does not pause the ground plate. A missing howl clip still fires this cook.

```
range = 8 m
halfAng = 12.5°     // 25° full
origin = pawn.xz + forward * 0.4
forward = (sin(yaw), cos(yaw))
```

A point `v` is valid when `d = length(v.xz − origin)` is in `(0.3, 8]`, `dir = normalize(v.xz − origin)`, and `dot(dir, forward) >= cos(12.5°)`. The keeper is the smallest `d`. Nothing behind the head. Nothing at 20 m because it is a crystal. `howlPose` on the three Odyssey lanes is this same cone. The field passes the mesh yaw. The rail passes L / C / R as a discrete forward. One test. Debug L draws a gold wire cone, 8 m.

Same frame, in order:

1. Press, plus the best target.
2. `shattered.add(id)`.
3. Drop the volume.
4. Hide the sheet card.
5. Plant the burst quad at `(x, groundY + h * 0.5, z)`, same yaw and scale as the card.
6. Play the mp4 from 0, muted, when that asset exists.
7. Spawn the GPU dust. 80 stand-in points when the film is unbound. 40 points, life 0.4–0.7, when it is bound.
8. On ended, or `t > 1.1` s, free the quad. The id stays in `shattered`.

No crystal respawn. `shattered` lives with the mem ring. Leaving geo and coming back does not rebuild the shard. Leaving mem forgets the id with `prev`. The 512 cap still drops ordinary trail ids. It does not spend a shattered id while that chunk is inside mem: this spawn's live ring is already past 512, and spending the shard on a geo leave would grow it back.

The burst film is names and rails only. Paths, per crystal variant:

```
public/decor/jade/fx/crystal_burst_v0.mp4 … v3.mp4
public/decor/jade/fx/crystal_burst_v0.png
```

The png is frame 0, the same shard as `crystal_vN.png`. Full cook table is [`../scripts/jade-lod/SHEETS.md`](../scripts/jade-lod/SHEETS.md). Duration 0.9–1.1 s. 512×1024. Native alpha or a chroma lock with cyan despill. Same rear-three-quarter, withers, late-day lock. Last frame is empty dust. The camera does not truck. Bolt is forbidden. This PR does not cook the mp4. Until those files exist, the 80 points are the break. With the film, the points are a halo and the film carries the form. Points do not invent a shard that the sheet did not have.

Picture-time. The quad advances with sim `dt`. Pause freezes it. The ground film keeps its own clock. The rings stay the Howl KEEP. Sparks are law [53](53-gpu-particles.md): a playback tape, not a mesh, not a colored disc, not the world. A missing spark sheet hides the points and still returns the shattered id. A later debris that must land is a separate Verlet of at most 80, still not Rapier.

### 6. Soft versus block

The hit is read on the volume. Never on the fern pixels. A green wire that thuds is the wrong hit.

| Hit | Kinds | In the disk |
|---|---|---|
| block | bole, elder, ruin | push out, then the knock |
| soft | fern | no push — the pawn stays inside |
| shatter | crystal | soft while walking; delete only on a confirmed Howl |

Fern volume is `r = 0.45`, `h = 0.6`. That is a tuft. The card is wider. The card width is not the disk.

Disk: `d < r + PAWN_R`. `PAWN_R` is 0.32 in xz ([`play.ts`](../scripts/jade-lod/play.ts)). That disk is the thud. The fur is not.

Block, unchanged. Push along the line from the tree to the pawn. `speed *= 0.35`. `m -= 0.8` once. The clip stays what it was. Yaw is not touched. An elder stops you. It does not force the walk clip.

Soft, each tick while you are in the disk:

```
wantSpeed *= 0.55     // even if Shift is down
accel      = 0.08     // the run accel is 0.18
m         -= 0.03
yawRate   *= 0.5
clip       = walk     // even if the speed wants sprint
```

The step you leave, those four are gone: want, accel, the nick, and the yaw. No 400 ms exit lerp. A ghost fern is FAIL. Two ferns are one set. Never `0.55` to the power of the tuft count.

`0.55` still lets you cross. `0.2` would trap you. Half yaw is undergrowth, not ice. `m -= 0.03` a tick at 60 Hz is about `−1.8` a second, a nick along a chain. The block's `−0.8` is the only real cut. A push plus a slow yaw is an invisible wall. Soft does not push.

Crystal underfoot uses the same soft numbers without the yaw clamp and without the forced walk. You still have to aim the Howl. Walking into quartz does not shatter it. The burst mp4 is a rail in section 5. This cut does not cook it.

The mixer graph is section 8. Entering the fern switches to walk the same tick, and Shift does not beat it. Leaving the disk waits 80 ms before sprint is legal. That wait is the crossfade window. It does not stack on a second 80–120 ms. The capsule still applies `wantSpeed` and `yawRate`. The mesh does not replace the disk.

Debug L. Soft wire is green. Block is cyan. Shatter is gold.

Done-when: sprint into a fern. The white settles to walk, the turn goes wide, you leave, and sprint is back about 80 ms later. `m` is nicked, not cut. Sprint into a bole. You stop, you are knocked, `m` jumps, and the clip does not change. A Howl on a crystal is the confirm it already was.

### 7. Path as noise

The valley is law [54](54-path-noise-valley.md). One page, `s+7`, two octaves, `L = 64`, wander 18 m. `x` does not enter the noise.

```
center(z) = (fbm(0, z/64, s+7, octaves=2) - 0.5) * 18
d = abs(x - center(z))
onPath = d < pathHalf
```

Spawn, the flatten, and the shader tint read that same `d`. No stones in the mp4. No magnet on the pawn. `onPath` is not a SprintCore rail.

### 8. KEEP bolt.glb — the pawn

The Hybrid KEEP is the pawn. It is not a costume on the capsule. Path: `game/public/assets/bolt.glb` in StarBoltSprint/bolt-hybrid. White coat, four legs, material `Coat_White`, one mesh. This kitchen does not import three, does not vendor a second glb, and does not pull the Imagine dog into a plate.

The file's POSITION min is y = 0, so the origin is the paws. The long axis is Z, so proto yaw 0 stays +Z. A later export that faces +X takes `π/2` once in the loader. A chest-centered export (min y below 0) offsets in the loader. The camera does not rise to hide a bad origin.

```
root.position.set(bolt.x, h(x, z) + yOffset, bolt.z)
root.rotation.y = bolt.yaw + yawFix
```

`h` is law [50](50-heightfield-posture.md). The mesh paws sit on `h`. The card's `h + 0.45` is not this root. SprintCore writes x, z, yaw, speed, and m. The mixer writes the clip and `timeScale`. The boom sits on the root.

The idle clip keys translation on the bone `root`. Strip that track. Idle plays in place. Two translations skate.

Clips by name, then by index `idle 0, walk 1, sprint 2, howl 3`. The KEEP on disk today has `idle` (2 s) only. Missing howl: hold idle or walk, and still fire the Howl cook. Missing sprint: play walk scaled by speed, or idle if walk is missing too. Do not synthesize a clip. Do not morph the coat. No extra paired mesh. No Bolt LOD. Never cull Bolt.

```
if howlPlaying:        howl    timeScale = 1
else if speed < 0.2:   idle    timeScale = 1
else if inSoft:        walk    timeScale = 0.85
else if speed < 4:     walk    timeScale = 0.8 + speed * 0.15
else:                  sprint  timeScale = 0.9 + min(0.25, m * 0.02)
```

Howl is a 0.5 s oneshot inside 0.4–0.6 s. It starts the same frame as the cone test and the burst plant. The hit is that frame. An optional hit at 0.2 s is not the default. H does not pause the ground plate. Soft beats Shift. After the oneshot, the graph falls back. Crossfade walk ↔ sprint is 100 ms (band 80–120). Howl fades 60 ms in and 100 ms out. The fern exit holds walk 80 ms, and that is the same window: do not add another crossfade after it. `timeScale` follows speed on the walk. `m` only nudges the sprint. It is not an anim slider.

Camera, behind the root, not a bone and not a plate:

```
behind = 6.2    height = 2.4
cam = pawn − forward * behind + up * height
lookAt(pawn.x, h + 0.7, pawn.z)
lookY = max(lookY, h + 0.3)
```

The disk stays `PAWN_R = 0.32` in xz. No convex hull from the fur. Debug L draws that disk at `h`, not the mesh AABB. Paw sparks birth at `(x, h + 0.12, z)`. The Howl cone reads the root yaw.

The loader does not draw the path, the trees, or the sky. It does not scroll the world. It does not parent the camera to a clip. Volumes stay disks. Fade and instancing do not include Bolt. The gallop cycle stays the lane teacher. It is not a second dog in the grove.

Scale: measure withers once, lock `scale = 0.6 / measured`. This KEEP's ears sit near 1.15 and its paws sit at 0, so the lock is a measure, not a guess written into the file.

Done-when: the white KEEP on the highway. Walk and sprint match speed. Feet on `h`. Camera behind the mesh. A fern forces walk. H plays howl when the clip exists, and shatters either way. No skate. No second dog. The disk still stops a bole.

---

## FAIL

- Writing the budget into `prev`. Storing `bandDraw` there is the same fail. `prev.set` after the quota, with the draw band, is that fail.
- A volume taken from `prev.band`.
- Requiring `dist < 12` before a budget-demoted crown may return.
- Counting a fade per plane.
- Two `prev` maps that copy each other.
- Forgetting an id that is still inside the memory ring.
- `forgetIds` tied to a geo drop.
- `memRing` equal to `geoRing`.
- Evicting an id whose chunk is still in geo.
- Calling the enter distances because a kit respawned. Missing kit is not missing memory.
- Shrinking a crown fade. Shrink on mid ↔ far. Scale to 0. A fade longer than about 200 ms on far ↔ cull. Scaling the group, the shadow, or a hidden bole. Writing that scale into the idle impostor pool.
- Shattering a crystal because a body touched it.
- A burst film with a wolf in it. Frame 0 that is not the crystal sheet. A 360° cone. An 8 m sphere. A volume that stays up while the burst plays. Recreating a crystal because its chunk re-entered geo. Advancing the burst mp4 with `Date.now`.
- A push on a soft volume. `speed *= 0.88` as the fern. A soft hit that cuts `m` like a block. Stacking the fern multipliers once per tuft. A long lerp after you leave the disk. A fern radius taken from the card width.
- Baking the path, or stones, into the ground film.
- A spawn skip on `abs(x)` while the height uses the valley.
- A second hero, or a wolf cooked into a sheet, a plate, a burst, or the ground film.
- Root translation left on the pawn. A camera parented to a clip or a bone. A soft disk while the mesh sprints. A physics mesh used as the thud. A fox morph. Chrome on the coat mid-run.
- Importing Three as the world. The pools are a contract for the remix.
- One solver that owns Bolt, the capsules, and the sparks. SprintCore is the dog. Volumes are the woods. Particles are the weather.

---

## Done-when

Walk the wandering path. The flatten, the empty corridor, and the tint use one `d`. Stand among 30 boles at 8 m: 24 crowns, 6 trunks, and the six are still remembered as near. Step so a slot frees. A crown returns without a trip to the enter line. Orbit a bole on the seam at 32.0. The crown stays, because `prev` outlived the mesh. Sprint until the trail is long. The cap drops chunk-centers outside geo and leaves the live ring, even when that ring is already past 512. Walk 80 m away and back. That forget is legal. A speck at the horizon shrinks to 0.35 over 180 ms and is gone. Turn back inside the belt and it grows from the size it had. Mid boles are at 40 m. Sprint into a fern: walk, a wide turn, out, sprint again about 80 ms later, `m` only nicked. Sprint into a bole: stop, knock, `m` jumps, clip unchanged. A crystal you walk through drags and stays. Face a crystal at 6 m and press H: the sheet is gone, the capsule is gone, the burst quad runs about a second (particles when the mp4 is not cooked yet), and the dust is GPU. Walk through that dust. Press H into empty air: the pose and the muzzle play, and nothing dies. A crystal behind the head survives. Leave the chunk and come back inside mem: the shard stays gone. Bolt is the Hybrid KEEP on the highway: walk and sprint match speed, the paws sit on `h`, the boom sits behind the mesh, a fern forces walk, and H howls and shatters. The disk still stops a bole. One dog. The ground film is still flat, and H does not freeze it.

World stays Imagine Video assets. The player stays the sealed Bolt. No wallet. No player API keys. Hang URL stays `https://boltverse-odysseyyyy.grok.me`.
