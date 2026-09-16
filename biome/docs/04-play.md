# 04 — play (LanePlayer + `/master`)

Play lives on the **native Grok Build game console** (in-app). This repo ships a **reference** compositor, not a new grok.me.

## Nodes

[../reference/LanePlayer.tsx](../reference/LanePlayer.tsx) + [../reference/lane-css.css](../reference/lane-css.css):

```
master-player.lane-player          VER = r19wide
 └─ #bolt-luma                     SVG hard-key
 └─ lane-stage
     └─ road.vid                   empty plate     MASTER
     └─ bolt-wrap → bolt.vid       luma cutout     seek-synced
 └─ lane-touch / lane-pips / hint
```

No wallet. No keys. No Forge chrome. Films **loop forever**.

## `/master` stack

Hung B-stack files: [../master/README.md](../master/README.md). Live r19wide names:

| file | role |
|---|---|
| `master/road.mp4?v=r19wide` | empty plate — clock |
| `master/bolt.mp4?v=r19wide` | luma cutout / gallop |
| `master/road.jpg` | poster / first still |

Kitchen Live may point at these paths the same way citadel Play points at `packs/<id>/`. Do **not** paste the Live URL in chat.

Console teaser (chat media, not a tap) is **not** the master stack: [`stock/biome/preview-loop.mp4`](../../stock/biome/preview-loop.mp4).

## Wire

1. Load road + bolt (`muted playsInline autoPlay loop`, `?v=r19wide`).
2. `clock = road.currentTime`.
3. Tick ~400 ms: `seekReady(bolt, clock % bolt.duration)` if slop > 0.08s.
4. Swipe = découpe plant on `.bolt-wrap` (`translate3d`, 44% / lane) — [03-decoupe-swipe.md](03-decoupe-swipe.md).
5. Watchdog on `pause` / `ended` / `visibilitychange`.

If a master file is missing → stock Sprint in-app. Do not scaffold a fallback app.
