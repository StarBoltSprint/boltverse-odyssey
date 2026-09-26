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

This is the budget ticket. Section 2 must not store it. `prev[id].band` is `holdBand` only. `row.bandDraw` is the mesh after the budget. `holdBand` never reads `bandDraw`. The budget may start a fade toward mid. `prev` stays near. Volume uses `bandDraw`, not the remembered near.

Done-when: 30 trees at 8 m show 24 crowns and 6 mid cards. Free a slot and the crown returns. You do not walk to 11.9 m to get it back.

### 4. Far → cull shrink

`scale = mix(1, 0.35, t)` and `opacity = 1 - t` over 180 ms. Cull → far is the reverse. This is the far ↔ cull edge only.

Done-when: specks on the horizon shrink, then die.

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

```
center(z) = (fbm(0, z/64, s+7, octaves=2) - 0.5) * 18
d = abs(x - center(z))
onPath = d < pathHalf
```

The same `d` flattens the posture, skips spawn, and tints the shader. Two octaves only. No stones in the mp4.

### 8. KEEP bolt.glb

`lock/bolt.glb`. Hybrid white coat, withers 0.6 m. SprintCore moves him. `y = h + foot`. Clips are idle, walk, and sprint. A fern forces walk. The boom camera sits behind the mesh and follows it. Bolt is never culled. No second wolf in a plate or a sheet.

---

## FAIL

- Writing the budget into `prev`. Storing `bandDraw` there is the same fail.
- Forgetting an id that is still inside the memory ring.
- `forgetIds` tied to a geo drop.
- `memRing` equal to `geoRing`.
- Evicting an id whose chunk is still in geo.
- Calling the enter distances because a kit respawned. Missing kit is not missing memory.
- Shrinking a crown fade.
- Shattering a crystal because a body touched it.
- Baking the path, or stones, into the ground film.
- A second hero, or a wolf cooked into a sheet.
- Importing Three as the world. The pools are a contract for the remix.
- One solver that owns Bolt, the capsules, and the sparks. SprintCore is the dog. Volumes are the woods. Particles are the weather.

---

## Done-when

Walk the wandering path. The flatten, the empty corridor, and the tint use one `d`. Stand among 30 boles at 8 m: 24 crowns, 6 trunks, and the six are still remembered as near. Step so a slot frees. A crown returns without a trip to the enter line. Orbit a bole on the seam at 32.0. The crown stays, because `prev` outlived the mesh. Sprint until the trail is long. The cap drops chunk-centers outside geo and leaves the live ring, even when that ring is already past 512. Walk 80 m away and back. That forget is legal. A speck at the horizon shrinks over 180 ms and is gone. A fern slows you and keeps the walk clip. A crystal you walk through drags and stays. A held Howl inside the cone hides it the same frame and plays the dust. Bolt is the sealed white dog. The ground film is still flat.

World stays Imagine Video assets. The player stays the sealed Bolt. No wallet. No player API keys. Hang URL stays `https://boltverse-odysseyyyy.grok.me`.
