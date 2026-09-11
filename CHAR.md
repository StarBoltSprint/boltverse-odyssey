# CHAR — Bolt is not the player's to change

Bolt is **one** dog. Every still, every breath, every walk. Style of the citadel may change. Bolt may not.

## Coat lock (hard)

Bolt = **FULL white German Shepherd** (StarBoltSprint). Forced in cook / Smoke — not chat-only.

- **All white** — dense white / cream coat
- **ZERO black** — no saddle, no mask, no black ears, no black cape
- **blanc+gros** — full white **and** in the size band, not a small grey wolf
- Identity = **back** still ([`lock/bolt-back.jpg`](lock/bolt-back.jpg)) — never face

**Teal collar** — always. Same width, same seat on the neck. Never a black cape.

Four legs. Standing. Tail down / slight. Weight on the floor. Seen **strictly from behind**. Back of the head, ears, spine, tail. Camera lock-off.

The old line *“Black saddle faint on the back”* is **void**. Saddle = FAIL.

## Never (FAIL — recook)

- silver / grey coat
- black saddle / mask / ears
- cape / black silhouette
- Face, eyes, muzzle, tongue, 3/4, profile, fashion-walk turn
- Bipedal, clothes, armor, hat, UI, muzzle flash, lens dirt
- A different breed, a puppy, two Bolts
- Sitting / lying on a breath or a walk (feet glued, standing)

Asteroid / hall plates with any black on Bolt = FAIL → recook.

## Scale (hard lock)

Measure = `bboxH / frameH` of the dog mask. Same lens / height / distance on every plate. The dog moves, not the rig. [STILL-PAIR.md](STILL-PAIR.md)

| Pose | `h = bboxH/H` |
|---|---|
| Spawn / mid-hall | **0.22 – 0.32** (withers ≈ 1/4 frame H) |
| Door sill (atA / atB) | **0.35 – 0.40** (FAIL < 0.28 or > 0.45). 0.15 = still spawn-scale at the door. 0.52 = punch. |
| Forbidden | **~0.70** / fills-door (punch-in / dolly) |

Breath: size frozen (Δh/H < **0.11**). Vapor / chest can add ~0.01–0.03 to the cream mask — that is not a step. 0.08 was a false positive. Walk remains 0.12. Walk: spawn-band → sill-band, no dolly. Dissolve does not fix a size jump.

**One line:** all white, large, back only — **no** black on the dog.

## How Grok uses this

1. **Never** `text_to_image` Bolt from scratch.
2. Spawn still = `reference_to_image` with `lock/bolt-back.jpg` **and** `lock/example-spawn.jpg` (camera + doors). Player style goes in the prompt. Prompt must say **full white, zero black, no saddle**.
3. atA / atB = `image_to_image` **from that spawn**. Only Bolt translates. Hall frozen.

If Bolt's collar, coat, or ear shape drifts between the 3 stills → FAIL. Recook from spawn. Do not cook films on a bad Bolt.
