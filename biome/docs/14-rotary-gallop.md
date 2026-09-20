# 14 — Rotary gallop + turn on the ribbon

HARD LOCK for Bolt’s cutout loop on a living-film Lane.  
Companion: `10-bolt-cutout-law.md` (**REUSE** sealed cycle → key → composite), `12` / `12b` (path table), `13` / `13b` / `13c` (make, anti-sticker, green/despill).

**One line:** Bolt is a **lumbar spring** — rear pack, closed flight, front pack, open flight — locked to plate time. Turns live in ribbon curvature; the dog only adds lead, a tiny lean, and a hind offset.

**PRIORITY 0 — Bolt sprint for new biomes = REUSE, not invent.**
A fresh Grok in a new Build convo must **NOT** cook a new Bolt gallop from scratch (no new Imagine dog sprint). Pipeline is:
1. Empty road plate only (Video A) — biome décor, no dog.
2. Take sealed [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4) as the Bolt motion asset (already rear / green / rotary).
3. Key + despill cutout from that cycle.
4. Composite cutout onto the scrolling empty plate (AFF stack). Speed/scroll = plate; gait = locked cycle.

**FAIL** if Grok invents a new Bolt sprint clip for a biome cook. Only SmiR can authorize a new cycle cook to replace the lock.
Style teacher [`lock/bolt-back.jpg`](../../lock/bolt-back.jpg) still applies if any still / repose is needed; motion teacher = the sealed cycle mp4.
Loop seam = **hard cut** on the closed period — do **NOT** optical-flow morph last→first. Preview only: [`lock/bolt-gallop-cycle-12s-preview.mp4`](../../lock/bolt-gallop-cycle-12s-preview.mp4). Hang ≠ wipe.

**KEEP 96 fps (SmiR 2026-09-20):** the sealed cycle is densified from the 24fps hard-cut — same duration/cadence, more fluid. Empty-road plates stay **48 fps**. Bolt teacher at 96 is OK (more dog frames). Do not recook 24 / 48 / 240.

## Not “more frames”

A real sprint is **dog mechanics** on plate time, not a GIF swimming over the road. More inbetweens without the stretched suspension = a disguised trot = sticker. Densifying the **sealed** cycle to 96 fps (KEEP) is not that fail — cadence stays; do not invent new inbetweens from Imagine.

German Shepherd (and most dogs) at speed use a **rotary gallop** (opposite laterality front vs rear). Transverse gallop (same lead both ends) reads horse / jog. Lane Bolt = **rotary**.

---

## A. Rotary cycle (what you animate)

Typical order after front flight:

1. **Trailing hind** plants (first touch, slightly rearward)  
2. **Leading hind** plants (further forward) — main **horizontal push**  
3. Hind lift → **gathered suspension** (flexed back, legs under belly)  
4. **Trailing fore** plants — higher vertical peak, shorter contact  
5. **Leading fore** plants — longer contact, aims / steers  
6. Fore lift → **stretched suspension** (extended spine, all feet airborne, ears back)  

Hind leading/trailing are on the **opposite** side from fore leading/trailing. Else it is not rotary.

Two flights per stride. No stretched flight → canter. No gathered flight → rabbit half-bound. Both flights make “dog that means it.”

### Phase table (loop driver)

```text
phase 0.00  trailing hind
phase 0.12  leading hind
phase 0.22  GATHERED FLIGHT     contact shadow k ≈ 0.15
phase 0.40  trailing fore
phase 0.55  leading fore          longer front contact
phase 0.70  STRETCHED FLIGHT    contact shadow k ≈ 0.15
phase 0.88  return toward hind
```

Two contact-shadow peaks, not a permanent puddle. Pivot at the **paws**.

### Who pushes, who steers

| Foot | Job |
|---|---|
| Trailing fore | Stronger vertical peak, shorter contact |
| Leading fore | Longer contact — plants and aims |
| Trailing hind | Longer contact, lower peak |
| Leading hind | More **horizontal acceleration** — the motor |

Front ≈ weight + brake / aim. Rear ≈ push. Trunk **closes then opens** the stride. Flat back for 8 frames = toy.

### Cadence

Sprint: ~**3.5–4.5 strides / s**. Clock:

```text
phase = (plate_time * strides_per_sec) % 1
```

**\(m\) does not speed the loop.** Higher \(m\) = slightly longer stride along \(s\) (supports slide farther on the ribbon). Speeding the cycle = cartoon.

### Aggressive read (mechanical, not teeth)

- Head low, eyes on the road  
- Ears pinned  
- Withers **rise** on front support (shoulder hit) and drop in stretched flight — without withers bob, even correct feet read as GIF  
- Tail in the body axis, not a flag  
- Gathered: front and rear clearly cross under the belly  
- Optional 1–2 Hz breath / ear micro-loop on top of the gallop  

Mute the HUD: if you do not feel a **shoulder hit** every quarter cycle, add amplitude + stretched pose — do not add frame count.

### How to make the loop

| Source | Note |
|---|---|
| **Sealed cycle** | **Required. REUSE.** [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4). Key + despill + composite. Hard-cut closed period. |
| 3D / live / 2D | **SmiR only** — to replace the lock. A fresh Grok must not cook a new stride. |

Do **not** let Imagine invent the gallop **inside** the road plate **or** as a new green sprint. Pretty for one second, then no control. **FAIL** if Grok invents a new Bolt sprint clip. Only SmiR can reseal the cycle.

### FAIL (gallop)

- Show-ring trot (long back, zero suspension) as sprint  
- Bound (both fores together, both hinds together)  
- 12 soft frames, no big stretch  
- Accel loop with \(m\)  
- Head to camera + ears up = mascot  
- Constant contact shadow  
- Chest-anchored sprite
- Inventing a new Bolt sprint clip for a biome cook (only SmiR may reseal [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4))
- Optical-flow / morph last→first (seam must be a **hard cut** on the closed period)

---

## B. Turn on the ribbon (not a kart lean)

A dog turn is **lead change + trunk bend + supports that no longer share the same \(\lambda\)**. One L/R tap in a window — not a joystick.

### Body

In a left turn (inside = left), typical:

1. Leading fore becomes the **inside** one (plants farther, longer — aims)  
2. Hinds keep the **opposite** lead (rotary)  
3. Trunk curves: lateral flex + a little roll  
4. Head stays on the chord, lower  
5. Tail follows trunk axis — not cartoon counterweight  

Turn radius comes mostly from **where feet land**, not a 45° lean. Moto lean is wrong except extreme track speed.

### Forces (same jobs, biased)

| Foot | In the turn |
|---|---|
| Inside fore (often lead) | More ground time, aims, shares centripetal |
| Outside fore | Vertical spike — “stake” |
| Inside hind | Push onto new tangent |
| Outside hind | More accel, slightly wider than front |

Centripetal \(mv^2/R\) is paid by supports, mostly front. Lean the PNG without offsetting paws = sticker on a slant.

### Ribbon math

Curve is already \(C(s)\) and \(\kappa(s)\approx\|C''\|\). Local \(R\approx 1/\kappa\).

Visual lean (small):

\[
\phi \approx \mathrm{clamp}(\lambda\cdot\kappa\cdot k_\phi,\; -\phi_{\max},\;\phi_{\max})
\]

\(\phi_{\max}\) ≈ **6–12°**, not 30°. Most of the turn is in \(C\), not \(\phi\).

Paws:

```text
λ_fore = λ_body
λ_hind = λ_body + δ_rotary * sign(lead)   // δ ≈ 0.05–0.12 of half-width
```

Hind does not stamp in the fore tracks (rotary).

### Player rights

One plate = **one** \(\lambda\) change in a window.

- Window \(s\approx 0.12\) or \(0.72\): tap the side **lit in the picture**  
- \(\lambda\) eases to \(-1/0/+1\) over ~8–12 frames  
- Rotary lead may flip **once** with that tap (inside = chosen side)  
- No free yaw — \(T\) stays path tangent  

Late tap → \(\lambda\) stays, glow dies — readable miss. Do not invent drift to save it.

### Stability / cook gate

If \(R \lesssim 2w / \tan\phi_{\max}\), feet leave the ribbon (\(|\lambda|>1\)) — recook a wider hook or it is a holdout, not a Lane.

Cap \(m\)’s push on \(s\) in the ~8% of \(s\) around choice windows so the window is not skipped.

### Short recipe

```text
φ     = clamp(λ * κ * kφ)          // tiny
yaw   = atan2(T)
pos   = C + λ w N                  // body
pawsF = C + λ w N
pawsH = C + (λ + δ) w N
shadow under paws, k from gallop phase
lead  = sign(λ) once tap commits
```

**One sentence:** the turn is in the ribbon’s curvature; the dog only adds a lead, a tiny lean, and a hind offset. Everything else is a kart glued on the film.

---

## C. Plate time owns everything

```text
phase = (plate_time * strides_per_sec) % 1
s    += ds_plate + k_m * m          // m = stride length, not FPS
λ    += ease(λ_target)
pos   = ribbonPoint(table, s, λ)
```

Gallop sheet V = plate time. Ribbon \(s\) only **places**. Contact \(k\) from phase. Shared grain after comp (`13b`).

## Pointers

- Cutout / style teacher / B→green→key: `10`, `13`, `13c`
- Motion teacher / sealed cycle: [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4) · [`lock/README.md`](../../lock/README.md)
- Path / inverse tap: `12`, `12b`, `curvature-sample` (`invertRibbon`)  
- Anti-sticker contact: `13b`  

Sealed 2026-09-20 — rotary gallop + ribbon turn for Lane Bolt. Motion cycle sealed the same day: `lock/bolt-gallop-cycle.mp4`.
