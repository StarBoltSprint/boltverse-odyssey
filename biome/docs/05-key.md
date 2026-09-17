# 05 — key (chroma + crown)

B-stack cutout is **not** luma, not SVG `#bolt-luma`, not a Fourier blob.

Rush = white GSD on **green**. Plate = empty road. One canvas.

## Keep

| Step | Law |
|---|---|
| Color difference (Vlahos) | `greenness = G − max(R,B)`. `> 16` and `G > 40` → α 0. `4–16` → ramp + despill `G ← max(R,B)`. |
| Spill | leftover `G > max(R,B)` → clamp G. No sunset grade on the body (cream cast). |
| Feather 1 px | opaque pixel with a transparent 4-neighbour → drop α. Stops the sticker. |
| Crown plage × bande | 100 px under the **true** silhouette top. Kill `sat > 0.44` and `R > B+16` and `R ≥ G`. Pipe sat ~0.55, fur ~0.28. |
| Dual road | two decoders + hold. Never `clearRect` the plate (black flash). |
| Plant | canvas `drawImage(bolt, dx, 0)`. `SHIFT = 30`. **X only.** No rotate, no skew. |
| Shadow | paws bbox ellipse, `source-over`. No `multiply`, no `filter` (Samsung skips them). |
| VER | `/master/road.mp4?v=r38` + `/master/bolt.mp4?v=r38`. |

## Do not

| Technique | Fail |
|---|---|
| RGB color-lines (fur / dark legs) | shadows fall off-line → holes |
| Fourier / shape matte | ears are high-freq → potato skull |
| Luma mask | green, fur, pipe are all bright |
| `v < 230` on the pipe | sunlit gold survives |
| Cut everything above “white fur top” | sunset sat on the crown → back becomes top → head sliced |
| 3-take L/M/R | cannot sync three films |
| `#bolt-luma` SVG | not a green-screen key |

## One line

**Chroma for the screen. Saturation × crown band for the glued gold. Do not redraw the dog.**

Reference: [../reference/LanePlayer.tsx](../reference/LanePlayer.tsx).
