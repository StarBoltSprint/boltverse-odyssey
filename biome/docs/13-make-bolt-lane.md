# 13 — Make Bolt on a living-film Lane

HARD LOCK for fresh Grok / new Build convos.  
Product brief: **make a cutout that can be steered**, not bake a dog into Imagine pixels. The plate is scenery. Bolt is a second layer with a clock and a ribbon.

Companion laws: `10-bolt-cutout-law.md` (identity / gallop / teacher), `12-lane-path-ribbon.md` + `12b-adaptive-curvature.md` (path table), `13b-anti-sticker-contact.md` (compositor anti-sticker + contact shadow), `biome/scripts/curvature-sample/` (`resamplePath`).

## What he is allowed to be

- One white German Shepherd, camera glued behind the shoulders  
- Gallop locked to **plate time**, not to a free animator  
- Position locked to ribbon \((s,\lambda)\): along the road and across three lanes  
- Momentum \(m,T,W\) survives dissolves; the sprite does not reset  
- No WASD, no orbit, no mid-plate biome change  

If you need more than hold + one L/R tap per plate, you are building the Three.js world, not a Lane.

## The two-layer make

| Layer | How you make it | Who moves it |
|---|---|---|
| Empty road plate (mp4) | Imagine / cook. **Zero dog.** Path readable. Glow cooked *into* the picture at ~8 s and ~45 s | Nobody. Wallpaper |
| Bolt cutout | Separate loop: sprite sheet or short alpha movie, same gallop cadence as the plate | Player: \(s\) from time+\(m\), \(\lambda\) from swipe |

B-stack is the make. C-light / 3-take L-M-R (dog painted in) is how control dies.

## How to make the cutout

1. **Silhouette first.** Behind-camera (strict rear when cook law says so), legs readable against ember *and* frost. If the outline only works on one biome, the dissolve will flash a hole.  
2. **Paw-anchor.** Registration point at the paws, not the head. Ribbon \(P(s,\lambda)\) is a ground point. Head-anchored sprites lean off the road in hooks.  
3. **Loop vs film.** An 8–12 frame gallop cycle, time-warped to plate duration, is enough. A second full-body movie only if you need coat flicker; still keyed, still empty of terrain.  
4. **One scale.** Do not let Imagine resize him every plate. Fixed pixel height relative to plate height (e.g. ~0.28 of frame / withers band from `10`). The road comes to him via \(w(s)\), not the other way around.  
5. **No ground shadow in the plate.** Shadow is a blob under the cutout, or none. A baked shadow in the mp4 will slide wrong when \(\lambda\) changes.

Teacher: show `lock/bolt-back.jpg` in chat before any Bolt cook (PRIORITY 0). Pipeline: B → cycle → green → key (`10`).

## How to make him controllable

Author a ribbon sidecar with the plate (not after):

- Centerline \(C\) on frame 0, centripetal spline  
- `resamplePath` → ~48 arc-length points, normals, \(w\)  
- Choice windows at \(s\approx0.12\) and \(s\approx0.72\)  
- `hand` bit so the next plate does not flip shoulders  

Play:

```text
s     += ds_plate + k * m
λ     += ease(λ_target)          // L / C / R
pos    = ribbonPoint(table, s, λ)
angle  = tangent
gallop = plate_time % cycle
```

Hold = commit (build \(m\)). Tap the glowing side in the *picture* = \(\lambda_{\text{target}}\). Miss or lift = decay. Next seed hashes last frame + \(\lambda\) + \(m\) + \(W\) + biome. Catalog only. Hang ≠ wipe.

## How to make the plate that can hold him

Cook tests, not vibes:

- You can draw \(C\) in two minutes  
- Optional later audit: 2D DT + flux thin of the road mask is **one open chain** (no plaza fork); ridge radius \(\approx w\)  
- Glow is in the frame at the windows, not a HUD  
- Bezel is not a bank (pad the mask if auditing)

Fail the two-minute draw → recook the road quieter. Do not add a joystick.

## How *not* to make him

- Three Imagine takes (left/mid/right dog) and a dissolve between dogs  
- WASD on top of a baked sprint  
- Reset \(m\) on every plate  
- Parks–McClellan / 3D MAT / Coverage Axis as the player path  
- Chat inventing the next architecture  

Those are how he becomes a cutscene.

## Order of work

1. One empty plate (e.g. Tide / ember) + JSON ribbon + a still cutout sliding on \((s,\lambda)\).  
2. Gallop loop locked to plate time.  
3. Hold builds a fake \(m\); Resonance bar only.  
4. One window, one tap, dissolve to a sister plate that inherits \(\lambda\) and \(m\).  
5. Then optional flux-audit the mask so recooks cannot silently move the road.

**Done when:** the finger can change \(\lambda\) and the world still looks like one film. Everything else is costume.

Sealed 2026-09-20 — Make Bolt Lane brief.
