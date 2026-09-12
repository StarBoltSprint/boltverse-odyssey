# STILL-PAIR — lock gate before Hang

Before Hang, two stills `I_a = stillEnd(A)` and `I_b = stillStart(B)` must match the **lock**, not "same artwork". Paint (ivy, ember) may drift a little. Rig / size / yaw / place may not.

`matchPose(a,b,edge) → { ok, why[] }` in [scripts/still-pair.mjs](scripts/still-pair.mjs). Wired into [SMOKE.md](SMOKE.md) layer B.

One far signal = illegal edge. Recook. Do not Hang.

## 4 signals

| Signal | = |
|---|---|
| **Rig** | doors / horizon / pillar X stable (hall SSIM, upper ~55%) |
| **Size** | `bboxH / H` of the white-dog mask |
| **Yaw** | back vs profile vs ¾ (PCA axis of the mask) |
| **Place** | paws / centroid XY in 9:16 |

## Pipeline (cheap → network last)

0. Survey from lock stills (doors, pawsY). v1 compares A vs B; lock family = spawn still of the pack.
1. **Hall SSIM** — upper ~55% (doors+ribs), light blur. High + dog change = OK walk. Low hall = new cam/room → FAIL except `enter`.
2. **Dog mask** — white lower-third. bbox (size+place), centroid, **PCA yaw** (back ≈ vertical; profile ≈ horizontal).
3. **NCC back-thumb** — withers→paws crop slid on lower ~45%. Peak = where / score = is it the back-GSD. 2 far peaks → `gate.clone`.
4. **Withers hist** — high luma / low sat = white fur; near-black = void/cape.
5. Network (layer C) only if dispute. Never SMPL / rotate-profile-into-back.

Start thresholds:

```
|Δ(h/H)| < 0.08          // walk: < 0.12
|Δaxis|  < ~32°
|Δcx/W|  < 0.08        // walk-A: drift LEFT OK
```

Breath→breath = tight. Walk-spawn-A = Δcx toward the door + slight Δh OK.

## Tolerances by edge

| Edge | Hall | Size | Yaw | Place |
|---|---|---|---|---|
| breath loop / breath→walk same | high | tight | tight | tight |
| walk→breath dest | high | grow OK | back | destward OK |
| enter | **low OK** | similar | back | reset spawn |

Video frame vs jpeg still: hall SSIM is noisy (encode). **Yaw / size / NCC still FAIL.** Hall-only on that pair = WARN (`warnHall`), recook if you can.


## Absolute size bands

Measure = `bboxH / frameH` of the cream-dog blob. Same lens on every plate.

| Pose | `h = bboxH/H` | `cx = dogMask.cx / W` |
|---|---|---|
| Spawn / mid-hall | **0.22 – 0.32** (0.19 tiny = FAIL) | **0.42 – 0.58** (center + fork) |
| Door sill atA | **0.35 – 0.40** aim; FAIL &lt; 0.28 or &gt; 0.45 | **≤ 0.38** (teal LEFT; gold still visible) |
| Door sill atB | same height band | **≥ 0.62** (gold RIGHT; teal still visible) |
| Forbidden | **≥ 0.55** punch-in · sit (mask aspect &lt; 2.2, loaf-turn, or sill cream w/h &gt; 0.82) · still yaw &gt; 28° · `identity.face` (dark muzzle) · sill top &lt; 0.46 · sill still with spawn-cx |

Deltas: breath \|Δh\|/H < 0.08. Walk edge / spawn↔sill stills **&lt; 0.12** (grow spawn-band → sill-band OK). stillEnd ↔ next stillStart = same size. No mid-hall still — recook the sill closer.

Punch-in = FAIL. Sill still at spawn-scale (0.28–0.34) = WARN `gate.size sill-band` (hung moss is here; new cooks aim 0.34–0.38). Sit / 3/4 = FAIL on the still itself. Face = layer C. Mid-hall / spawn-cx on a sill still = FAIL `gate.place` (do not Hang a grown spawn as at-A/at-B).

Cook: feet on the **hall floor in front of** the rift, not inside the fill. Official sill teachers = hung moss PASS `packs/moss/stills/at-*.jpg` and `lock/sill-at-*` (same pixels). They teach seuil: standing BACK, cx left/right, taille ~0.30–0.33. moss at-B is RECT; moss at-A still oval — RECT from spawn. `lock/example-at-*` are anti-teachers (oval + ~0.18 + sit) — **never send**. `gate.place` PASS on those files does **not** clear sit/yaw/size. `bolt-back` is coat-only (~0.53 close-up — do not copy). atA/atB `image` = the spawn still. Do not relax these numbers to pass a climb.

## Anti

Optical flow "he turned = OK". Face landmarks. Match per-frame at play. 3D pose for sit/stand. Warp at runtime.

## One line

SSIM the hall, PCA/NCC the back — not a skeleton. Tight on breath, place looser on walk. If it has to turn to fit, **FAIL**.
