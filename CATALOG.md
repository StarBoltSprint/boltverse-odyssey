# CATALOG — a closed list of paints, not a world generator

The building is frozen: Bolt's back, lock-off camera, teal left, gold right, fork on the floor, spawn / atA / atB.

`worldLine` is only **what the pillars, floor, and light are made of**.

Hall' is a **neighbor brick**, not "Mars in free text". [FLOORS.md](FLOORS.md).

## Why free text breaks

"Martian temple under the sea, third moon, throne in the middle."

Imagine, to be nice:

- invents a 3rd door
- turns the dog
- changes the lens
- or glues two halls into one clip (clone)

The keeper becomes an editor again.

`moss` does not have enough words to break the sentence. That is the point.

## What a worldLine is

A **slot**: id + 2 lines of material. Nothing else.

| id | What changes | What does not |
|---|---|---|
| `moss` | ivy, wet stone, green | lock, 2 doors, Bolt |
| `ember` | embers, hot metal, amber | same |
| `dusk` | rose / violet, dust | same |
| `asteroid` | dust, basalt, star-cleft | same |
| `frost` | ice, pale stone, breath-fog | same |
| `ivy` | heavy vines, dark leaf | same |
| `ash` | grey cinder, dead hearths | same |
| `tide` | black wet stone, salt, seafoam in cracks | same |
| `ember-deep` | darker ember, lava cracks | same |
| `gold` | gilded stone, warm lamps | same |

**Ten**, not ten thousand. Enough to choose. Not enough to write a novel.

Each slot may keep one example still later (`lock/example-spawn` recooked once in that material) so Grok copies a **texture**, not an architecture.

Stock (`/`) and `/r/citadel` are not paints. Stock = floor 0. citadel = floor-3 demo.

## How the player picks

Not a prompt. A **word from the list** (or a picker later):

```
moss · ember · asteroid · dusk · frost · ivy · ash · tide · ember-deep · gold
```

Aliases: mousse→moss, braise→ember, crépuscule→dusk, astéroïde→asteroid, or→gold.

"Citadel moss" = floor 1, `cookRoom("moss")`.  
Off-list → nearest, or one question: "did you mean ember?"  
Never the default path: "describe any temple".

## Hall' = neighbor hall. A door may instead hang a **sprint biome** ([LINKS.md](LINKS.md))

Enter does not say "invent the sequel". It says: `moss` door A → `ember`.

Same depth, same crop, same doors. Only the matter changes. That is why the curtain can work.

Declared neighbors (opt-in floor 3):

```
moss.A → ember          moss.B → dusk
ember.A → asteroid      ember.B → ash
dusk.A → frost          dusk.B → ivy
asteroid.A → ember-deep asteroid.B → tide
frost.A → moss          frost.B → gold
ivy.A → moss            ivy.B → tide
ash.A → ember           ash.B → ember-deep
tide.A → dusk           tide.B → frost
ember-deep.A → ember    ember-deep.B → ash
gold.A → ember          gold.B → dusk
```

Not an infinite graph. A small map of 10 halls.

## What Grok may write

`cook-room` / `imagineStill` read the two lines from `catalog/<id>.md`. Do **not** paste them into chat Imagine.

- yes: "bioclast moss: ivy on pillars, wet stone"
- no: "a unique original temple you design"

Change a slot = change that file. Do not let the model dream. New slots = a PR, not chat.

If a paint FAILs Smoke → URL still opens **stock**, plus one line (`atA: face`). The site does not die.

## One sentence

**You pick a paint on the wall. You do not invent the building.**  
The building is already the citadel. The catalog is the color.

Does not own sprint kits. Those are [BIOMES.md](BIOMES.md) (`BiomeRow`). Paints = matter. Rows = stock + neighbors + identity.
