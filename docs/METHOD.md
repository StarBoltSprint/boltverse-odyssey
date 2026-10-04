# The Odyssey Method — read before any step

**One sheet, the approved way to build each element.** Owner: SmiR. If an older doc says otherwise, this sheet wins for the
open-zone game. The citadel boot / Welcome laws in [`AGENTS.md`](../AGENTS.md) and [`GROK.md`](../GROK.md) are unchanged.
Hard laws that stay in force beside it: the Bolt lock, law 65 ([render quality](../biome/docs/65-render-quality.md),
zero quality loss) and law 67 ([post-pass exception](../biome/docs/67-imagine-post-pass.md)).

Subpages: [**ground recipe**](METHOD/ground.md) · [rocks recipe (IN TEST)](METHOD/rocks.md) · [ruins recipe (IN TEST)](METHOD/ruins.md) · [sky recipe (**VALIDATED**)](METHOD/sky.md) · [tools](METHOD/tools.md) · [self-improvement loops](METHOD/self-improvement.md) · [recipe progression](METHOD/self-improvement.md#6-recipe-progression-versions-score-lock) ·
[rejected approaches](METHOD/rejected.md) · [decisions log + contradictions](METHOD/decisions-log.md).
Taste log (owner reactions): [`learn/taste.md`](../learn/taste.md). Failures already paid for: [`learn/failures.md`](../learn/failures.md).

Status words: **APPROVED** = build it this way. **VALIDATED** = an IN TEST candidate that SmiR validated on the phone; same force as APPROVED. **IN TEST** = candidate, pending owner validation. **PARKED** = written, not built.

## 0. Golden rule — APPROVED 2026-10-02

- The game is a **living painted film**. Every visible pixel comes from **Imagine** images or videos.
- The hero is **Bolt, an Imagine video**: the keyed gallop mp4 (`lock/bolt-gallop-cycle.mp4`) and idle breath
  (`lock/bolt-idle-breath.mp4`) from this repo. Exactly one Bolt. Never invented, recooked, re-keyed, hulled or mirrored.
- The universe comes from SmiR's **800+ X decrees** (`python3 tools/decrees/brief.py` at step start).
- Never drift toward a classic 3D game. **Banned:** real-time lights, shadows, reflections; code-drawn colours, textures or
  particles; non-Imagine models; Unity / TripoSR-style mesh generators.
- Code computes **invisible shape and placement only** (relief, footprint, colliders, positions, yaw, scale, LOD, cells).

## 1. Rules per element

| Element | THE approved way | Decided |
|---|---|---|
| **Ground (zones)** | Invisible **height relief built by code** (shape/placement only) carrying **top-down Imagine ground tiles** (world-locked, ≥ 4 variants). | 2026-10-01 |
| | **Recipe: [`METHOD/ground.md`](METHOD/ground.md)** — generic, kit-driven (volume + skin + anti-carpet, prompt templates, prep, mesh, cutouts, post, QC). **Look APPROVED by SmiR 2026-10-03** (zone A step 1, PR #156); relief fixes (≤ 3 m / ≤ 15°, soft transitions, no wide-view grid, no sky cap) still pending. Merged to main 2026-10-03 as part of zone A (PR #156); **not VALIDATED** — the slope fix is deferred and waits for SmiR's phone check. | 2026-10-03 |
| | **Plus per-pixel invisible depth relief** derived from each Imagine tile (monocular depth + light high-pass), so painted cracks, plates and crystals get real micro-volume. | 2026-09-29 + 2026-10-03 |
| | **Several distinct Imagine materials** distributed by the relief, soft transitions, large-scale variation. **Never one plain dirt texture** (rejected as ugly). | 2026-10-03 |
| | **Anti-carpet:** relief silhouettes against the sky; raised lips at fissures/plates; small Imagine cutout ground details standing up; oblique/grazing Imagine textures where useful; fog for depth. | 2026-10-03 |
| | **Magnification ≤ 1.0** on 720×1600, including slope stretch; watch tile repetition. Relief: up to 3 m over ≥ 20 m, walkable slope ≤ 15° (Director 2026-10-02); taller cliffs are objects, not relief. | 2026-10-01/02 |
| **Ground (fixed paths between zones)** | May use the **speed-tied scrolling Imagine ground video** (`rate = boltSpeed / bakedGroundSpeed`, rate 0 + idle breath when stopped). | 2026-09-30 |
| **Sky** | **Closed sky from Imagine slices** (8 × 60° HFOV, 45° step, rail 12 / kits; chained edits, never cloned/mirrored columns) **+ living seamless-looping Imagine video layers with different durations** (e.g. stars 13 s, dust 17 s, nebula 29 s). 360° ring = far backdrop, does not move with Bolt. **Fog colour sampled from the sky horizon band**, never typed. Gate: `python3 tools/sky/check.py`. **Zone A look validated by SmiR 2026-10-03 except the vertical seams. Seams are fixed by crossfading neighbour slices (no new pixels, mag unchanged). That fix and the 13-slices-per-band layout are IN TEST** ([sky.md](METHOD/sky.md)). Superseded 2026-10-03 21:56: **VALIDATED**, see the next row. | 2026-10-02 / 2026-10-03 |
| | **VALIDATED** (SmiR 2026-10-03 21:56 Paris, on the phone, after the seam crossfade fix d74f367, PR #159; same force as APPROVED): the zone A sky as built is the sky recipe. Layout: **unstretched Imagine slices** (magnification ≤ 1, no slice widened past its band's own limit), **13 slices per band** (horizon and upper, about 27.7° each; high 8 × 45°), **neighbour overlap crossfade in the shader** for the vertical seams (the two slices' own pixels, smoothstep, no new pixels), **GPU-instanced video layers with per-tile time offsets** (one decode, one texture, one instanced draw per layer), **closed dome** (bands + cap, no hole at the pole), **parallax layers** (small yaw offset by depth). This layout replaces the 8 × 60° display rail for the sky (this sheet wins). Recipe: [`METHOD/sky.md`](METHOD/sky.md), gate `python3 tools/sky/check.py`. **Accepted known issues** (declared, not blockers; do not spend Imagine quota on them): a faint joint may remain around 19–28° up (horizon/upper overlap); two duplicated upper slices; the streak layer reads as a meteor-rain grid instead of sparse shooting stars; meteor streaks stop or vanish at slice joints (fix in progress locally, separate task); darker zenith centre (the cap painting's own dark centre); a small load regression. | 2026-10-03 |
| | **VALIDATED 2026-10-03 21:56** (part of the validated sky above; was IN TEST 2026-10-03): those living layers are GPU-instanced tiles (one decode, one texture, one instanced draw per layer) at magnification ≤ 1, with a small yaw parallax by depth and no sky relief. The sky gate fails any slice, cap, or video tile displayed above magnification 1. Recipe: [`METHOD/sky.md`](METHOD/sky.md). | 2026-10-03 |
| | **VALIDATED 2026-10-03 21:56** (part of the validated sky above; was IN TEST 2026-10-03, step 2c): the sky gate also rejects a repeated, mirrored, copied, or hard-seamed motif inside a slice. Opaque slices may be lossy-encoded. Show the horizon band before the other bands. A bright living shape is keyed from its own pixels onto one tile. | 2026-10-03 |
| **Post** | Light distance fog, one light colour grade per biome, subtle capped bloom on bright Imagine pixels. Phone-cheap, zero quality loss, Bolt never glows. Nothing else computed. Law 67. | 2026-10-02 |
| **Static solid decor** | Still Imagine image on an **invisible depth relief** (law 59 carrier). | 2026-09-29 |
| **Living elements** (stars, dust, vapor, lights, glow) | **Keyed seamless-looping Imagine video layers** (first = last frame or ping-pong; never hard-restart). ≤ 4 decoding videos incl. Bolt. | 2026-09-29 |
| **Organic objects** (rocks, trees) | **8-view Imagine silhouette carving** (8 views every 45°, one sharp V0 + silhouette lock) → `tools/objsheet` → `tools/walkaround/build.py`. Natural, irregular, sharp silhouettes; **never balls / blobs / capsules**. Placement by simplex/code = placement only, never drawing. | 2026-10-01/02 |
| | **IN TEST (2026-10-03):** rocks, boulders, ridges and crests are one kit-driven TerrainFeatureGenerator. Swap the Imagine kit; the placer, the seating rule and `python3 tools/rocks/build.py --kit <id>` stay the same. Pebbles at or under 30 cm stay upright keyed cutouts. A running corridor and a spawn bubble stay clear. Each solid is seated on the relief under its footprint. Recipe: [`METHOD/rocks.md`](METHOD/rocks.md). Merged to main 2026-10-03 (PR #162), still **IN TEST** (owner phone QC open). Known issues: rock skins reach magnification 1.15–1.32 up close; one shape per type; the crest hull is not carved. | 2026-10-03 |
| **Hard objects** (ships, gates, wrecks) | **Real 3D the player can walk around.** Flat angle-switching impostors are rejected as the main solution. | 2026-10-02 |
| | **IN TEST (2026-10-04):** landmark gates and crashed-ship wrecks are one kit-driven RuinGenerator. Swap the numbers file; the loft and `python3 tools/ruins/build.py --kit <id>` stay the same. Zone A is the filled example. The Eclipse Gate is a 25–30 m monolith with veins, a ring in the arch, a real open passage, and colliders taken from the mesh (the stored keep radius is not a wall). Recipe: [`METHOD/ruins.md`](METHOD/ruins.md). Still **IN TEST** (not APPROVED, not VALIDATED). | 2026-10-04 |
| | **VALIDATED** (SmiR 2026-10-03 21:36 Paris, on the phone, after PR #161): shapes **measured from Imagine images** (side, top, cross-sections, plates); sections **lofted** into the hull; left/right read separately; holes kept; generic part builder; **one unlit Imagine skin per part**; mid-grey readable skins. Measure images come from Imagine, never drawn by code. The loft is the volume — plates are not a second shell offset along the normal. Each volume part is measured once on `images/measure/` and built once; the skin under it is Imagine plain plating, never a code rectangle. Recipe: [`METHOD/hard-objects.md`](METHOD/hard-objects.md) (Howl frigate, gate `python3 tools/hard-objects/rebuild.py`). **Accepted known issues** (declared, not blockers; do not spend Imagine quota on them): five painted engine circles on `top.jpg`; starboard nozzles still painted on `stbd.jpg`; tower-roof streaks; black faces (bridge side wedge, nacelle inner face, stern edge strips, deck block, bay aft edge); magnification ≤ 1 holds at the aim point only. Bolt stays the Imagine-video wolf and is not drawn by this folder. **Law 59 amended 2026-10-03:** lofted measured-section hulls are an approved invisible carrier; every visible pixel stays unlit Imagine ([law 59](../biome/docs/59-invisible-depth-carrier.md#amendment-2026-10-03-lofted-measured-section-hulls)). | 2026-10-03 |
| **Zones / biomes** | **3 biomes:** A *The Howling Eclipse* (ship wreck, Eclipse Gate) · B *Ember Mesa* · C *Cascade Verdance*. Each a **large natural organic open zone** (≥ 5× the retired circle, irregular footprint, nooks, natural soft boundaries, **no circles / rings**), joined by **paths with a distance-based fog/grade blend**. Kits: [`biome/kits/`](../biome/kits/README.md). | 2026-10-02 |
| | Ship = **lore / POI, not a vehicle**. Bolt sprints through space powered by the **Lightning Core**. | 2026-10-02 |
| | **PARKED** narrative frame: each biome is a **Frontier Shard** woken by Bolt's permanent EMP wave (decrees #031, #063, #064). Lore never changes the visual laws. | 2026-10-02 |
| **Bolt** | Keyed `lock/` gallop + idle breath, automatic IDLE/GALLOP switch, camera behind, one Bolt. `lock/` WARN = informational, never a recook. | 2026-09-20 → 2026-10-01 |
| **Camera** | No shake, ever. The chase holds one legal pose (hysteresis on boom / eye / slide) and eases eye height off the raw relief sample. A per-frame rescore must not snap the eye. Magnification stays ≤ 1. | 2026-10-03 |
| **Biome names in docs** | Biome **names** are allowed in tracked repo files (docs, commit messages, ids). **Palettes and Imagine prompt text stay out** (only in prompts and untracked `*.local.*` files). | 2026-10-03 |
| **Phone** | Portrait 720×1600, full screen, controls as transparent overlay. Stills `LINEAR_MIPMAP_LINEAR` + mipmaps, video `LINEAR`, never `NEAREST`, DPR ≤ 2, perf only removes waste. | 2026-10-02 (law 65) |

## 2. Workflow — APPROVED

1. Steps of **~1 h**. Each step = **one fresh Grok run** pointing at a **spec file** (goal, rails, done-when ≤ 8 rows).
2. The prompt gives **goal + fixed rules**; Grok **chooses its own method** inside them.
3. Every step ends with **screenshots + a 3-line report**; **owner QC on the phone**.
4. Accept small Imagine-born defects. **Stop after 2 failed attempts** at the same defect; list it, move on (everywhere: steps, attempts, tool-loop rounds).
5. Tests pass + laws respected → **merge**. Then the retro: taste row, failure / recipe, take note
   ([self-improvement](METHOD/self-improvement.md)).

## 3. How to add a new decision

- Every new **owner-approved** method gets a line **here** (in the element table, with its date) **and** a dated row in
  [`METHOD/decisions-log.md`](METHOD/decisions-log.md), **in the same PR** that uses it.
- Write the rule in one short line: what to build, with what, and the ban it replaces.
- A candidate is **IN TEST** until SmiR validates it on the phone; then change the word to **APPROVED** (or **VALIDATED**, same force) with the date.
- When it contradicts an older doc, add a one-line `Superseded by docs/METHOD.md` header to that doc. Never delete it.
- A rejected idea goes to [`METHOD/rejected.md`](METHOD/rejected.md) with the date and why.
