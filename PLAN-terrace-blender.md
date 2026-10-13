# PLAN: Zone D terrace rebuild with the wall-proof method (blender_wall.py)

Status: proposal. Nothing is spent until SmiR says GO. Source of facts: steps/zone-d/01-terrace (terrace_block.py tiers,
REPORT.md, spine.json v1.3.1, placement), wall-proof v3/v4 measurements (/workspace/wall-proof-1013).

## 1. What the method is (proven on a 6 m piece, v3/v4)
Height from pixels: every surface is a grid whose depth comes from the plate's own pixels (column edges = dark minima,
chips = darker-than-column pixels at edges, tops = shadow-band transition), scaled to 1.0-1.3x the MoGe-2 read.
Hidden faces (jambs, lintel undersides, cornice undersides, tops) are separate geometry textured by translation from
real neighbouring pixels of the same plate (never stretched front pixels). No decimation on stone near the player.
Measured on the piece: stone 97-118 %, cornice 94-107 %, door 106 % (rule >= 70 %), 13.6k tris for 6 m.

## 2. The tool: tools/imagine-to-3d/blender_wall.py (manual fixes -> automatic tool)
Input: plate + MoGe depth + a small face spec (plate px box, metric frame, door boxes, cornice rows).
Steps inside: column/joint detection -> heightfield per zone (stone / cornice+snow / setback) -> hidden-face pieces with
translated UVs -> icicle cones from drip streaks (existing terrace_block logic, ported) -> Blender: weld, smooth-by-angle,
LOD1/LOD2 (silhouette parts kept, joint depth baked to normal maps) -> GLB + depthmeasure spec auto-written.
Self-tests (must exist before it is used):
- bad = FAIL: v3.5 flat facade piece; a facade with stretched jamb pixels; relief 4x MoGe (the v2 piece); decimated
  piece with visible facets; a grey/untextured face.
- good = PASS: v4 6 m piece (stone/cornice/door >= 70 %, outline >= 0.3 m, <= 15k).

## 3. Faces of the terrace (16 m wide, 3 tiers, 16 m deep)
| Piece | Seen from path | Plate today | px/m today | Sharp enough (150 px/m within 8 m)? |
|---|---|---|---|---|
| Tier-1 front, centre (door) | yes, up close | t1-right-v35 | 98 | no (98) |
| Tier-1 front, outer parts | yes | plate-front-v35 | 46 | no |
| Tier-1 cornice + snow + icicles | yes, up close | plate-front / t1-right | 46-98 | no |
| Tier-2 front + door + cornice | yes, 5-10 m up | plate-front-v35 | 46 | no (but farther than 8 m most of the time) |
| Tier-3 front + door + cornice | far, > 10 m | plate-front-v35 | 46 | acceptable at distance (to check) |
| Left side (3 tiers) | yes (path turns) | plate-side-v35 | ~46 | no |
| Right side | maybe (check spine) | none (side plate mirrored?) | - | unknown |
| Tops / snow terraces | from above only | top.jpg | low | probably fine |
| Back | never on path | front reused | - | fine |
Unknown: exact spine distance to each face; Level Designer must confirm which faces come within 8 m.

## 4. Steps in order (time = agent work, not wall clock with waits)
1. Write blender_wall.py from the proof scripts + self-tests (bad FAIL / good PASS). ~1.5-2 h. 0 credit.
2. Rebuild the whole terrace with the EXISTING plates (46-98 px/m). Shows the full shape with real relief. ~1 h. 0 credit.
3. depthmeasure on every face (spec auto-written) + oblique phone views at spine v1.3.1 cameras. ~30 min. 0 credit.
4. Art Director + SmiR look at step 3 on the phone. Decide if sharper plates are worth it. STOP POINT.
5. Only if yes: new Imagine plates for the faces within 8 m (see 5.), then re-run steps 2-3 with them. ~1-1.5 h.
6. Level Designer refits colliders (14 boxes + door planes) from the new mesh (script, 2 cm inset, 5 cm max). ~30 min.
7. Engine Core: LODs, meshopt pack, 0 px outline swap check at 15/40 m, sky fallbacks. ~45 min.
8. Play build on S20 FE: 50-60 fps with &bench=1, Playtester run, Art Director KEEP from the play build. ~30 min.
Total: about 6-8 h of agent work, in 3 stop points (after 1, after 4, after 8).

## 5. New Imagine images (only after stop point 4)
Faces that need 150 px/m within 8 m: tier-1 front (left part, centre door, right part), tier-1 cornice/icicle band,
left side tier 1, maybe tier-2 front. Each 1024 px plate covers ~6.8 m at 150 px/m.
- Tier-1 front 16 m: 3 plates. Cornice band: covered by the same 3 if framed to include it (else +2).
- Left side tier 1 (16 m): 3 plates. Tier-2 front close: 2 plates (optional).
- Retries: REPORT v3.2 shows 1 of 3 plates matched its standpoint -> plan 1 retry per plate.
Estimate: 6-8 plates needed, 12-16 generations with retries (8-10 without the optional tier-2/cornice ones).
Credit cost: UNKNOWN per image. I have no record of the credit % one Grok Build Imagine image costs. Measure it on the
first plate (read the usage before/after) and stop if one image costs more than expected.

## 6. Budgets (LOD0 90k, Engine Core split)
- Stones 30k (6 m proof = ~10k for stone alone -> 16 m tier-1 front alone would be ~27k: tiers 2-3 and sides MUST
  use coarser grids (they are farther). Risk: 30k is tight; check against learn/proposals/zone-d-perfbudget.v1.json.)
- Cornices/snow 20k, icicles 15k, doors 15k, reserve 10k. LOD1 30k, LOD2 8k; cornices/snow lips/icicles > 0.5 m stay
  geometry at every LOD, joint depth baked to normal maps.

## 7. Gates (all must pass before SmiR sees it)
- depthmeasure per feature per face: real >= 70 % of apparent (MoGe), and <= 130 % (nothing beyond the pixels).
- Grazing outline leaves the wall by >= 0.3 m where the plate shows relief.
- No stretched pixels on hidden faces (texel stretch <= 1.3), no grey/magenta, LOD outline 0 px at 15/40 m.
- Oblique phone check at spine v1.3.1 cameras (45 deg + grazing) on the S20 FE, 50-60 fps.
- Art Director KEEP from the play build (not from offline renders), then SmiR.

## 8. Honest unknowns / risks
- Credit per Imagine image unknown (see 5.).
- New plates may not match the old ones in colour/light (happened in v3.2); a colour gate is needed.
- Stone budget 30k is tight for 16 m x 3 tiers + sides at proof density.
- The proof was rendered with software WebGL, never on the phone yet.
- Right side face has no plate; may need one more image if the path sees it.
- depthmeasure cannot measure the v3.5 mesh (auto_frame), so old-vs-new numbers exist only for new pieces.
