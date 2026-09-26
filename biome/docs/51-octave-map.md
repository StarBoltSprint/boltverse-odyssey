# 51 — Octave lock

**Go 2026-09-26 (SmiR).** Kitchen only. Do not read this to the player.

An octave reprints the same noise at half size and half ink. One octave is a swell. Five is gravel. The page and `L` do not change. Only the grain inside one wavelength changes.

Height is law [50](50-heightfield-posture.md). Spawn is [`spawn.ts`](../scripts/jade-lod/spawn.ts). The shared ladder is [`noise.ts`](../scripts/jade-lod/noise.ts) (`fbm`, `OCTAVE_LOCK`).

The amp ladder is `0.50` at frequency 1, `0.25` at 2, `0.125` at 4, and so on. Divide by the sum of the amps so the field stays 0–1.

---

## Lock

```
height   fbm(..., s+101, octaves=3)   L=28
n1 bole  fbm(..., s+  0, octaves=3)   L=14
n2 ruin  fbm(..., s+ 17, octaves=2)   L=40
n3 shard fbm(..., s+ 31, octaves=3)   L=22
```

Height stays at 3 while the rise is 20 cm. The last octave is about 7 m, longer than a stride (about 1–2 m). Octave 4 is about 3.5 m and fights the gait. Octave 5 and above is gravel. Raise height to 4 only if the amplitude later becomes meters.

Spawn does not copy the height count.

- n1 bole, `L = 14`, **3** octaves. Continents with moth-holes. 4 or 5 is salt-and-pepper, like snow.
- n2 ruin, `L = 40`, **2** octaves. Rare continents. Ruins hate 4. That turns them into speckled bricks.
- n3 shard, `L = 22`, **3** octaves.

Extra octaves spend the budget on finer wiggles. On a spawn threshold that shreds the level set. On height it adds slope noise. The peak stays about 0.40. At this scale the cost is taste, not frame time.

The page is the same on every octave. Do not salt a new page to “add richness.” Moving an octave count without changing the job is FAIL.

---

## FAIL

- Height at 4 or more while the amplitude is 20 cm.
- Ruins at 4.
- Using octaves to add richness without changing the job.
- Gating spawn on the height page.

---

## Done-when

Read the lock. Height samples `s+101` at `L = 28` with 3 octaves, and a fourth call is not what the pawn uses. A ruin comes from `s+17` at `L = 40` with 2 octaves, as a continent, not a per-cell coin flip. Boles come from `s+0` at `L = 14` with 3. Shards come from `s+31` at `L = 22` with 3. None of those pages is the height page. The ground film is still flat.

World stays Imagine Video assets. The player stays the sealed Bolt. No wallet. No player API keys. Hang URL stays `https://boltverse-odysseyyyy.grok.me`.
