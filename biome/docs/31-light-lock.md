# 31 — Light lock (persistent vs event)

Cook + live. Extends [16](16-biome-ground-fx.md). KEEP is the exposure bible. `m` must not raise ambient.

## Two clocks

| | Persistent (`m`) | Event (one plate) |
|---|---|---|
| What | lanterns, nebula, motes | comet, calving flash |
| Where | sides / sky | 1–2 lanes, in the air |
| Duration | all later plates | spawn → exit → **off** |
| Exposure | does **not** lift ambient | local specular, then return KEEP |

Key, white balance, black point = **KEEP, forever**. Same night. No sunrise because `m` went up.

## KEEP numbers (measure once)

- Asphalt lower-third mean luma ~**0.04–0.12** — darkest mass.
- Sky highlights ≤ ~**0.85**.
- Last-frame asphalt hotter than first = FAIL.
- First and last = **same WB**. Last may be closer, never hotter.

A +1 lantern is a **practical** (small teal flame, sides). It is not a fill. Nebula may saturate the sky; it must not bleach the cone.

## Clip

Constant light except the event. The comet is a **moving specular**, not a second sun. Last: event gone, expo = first, lanterns did not become headlights.

Ban in prompts: *the world glows / luminous road / cinematic lighting / the comet lights the canyon.*  
Use: *Same light as the first image. ADD a small practical / sky only. Do not raise ambient. Exposure ≤ first.*

## Seam + miss

`last(n)` and `first(n+1)`: same WB, same road luma, décor closer. Judge = law [33](33-plate-mae-qc.md) (full-frame MAE, asphalt luma MAE, `|Δ(R−B)|`). Exit non-zero = recook. Miss recooks from a stack still (known expo), never from a flashed mid.

## Bolt (live)

White GSD forever. Rim **sampled from this plate** (sky / crystal band), not a second Imagine grade. Event flash = short `uHit` / trauma, then return. Do not raise Bolt grade with `m`.

Crystal GPU row (identity, until live sample exists): cool 0.86 / 0.90 / 1.16 · sat 0.58 · print 0.42 / 0.38 / 0.62 · drop 0.72 / 0.55 / 1.0 · grade 0.08. **No frost lime neon overlay** on a prism road (`uNeon = 0` for crystal).

## Related

[16](16-biome-ground-fx.md) · [28](28-stills-two-rails.md) · [30](30-i2i-prompt.md) · [33](33-plate-mae-qc.md) · `biome/prompts/color-prismwake.txt`
