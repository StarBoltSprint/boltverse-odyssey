# FILM-STACK — Imagine engine locks (SmiR 2026-09-14 / 2026-09-15)

**Cold-start.** No chat history required. Dated Engine law for the Imagine biome stack.

Hall / citadel is a **different job**: [COOK.md](COOK.md). Do not apply this page there.

Cook rails (empty plates, SPEED REF, `rate(t)`, first+last, 3-take cook brief): [COOK-BIOME-25D.md](COOK-BIOME-25D.md).

This repo is the **recipe**. Play lives in bolt-hybrid `play/`. Do not scaffold a player. Do not publish a new grok.me.

---

## Which stack (read this first)

**3-take L / M / R is PRIMARY for this runner.** The assets film-stack stays legal when that stack is in use. Cutout is **fallback only**.

| Stack | When | Bolt | Path / ribbon |
|---|---|---|---|
| **3-take L / M / R** | **PRIMARY — this runner** | path + Bolt **painted into** each take | **ONE** luminous ribbon **follows Bolt’s lane** on that take |
| **Assets film-stack** | empty plate + layers / replayable routes | Imagine **gallop video** layer (not in the plate) | PathGen **procedural** ribbon (not baked into the plate) |
| **Cutout fallback** | L / R cooks **FAIL** | soft-key Bolt **cutout** on live mid | mid path keeps scrolling; swipe **moves the cutout** |

Do not mix stacks in one play: a 3-take runner does **not** also slide a gallop card across an empty plate. Prefer matching L / R recooks over falling to cutout.

---

## 3-take lane system (PRIMARY for this runner)

Bolt is **NOT** one cutout slid sideways. Three **synced baked takes** L / M / R: **path + Bolt painted into the road**.

| Lock | Law |
|---|---|
| Takes | Three clips: **L**, **M**, **R**. Same road. Same locked camera. Same 3-lane futuristic city-style avenue |
| Paint | Path + Bolt **in** the take. World décor = a **separate later plate** filling the black. **Never** bake canyon / skyline / arrows / décor into the takes |
| Void | Pure **BLACK** void outside the road |
| Ribbon | **ONE** luminous ribbon **FOLLOWS Bolt’s lane** each take (under him on L, mid on M, right on R). Must **NOT** stay stuck on mid when he’s L / R |
| Camera | Locked. Same millimeter. **Reject** tilted road / smaller Bolt / tunnel / mismatched ribbon |
| Identity | Identical Bolt — full-white coat forever; décor-matching skin ON TOP OK. Same scale, gait tempo, travelling speed, loop length |
| Sync | **HARD sync.** Shared `currentTime`. **Mid = master.** L / R must match mid |
| Swipe | **One lane per swipe.** Short **lunge / lean** then **cut-on-action** to the take where he **already stands** |
| Edge | Edge **bumps** (no fourth lane) |
| Dots | Dots = **live take** (the clip that is playing, not a still) |

**PLAY FIX — L / R must not freeze as stills.** Picture never stops.

On `slideChange`:

1. Sync `currentTime` from the **mid master** (or the outgoing live take) onto the incoming take
2. `.play()` the **visible** take
3. **Pause** the others **OR** keep all three **decoding** under `opacity: 0`

Either pause-or-decode is legal. Frozen side plates sold as lanes = **FAIL**.

| Banned | Why |
|---|---|
| One-clip **pan / slide** of the whole **mid** video as a lane change | Camera **drifts**. That is not a lane change |
| Carousel of **frozen** side stills | L / R become posters. Picture stops |

---

## Fallback if L / R cooks fail

Keep **mid** as the only live quality clip.

- Soft-key Bolt **cutout**
- Mid **path keeps scrolling**
- Swipe **repositions the cutout** L / M / R with the same short **lunge**
- Prefer **matching L / R recooks**
- Cutout is **fallback, not default**

Do not ship cutout while good L / R takes exist. Do not invent a pan of the mid clip to fake a missing take.

---

## Assets stack (empty plate + layers)

Engine = **Imagine film-stack**: full-frame biome plate + movable Imagine **video** assets + generators.

**When this stack is in use:** empty plate = **ZERO Bolt, ZERO luminous follow-path.** PathGen stays the **procedural** ribbon for **replayability** (same plates, different L / M / R routes). Baking the follow-path into an assets-stack plate = the same road every run = **FAIL for replayability**.

| This | Not this |
|---|---|
| Empty plate mp4 (world only) | Bolt baked into the plate ([COOKLANE.md](COOKLANE.md) living-film) |
| Imagine **gallop video** layer (playable Bolt) | Old still **2.5D card** |
| Imagine PathGen **ribbon** loops | Neon CSS / DOM “PathGen” |
| Runtime **light bus** on every video layer | Hand-wrap each asset |
| Rails / curbs in the plate | Follow-path painted into the plate |
| Imagine assets + generators | Mesh-first / Unreal requirement |

```
[ plate mp4 — full frame, empty ]
        │  ZERO Bolt, ZERO luminous follow-path
        ▼
[ Bolt gallop VIDEO — lower third, planted ]
        │  strafe L/R, jump, plant; playbackRate = plate rate(t)
        ▼
[ PathGen ribbon VIDEO — one luminous road ahead ]
        │  Imagine alpha/black loops: straight / curve-L / curve-R
        ▼
[ props / VFX VIDEO ]
        │  same light bus as Bolt + ribbon
```

Not Unreal. Not a 3D mesh requirement. Artists not required.

**3-take PRIMARY does not delete this stack.** Use it when the runner is empty-plate + layers. Do not apply ZERO-Bolt plate law to a 3-take clip (those takes **must** paint path + Bolt).

---

## Bolt (playable layer — assets stack)

Playable Bolt is an Imagine **gallop video loop** (rear / white wolf-dog / **full-white coat**). NOT the old still 2.5D card.

Same slot as the retired card:

- Strafe **L / R**
- Jump
- Plant at paws / `groundY`
- Layer `playbackRate` **syncs to plate `rate(t)`** — never speed legs on a second clock

**Plate:** ZERO Bolt in the plate. Dual dogs (plate + layer) = FAIL.

**Key:** soft black / alpha. Keep fine semi-transparent **paw dust** from the bake. Do **not** hard-key wipe low-alpha. Kill **all** code/CSS fake splash / dust layers and debug hitboxes. Prefer dust **baked into the gallop cycle**.

White coat forever. Wrap is **light only** — [Global light bus](#global-light-bus).

On the **3-take** stack, Bolt is **in** the take — not this layer. Do not also composite a second gallop dog.

---

## Global light bus

**Documented here. Referenced from [COOK-BIOME-25D.md](COOK-BIOME-25D.md).** Do not hand-wrap every asset.

One runtime lighting bus for **ALL** video layers: Bolt, PathGen ribbon, props, VFX. On 3-take play, the same bus may grade the visible take + later décor plate — still **one** bus, not a hand wrap per clip.

| Cook | Play |
|---|---|
| Assets on **black / neutral** light (underlit for multiply) | Each frame, sample the plate under that asset’s plant / bbox |
| 3-take road on **black void** (décor is a later plate) | Sample the **décor plate** under the take / cutout when that plate exists |
| | Multiply **tint + brightness** + soft contact shadow |

- White coat forever: wrap is light only — **no peach / grey silhouette fill**, no morph
- Same stack as live `rate(t)` (~0.1 s / ≥10 Hz is the existing filet)
- Soft-multiply + identity guard: luma of the coat stays high

---

## PathGen (procedural ribbon)

PathGen is the **procedural luminous ribbon** — Imagine **alpha / black video loops** (`straight` / `curve-L` / `curve-R`). **Not** neon CSS.

**When applicable (assets stack / replayability):** the same plates must replay with **different L / M / R routes**. Baking the follow-path into the plate = the same road every run = **FAIL for replayability**.

| Lock | Law |
|---|---|
| Count | **ONE** ribbon (not three always-on lanes) |
| Lead | Forms **ahead** of Bolt’s paws (~**1–2 s** of road so the player can read) |
| Steer | PathGen moves the ribbon across **L / M / R**; the player steers Bolt to follow |
| Default | Off-path **slows** the plate |
| Exception | Some city **never-slow** plates keep **constant max** travelling. Obstacles on those plates are **dodge-only** and **must not** slow the plate |
| Plate cook | **ZERO** luminous path painted into the **empty** plate. Subtle ground **rails / curbs** OK |

**3-take exception:** the ribbon **is** painted into each take and **must follow that take’s lane**. That is not PathGen-on-empty-plate. Do not freeze the 3-take ribbon on mid when Bolt is L / R.

Neon CSS / DOM bars / SVG arrows / chrome UI path = **BANNED** (this was HOLD; the unlock is Imagine ribbon loops only — not a sticker).

---

## City enter plate (cook brief)

Next plate after the canyon KEEP: **denser futuristic Mars city entry**.

Assets-stack plate (empty): ships / hover craft, denser street canyon, glass domes / needle spires, **2–3 dodge obstacles** in the picture. **ZERO** Bolt, **ZERO** luminous follow-path.

3-take road (PRIMARY runner): same city-style **avenue** as the three takes — **BLACK void** outside the road. Décor (canyon / skyline / ships) = **later plate** filling black. Never bake that décor into L / M / R.

- Travelling **FULL SPEED constant** (never slows for obstacles — never-slow exception)
- **9:16**, lock-off, **NO UI chrome**
- `last_frame` continuity from the previous plate end
- Ultra detailed

Cook text: [COOK-BIOME-25D.md — City enter](COOK-BIOME-25D.md#city-enter--plate-2). 3-take cook: [COOK-BIOME-25D.md — 3-take](COOK-BIOME-25D.md#3-take-lane--primary-runner).

---

## Which job

| Human says | Job | Page |
|---|---|---|
| citadel / salle / hall | Bolt **in** the stills | [COOK.md](COOK.md) |
| biome / sprint / lane **living-film** | Bolt **baked into** the reel | [COOKLANE.md](COOKLANE.md) |
| **2.5D** / empty plate / film-stack / gallop layer | empty reel + Imagine video layers | **this page** (assets stack) + [COOK-BIOME-25D.md](COOK-BIOME-25D.md) |
| **3-take** / swipe lane / L M R takes | three synced baked takes (PRIMARY runner) | **this page** + [COOK-BIOME-25D.md](COOK-BIOME-25D.md) |

`cook-biome.mjs` bakes Bolt into the living-film reel. Illegal for the **assets** stack. 3-take bakes path+Bolt **on purpose** — that is this page, not COOKLANE.

---

## One line

**PRIMARY runner = three synced baked takes (path+Bolt in the road, ribbon follows his lane). Assets stack = empty plate + layers + PathGen (replayability). Cutout = fallback only. One light bus. Never pan the mid clip. Never freeze L/R as stills.**
