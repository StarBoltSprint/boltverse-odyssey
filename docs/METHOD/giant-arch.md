# Giant arch — continuous shell + stacked pier bands

Back to [METHOD.md](../METHOD.md). Parent loft rules: [hard-objects.md](hard-objects.md). **Status: IN TEST (2026-10-08)** — Ember Mesa Anchor research (Grok chat 48f73a49…).

The arch failed as two columns and a mast because nothing owned the span. Treat it as **one shell**, stack plates so a 900 px Imagine frame is never stretched past **2.3 m**, and lock the tower to the photo instead of repeating a bay up to 60 m.

**Every plate uses the zone [light sheet](lighting-coherence.md)** (Ember Mesa line pasted unchanged). Studio key on black is FAIL.

## Scale lock (from the reference, not from tiled bays)

| Measure | Value |
|---|---|
| Arch footing → stone crown | **20 m** |
| Opening | ~**10 m** wide, **12 m** to the intrados (Bolt clears it) |
| Tower on the crown | **7.5 m** wide × **24 m** to the lantern |
| Tower bays | **4 unique** × 5 m + cap — **no vertical repeat** |
| Photo ratio | Tower above the stone is a little taller than the arch, about a third of the arch's outer width |

The lattice seen through the opening is the tower's **far legs behind the shell**, not a third piece of stone.

## 1. Height / pixel density

One 900 px plate stays **2.3 m** of world height (**391 px/m**). A pier is four stacked bands, not one plate scaled up:

| Band | World Y | Plate |
|---|---|---|
| L0 / R0 | 0–5.0 m | footing, 0.4 m overlap with L1 |
| L1 / R1 | 4.6–9.6 m | pier shaft |
| L2 / R2 | 9.2–14.2 m | springing, overlaps the crown plate 1.5 m |
| Crown | 12.5–20 m | **one plate, 12 m wide, owns the whole saddle** |

Four bands × 2.3 m gets the pier to 20 m without stretching. Pack all eight pier bands plus the crown into one **4096** atlas (a 900 px plate tiles 4×4 with padding). One material, one draw call. Outer flanks can be the same atlas at half density; the path-facing skin stays 1:1. Overlap at ≤ **391 px/m**.

## 2. One arch (continuous inverted-U)

- Support mesh = **single extruded inverted-U** (~12 segments, ~3 m thick), **not two boxes**.
- Pier plates stop at the springing line and **never try to meet**.
- **Crown plate** is generated as one sandstone mass with **both haunches in frame**; those haunch rocks are the overlap copied onto L2/R2.
- The seam is the **same pixels twice**, feathered **64 px** in the atlas, not a gap with a mast in it.
- Intrados = second UV island on the same atlas (worm's-eye of the ceiling) so the run-under is stone.
- Underside / belly plate required so looking up is stone, not void.

## 3. Tower width — no V-repeat

- Four **unique** bay plates, each framed at the full **7.5 m** width, aspect **7.5:5**.
- Mesh width comes from that aspect × 5 m bay height, so it cannot be scaled into a stick without cropping the plate.
- Cap and lantern are the top plate.
- **Cable** = ribbon on a curve with one braid plate, fray in the alpha — not a camera-facing card.
- Base plate includes a 0.4 m stone lip; crown plate includes the tower footprint stain.

## 4. Draw budget

| Item | Budget |
|---|---|
| Draw calls | arch + tower + cable ≈ **3** |
| Atlases | one 4096 arch, one 2048 tower |
| Cap | well under 10 calls and 250 MB even uncompressed |

Bible line on every plate (plus the zone light sheet): orthographic front, sandstone / rust materials as in the cook, background keyed/black only if bleed+premul will remove the fringe ([lighting-coherence](lighting-coherence.md) §1).

## FAIL

- Two separate pier boxes with a mast or thin stem between them.
- One plate scaled past 2.3 m / below 391 px/m.
- Tower bay V-repeated into a stick.
- Cable as a billboard card.
- Plates without the zone light sheet.
- Arch opening blocked (colliders follow faces — [ruins §7](ruins.md#7-colliders--no-invisible-walls-owner-decision-2026-10-04)).

## Done-when (with lighting checklist)

1. Continuous inverted-U mesh; crown plate owns the span; shoulders double as pier-band overlap.
2. Pier bands ~5 m with overlap; density ≤ 391 px/m stretch.
3. Underside plate present; tower 7.5×24 m, 4 unique bays.
4. Cable ribbon; ~3 draw calls.
5. [Lighting coherence checklist](lighting-coherence.md#grok-build-checklist--object-not-done-until-all-pass) all green.
