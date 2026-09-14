# FILM-STACK — Imagine engine locks (SmiR 2026-09-14)

**Cold-start.** No chat history required. Dated Engine law for the Imagine biome stack.

Hall / citadel is a **different job**: [COOK.md](COOK.md). Do not apply this page there.

Cook rails (empty plates, SPEED REF, `rate(t)`, first+last): [COOK-BIOME-25D.md](COOK-BIOME-25D.md).

This repo is the **recipe**. Play lives in bolt-hybrid `play/`. Do not scaffold a player. Do not publish a new grok.me.

---

## Stack

Engine = **Imagine film-stack**: full-frame biome plate + movable Imagine **video** assets + generators.

| This | Not this |
|---|---|
| Empty plate mp4 (world only) | Bolt baked into the plate ([COOKLANE.md](COOKLANE.md)) |
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

---

## Bolt (playable layer)

Playable Bolt is an Imagine **gallop video loop** (rear / white wolf-dog / **full-white coat**). NOT the old still 2.5D card.

Same slot as the retired card:

- Strafe **L / R**
- Jump
- Plant at paws / `groundY`
- Layer `playbackRate` **syncs to plate `rate(t)`** — never speed legs on a second clock

**Plate:** ZERO Bolt in the plate. Dual dogs (plate + layer) = FAIL.

**Key:** soft black / alpha. Keep fine semi-transparent **paw dust** from the bake. Do **not** hard-key wipe low-alpha. Kill **all** code/CSS fake splash / dust layers and debug hitboxes. Prefer dust **baked into the gallop cycle**.

White coat forever. Wrap is **light only** — [Global light bus](#global-light-bus).

---

## Global light bus

**Documented here. Referenced from [COOK-BIOME-25D.md](COOK-BIOME-25D.md).** Do not hand-wrap every asset.

One runtime lighting bus for **ALL** video layers: Bolt, PathGen ribbon, props, VFX.

| Cook | Play |
|---|---|
| Assets on **black / neutral** light (underlit for multiply) | Each frame, sample the plate under that asset’s plant / bbox |
| | Multiply **tint + brightness** + soft contact shadow |

- White coat forever: wrap is light only — **no peach / grey silhouette fill**, no morph
- Same stack as live `rate(t)` (~0.1 s / ≥10 Hz is the existing filet)
- Soft-multiply + identity guard: luma of the coat stays high

---

## PathGen (procedural ribbon)

PathGen is the **procedural luminous ribbon** — Imagine **alpha / black video loops** (`straight` / `curve-L` / `curve-R`). **Not** neon CSS.

**Why procedural (not a plate bake):** the same plates must replay with **different L / M / R routes**. Baking the follow-path into the plate = the same road every run = **FAIL for replayability**.

| Lock | Law |
|---|---|
| Count | **ONE** ribbon (not three always-on lanes) |
| Lead | Forms **ahead** of Bolt’s paws (~**1–2 s** of road so the player can read) |
| Steer | PathGen moves the ribbon across **L / M / R**; the player steers Bolt to follow |
| Default | Off-path **slows** the plate |
| Exception | Some city **never-slow** plates keep **constant max** travelling. Obstacles on those plates are **dodge-only** and **must not** slow the plate |
| Plate cook | **ZERO** luminous path painted into the plate. Subtle ground **rails / curbs** OK |

Neon CSS / DOM bars / SVG arrows / chrome UI path = **BANNED** (this was HOLD; the unlock is Imagine ribbon loops only — not a sticker).

---

## City enter plate (cook brief)

Next plate after the canyon KEEP: **denser futuristic Mars city entry**.

- Ships / hover craft
- Denser street canyon
- Glass domes / needle spires
- **2–3 dodge obstacles** in the picture
- Travelling **FULL SPEED constant** (never slows for obstacles — never-slow exception)
- **9:16**, lock-off, **NO Bolt**, **NO UI chrome**
- `last_frame` continuity from the previous plate end
- Ultra detailed
- **ZERO** luminous follow-path in the plate

Cook text: [COOK-BIOME-25D.md — City enter](COOK-BIOME-25D.md#city-enter--plate-2).

---

## Which job

| Human says | Job | Page |
|---|---|---|
| citadel / salle / hall | Bolt **in** the stills | [COOK.md](COOK.md) |
| biome / sprint / lane **living-film** | Bolt **baked into** the reel | [COOKLANE.md](COOKLANE.md) |
| **2.5D** / empty plate / film-stack / gallop layer | empty reel + Imagine video layers | **this page** + [COOK-BIOME-25D.md](COOK-BIOME-25D.md) |

`cook-biome.mjs` bakes Bolt into the reel. Illegal here.

---

## One line

**Empty plate + Imagine video layers + one light bus. PathGen is a ribbon, not a bake. Bolt is a gallop loop, not a card.**
