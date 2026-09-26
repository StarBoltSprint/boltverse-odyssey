# 52 — Engine vs Play

**Go 2026-09-26 (SmiR).** Kitchen only. Do not read this to the player.

Engine draws, and it remembers. Play is what the paws mean. They stay apart the way fade stays apart from hysteresis.

Laws behind this page: [44](44-imagine-volume-stack.md) volume, [45](45-shader-graph-look-kitchen.md) look, [46](46-four-picture-jobs.md) pictures, [47](47-jade-sheet-cook.md) sheets, [48](48-jade-plate-cook.md) plates, [49](49-two-plane-tree.md) the two-plane tree, [50](50-heightfield-posture.md) posture, [51](51-octave-map.md) octaves. Howl rings stay the KEEP in [32](32-howl-gpu-targets.md) and [34](34-howl-live-aim.md): [`../fx/howl/howl-attack.mp4`](../fx/howl/howl-attack.mp4). Do not recook them.

The player is the sealed Bolt. Mesh path `lock/bolt.glb` is the Pack KEEP (white coat, withers 0.6 m). This repo does not cook that file and does not invent a second wolf. Motion teacher stays [`../../lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4). Style teacher stays [`../../lock/bolt-back.jpg`](../../lock/bolt-back.jpg).

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
8. `bolt.glb`.

Steps 1–6 are the feel. Step 7 is frames. Step 8 is identity.

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

The minimum that survives the geo drop is `prev` plus `groundY`. The kit rebuilds from `holdBand` on the way back in. `memKits` is optional: it resumes a fade that was mid-flight. It does not pick a new band.

Cap 512. Evict the farthest chunk-center from the pawn. Never evict an id whose chunk is still in geo. Evict `prev`, `groundY`, and `memKits` together. A chunk still inside mem is remembered when the store is under the cap. This spawn's live 3×3 is already past 512, so the cap spends the trail outside geo and the live ring stays whole. It does not eat on-screen ids to force the count under 512.

Re-enter. `holdBand(id)` is still there, so the band stays sticky. Do not use the enter distances just because the kit was missing. A missing kit is not missing memory. `groundY[id] ?? h(x, z)`.

Do not keep instance matrices, GPU particle births, volume objects, or Imagine textures in this ring. Textures stay shared. Particle look stays law [53](53-gpu-particles.md).

`bandDraw` is the budget ticket in section 3. It is not stored in `prev`.

Done-when: orbit a bole on the chunk seam at 32.0. The crown stays. After a long sprint, every id still in `prev` has its chunk inside geo once the live ring is past 512, and none of those on-screen ids were the ones dropped. Walk 80 m away and back. That chunk has left mem. The forget is legal. The seam orbit is not that forget.

### 3. Budget must not overwrite holdBand

This ticket is law [55](55-budget-banddraw.md). Section 2 stores `prev` only. `holdBand` is meters. `bandDraw` is the chair: near 24, mid 64, far 96. `promoteLod` writes the draw fields and does not write `prev`. A crown fade is one slot, 220 ms, cap 8, and it follows `bandDraw`.

Done-when: 30 boles inside 10 m show 24 crowns and 6 bare trunks. Cull 6 crowned ones outward. The bare trunks take the crowns in place. Their `prev.band` never went mid.

### 4. Far → cull shrink

This closes the LOD kitchen. Soft gait, a new Howl cook, and `bolt.glb` are the next sketches. They are not this cut.

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

A crystal's hit kind is `shatter`. Howl is H, held, in a cone of about 8 m and 25°. On confirm: hide the card and drop the volume the same frame, then play `crystal_burst_vN` (about 1 s, no capsule). Walking into a crystal is a soft drag. It does not shatter. A miss is the Howl pose and the audio only.

Cook: shard becomes quartz dust, transparent back, no Bolt, first frame is the still, last frame is empty. Not chrome. The rings stay the Howl KEEP. This plate, `crystal_burst_vN`, is the primary shatter picture. The spark overlay is law [53](53-gpu-particles.md): 80 points in the vertex shader, each one sampling the Imagine spark-dust sheet. Those points are a playback tape. They do not settle on a bole and they do not write SprintCore. A later debris that must land is a separate Verlet of at most 80, still not Rapier. A missing sheet hides those points. They are not a mesh, not a colored disc, and not the world.

### 6. Soft versus block

Block: push, `speed * 0.35`, `m -= 0.8`.

Soft fern: no push, `wantSpeed * 0.55`, a slower accel, `m -= 0.03`, yaw at half, and the walk clip even if Shift is down.

Crystal underfoot is that soft hit without the yaw clamp.

### 7. Path as noise

The valley is law [54](54-path-noise-valley.md). One page, `s+7`, two octaves, `L = 64`, wander 18 m. `x` does not enter the noise.

```
center(z) = (fbm(0, z/64, s+7, octaves=2) - 0.5) * 18
d = abs(x - center(z))
onPath = d < pathHalf
```

Spawn, the flatten, and the shader tint read that same `d`. No stones in the mp4. No magnet on the pawn. `onPath` is not a SprintCore rail.

### 8. KEEP bolt.glb

`lock/bolt.glb`. Hybrid white coat, withers 0.6 m. SprintCore moves him. `y = h + foot`. Clips are idle, walk, and sprint. A fern forces walk. The boom camera sits behind the mesh and follows it. Bolt is never culled. No second wolf in a plate or a sheet.

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
- Baking the path, or stones, into the ground film.
- A spawn skip on `abs(x)` while the height uses the valley.
- A second hero, or a wolf cooked into a sheet.
- Importing Three as the world. The pools are a contract for the remix.
- One solver that owns Bolt, the capsules, and the sparks. SprintCore is the dog. Volumes are the woods. Particles are the weather.

---

## Done-when

Walk the wandering path. The flatten, the empty corridor, and the tint use one `d`. Stand among 30 boles at 8 m: 24 crowns, 6 trunks, and the six are still remembered as near. Step so a slot frees. A crown returns without a trip to the enter line. Orbit a bole on the seam at 32.0. The crown stays, because `prev` outlived the mesh. Sprint until the trail is long. The cap drops chunk-centers outside geo and leaves the live ring, even when that ring is already past 512. Walk 80 m away and back. That forget is legal. A speck at the horizon shrinks to 0.35 over 180 ms and is gone. Turn back inside the belt and it grows from the size it had. Mid boles are at 40 m. A fern slows you and keeps the walk clip. A crystal you walk through drags and stays. A held Howl inside the cone hides it the same frame and plays the dust. Bolt is the sealed white dog. The ground film is still flat.

World stays Imagine Video assets. The player stays the sealed Bolt. No wallet. No player API keys. Hang URL stays `https://boltverse-odysseyyyy.grok.me`.
