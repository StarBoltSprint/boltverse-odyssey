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

Wire: `TEX[kind][variant].bole / .crown / .imp` from [`twoPlane.ts`](../scripts/jade-lod/twoPlane.ts) `texOf`. Capsules stay `KIND_TABLE[kind].r` on the **bole**. The crown is not a collider. `KIND_TABLE` is the hung `KIND_RH`.

**FAIL:** a sheet with a second tree, a path, or Bolt.

---

## 2. Ground and sky plates

Two looping films, empty of things you can thud.

`jade_ground.mp4` — world-XZ projected. A little travel or haze is fine. It is not a treadmill that slides dirt under planted cards.

```
uv.x = worldX/24 + 0.02*sin(pictureTime)
uv.y = worldZ/24
```

Picture-time, not the wall clock. Stub: [`plates.ts`](../scripts/jade-lod/plates.ts).

`jade_sky.mp4` — dome or sphere, yaw only, no pitch flip. The horizon color matches the ground edge.

Optional second ground pass: the same clip, UV / 1.7, opacity about 0.2, 8 cm lower.

Cards parent to world XZ **on** this floor. They are not composited into the mp4.

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

Widths: bole about 0.7–1.0 m, crown about 1.8–2.4 m. Elder takes the top of each range. Trunk radius sits on the bole: contact 0.28, bole 0.55. The live capsule is still `KIND_TABLE[kind].r` (bole 0.55, elder 0.9, and the other kinds as hung). Never the crown width.

| Band | Bole | Crown | Shadow | Impostor |
|---|---|---|---|---|
| Near | 1 | 1 | 1 | 0 |
| Mid | 1 | 0 | 0 | 0 |
| Far | 0 | 0 | 0 | 1 |
| Cull | 0 | 0 | 0 | 0 |

Near ↔ mid dissolves **only crown and shadow** (~220 ms). The bole stays cutout and writes depth. Mid ↔ far dissolves bole ↔ impostor (~280 ms). Both sit inside the 220–280 ms fade band and under the cap of 8. The capsule never fades.

Crown faces the camera about 0.85. Bole about 0.55. The single-card kit stays 0.70.

---

## 4. Heightfield, posture only

```
h(x,z) = 0.20 + 0.20 * fbm(x/28, z/28, s+101)
```

That is 20–40 cm. Stub: [`height.ts`](../scripts/jade-lod/height.ts).

Bolt's feet, the card group, the shadow, and the capsule base use `h`. Inside `pathHalf` the corridor flattens toward 0.20.

This noise does **not** decide spawn. Spawn stays the hung `spawnChunk` page — n1 / n2 / n3 at L = 14 / 40 / 22. Height is a different page (`s+101`, scale 28), so a peak is not automatically a tree.

Law 44 still holds: the ground Imagine film stays the flat plate. Height moves contact in meters. It does not paint or lift the sol photo. A fractal that redraws sol is FAIL.

---

## Frame

1. Picture-time on the plates.
2. `tickField` → rows + volumes `(x, z)`.
3. Snap kits to `h`. Two planes by band. Fade the crown on near ↔ mid.
4. Pawn `(x, h, z)`. Volumes in xz, then `y = h`.

World stays Imagine Video assets. The player stays the sealed Bolt. No wallet. No player API keys. Hang URL stays `https://boltverse-odysseyyyy.grok.me`.
