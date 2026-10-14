# Decisions log (owner-approved methods, newest last)

Back to [METHOD.md](../METHOD.md). Append-only: add a dated row in the same PR as the METHOD.md line. Do not rewrite a row;
a change is a new row that cites the old one. Times are Paris.

| Date | Decision | Status | Source |
|---|---|---|---|
| 2026-09-12 | Hall: Imagine Agent for STYLE stills only; films = Imagine Video first+last; smoke gates; soft KEEP banned. | APPROVED (hall) | PRs #2–#16, `AGENTS.md` |
| 2026-09-18 | Hang ≠ wipe; new biome = add beside masters; Bolt teacher `lock/bolt-back.jpg`. | APPROVED | PRs #62–#66 |
| 2026-09-20 | Bolt motion = REUSE sealed 6 s / 534-frame / 96 fps gallop; never invent a sprint. | APPROVED | PRs #77–#85 |
| 2026-09-26 | Imagine videos are the world; no Three.js/engine world; no mesh/noise generators; simplex places only; the player is Bolt. | APPROVED | PRs #114–#118 |
| 2026-09-28 | Cutout native scale: cook at or above on-screen pixels; never enlarge (law 56). | APPROVED | PR #121 |
| 2026-09-29 | Law 59 invisible depth carrier: Imagine plate on invisible per-pixel depth relief (+ light high-pass). Static solid decor = still Imagine image on depth relief; living elements = keyed seamless Imagine loops. | APPROVED | PR #122 |
| 2026-09-30 | Speed-tied scrolling Imagine ground video (owner KEEP) — now for fixed paths between zones. | APPROVED | `learn/taste.md`, doc 61/62, `biome/scripts/zone-flow` |
| 2026-10-01 | Law 59 extension: code may compute invisible ground shape; walkable ground = world-locked top-down Imagine tiles (≥ 4) on invisible relief; magnification ≤ 1.0. | APPROVED | PR #128, doc 61 |
| 2026-10-01 | Open world by zones; standard 3D object pipeline = 8 views every 45° → objsheet → walkaround hull; rendered-pixel validator. | APPROVED | PRs #127, #130–#134 |
| 2026-10-02 | Law 65 render quality (zero quality loss, no NEAREST, mipmaps). Law 66 tool feedback. | APPROVED | PRs #141, #143 |
| 2026-10-02 | Law 67 post-pass: only light fog (sampled), one light grade per biome, subtle capped bloom. Phone-cheap. | APPROVED | PR #144 |
| 2026-10-02 09:57 / 10:03 | 3 zones = 3 different biomes: A The Howling Eclipse, B Ember Mesa, C Cascade Verdance. | APPROVED | `owner-decisions.local.md`, `biome/kits/` |
| 2026-10-02 10:03 | No circles / rings: large natural organic zones ≥ 5× the old circle; distance-based fog/grade blend on paths. | APPROVED | `owner-decisions.local.md`, spec rails 5b, 10 |
| 2026-10-02 10:08 | Relief up to 3 m over ≥ 20 m, walkable slope ≤ 15°; taller cliffs = objects (Director, delegated). | APPROVED (docs PR pending for law 59 / doc 61) | spec rail 10 |
| 2026-10-02 | Golden rule "living painted film" + taste log + visual judge gate; self-learning kit; geometry lock (rail 12: level horizon 0.50, 8 sky slices × 60° at 45°). | APPROVED | PRs #146, #147, #149 |
| 2026-10-02 | Objects must be real 3D (invisible volume + Imagine views); sprite swap / object-class pack rejected. | APPROVED (method for hard objects still open) | `spec.md` rail 12, `learn/object-classes.md` |
| 2026-10-02 | Steps = one goal, ≤ 8 rows, `REPORT.md` as you go; stop after 2 failures of the same defect. | APPROVED | `spec.md`, PR #148 |
| 2026-10-02 10:53 / 10:56 | Momentum `m` / world awakening written but PARKED. Echo Shards PARKED. Narrative frame (Frontier Shards, decrees #031, #063, #064) PARKED. | PARKED | local spec §9–§12 |
| 2026-10-02 | Ship = lore / POI, not a vehicle; Bolt sprints through space powered by the Lightning Core. | APPROVED | owner, local spec §12 |
| 2026-10-02 | Sky = closed Imagine slice ring + living loop layers of different durations (13 / 17 / 29 s); fog colour from the sky horizon band. | APPROVED | PR #148, `tools/sky` |
| 2026-10-03 | Ground: several distinct Imagine materials by relief (never one plain dirt texture), per-pixel depth micro-relief from each tile, anti-carpet rules. | APPROVED | owner 2026-10-03 |
| 2026-10-03 | Hard objects: measured-section loft + offset plates + one unlit Imagine skin per part (frigate test). | IN TEST — pending validation | owner 2026-10-03 |
| 2026-10-03 | This sheet (`docs/METHOD.md`) is the single entry point; every new approved method is added here in the same PR. | APPROVED | PR #152 |
| 2026-10-03 10:00 | Biome **names** allowed in tracked repo files; palettes and Imagine prompts stay out (resolves contradiction 1; hard law rail 6 amended in repo docs 62 / 64 and local `hard-laws.inc`, spec rail 6, tool-loop rule 6). | APPROVED | SmiR 2026-10-03 |
| 2026-10-03 | Newer always wins: older laws/docs amended to METHOD.md (contradictions 2–6, 9–11); stop rule = 2 everywhere; sky = 8 × 60° slices; GPU tint only as the law 67 light grade. | APPROVED | follow-up docs PR |
| 2026-10-03 11:45 | Ground recipe written down: `docs/METHOD/ground.md` (generic, kit-driven; volume under the plates mandatory; templates T1–T4; zone A filled example; B/C material ideas; exact prompts in the local file). Owner approved the zone A step 1 ground look; relief fixes pending (7.66 m / 33° accepted for now, target ≤ 3 m per ≥ 20 m and ≤ 15°). One-command tool: issue #157. | APPROVED (look) — relief fixes pending | SmiR 2026-10-03, PR #156 |
| 2026-10-03 | Frigate (hard-object) method added **IN TEST**: recipe [`hard-objects.md`](hard-objects.md) (Howl frigate: reader, measured-section loft, parts, one unlit Imagine skin per part, 20 locked Imagine plates; gate `python3 tools/hard-objects/rebuild.py`). The loft is the volume; plates are not a normal-offset shell (corrects the wording of the 2026-10-03 hard-objects row, does not approve it). Six open QC issues listed in the recipe section 11. `.PROMPT.txt` files keep only colour-free templates; palettes / prompt wording stay in the untracked local prompts file. Skins sample per law 65. **Law 59 amendment (contradiction 12) waits until the fixes are validated by SmiR on the phone.** | IN TEST — pending validation | SmiR 2026-10-03, PR #158 |
| 2026-10-03 12:49 | Zone A step 2 sky built on the 2026-10-02 sky row: 8 chained slices pixel-joined into one ring (11488 px, mag 0.994), one Imagine zenith cap, three Imagine loops (13 / 16.7 / 29 s), fog sampled from the ring horizon. Recipe written: [`sky.md`](sky.md). Director QC found blockers (heading-0 seam, stretched low-res layers at high weight, smeared cap looking up, loop-restart flash, no readable eclipse glow), so it is not merged. | IN TEST — QC blockers | Director 2026-10-03, branch `zone-a-step2-sky` |
| 2026-10-03 | Sky video layers are GPU-instanced: one decode and one texture per layer, one instanced draw of tiles, per-instance placement, UV offset, and phase. Magnification of every sky texel, video tiles included, must be ≤ 1. A missing `display.videoTiles` block, or an 848×480 frame over 360°, fails `python3 tools/sky/check.py` and `tools/playcheck`. | IN TEST | SmiR 2026-10-03, zone A step 2b |
| 2026-10-03 | Sky light-layer parallax: stars nearest to still, painted slices far, nebula wisps and dust a little nearer, as a small yaw offset. No invisible relief for the sky. The ring stays centred on the eye. | IN TEST | SmiR approved 2026-10-03, zone A step 2b |
| 2026-10-03 | Camera: no shake, ever. The chase holds one legal pose with hysteresis and eases eye height off the raw relief sample. A per-frame rescore that snaps the eye is banned. Magnification stays ≤ 1. | IN TEST | SmiR 2026-10-03, zone A step 2c |
| 2026-10-03 | Sky motif gate: a slice fails when an interior window repeats, mirrors, copies the other half, or carries a hard interior seam. Opaque slices may be lossy-encoded. The horizon band is shown before the rest. A bright living shape is keyed from its own pixels onto one tile, not mixed as a full-dome veil. | IN TEST | zone A step 2c |

## Contradictions found (2026-10-03 sweep)

Older docs carry a one-line `Amended …` or `Superseded by docs/METHOD.md` header; nothing was deleted.
Status after the follow-up PR: **RESOLVED** = old text amended to the newer rule; **TRACKED** = doc note + tool-loop issue; **OPEN** = left for the owner.

1. **Biome names vs style-agnostic rail.** Local spec rail 6 / `hard-laws.inc` say no biome name in any tracked file, but
   `AGENTS.md`, `biome/kits/*.json` (PR #150) and now this sheet name them (owner asked for them here). Owner to confirm
   that names (not palettes / prompts) are allowed in tracked docs.
    Status: **RESOLVED** — SmiR 2026-10-03: names allowed in tracked files; palettes and Imagine prompts stay out. Note: `biome/kits/*.json` and `biome/kits/README.md` still carry palette words (PR #150); left for a separate owner call.
2. **Relief amplitude.** Law 59 extension + doc 61: relief "a few cm up to ~15–25 cm", tile edges at 0. Newer: 3 m over
   ≥ 20 m, slope ≤ 15° (2026-10-02) plus per-tile depth micro-relief (2026-10-03).
    Status: **RESOLVED** — law 59 extension + doc 61 now say 3 m / ≥ 20 m / ≤ 15° + per-tile depth relief.
3. **Rocks.** Law 59 extension + doc 61: rocks = upright Imagine cutouts, simplex + 90° rotation. Newer: rocks = 8-view
   carved hulls; cutouts only for small ground details.
    Status: **RESOLVED** — law 59 + doc 61: rocks are 8-view carved hulls; cutouts only for small ground details.
4. **Ground material.** Law 43: one tiled ground video + four sky videos, "do not replace this dirt". Newer: several
   Imagine materials by relief; closed slice sky + living layers.
    Status: **RESOLVED** — law 43 ground/sky rewritten to the current rule; old rig and shader earth colour marked history.
5. **Zone shape.** Docs 62 / 63: closed round edge ring around a clearing. Newer: organic zones, no rings (Director docs
   PR still pending).
    Status: **RESOLVED** — docs 62 / 63 describe organic no-ring zones; circle mode = retired test layout.
6. **Approach zoom.** Law 59: approach may zoom a plate up to ~1.3×. Law 65 / rail 3: magnification ≤ 1.0 everywhere.
    Status: **RESOLVED** — law 59 approach: magnification ≤ 1.0.
7. **Sampling.** `tools/walkaround/README.md` and `tools/mesh3d` said visible pixels are nearest samples / no mipmaps.
   Law 65: `LINEAR_MIPMAP_LINEAR` + mipmaps.
    Status: **RESOLVED** — play viewers sample stills with `LINEAR_MIPMAP_LINEAR` and mipmaps. CPU QC nearest stays a measurement buffer and does not feed the play view. Magnification limit stays 1.0. Issue [#153](https://github.com/StarBoltSprint/boltverse-odyssey/issues/153).
8. **TripoSR.** `tools/mesh3d` kept TripoSR as an invisible-shape engine; the Golden rule bans TripoSR-style generators.
    Status: **RESOLVED** — `auto` and the default engine are the visual hull. TripoSR runs only with `--experiment triposr`, and that mesh is not written into the play asset. Issue [#153](https://github.com/StarBoltSprint/boltverse-odyssey/issues/153).
9. **Cards and particles.** Laws 44 / 45 / 49 (cards + capsule, two-plane tree) and law 53 (GPU particles) vs 8-view
   objects and law 67 (no code-drawn particles; living elements = keyed Imagine loops). Law 38 lets the GPU own "tint" of
   light layers, which reads as a code colour.
    Status: **RESOLVED** — laws 44 / 45 / 49 / 53 marked SUPERSEDED (8-view objects, Imagine video living layers); law 38 tint only as the law 67 light grade.
10. **Stop rule.** Local spec §7 and the tool loop stop after 3 identical attempts; owner rule and repo `spec.md` say stop
    after 2.
    Status: **RESOLVED** — stop rule = 2 in local spec §7, tool-loop.md, tool-step template, step-01 and METHOD subpages.
11. **Sky slice count.** Rail 12 / kits: 8 slices × 60° HFOV; local spec §8 / doc 64 D estimate ~9–10 chained slices at
    hfov 22.7°.
    Status: **RESOLVED** — doc 64 D and local spec §8: 8 slices × 60° HFOV, per-slice width for magnification ≤ 1.0.
12. **Hard objects vs law 59 wording.** Law 59 is "the sole exception to the no-mesh law" and lists depth relief, terrain
    shape and walk-around hulls; lofted measured-section hulls are a new invisible carrier and need a law 59 amendment
    once the frigate test is validated. `GROK.md` still says raw WebGL mesh scenes are FAIL (true for visible meshes).
    Status: **OPEN** — waits for the frigate validation.
