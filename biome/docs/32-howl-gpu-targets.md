# 32 — Howl GPU targets (two rails)

**Sealed 2026-09-22 (SmiR).** Hang ≠ wipe. Recipe, not Live wiring. Howl pixels are the hung KEEP. This file does not shader them.

Dodge events and Howl targets are **different plates**. Law [25](25-hazard-cone.md) does not become destroyable because a Howl exists.

Paste: [`COLD_START-howl-gpu.md`](COLD_START-howl-gpu.md)  
**Howl KEEP:** [`../fx/howl/howl-attack.mp4`](../fx/howl/howl-attack.mp4) — SmiR sealed 2026-09-22. REUSE. Do not recook.  
Imagine post: https://grok.com/imagine/post/fd87eff5-39a5-4cd0-a356-ea2a81262ba5  
Folder: [`../fx/howl/README.md`](../fx/howl/README.md)  
Attack look: [`../prompts/howl-attack.txt`](../prompts/howl-attack.txt)  
Obstacle plate: [`../prompts/howl-obstacle.txt`](../prompts/howl-obstacle.txt)  
Shatter plate: [`../prompts/howl-shatter.txt`](../prompts/howl-shatter.txt)

---

## Law 25 vs law 32

| | **25 — rail A** | **32 — rail B** |
|---|---|---|
| What | Imagine-baked dodge event (meteor, comet, crystalfall) | Imagine keyed obstacle, GPU-placed like Bolt |
| In the road mp4 | yes, wet in the plate | **no** — own plate |
| Player | dodge | Howl destroys **this** quad only |
| Destroyable | **never** | yes |
| Shatter | none | **separate** Imagine plate **per type** |
| Judge | `plate-hazard-qc.py` | this law + anti-sticker [13b](13b-anti-sticker-contact.md) / [15](15-gpu-compositor.md) / [17](17-live-compositor.md) |

A plate may carry both. The baked meteor still arrives if the player Howls. Howl removes the keyed quad. It does not erase rail A pixels.

Sharing a lane ray does not promote a meteor to a target. The same noun must not sit in the law 26 hazard column and the GPU Howl column.

If the plate already blocks **2** lanes (`--expect 2`), the GPU target is **—**. A Howl target must not close the free corridor.

---

## Rail B — keyed obstacle (like Bolt)

Cook one Imagine plate per **type** (quartz, prism, storm, …). Flat `#00FF00`. One object. No road, no dog, no rings, no shatter in that file.

GPU places it. The compositor owns position and scale along the cone (same ray math as law 25):

\[
x(y) = x_{VP} + b_{\text{lane}}\,(y - y_v)
\]
\[
w(y) = k_{\text{lane}}\,(y - y_v)
\]

\(y_v = 0.382\) · \(x_{VP} = 0.53\). The clip does not contain the approach. Imagine holds the prop. GPU foreshortens it.

**Anti-sticker (mandatory, same family as Bolt):**

- Quad dest, not a CSS sprite, not a scissor sketch ([15](15-gpu-compositor.md) · [17](17-live-compositor.md)).
- Green key + despill ([05](05-key.md) · [13c](13c-green-despill.md)). Luma protect so dark crystal facets survive.
- Grade and plate bounce from **this** road ([13b](13b-anti-sticker-contact.md) · [17](17-live-compositor.md)). A studio-lit prop on a night plate is a sticker.
- Contact shadow on the road when the prop is at plant height. In the air, no skateboard blob.
- Do not bake the obstacle into `road-<biome>*.mp4`.

---

## Shatter — one plate per type

Shatter is **not** inside the Howl video and **not** inside the obstacle video.

| Type | Obstacle plate | Shatter plate |
|---|---|---|
| quartz | `obstacle-quartz.mp4` | `shatter-quartz.mp4` |
| prism | `obstacle-prism.mp4` | `shatter-prism.mp4` |
| storm | `obstacle-storm.mp4` | `shatter-storm.mp4` |
| rune | `obstacle-rune.mp4` | `shatter-rune.mp4` |

On Howl arrival the GPU **swaps** the obstacle quad for that type’s shatter plate, then both leave. A quartz hit never plays a prism shatter.

Key = flat `#00FF00`. Flying fragments of that one object.

**BAN:** flat 2D broken-glass rectangle · black squares · opaque black mats · full-frame black rects around shards · one shared shatter for every type · shatter baked into the Howl.

---

## Howl — Imagine VIDEO only (SmiR KEEP)

**Hung:** [`../fx/howl/howl-attack.mp4`](../fx/howl/howl-attack.mp4). One plate for every biome. Not a shader.

Cold Groks **REUSE** that file. Do not cook a second Howl. Width and speed may tune in Live. The GPU may scale and aim the quad. It may not redraw the rings.

The sealed look (do not rewrite; [`howl-attack.txt`](../prompts/howl-attack.txt) is the text of this plate):

- Vertical ring stack. Rings stand upright (a tunnel of vertical circles), travel **rightward**.
- White core, yellow-orange inner rim, neon electric blue outer fringe. Thick, ribbed, volumetric.
- Progressive ~6s: rings **birth narrow** at the **left** (Bolt’s mouth), then each ring farther out is **wider**. Narrow → progressively wider. Energy leaves first and arrives later. The full tunnel does not pop in on frame 0.
- Locked camera. Tripod. Zero pan / tilt / dolly / zoom / shake. Only rings move.
- Pure `#000000` key. No wolf body. No road. No UI.
- **No** crystals, shards, explode, debris, impact burst. Shatter stays on its own plates.

GPU plays the hung plate as an FX quad from Bolt toward the current rail B target. It may scale and aim the quad. It may **not** redraw the rings. Width and speed may tune in Live.

**BAN:** procedural / WebGL / canvas Howl · thin laser · lightning · sine filaments · soft bubble · horizontal pancakes · a Howl painted into the road mp4 · a gallop cycle where Bolt stops and vocalizes (that ban stays on the green dog — [02](02-videos.md)).

Hall breath is not this plate. Breath = citadel, same still twice, chest rise ([FILMS.md](../../FILMS.md)). Sprint attack Howl = this Imagine VIDEO.

---

## Cook order

1. Rail A road plates still follow laws 23 → 25 → 33. Howl does not skip them.
2. **REUSE** [`../fx/howl/howl-attack.mp4`](../fx/howl/howl-attack.mp4) (SmiR KEEP). Do not recook the rings. SmiR reseal only.
3. Cook each obstacle type from `howl-obstacle.txt` (green key).
4. Cook each shatter type from `howl-shatter.txt` (green key, that noun only).
5. Composite in the GPU stack above. Do not hang a keyed plate that still shows green, a black mat, or a road.

Live hitboxes, `uHit`, and player input are **not** this file. Hang the recipe. Wire later.

**FAIL if:** Howl is a shader · the hung Howl is recooked · shatter is inside the Howl · black rectangles around shards · a meteor is marked destroyable · rail B is baked into the road · the obstacle is a sticker (no bounce, no contact, knife alpha) · one shatter plate serves every type.

Related: [25](25-hazard-cone.md) · [13b](13b-anti-sticker-contact.md) · [15](15-gpu-compositor.md) · [17](17-live-compositor.md) · [02](02-videos.md) · [26](26-biome-sprint-plan.md) · [00](00-PRIORITY0-any-biome.md)
