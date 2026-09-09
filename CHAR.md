# CHAR — Bolt is not the player's to change

Bolt is **one** dog. Every still, every breath, every walk. Style of the citadel may change. Bolt may not.

## Identity (lock)

File: [`lock/bolt-back.jpg`](lock/bolt-back.jpg)

- Cream / white German Shepherd (wolf-dog). Dense coat. Black saddle faint on the back.
- **Teal collar** — always. Same width, same seat on the neck.
- Four legs. Standing. Tail down / slight. Weight on the floor.
- Seen **strictly from behind**. Back of the head, ears, spine, tail. Camera lock-off.

## Never (FAIL — recook)

- Face, eyes, muzzle, tongue, 3/4, profile, fashion-walk turn
- Bipedal, clothes, armor, hat, UI, muzzle flash, lens dirt
- A different breed, a black dog, a puppy, two Bolts
- Sitting / lying on a breath or a walk (feet glued, standing)

## Scale

Bolt occupies roughly the lower third, never a giant, never a speck. Same size on spawn / atA / atB.

## How Grok uses this

1. **Never** `text_to_image` Bolt from scratch.
2. Spawn still = `reference_to_image` with `lock/bolt-back.jpg` **and** `lock/example-spawn.jpg` (camera + doors). Player style goes in the prompt.
3. atA / atB = `image_to_image` **from that spawn**. Only Bolt translates. Hall frozen.

If Bolt's collar, coat, or ear shape drifts between the 3 stills → FAIL. Recook from spawn. Do not cook films on a bad Bolt.
