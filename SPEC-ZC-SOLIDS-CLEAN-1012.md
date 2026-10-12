# Zone C solids clean — solid smooth hulls + real volumes + blocking triangle/untextured gates (12 Oct)

SmiR saw solids2 on phone (capture ~09:48): shredded triangle soup from noisy depth maps, textures flying everywhere, big untextured grey walls. The gate passed "sealed" and "hidden faces OK" anyway — it checks numbers, not what the phone sees. Same class of failure as the flat tower facades. New direction approved: stop polishing solids3 numeric fails; rebuild the 5 solids as solid, smooth, watertight shapes with real metric relief volumes, and add blocking visual gates.

Base / context: Zone C "Cascade Verdance". Bible: `/workspace/zc-bible-1011/PROMPT-GROK-BUILD-ZONE-C.md` (rules 1-9). Branch `zc/05-solids`. Camera #199 and masks #200 are in-tree. Terrain stays as kept (causeway from zc/03-terrain). solids2 result lives in `steps/zone-c/05-solids/` (preview may still serve it — do not edit). solids3 was killed mid-run; ignore `steps/zone-c/05-solids-v3/` if present.

**NEW outdir only:** write everything under `steps/zone-c/05-solids-clean/`. Do **not** modify `steps/zone-c/05-solids/` or `steps/zone-c/05-solids-v3/`. Do not resume solids3.

Max 2 attempts. Never write PASS if any blocking row fails. Stop at PASS or after 2 attempts with honest REPORT.md.

kit-gate: node tools/object-gate/cli.mjs --scene tools/object-gate/specs/zone-c/solids-scene.yaml --out steps/zone-c/05-solids-clean/object-gate
<!-- kit-gate-outdir: steps/zone-c/05-solids-clean -->

## Read first
GROK.md, docs/METHOD.md, learn/failures.md, learn/geometry.md,
tools/imagine-to-3d/README.md + auto.py (+ depth_relief / hard_surface siblings if present),
tools/object-gate/README.md + gate.mjs + selftest.mjs + profiles + specs/zone-c/,
steps/zone-c/01-camera/, steps/zone-c/02-masks/, steps/zone-c/03-terrain/REPORT.md,
steps/zone-c/05-solids/REPORT.md + numbers.json + kit-gate-result.json + object-gate/report.md + sheet-phone.jpg,
SPEC-ZC-SOLIDS2-1012.md, SPEC-ZC-SOLIDS3-1012.md (context only — do not continue it),
key `/workspace/zc-bible-1011/key-zc1.jpg`,
**all 11 validated plates** at `/workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/` (VALIDATED.md; SmiR accepted #6 and #8).

Also check whether the parallel **tower-volumes** step in `/workspace/grokcli/wt/tower-vision-1010` already landed `oblique-profile` in `tools/object-gate` on that worktree. If the check exists there (or lands mid-step), **reuse the same check name/API** here rather than inventing a parallel one. Keep all object-gate edits in **this** worktree's branch (`zc/05-solids`). Note in REPORT.md that a later merge with the tower branch may conflict on `tools/object-gate`.

Plates (reference by absolute path; do not regenerate, do not Imagine):
| # | File |
| --- | --- |
| 5 | plate-05-arch-left-inner.jpg |
| 6 | plate-06-arch-right-inner.jpg |
| 7 | plate-07-wall-left.jpg |
| 8 | plate-08-wall-right.jpg |
| 9 | plate-09-waterfall.jpg |
| 10 | plate-10-mist.jpg |
| 11 | plate-11-leaf.jpg |
| 12 | plate-12-fern.jpg |
| 13 | plate-13-causeway-underside.jpg |
| 14 | plate-14-gorge-closure.jpg |
| 15 | plate-15-planet.jpg |

## Why solids2 failed the phone (do not repeat)
- Noisy MoGe-2 depth was displaced onto the hull → shredded / sliver triangles ("triangle soup").
- UV / projection broke → textures flying off faces.
- Hidden / side faces never got a plate → flat grey fallback materials on screen.
- Gate checked watertight + hidden-face wiring, not render-space triangle quality or untextured screen area.

## Goal — solid, smooth, textured, with real volumes
The phone must see smooth rock/ruin forms with readable ledges and carved frames, every visible face textured, no grey walls, no shredded spikes. A clean low-noise hull with metric relief volumes under plate features — not a centimetre heightfield on a noisy depth map.

### A) Rebuild the 5 solids (tools/imagine-to-3d only — RUN and EXTEND; NO hand recipe)
Rebuild into `steps/zone-c/05-solids-clean/`:
1. left arch (mask-arch-left)
2. right arch (mask-arch-right)
3. left cliff (mask-cliff-left)
4. central gorge rock (mask-gorge-rock)
5. right cliff (mask-cliff-right)

Pipeline (extend `tools/imagine-to-3d` `auto.py` and siblings; no one-off script outside `tools/`):
1. **Base volume** from key-image silhouette / vision (#199 camera, #200 SAM2 masks): clean **low-noise hull**, remeshed, smoothed, **no spikes**. Prefer a watertight manifold hull derived from the mask silhouette + a denoised/regularized depth field — not raw per-pixel MoGe-2 displacement.
2. **MoGe-2 depth denoised and scaled to metres** (object-scale metric). Use depth for *placing and sizing* relief volumes, not for raw vertex soup.
3. **Real metric relief volumes** placed **exactly under their pixel features** in the 11 validated plates via **Grok vision + SAM2 masks**: ledges, overhangs, carved ruin frames, vegetation masses. Each volume snaps to its mask outline; report per-feature xy + protrusion metres in `work/features.json`. Prefer hard-surface / Boolean / extrusions over global centimetre displacement.
4. **Plates projected cleanly** onto those volumes (UV stretch **≤ 1.3** p95). **Every visible face textured** — no fallback grey material on any phone/orbit view. Key projection for key-visible faces from `key-zc1.jpg`; hidden faces use plates 5–15 (same plate→face intent as solids2 REPORT; fix wiring so grey never appears).
5. **Grounded 0.00 m** float on all 5 (solids2 had cliff-left 0.69 m and gorge-rock 2.63 m — fix; do not regress the others).
6. **LOD approach** with identical silhouette — **reuse tower fix4 approach-LOD method** (min IoU **≥ 0.91**, sameHull / continuous fade). Port/share the tool path; do not invent a one-off.
7. **Colour vs key** — improve ΔE (solids2 was 16.9); toneMapped:false / sRGB honesty as learned on the tower. Report before/after.
8. Zero new Imagine. Draw calls ≤ 12. Sealed / watertight (open 0, non-manifold 0) on all 5.

### B) NEW BLOCKING gate checks in tools/object-gate
Coordinate with the parallel **tower-volumes** step: if it already added **`oblique-profile`**, reuse that check name/API here (wire it for cliffs/arches too where a face can be viewed of-axis) and also require the two new checks below. Keep edits in this worktree.

#### (a) `triangle-quality` (blocking)
- Fail on shredded / sliver triangles: bad **aspect ratio**, **dihedral spikes**, **normal noise**, and **render-space fragment count** (phone views must not explode into thousands of tiny screen fragments from a noisy hull).
- Document concrete thresholds in the profile + REPORT (e.g. max aspect ratio, max dihedral outlier fraction, max normal angular variance, max screen fragments per object at 30 m / 720×1600).
- **Self-test** in `tools/object-gate/selftest.mjs` (or dedicated fixture): a **noisy depth-displaced mesh FAILS**; a **clean remeshed/smoothed hull PASSES**. Self-test must run and pass in this step.
- Wire into `tools/object-gate/specs/zone-c/solids-scene.yaml` (and/or per-object yamls / rock-ruin profile) so the kit-gate line exercises it for all 5 solids.

#### (b) `untextured-area` (blocking)
- Render phone views at **8 m**, **30 m**, **hero**, and **orbit**.
- **FAIL** if any visible screen area is flat grey / untextured or uses a fallback material (missing map, default MeshBasic/MeshStandard grey, checker absence, etc.).
- Document the pixel/fraction threshold (e.g. max untextured visible fraction ≤ a small %; zero large contiguous grey blobs).
- **Self-test**: a mesh with a missing-material face (or grey fallback) FAILS; a fully plated mesh PASSES.
- Wire into the same zone-c solids scene. Emit captures under `steps/zone-c/05-solids-clean/object-gate/untextured-*.png`.

Also keep / require existing bars that still make sense: sealed, float 0 m, UV ≤ 1.3, draw calls ≤ 12, relief from plate pixels, hidden-face plates wired (no PENDING that leaves grey on screen), approach LOD IoU ≥ 0.91, colour vs key reported. Visible px/m: honest; WARN only if native plate density is the hard limit (same pattern as tower).

### C) Bars
- object-gate on this outdir → **zero FAIL** (WARN allowed only for documented native-plate px/m).
- `triangle-quality` PASS on all 5.
- `untextured-area` PASS on all 5 at 8 m / 30 m / hero / orbit.
- If `oblique-profile` is available (from tower-volumes or added here): PASS on faces that can be viewed of-axis.
- Self-tests for triangle-quality + untextured-area (+ oblique-profile if touched) PASS.
- Max 2 attempts. Never PASS on a blocking fail. Never claim "sealed" as phone-OK when the mesh is shredded or grey on screen.

Real headless renders after the loading screen is gone. Phone sheet **sheet-phone.jpg** 720×1600 beside the key. Staging port **8772** (NOT 8780, 8996, 8771, 8994, 8997, 8981, 8982) — if something already holds 8772, use a free port and record it in REPORT; **do not kill** the preview serve on **:8780** or the cloudflared tunnel. Live index.html untouched. Do not edit `steps/zone-c/05-solids/` or the tower worktree.

## Deliver — steps/zone-c/05-solids-clean/  (MUST write even on failure)
- **REPORT.md** (honest PASS/FAIL; before/after vs 05-solids; why triangle soup / grey walls failed the phone; hull method; per-solid triangle-quality + untextured-area numbers; features.json metres; approach IoU; float; sealed; UV; ΔE; plate→face map; note possible merge conflict with tower-volumes on `tools/object-gate`; timings; cost = 0 new Imagine)
- **kit-gate-result.json** (+ .txt via Stop hook)
- **sheet-phone.jpg**, **oblique-sheet.jpg** (45° / grazing or orbit-of-axis views; required even on FAIL — produce from oblique-profile if present, else from honest of-axis phone captures of each solid)
- numbers.json, work/features.json, renders, object-gate/ (incl. triangle-quality + untextured captures), selftest proof log
- World Graph updates for the 5 solids into the clean outdir if needed; validate zone.v1
- Tool + learn/ updates (ALWAYS IMPROVE — document why noisy depth displacement + numeric-only gates failed the phone, and what triangle-quality / untextured-area catch). Local commits on `zc/05-solids` only. **Do NOT push, do NOT merge.** Do not touch the tower worktree, plates worktree, `steps/zone-c/05-solids/`, or the :8780 preview/tunnel.

---

## ADDENDUM — Zone B base-shape method (SmiR 2026-10-12 ~10:00 Paris) — READ AND OBEY

**Owner direction after phone review of solids2:** Zone B mesas/towers looked acceptable; Zone C solids2 was catastrophic (triangle soup + grey walls). Do **not** keep inventing a MoGe-2 depth-displaced hull for Zone C. Reuse the method that already worked for Zone B.

### Mandatory base pipeline (Zone B mesa path in this repo)
Reference (read before building):
- `tools/imagine-to-3d/README.md` — stages **hull.py → proj.py → blender_mesa.py** (Zone B sandstone mesas, 2026-10-09)
- `tools/imagine-to-3d/specs/zoneb-mesa.yaml` + `zoneb-mesa-build.yaml`
- `docs/METHOD.md` standing rules 1 + 8 (visible world = real solids; loft/hull is invisible carrier; every visible pixel = unlit Imagine plate)
- Proven outputs: `/workspace/mesa-1009/work/` (mesaA / mesaF fused hull) and `/workspace/zb-preview-1008/mesas/` (strata / hybrid runtime)

**Base shape for each of the 5 Zone C solids MUST be:**
1. A **clean, simple, authored/visual-hull** solid — same family as Zone B mesas: silhouette → terraced/smooth heightfield (or equivalent clean remeshed solidify), **voxel-remeshed / smoothed**, watertight, **no spikes**. Prefer the Zone B `hull.py` + `blender_mesa.py` (solidify → voxel remesh ~0.35 m class) path adapted to arches/cliffs/gorge-rock, or an equivalent clean authored hull from mask silhouette. **Ban raw per-pixel MoGe-2 displacement as the volume.**
2. **Imagine plates projected** onto that hull (key faces from `key-zc1.jpg`; hidden faces from the 11 validated plates) with UV stretch ≤ 1.3 — same projection honesty as Zone B `proj.py`.
3. **Image-derived volumes / relief ON TOP only** (ledges, frames, vegetation masses from plate features via vision+SAM2+denoised depth for *placement/sizing*): add them **only if** they pass the blocking `triangle-quality` and `untextured-area` checks (and `oblique-profile` when available). If a relief feature shreds the mesh or leaves grey, **drop that feature** and keep the clean plated hull — do not ship soup to make a numeric "relief present" row green.

### Still required (unchanged from body of this spec)
- Outdir `steps/zone-c/05-solids-clean/` only; grounded 0.00 m; LOD approach IoU ≥ 0.91; sealed; draw calls ≤ 12; zero new Imagine; blocking gates + self-tests; no push/merge; do not touch tower worktree or :8780 preview/tunnel.

### REPORT.md must state
- That the base hull followed the **Zone B mesa method** (cite hull/blender_mesa or the concrete tool path used).
- Which image-derived volumes were kept vs dropped because they failed triangle-quality / oblique / untextured checks.
