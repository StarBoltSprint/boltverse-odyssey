# PRIORITY 0 — Any biome = Frost-parity (random player, cold Grok)

**Audience:** a brand-new Grok in a brand-new conversation, cooking **any** named biome (Frost, Tide, Ember, invented `{PAINT}`). Not Frost-only.

**Target parity:** same *feel* as the sealed Frost Live finale —
GPU compositor (no CPU `getImageData` hot path) · sealed **6 s** gallop · auto-scale · **plate bounce** · contact shadow · **biome-adaptive ground FX** · hang ≠ wipe · Pack auto-wire.

**Live compositor = [17-live-compositor.md](17-live-compositor.md).** Copying the old scissor / IGN-fract sketch = **FAIL**.

Player may be random. Grok must not ask them to install Pack, invent a dog sprint, or wipe old biomes.

---

## A. Fixed forever (every biome)

| Piece | Law | Where |
|---|---|---|
| Bolt motion | **REUSE** `lock/bolt-gallop-cycle.mp4` = **6 s / 96 fps / 534 frames / `#00FF00` / rear** | [lock/README.md](../../lock/README.md) |
| Style teacher | `lock/bolt-back.jpg` (show in chat before still/repose) | [10](10-bolt-cutout-law.md) |
| Architecture | B-stack: empty road Video A + keyed Bolt cutout. Never bake Bolt into one film | [09](09-recette-biome.md) |
| Compositor | **GPU from frame 0** — copy `bolt-key-gl.ts` **+** `wet-fx.ts`. Quad dest, luma protect, plate bounce, sin grain, rVFC stamp | [17](17-live-compositor.md) · [15](15-gpu-compositor.md) · [WIRE](../scripts/bolt-key-gl/WIRE.md) |
| Scale | `computeScale` / `assertScale` (13d) after key | [13d](13d-auto-scale.md) |
| Clock | `gallop-clock` / `assertGallopClock` (14c) — native fps, `plate_time` | [14c](14c-gallop-clock.md) |
| Contact | Paw multiply shadow on **road** (13b); weaker in air | [13b](13b-anti-sticker-contact.md) |
| Light | **Plate bounce HARD** — sample road behind the dog, not a studio LUT | [17](17-live-compositor.md) · [13b](13b-anti-sticker-contact.md) |
| Ground FX | **Biome table** — paw trails + splash/dust, Euler quads, phase-locked | [16](16-biome-ground-fx.md) · `wet-fx.ts` |
| Hang | ADD plates beside masters. Never wipe canyon→war | [09](09-recette-biome.md) |
| Pack | Auto-embed `BOLTVERSE_PACK_ORIGIN=https://boltverse-pack.vercel.app` + `pack.js` | [07](07-pack-live.md) |
| Play controls | A/D or side swipe = lanes · W / swipe up = jump | [PLAY.md](../PLAY.md) |

Constants:
```
CYCLE_FPS = 96
CYCLE_FRAMES = 534
STRIDES_PER_CYCLE = 22
bolt.loop = true
playRate = 1
```

Remux lock → Live `public/master/bolt.mp4` (`-an` +faststart), bump `?v=`. Do **not** invent a new gallop. Archive `lock/bolt-gallop-cycle-0.93s-prev.mp4` = FAIL as play cycle.

---

## B. Biome-variable (`{PAINT}` + FX row)

Only these change per biome:

1. **Empty plate paint** — roads, light, weather (`image-empty-plate.txt` + `{PAINT}`).
2. **Hazard cousins** — same camera grammar, biome objects.
3. **Grade / FX row** from [16](16-biome-ground-fx.md) + `uniformsFor(chap)` in [17](17-live-compositor.md).
4. **File names** — `road-<biome>.mp4`, `road-<biome>-*.mp4`, never overwrite hung `road.mp4` unless SmiR says replace Beat.

Bolt identity, gallop file, GPU path, scale, clock, Pack = **identical**.

---

## C. Ordered cook (copy this)

1. Show `lock/bolt-back.jpg` + `lock/bolt-gallop-cycle.mp4` in chat (teacher gate).
2. Still empty first + distinct last — ZERO dog.
3. Video A empty rush — `imagineBiomeClip`, **48 fps**, SPEED LAW.
4. REUSE lock cycle → key + despill (13c) — **law 17** GPU even in cook QA.
5. `computeScale` / `assertScale` (13d).
6. Wire Live: `makeCompositor` **before** `getContext("2d")` ([17](17-live-compositor.md)).
7. `gallop-clock` / native loop 1× (14c).
8. Plate **bounce** + contact shadow + **ground FX row for this biome** (16 / wet-fx).
9. Hazards (spawn far, 1–2 lanes, plate-speed match).
10. Hang ≠ wipe + Pack wire + bump `GPU_VER`.
11. Smoke: dogFps ≈ min(96, display); hind paws intact; **no vertical bars**; shadow on road; FX visible on plant; coat matches THIS plate; no truck scale.

**FAIL** if: invent sprint · CPU key every rAF · **copy scissor/IGN sketch** · wipe masters · hang without composite gate · skip bounce / FX row · bake Bolt into road mp4 · SPH / Box2D.

---

## D. Cold-start message (kitchen — paste into Build when cooking)

Use [COLD_START-any-biome.md](COLD_START-any-biome.md). Do **not** use the old Frost share paste that said “don’t use `lock/bolt-gallop-cycle.mp4`” — on `main` that file **is** the 6 s canon.

Player boot (“start odyssey”) stays [START.md](../../START.md) — Welcome + teaser + play URL. This doc is **cook**, not Welcome.
