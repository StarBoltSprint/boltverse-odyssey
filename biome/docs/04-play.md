# 04 — play (LanePlayer + `/master`)

Play lives on the **native Grok Build game console** (in-app). This repo ships a **reference** compositor, not a new grok.me.

## Nodes

[../reference/LanePlayer.tsx](../reference/LanePlayer.tsx) + [../reference/lane-css.css](../reference/lane-css.css):

```
master-player.lane-player          VER = r38lock
 └─ lane-stage
     └─ canvas.lane-canvas         the picture
     └─ lane-decoders (hidden)
         └─ roadA + roadB          locked playlist, dual hold
         └─ bolt.vid               green-screen gallop
 └─ lane-touch / lane-pips / hint
```

No wallet. No keys. No Forge chrome. Films **loop forever**.

## `/master` stack

Hung B-stack files: [../master/README.md](../master/README.md). Dealer playlist is **locked** (canyon → cars → duel → night → war) — [11-plate-order.md](11-plate-order.md). Live `r38lock` names:

| file | role |
|---|---|
| `master/road.mp4?v=r38` | empty plate — clock |
| `master/bolt.mp4?v=r38` | green-screen gallop (keyed on canvas) |
| `master/road.jpg` | poster / first still |

Kitchen Live may point at these paths the same way citadel Play points at `packs/<id>/`. Do **not** paste the Live URL in chat.

Optional biome preview (archive — **not attached at boot**) is **not** the master stack: [`stock/biome/preview-loop.mp4`](../../stock/biome/preview-loop.mp4). Boot attaches [`stock/citadel/preview-loop.mp4`](../../stock/citadel/preview-loop.mp4) only.

## Wire

1. Load dual road + bolt (`muted playsInline autoPlay`, `?v=r38`).
2. RAF: grab road → hold. Grab bolt → `keyGreen` → `killCrown` → `featherAlpha` → stamp on canvas at `dx`.
3. Swipe = plant on X (`SHIFT = 30`) — [03-decoupe-swipe.md](03-decoupe-swipe.md). Living-film Lane `path.json` (ribbon + arc-length, not SprintCore): [12-lane-path-ribbon.md](12-lane-path-ribbon.md).
4. Key law — [05-key.md](05-key.md).
5. Watchdog on `pause` / `ended` / `visibilitychange`. Dual road swap before the loop point.

If a master file is missing → stock Sprint in-app. Do not scaffold a fallback app.
