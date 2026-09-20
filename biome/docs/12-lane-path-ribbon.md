# 12 — Living-film Lane path (ribbon + arc-length)

HARD LOCK for fresh Grok / new Build convos.  
This page is **control geometry** for a playable Lane plate. It does **not** replace Imagine cook (`10-bolt-cutout-law.md`, `09-recette-biome.md`).

**Simple product line:** empty road mp4 + Bolt cutout sticker + tiny `path.json` chart. Without the chart = pretty film. With the chart = game.

## What this is for

| Helps | Does not help |
|---|---|
| Swipe L/C/R that means something | Cooking Tide empty road |
| Hit / miss → Resonance / next seed | Cooking rotary rear Bolt |
| Glow that stays on the road after recooks | SprintCore / Three.js / FIR / Remez |
| Honest sprint clock on bends | Painting Bolt into the plate |

Cook order stays: **A empty → B gait → green → key** (see `10-bolt-cutout-law.md`). Author `path.json` on **empty road plate A** after A KEEP (or in parallel once the road is readable). Hang ≠ wipe: new biome = new folder + new path, never delete `biome/master/*`.

## Three different “masks” (do not mix)

| Mask | Job | Control? |
|---|---|---|
| **Centerline** \(C(s)\) | Where the paws go | Yes |
| **Ribbon** offset of \(C\) by half-width \(w(s)\) | Legal lanes L / C / R | Yes |
| **Holdout matte** | Plate pixels that cover Bolt (rock, lightning in front) | No — compositing only |

If holdout includes the road, you will think he left the path when he only went behind a crystal. Never steer with holdout.

## Ribbon UV (the chart)

Treat the road as a strip chart, not mp4 pixels:

\[
P(s,\lambda)=C(s)+\lambda\,w(s)\,N(s)
\]

| Coord | Range | Meaning |
|---|---|---|
| \(s\) | \([0,1]\) | Along the sprint (arc-length / path length) |
| \(\lambda\) | \([-1,1]\) | Across lanes. \(0\) = center. Pick L/R sign once; never flip mid-run |

Player state is only \((s,\lambda)\). Tap → invert nearest segment to \(\lambda_{\text{hit}}\). Outside \([-1,1]\) = miss ribbon. Outside choice windows = ignore.

**Stretch** road marks to the ribbon. **Flow** only lightning/sparks (\(s - vt\)). Never flow the road under locked paws. Gallop sheet uses **plate time**, never ribbon \(s\).

## Arc-length resample (draft → clock)

The Bézier / mask spline you draw uses author \(t\). Play must **never** see raw \(t\).

1. Author: centripetal Catmull–Rom (\(\alpha=1/2\)) or mask-tool Bézier.  
2. Fine grid: ~16 samples/span (or denser on turns).  
3. Accumulate chord lengths in **plate UV**.  
4. Emit **N = 32–64** points at equal arc length. Store those. Drop the fine grid.

If \(s\) is not arc-length, Bolt surges on straights and crawls in bends — players read “I am not in control.”

Normals in 2D plate space: \(T=\mathrm{normalize}(C_{i+1}-C_{i-1})\), \(N=(-T_y,T_x)\), flip-guard `if N·N_prev < 0: N = -N`. No 3D Frenet.

## Sidecar per plate (ship this)

```json
{
  "plate": "tide-01",
  "N": 48,
  "C": [[0.50, 0.82], [0.51, 0.79]],
  "w": [0.08, 0.08],
  "hand": "screen-left",
  "windows": [
    { "s": 0.12, "side": "L" },
    { "s": 0.72, "side": "R" }
  ]
}
```

- `C[i]` = plate UV \([0,1]^2` (not pixels).  
- `w[i]` = half-width in UV.  
- `hand` = which way \(N\) points at \(s=0\) (match across dissolves or he jumps shoulder).  
- `windows` = when a side choice is legal (~8 s calm / ~45 s answer in 60 s bone → map to \(s\)).

Optional later: `path.keys` / \(C(s,t)\) if the road moves in frame. Most locked-cam Lane plates: **one static spline**.

File next to the plate, e.g. `biome/<name>/plates/01/path.json`.

## Play (tiny state machine)

```text
s   += ds_plate + k * m     // plate clock + tiny momentum lead (stay in shot)
λ   += ease(λ_target - λ)   // 200–400 ms; never snap
pos  = lerp(C,s) + λ * lerp(w,s) * lerp(N,s)   // anchor at PAWS
angle = atan2(T)
```

Glow = ribbon sample at \(\lambda=\pm1\) × envelope at choice beats. Authoritative glow from sidecar (Imagine paint is hint only).

Next plate seed includes final \(\lambda\), \(s\), \(m\), \(W\), biomeId. Catalog paint only — hang ≠ invent architecture mid-run.

## Lane cook gate

If you cannot draw the centerline Bézier on frame 0 of empty road **in ~2 minutes**, the plate is too busy. Recook quieter. The path cannot save an unreadable road.

**FAIL:** Bolt painted into the road plate · no `path.json` on a “playable” Lane · pixel units for \(C\)/`w` · raw Bézier \(t` as play \(s` · holdout used for steering · WASD / yaw on a living plate · FIR / Parks–McClellan / physics-on-spline for this job.

## Pointers

- Cutout / gallop / teacher: `10-bolt-cutout-law.md` + `lock/bolt-back.jpg` (PRIORITY 0 show in chat before Bolt cook)  
- Full biome recipe: `09-recette-biome.md`  
- Hang ≠ wipe: never delete existing master biomes when adding Tide / next  
- Open-world SprintCore / Nebula editor Joy XP: **flavor only** — not this stack  

Sealed 2026-09-20 — living-film Lane path law.
