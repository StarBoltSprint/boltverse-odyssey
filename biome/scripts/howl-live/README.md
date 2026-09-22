# howl-live — law 34

Portable Howl aim + cut + shatter swap + wet GPU. Copy into any biome Live.

| File | Role |
|---|---|
| [`howlLive.js`](howlLive.js) | `howlFireSec` · `howlFxBeam` · `howlStep` · `howlPose` · `pickHowlLane` |
| [`howlWet.glsl`](howlWet.glsl) | luma-key Howl + plate bounce + road sit (two-pass) |
| [`demo.js`](demo.js) | `node demo.js` — asserts inset tip + duration clamp |

Law: [`../../docs/34-howl-live-aim.md`](../../docs/34-howl-live-aim.md)  
Plates: [`../../docs/32-howl-gpu-targets.md`](../../docs/32-howl-gpu-targets.md)  
KEEP: [`../../fx/howl/howl-attack.mp4`](../../fx/howl/howl-attack.mp4)

## Wire (new Grok)

1. REUSE the KEEP mp4. Do not recook rings. Do not shader them.
2. Copy `howlLive.js` → Live `plates.ts` (or import).
3. Copy `howlWet.glsl` into `bolt-key-gl.ts` (`HOWL_VS` / `HOWL_FS`).
4. On **S**: sample Bolt mouth + live rail-B dest → `howlStep`. Set `howl.playbackRate = playRate`. Draw `beam`.
5. When `cut`: `howl.pause()` **now**. Swap obstacle video → that type’s shatter. Same dest quad.
6. New biome = new `obstacle-{noun}` + `shatter-{noun}` only. Register a `HowlKind`. Math stays.

BAN: laser · homemade rings · Howl that slides A→B as a sticker · overshoot past the prop · Howl that keeps playing after contact · dogs as obstacles · closing the last free lane.
