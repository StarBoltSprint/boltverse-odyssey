# Art direction — 2026 AAA look baked into every prompt (IN TEST, 2026-10-08)

**Status: IN TEST.** Exact wording lives in the untracked `tools/biome/style/<styleId>.local.txt` and
`.avoid.local.txt` (repo rule 2026-10-03: prompts stay out of tracked files). This page records the decisions.

## 1. Order of authority

1. **Bible numbers** (sun, palette, fog, exposure) — the lock sentence, identical in every prompt.
2. **Slot clause** — what this one image is (camera, framing, subject).
3. **Style block** — one paragraph shared by every slot of every biome using that style id.
4. **Avoid list** — appended last.

Changing the style block changes every cache key (it is hashed with the prompt), so a style change is a deliberate,
visible re-cook, never a silent drift.

## 2. What the style block asks for (paraphrased)

- A current-generation cinematic real-time look: global illumination feel, physically based materials, crisp
  micro-detail on top of large readable shapes.
- **One** coherent sun with soft bounce; atmospheric perspective that cools and lifts with distance.
- Colour rich but held inside the bible palette; deep shadows that keep colour and detail (never crushed).
- Gentle filmic contrast, no clipped whites, sharp edge to edge, fine natural grain.
- A photoreal-painterly hybrid like a premium console title, not a photo and not a cartoon.

## 3. What the avoid list bans (categories)

Studio or flat lighting, a noon sun, a second sun, neutral white light, pure black shadows, black matte fringes,
any planet or moon in a sky plate, text / logos / watermarks, mirrored halves, visible tiling, cel shading, plastic
look, neon, heavy lens flare, smeared or blurry AI texture, people, vehicles, UI.

## 4. Per-slot camera language

- Sky plates: level camera, horizon at mid-height, heading given in degrees from the run direction, the sun side
  stated relative to that heading.
- Ground: straight top-down, seamless on all four edges, metres per tile stated.
- Object silhouettes: orthographic, object centred, filling about 80 % of the frame (86 % for a hero; QC fails under 70 %), plain flat empty background the reader can segment.
- Three-quarter colour plates: 15° above, 45/135/225/315° around, same light as the anchor.

## 5. Checks that enforce it

The look is not judged by eye first: `qc.py` measures every plate against the anchor (horizon, shadow, highlight,
saturation, lit face, seams, bbox, grain). See [`biome-bible.md` §5](biome-bible.md#5-qc-numbers-ciede2000-against-the-anchor).
