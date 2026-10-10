# Failure log — imagine-to-3d
Append-only.

### 2026-10-09 — hull from min() of view profiles gave a pyramid, IoU 0.40
| | |
| --- | --- |
| Take | mesaA v1 |
| Defect | terrace(d) from the top plate's distance field + min of front/side profiles: pointed cap, IoU 0.40/0.40/0.39 |
| Root cause | top plate footprint had a bite; distance-to-edge drove heights below the silhouettes |
| Fix | per-height superellipse from the x/z spans of the plates, top plate only as a shrink-only outline wobble |
| Guard | hull.py iou_views: >= 0.9 per view (now .94/.94/.98) |

### 2026-10-09 — 5-axis triplanar: stretch 875, 40 % of the area over 1.3
| | |
| --- | --- |
| Defect | round mesa: faces at 45 deg yaw / slope get 1.41+ stretch, down-facing faces infinite |
| Fix | 18 projection directions (proj.py) + span wrap; max 1.22 |
| Guard | qc.py stretch.max <= 1.3 per LOD; gate row "UV stretch" |

### 2026-10-09 — Imagine ignored "make it four times wider"
| | |
| --- | --- |
| Defect | front-wide.jpg (slot 6/6) came back as the same compact butte |
| Root cause | image_edit with our own front plate as source 1 copies it; the size ask loses to the source |
| Fix | none (budget spent); key's broad massif approximated by two overlapping placements (L-mid + L-mid2) |
| Next | ask for the wide view from the KEY crop only, not from the front plate |

### 2026-10-09 — scree faces decimated into spikes ("crumpled paper") up close
| | |
| --- | --- |
| Fix | oblique faces get half the relief amplitude, displacement smoothed over 2 vertex rings, split normals 62 deg |

### 2026-10-09 — mesas 1.5-2x brighter than the key (mesa/sand 1.47 vs 0.71)
| | |
| --- | --- |
| Root cause | full ground fog + haze + 0.42 ambient on a backlit face |
| Fix | albedo gain .7, ambient .03, fog .12 / haze .2 near, ramping to .9 past 550 m (mesa-tune.mjs sweep) -> ~0.95 |

### 2026-10-09 — a comment ate ");" in mesas.mjs, the guarded import failed silently (warning only)
| | |
| --- | --- |
| Guard | `node --check mesas.mjs` + console-check.mjs before any bump |

### 2026-10-09 — gate: mesa collision row false FAIL
| | |
| --- | --- |
| Root cause | 600 ms wait; SwiftShader renders ~0.3 fps, no frame ran |
| Fix | wait until the walker moves (max 15 s); mesa-collide-check.mjs shows it pushed 50 m out to the rock edge |

### 2026-10-09 — OPEN: native Imagine px/m 5-11 (< 64), LOD pop 22 px
| | |
| --- | --- |
| Defect | one 1280 px plate spans a 107-235 m mesa; LOD0->LOD1 p99 deviation 1.5 m (relief + sharp ledges) |
| Fix (next) | band plates: split each view into 4-6 horizontal strata bands, Imagine-edit each at full res (needs ~12-18 images); LOD: dithered cross-fade band or denser LOD1 (30k) + morph targets |
| Guard | gate rows "native Imagine px/m (no detail)" and "approach morph" — the tool refuses to export |

## 2026-10-09 17:16 - edited the LIVE module in place (mesas.mjs v8 -> unfinished v9)
- What happened: I rewrote zb-preview-1008/mesas/mesas.mjs in place while building v9. The live page (index.html v52) imports
  mesas.mjs?v=8, and the server serves the current file, so SmiR saw the unfinished v9 (broken stacked orange-edged plates)
  on the public link. The parent restored the live file from zb-preview-1008-tools/mesas.v8.mjs.
- Rule: never edit live preview files in place. Work in a staging copy (mesas/mesas-v9.mjs, loaded only by
  mesatest.html / main-mesatest.mjs). Swap the live file only after the gate PASSES and close/low/far phone captures are checked, then bump ?v=.
- Guard: imagine-to-3d/runtime/build.py assembles the staging module and refuses to write a path ending in /mesas.mjs.

## 2026-10-09 evening - v2 strata mesas (staging)
- Pagoda of thin plates + spikes: one level set per stratum on a dome hull steps every layer; noisy masks made radial spikes. Fix: 3 steep tiers, cleaned masks (largest component, fill, opening, median 9).
- Wall winding was inward (5408 in / 890 out), so back faces showed and the walls read as a soft dome. Fix: quad order; strata.py now reports wallOut/blockOut.
- Repetition rule over-strict at first (same plate within 7 m counted even with no shared pixels). Final rule: no shared plate pixels within 7 m, no same pixels (>50 % overlap, same flip) within 30 m. Re-seeding auto-fix.
- Depth relief pushed px/m under 64 (stretch 1.28). Fix: gradient limit 0.7 (stretch <= 1.22). "Spikes" metric flagged real creases. Fix: median-residual spike test.
- Far LOD merged coincident stacked layers -> non-manifold edges. Fix: one prism per tier on LOD2; degenerate tris dropped.
- Collider from a radial offset of the raw foot ring self-intersected at fracture steps, so the walker ended inside the rock. Fix: star-shaped radial envelope.
- Gate page crashed ("Target crashed") with every LOD0 relief mesh resident. Fix: LOD0 built lazily near the camera and freed far away.
- The object-gate's "unique px/m" (a reused plate counts once) can't reach 64 px/m on ~25k m2 mesa walls with any feasible Imagine budget. Decision needed (see report).
