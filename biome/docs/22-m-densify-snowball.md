# 22 — Momentum densify (same biome, snowball refs)

**Sealed 2026-09-20 (SmiR).** Hang ≠ wipe. Picture is the clock. Lena densification for Lane biomes.

## Product

Same biome the whole run. The **base empty road plate** stays fixed (first+last loop). As Bolt succeeds sprints / dodges, the world **wakes**: more beautiful, more animated décor — always in perfect harmony with that biome. Miss = fall back one densify tier.

This is what `m` **looks like** in picture (not XP chrome). Hazards stay readable every plate.

---

## Base plate (HARD)

- One sealed empty-road A (law 20 proportions, biome paint).
- Cook A as **loop**: first frame = last frame (Imagine hooks). Rush direction constant.
- Bolt = REUSE sealed 6s gallop + GPU compositor (laws 00 / 15 / 17). Never invent gait.
- Base A does **not** morph when `m` changes. Only densify layers / cook slots change.

---

## Densify tiers ↔ `m`

Index a small ladder of décor detail stills (Imagine `@` refs), biome-locked.

| Event | Tier | Refs active |
|---|---|---|
| Start / low `m` | 0 | base A only (+ hazard if any) |
| Success (dodge / jump / plate clear) | +1 | **all prior refs + 1 new** |
| Miss (hit obstacle / fail plate) | −1 | drop newest; keep older |

**Snowball (HARD):** on success, **add** a new ref **and keep every unlocked ref**. Never replace the stack with only the newest. Cap **≤ 12** Imagine refs (product limit).

Miss drops **one** tier (lose the last unlocked detail), not wipe to zero unless `m` fully drains per play law.

---

## What the new detail is

- One extra décor element adapted to **this** biome (light, material, palette, weather).
- Makes the plate richer / more alive (parallax props, sky life, edge flora, distant structures, animated weather accents…).
- **Harmony FAIL** if the detail looks like another biome or collage chrome.
- **Ban:** detail on Bolt silhouette · detail blocking L/C/R lanes · morphing the road geometry · morphing Bolt identity.

Hazard on each denser plate is still allowed / expected — densify ≠ remove danger. Richer world **plus** readable threats.

---

## Cook for Grok (cold)

1. Seal base empty A (first=last loop). Hang ≠ wipe masters.
2. Author a **ref pack** for this biome: ordered detail stills `d0…dN` (N≤11 extras + identity locks as needed). Same grammar as A.
3. At play / cook commit: `tier = f(m)` → attach refs `[d0…d_tier]` **cumulatively** + base A as first/last.
4. Cook next plate loop with that ref set. Smoke: same road identity, richer edges, lanes clear, Bolt REUSE.
5. On miss: cook/play previous tier pack (snowball shrinks by one).

Spec free early; paid Imagine only on confirm (existing credits law). Speculative prefetch = stock / lower tier only.

---

## FAIL

- New plate invents a different biome / morphs base road
- Success uses only the new ref (forgets prior stack)
- >12 refs
- Décor fights hazard readability or covers Bolt
- Inventing densify by free chat instead of sealed ref pack

## Related

[00](00-PRIORITY0-any-biome.md) · [16](16-biome-ground-fx.md) · [20](20-default-plate-proportions.md) · [21](21-paw-to-galaxy.md) · Priya slots / Lena densify · Marcus dodge → `m`
