# 04 — play (LanePlayer + `/master`)

Play lives on the **native Grok Build game console** (in-app). This repo ships a **reference** compositor, not a new grok.me.

## Nodes

[../reference/LanePlayer.tsx](../reference/LanePlayer.tsx) + [../reference/lane-css.css](../reference/lane-css.css):

```
stage          9:16 contain, void letterbox
 └─ road       <video> empty plate     MASTER
 └─ bolt       <video> cutout          seek-synced
```

No wallet. No keys. No Forge chrome. Films **loop forever**.

## `/master` stack

Hung B-stack files: [../master/README.md](../master/README.md).

| file | role |
|---|---|
| `master/road.mp4` | empty plate — clock |
| `master/bolt.mp4` | cutout / gallop |
| `master/road-first.jpg` | poster / first still |
| `master/bolt-first.jpg` | cutout first still |

Kitchen Live may point at these paths the same way citadel Play points at `packs/<id>/`. Do **not** paste the Live URL in chat.

Console teaser (chat media, not a tap) is **not** the master stack: [`stock/biome/preview-loop.mp4`](../../stock/biome/preview-loop.mp4).

## Wire

1. Load road + bolt (`muted playsInline autoPlay loop`).
2. `clock = road.currentTime`.
3. Tick ≥10 Hz: match `playbackRate`; `seekReady(bolt, clock)`.
4. Swipe = découpe plant ([03-decoupe-swipe.md](03-decoupe-swipe.md)).
5. Watchdog on `pause` / `ended`.

If a master file is missing → stock Sprint in-app. Do not scaffold a fallback app.
