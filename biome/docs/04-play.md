# 04 — play (LanePlayer + `/master`)

Play lives on the **native Grok Build game console** (in-app). This repo ships a **reference** compositor, not a new grok.me.

## Nodes

[../reference/LanePlayer.tsx](../reference/LanePlayer.tsx) + [../reference/lane-css.css](../reference/lane-css.css):

```
master-player.lane-player          VER = r38
 └─ lane-stage
     └─ canvas.lane-canvas         the picture
     └─ lane-decoders (hidden)
         └─ roadA + roadB          empty plate, dual hold
         └─ bolt.vid               green-screen gallop
 └─ lane-touch / lane-pips / hint
```

No wallet. No keys. No Forge chrome. Films **loop forever**.

## `/master` stack

Hung B-stack files: [../master/README.md](../master/README.md). Live r38 names:

| file | role |
|---|---|
| `master/road.mp4?v=r38` | empty plate — clock |
| `master/bolt.mp4?v=r38` | green-screen gallop (keyed on canvas) |
| `master/road.jpg` | poster / first still |

Kitchen Live may point at these paths the same way citadel Play points at `packs/<id>/`. Do **not** paste the Live URL in chat.

Console teaser (chat media, not a tap) is **not** the master stack: [`stock/biome/preview-loop.mp4`](../../stock/biome/preview-loop.mp4).

## Wire

1. Load dual road + bolt (`muted playsInline autoPlay`, `?v=r38`).
2. RAF: grab road → hold. Grab bolt → `keyGreen` → `killCrown` → `featherAlpha` → stamp on canvas at `dx`.
3. Swipe = plant on X (`SHIFT = 30`) — [03-decoupe-swipe.md](03-decoupe-swipe.md).
4. Key law — [05-key.md](05-key.md).
5. Watchdog on `pause` / `ended` / `visibilitychange`. Dual road swap before the loop point.

If a master file is missing → stock Sprint in-app. Do not scaffold a fallback app.
