# 46 — Four picture jobs

**Go 2026-09-26 (SmiR).** Kitchen only. Do not read this to the player.

The film still has no thickness. These four jobs make the stack read as a place. Same seed, same ids. Law [44](44-imagine-volume-stack.md) still poses the capsule and the bands. Law [45](45-shader-graph-look-kitchen.md) still shades the card. This law names the pictures.

No png or mp4 bytes ship here. Cook the sheets later. Do not rewrite `pyre-stage`. Three.js is not the world.

---

## 1. Imagine sheets

One asset family per `kind`. The spawn row already carries `variant`. Cook **sheets**, not a forest video.

| File | Use |
|---|---|
| `bole_vN.png` | mid + near trunk. Elder uses this family, larger quad. |
| `crown_vN.png` | near only |
| `ruin_vN.png` · `crystal_vN.png` · `fern_vN.png` | that kind's card |
| `*_imp_vN.png` | far impostor, 64–128 px |

`N` is 0–3. Hung `spawnChunk` emits 0–2. A fourth sheet can land without a new scatter.

Key: clean alpha, or a locked green screen with despill. Same light lock as the ground plate. Camera: rear three-quarter, dog withers height. One subject. No forest behind. No Bolt. No path in the sheet.

Cook stills first. A short 2–3 s loop only when the crown must breathe. First frame matches the last.

Wire: `TEX.bole[2].bole / .crown / .imp` from [`twoPlane.ts`](../scripts/jade-lod/twoPlane.ts) `texOf`. Lookup is `row.kind` + `row.variant` only. A missing file falls back to v0. The row still draws. Capsules stay `KIND_TABLE[kind].r` on the **bole**. The crown is not a collider. `KIND_TABLE` is the hung `KIND_RH`.

The cook (folder, canvas, prompts, key, variant meaning) is law [47](47-jade-sheet-cook.md). Far tree ghost file is `bole_imp_vN.png`. Ground and sky stay a separate cook.

**FAIL:** a sheet with a second tree, a path, or Bolt.

---

## 2. Ground and sky plates

Two looping films, empty of things you can thud.

`jade_ground.mp4` — world-XZ projected. A little travel or haze is fine. It is not a treadmill that slides dirt under planted cards.

`jade_sky.mp4` — dome or sphere, yaw only, no pitch flip. The horizon color matches the ground edge.

The hung files, the UV (`TILE` 24 m, `sin(pictureTime * 0.15)`), the roots pass, and the cook rails are law [48](48-jade-plate-cook.md). Picture-time is the sim clock. Never `Date.now`. Stub: [`plates.ts`](../scripts/jade-lod/plates.ts).

Cards are siblings of the floor. They are not children of the video mesh, and they are not composited into the mp4. Sheets stay cutouts (law [47](47-jade-sheet-cook.md)).

**FAIL:** near trunks painted into the ground film. That doubles the seed.

---

## 3. Two-plane tree

Bole and crown quads share `(x, z)`. Elder is the same pair, bigger. Ruin, crystal, and fern stay one sheet.

| Plane | Place |
|---|---|
| Bole | `y = hBole/2` — mid + near |
| Crown | `y = hBole + hCrown/2` — near only |
| Shadow | `y = 0.02` above the posture — near only |
| Impostor | far only |

Hung sizes, per-child yaw, and the bole cylinder are law [49](49-two-plane-tree.md). The crown width is never the hit.

| Band | Bole | Crown | Shadow | Impostor |
|---|---|---|---|---|
| Near | 1 | 1 | 1 | 0 |
| Mid | 1 | 0 | 0 | 0 |
| Far | 0 | 0 | 0 | 1 |
| Cull | 0 | 0 | 0 | 0 |

Near ↔ mid is one slot: crown and shadow only. The bole stays cutout. Mid ↔ far is the only edge where the bole may go translucent. Far does not keep a hidden bole. The capsule never fades. Detail is law [49](49-two-plane-tree.md).

The single-card kit stays face 0.70.

---

## 4. Heightfield, posture only

The hung page, the smooth path flatten, and who samples it are law [50](50-heightfield-posture.md). Stub: [`height.ts`](../scripts/jade-lod/height.ts).

```
h0 = 0.20 + 0.20 * fbm(x/28, z/28, s+101, octaves=3)
```

That is 20–40 cm. Three octaves. Elder and fern share the field. The path eases toward 0.20 with a smoothstep, not a trench and not a hard step.

This noise does **not** decide spawn. Spawn stays `s+0` / `s+17` / `s+31` at L = 14 / 40 / 22, with its own octave counts (ruin is 2). Height is `s+101` at L = 28 with 3. The lock is law [51](51-octave-map.md). A peak is not a tree.

Law 44 still holds: the ground Imagine film stays the flat plate at `y = 0`. Height moves contact in meters. It does not paint or lift the sol photo. A fractal that redraws sol is FAIL.

---

## Frame

1. Picture-time on the plates.
2. `tickField` → rows + volumes `(x, z)`.
3. Snap kits to `h`. Two planes by band. Fade the crown on near ↔ mid.
4. Pawn `(x, h, z)`. Volumes in xz, then `y = h`.

World stays Imagine Video assets. The player stays the sealed Bolt. No wallet. No player API keys. Hang URL stays `https://boltverse-odysseyyyy.grok.me`.
