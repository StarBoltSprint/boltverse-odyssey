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

### 2. Chunk-edge memory

`geoRing = 1` (a 3×3 of spawn, kits, and volumes). `memRing = 2` (a 5×5 that holds `holdBand`, `kit.groundY`, and the fade). `forgetIds` runs only when an id leaves the memory ring. Cap about 512 ids. Past that, drop the farthest.

Done-when: orbit a bole across a 32 m seam. The crown does not pop. `groundY` is the value stored the first time.

### 3. Budget must not overwrite holdBand

`prev[id].band` is `holdBand` only. `row.bandDraw` is the mesh after the budget. `holdBand` never reads `bandDraw`. The budget may start a fade toward mid. `prev` stays near. Volume uses `bandDraw`, not the remembered near.

Done-when: 30 trees at 8 m show 24 crowns and 6 mid cards. Free a slot and the crown returns. You do not walk to 11.9 m to get it back.

### 4. Far → cull shrink

`scale = mix(1, 0.35, t)` and `opacity = 1 - t` over 180 ms. Cull → far is the reverse. This is the far ↔ cull edge only.

Done-when: specks on the horizon shrink, then die.

---

## Play

### 5. Howl / shatter

A crystal's hit kind is `shatter`. Howl is H, held, in a cone of about 8 m and 25°. On confirm: hide the card and drop the volume the same frame, then play `crystal_burst_vN` (about 1 s, no capsule). Walking into a crystal is a soft drag. It does not shatter. A miss is the Howl pose and the audio only.

Cook: shard becomes cyan dust, transparent back, no Bolt, first frame is the still, last frame is empty. Not chrome. The rings stay the Howl KEEP.

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

- Writing the budget into `prev`.
- Forgetting an id that is still inside the memory ring.
- Shrinking a crown fade.
- Shattering a crystal because a body touched it.
- Baking the path, or stones, into the ground film.
- A second hero, or a wolf cooked into a sheet.
- Importing Three as the world. The pools are a contract for the remix.

---

## Done-when

Walk the wandering path. The flatten, the empty corridor, and the tint use one `d`. Stand among 30 boles at 8 m: 24 crowns, 6 trunks, and the six are still remembered as near. Step so a slot frees. A crown returns without a trip to the enter line. Orbit across a chunk seam. The crown you left is the crown you come back to. A speck at the horizon shrinks over 180 ms and is gone. A fern slows you and keeps the walk clip. A crystal you walk through drags and stays. A held Howl inside the cone hides it the same frame and plays the dust. Bolt is the sealed white dog. The ground film is still flat.

World stays Imagine Video assets. The player stays the sealed Bolt. No wallet. No player API keys. Hang URL stays `https://boltverse-odysseyyyy.grok.me`.
