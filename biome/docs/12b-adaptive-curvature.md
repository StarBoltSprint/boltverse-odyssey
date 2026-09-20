# 12b — Adaptive curvature resample (cook-time)

Kitchen sibling of [12-lane-path-ribbon.md](12-lane-path-ribbon.md).  
**Not** a new play law. **Not** SprintCore / Nebula / FIR.

12 already locks: centripetal (or mask Bézier) to **draw**, arc-length \(\ell\) to **clock**, ribbon \(P(s,\lambda)\) to **steer**.  
This page only says **where** the shipped table sits before you write \(s=\ell/L\).

**Purpose:** honest \(N(s)\) and tap hit-tests in a bend.  
**Not** making the clock prettier. Clock still comes from accumulated chord length. Adaptation only places fine samples, then you downsample to shipped \(N\) (48–64).

Hang ≠ wipe: never delete `biome/master/*`. Docs / sidecar only.

---

## One line

Adapt samples where the road **turns**, not where the author clicked. Straights cheap. Hairpins dense.

Ribbon map makes the plate steerable. Adaptive stops the map going **blind** in a bend.

| Who | Job |
|---|---|
| Centripetal / Bézier | Draw \(C(t)\) |
| Arc-length \(\ell\) | Clock. Play \(s=\ell/L\). Never raw author \(t\). |
| Curvature keeps | Place the table (this page) |
| Ribbon \(P(s,\lambda)\) | Steer. [12](12-lane-path-ribbon.md) |

---

## Do not sample \(\propto\kappa\) raw

Raw \(\kappa\) dumps every point into a kink and starves the long straight. Then \(N(s)\) flips or the tap miss-tests a 40 m board.

Bound **turning per step**, plus a **max chord** so straights still get points.

| Bound | Typical | Meaning |
|---|---|---|
| \(\Delta\theta_{\max}\) | \(\sim 6^\circ\)–\(12^\circ\) | Max turn between consecutive shipped tangents. Same job as \(\int\kappa\,ds\) on a segment. |
| \(\ell_{\max}\) | plate-UV chord, e.g. \(0.04\)–\(0.08\) | Long straight still gets a sample. |
| \(\ell_{\min}\) | smaller than \(\ell_{\max}\) | Do not cluster on a pixel kink. |

Discrete turn on the fine polyline (2D plate UV, same as 12 — no 3D Frenet):

\[
\theta_i=\arccos\!\big(\mathrm{clamp}(T_{i-1}\cdot T_i,-1,1)\big)
\qquad
T_i=\mathrm{normalize}(C_{i+1}-C_i)
\]

A keep fires when the running sum \(\Sigma\theta\ge\theta_{\max}\) **or** the running chord \(\ell\ge\ell_{\max}\). Reset both after a keep.

Do **not**: sample \(\propto\kappa\), sample at click knots only, or emit equal-\(\ell\) as the *placement* (equal-\(\ell\) is the *clock label* after placement).

---

## Cook procedure (four passes)

Work on empty-road plate A after A KEEP (or once the road is readable). Units = plate UV \([0,1]^2\).

### Pass 1 — fine candidates + discrete turn

1. Evaluate the author spline (centripetal \(\alpha=1/2\) or mask Bézier) on a **fine** grid. \(\sim 16\) samples/span is the floor; denser on already-tight spans is OK.  
2. At each candidate: position \(C\), half-width \(w\), discrete \(T\), \(\theta_i\).  
3. Keep this grid in the kitchen. Do not ship it.

### Pass 2 — keep on tripwires

Walk the fine grid. **Keep** a candidate when any tripwire fires:

| Tripwire | Why |
|---|---|
| \(\Sigma\theta\ge\theta_{\max}\) | Hairpin / bend — \(N(s)\) would go blind |
| \(\ell\ge\ell_{\max}\) | Long straight still has a chord |
| \(w\) change above a small ε | Ribbon width step (lane pinch) |
| Choice window \(s\) from 12 | Tap hit-test needs a nearby sample |
| Span endpoints | Author span start / end |

Always keep first and last. Reset \(\Sigma\theta\) and running \(\ell\) after each keep.

### Pass 3 — cap / fill to shipped \(N\)

Target **\(N=48\)–\(64\)** (12’s band is 32–64; adaptive ships the upper half so bends still have room).

- Too many keeps → thin (see RDP below).  
- Too few → fill longest remaining chords first (still \(\ell_{\max}\), not \(\propto\kappa\)).  
- **FAIL** if you need \(N>64\) to pass asserts. Fix the **draw**, do not crank \(N\) to 256.

### Pass 4 — re-accumulate \(\ell\), write \(s=\ell/L\)

On the **kept** polyline only:

1. \(L=\sum\|C_{i+1}-C_i\|\).  
2. \(s_i=\ell_i/L\). First \(s=0\), last \(s=1\).  
3. Recompute \(T,N\) with 12’s flip-guard: \(T=\mathrm{normalize}(C_{i+1}-C_{i-1})\), \(N=(-T_y,T_x)\), `if N·N_prev < 0: N = -N`.  
4. Write sidecar `C`, `w`, `N` (or derive \(N\) at play), `windows`. Drop the fine grid.

Play still sees only \((s,\lambda)\). Adaptation is gone once the table is written.

---

## RDP (tiny post-thin only)

Ramer–Douglas–Peucker may **thin** Pass-2 keeps that sit on a dead-straight board.

- ε = a **tiny** plate-UV slack (kitchen, not a play knob).  
- Never the **only** resample. RDP-from-clicks ignores \(\Delta\theta\) and starves hairpins.  
- Never delete a choice-window keep, a span endpoint, or a keep that exists only to cap \(\Delta\theta\).

---

## Time-varying \(C(s,t)\)

Most locked-cam Lane plates: **one static spline** (12). If the road moves in frame and you ship `path.keys`:

1. Adapt **per keyframe** (Pass 1–2 on that \(C(\,\cdot\,,t_k)\)).  
2. **Union** the keep \(s\) values (same arc-length clock after each key’s own \(\ell\), then align — or accumulate on a shared reference key and warp).  
3. Ship **one shared \(s\)-grid** + one polyline per key. Play lerps \(C,w,N\) in \(t\), still \((s,\lambda)\) in space.  
4. Do not ship a different \(N\) per key. Do not let a dissolve flip `hand`.

If union \(N\) would exceed 64 → the road is thrashing. Recook quieter or fewer keys. Do not crank \(N\).

---

## Cook asserts (kitchen, not play)

If any assert fires → **fix the draw** (simpler centerline, readable road, 12 cook gate). Do **not** crank \(N\) to 256.

| Assert | Fail means |
|---|---|
| Max shipped chord \(\le\ell_{\max}\) | Straight went blind — tap / glow has a hole |
| Max adjacent \(\Delta\theta\le\theta_{\max}\) | Bend too sharp for the table — \(N(s)\) lies |
| \(N\) flip-guard never trips twice in a row | Figure-8 / reversal in the draw |
| Each `windows[].s` has a keep within a small \(\Delta s\) | Choice beat cannot hit-test |
| Re-accumulated \(L\) matches the fine-grid \(L\) within \(\sim 1\%\) | Keeps skipped a loop / shortcut |
| \(48\le N\le 64\) (static plate) | Over-fit or starved |
| First \(s=0\), last \(s=1\), `hand` set | Sidecar incomplete |

---

## FAIL (this page)

- Sample \(\propto\kappa\) raw  
- Equal-\(\ell\) placement sold as “adaptive” (equal-\(\ell\) is the clock **label**, not the keep rule)  
- RDP as the only resample  
- Click knots only (author \(t\))  
- Crank \(N\) to 256 to silence an assert  
- Play-time curvature solver / FIR / Remez / physics-on-spline  
- Changing 12’s ribbon map or using holdout to steer  

---

## Tie-back

Centripetal to draw. Arc-length to clock. Curvature keeps to place the table.  
Ribbon map makes it steerable. Adaptive stops the map going blind in a bend.

Sealed 2026-09-20 — cook-time adaptive curvature (sibling of 12).
