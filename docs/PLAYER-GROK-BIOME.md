# Player Grok — build a Boltverse shard (biome) end to end

**Who reads this:** any player's Grok (grok.com chat or Grok Build), on the player's own plan.
**Trigger:** the player says "I want to explore", "build me a shard", or gives a one-line idea.
The player chooses nothing else. You decide type, name, story, prompts, and assembly. Do not ask follow-up questions unless Imagine is unavailable.

**Not a trigger:** "start / play / lance Boltverse Odyssey". That is the boot reply in [`GROK.md`](../GROK.md) (Welcome + teaser + URL, no Build). Never build on boot.

Hard laws that win over this page: [`docs/METHOD.md`](METHOD.md) (standing owner rules), the Bolt lock and the Imagine-only world in [`GROK.md`](../GROK.md), law 65 [render quality](../biome/docs/65-render-quality.md). Every visible pixel is Grok Imagine. Code only places and composites.

## What is automated now vs manual (be honest with the player)

| Step | Status today |
| --- | --- |
| 1. Shard type, name, story, question, truth | **Automated by you** (chat). Contract + validator exist: [`tools/adventure`](../tools/adventure/README.md). |
| 2. Imagine sky / ground / objects | **You write the prompts; the player's Imagine renders them.** In chat, the player taps generate (or you call Imagine if your session can). Files must be downloaded at full resolution. |
| 3. Checks + pack assembly | **Grok Build only** (needs a shell and a clone). Repo tools run the checks; the object hull build is CPU-heavy. In plain chat, stop after step 2 and hand the files to the player. |
| 4. Play / share | **Manual.** A player shard is not live in the public game until a maintainer merges it. Locally it plays from a static server. |

Do not claim a shard is in the game, on grok.me, or in the Living Codex until a PR is merged.

## Step 1 — Pick the shard (lore, decrees)

Read [`biome/docs/69-adventure-generator.md`](../biome/docs/69-adventure-generator.md) (Purpose, Star Core) and [`tools/adventure/shard-types.json`](../tools/adventure/shard-types.json). Then fill this card. Canon: shards (éclats) are worlds split off by the Great Sundering and awakened by the permanent Lightning EMP — "each shard a different possibility, a different sky, a different law". Bolt (the white StarBoltSprint shepherd) is always the runner.

```json
{
  "shardType": "<one id from shard-types.json, or a new kebab-case id>",
  "name": "<2-4 words>",
  "story": "<2 sentences: what the EMP woke here, what Bolt finds>",
  "question": "<one question about the true nature of the universe>",
  "truth": { "kind": "echo-shard", "insight": "<one Star Core revelation, no decree number>" },
  "sun": { "azimuthDeg": 0, "elevationDeg": 0, "kelvin": 0 },
  "objects": ["<hero solid, e.g. ruined arch>", "<mid solid, e.g. crystal slab>", "<small solid, e.g. boulder>"]
}
```

Rules: the truth is a Star Core revelation in the style of the canon list in `tools/adventure/lib.js`; never invent a decree number. If the player gave an idea, keep it as the core of `story`. One sun for the whole shard.

Grok Build: write a biome kit from the template and check it.

```bash
cp biome/kits/_template/kit.json biome/kits/<shardType>.json   # fill every field
python3 tools/kits/kit.py check --file biome/kits/<shardType>.json
python3 tools/kits/kit.py show --id <shardType>   # = PREAMBLE, prepend to every prompt below
```

In chat (no shell): the preamble is: `<name>. One sun: azimuth <a>°, elevation <e>°, <k> K. Level horizon at 50% of the frame. Every visible pixel is an Imagine image or video.`

## Step 2 — Imagine prompts (copy, fill `<…>`, prepend PREAMBLE)

Full rules: skill [`.grok/skills/boltverse-imagine-prompts`](../.grok/skills/boltverse-imagine-prompts/SKILL.md), limits [`biome/docs/64-imagine-build-limits.md`](../biome/docs/64-imagine-build-limits.md). Always ask for the **highest resolution**: stills at 2k, video 1080p (720p only when first/last frames are pinned), never the 480p default. Game assets never show Bolt, text, HUD, watermark.

### 2a. Sky — empty base still + one looping video per animated element

Method: [`docs/METHOD/sky.md`](METHOD/sky.md), [`docs/METHOD/sky-video-layers.md`](METHOD/sky-video-layers.md). Never put one video over an already-full sky.

```text
SKY BASE (still, 21:9, 2k): <PREAMBLE> Empty night sky of <name>: smooth gradient and sparse distant stars only, no ground, no planet, no clouds, no text. Level horizon exactly at the bottom edge. Fills the whole frame.
```

```text
SKY LAYER (video, image-to-video, 1080p, seamless loop): <PREAMBLE> <one element: nebula | thin clouds | sparse shooting stars> on pure black background. Locked camera, no zoom, no pan. First frame identical to last frame. The element fills the frame. No ground, no text.
```

```text
PLANET (video, 1080p, seamless loop): <PREAMBLE> Photorealistic <planet description> filling almost the whole frame, slowly rotating on its axis, on flat chroma green (#00FF00). Locked camera, no zoom. First frame identical to last frame. No text.
```

Check: scrub the planet frame by frame and confirm it rotates. Gate: `python3 tools/sky/layer_source.py` and `python3 tools/sky/check.py`.

### 2b. Ground — continuous, no tile grid

Method: [`docs/METHOD/ground.md`](METHOD/ground.md), skill [`.grok/skills/ground-tiles`](../.grok/skills/ground-tiles/SKILL.md). At least 4 variants of the same material, same light.

```text
GROUND (still, 1:1, 2k, ×4 variants): <PREAMBLE> Orthographic top-down photo of <ground material> of <name>, seamless and tileable on all four edges, even exposure, no single focal feature, no repeating motif, no lines or grid, no objects taller than pebbles, no shadows of off-frame objects, no sky, no text. Fills the whole frame.
```

Gate: `python3 tools/assetcheck/check.py --dir <ground dir> --kind tile --out reports/assetcheck` (wrap seam, exposure, magnification ≤ 1 at 720×1600). A visible checkerboard is FAIL.

### 2c. 2–3 objects — real solids (frigate method), never flat cards

Method: [`docs/METHOD/hard-objects.md`](METHOD/hard-objects.md), skills [`.grok/skills/orbit-views`](../.grok/skills/orbit-views/SKILL.md) and [`.grok/skills/keyed-cutout`](../.grok/skills/keyed-cutout/SKILL.md). One object = one set of views of the same frozen object, same light. The views become a 3D hull; the Imagine pixels are its skin.

```text
OBJECT VIEW V0 (still, 2k): <PREAMBLE> One <object> of <name>, frozen, centered, orthographic, no perspective, no tilt, side view. Sharp angular silhouette (no circles, no blobs). Flat black background, small empty margin, nothing touching the corners. No ground, no stars, no text. Mid-tone skin, panels and seams readable at phone size. Its base is flat so it can stand on the ground.
```

```text
OBJECT NEXT VIEW (edit of V0, then of each previous view): Same object, same light, same scale, rotated <45 | 90 | 135 | 180 …>° around its vertical axis. Keep every detail consistent. Flat black background, same margin.
```

Make: side views every 45° (8) or, for ship-like solids, port, starboard, top, belly, stern cap. Cut out to PNG with alpha (keyed, no green/black fringe). Gate: `python3 tools/assetcheck/check.py --dir <views dir> --kind cutout --key alpha --out reports/assetcheck` then `python3 tools/objsheet/sheet.py` (see [`tools/objsheet/README.md`](../tools/objsheet/README.md)).

## Step 3 — Assemble into a pack (Grok Build)

Reuse the corridor; do not write a new engine. Template: [`packs/corridor-ab`](../packs/corridor-ab/README.md) (corridor run) and [`packs/zone-a`](../packs/zone-a/) (sky dome, ground, rocks, ruins, hulls).

```bash
git clone https://github.com/StarBoltSprint/boltverse-odyssey && cd boltverse-odyssey
git checkout -b shard/<shardType>
mkdir -p packs/<shardType>/src && cp -r packs/corridor-ab/play packs/<shardType>/play
# put sky/, ground/, objects/ under packs/<shardType>/src/
python3 tools/walkaround/build.py --views <views dir> --config <config.json> --out packs/<shardType>/src/objects/<obj>   # one per object; read qc/report.json
python3 tools/library/library.py add --intake intake.json   # register each passing solid
```

Then point `packs/<shardType>/play` at your files (sky layers, ground stills, hulls) in place of the zone A paths. Keep these rules:

- **Seeded placement only.** Objects are placed from `?seed=` (deterministic stream, [`biome/docs/68-wfc-path-placement.md`](../biome/docs/68-wfc-path-placement.md), `python3 tools/wfc-path/wfc.py`). Placement never draws a pixel.
- **Born beyond the fog.** Spawn every solid farther than `FOG_FAR` in `play/ground.js` (fully hidden), so it emerges out of the fog as Bolt runs. Nothing pops in near, nothing teleports. Balance big solids left and right.
- **Grounded.** Every solid sits on the ground (no floating); collisions follow its faces (no invisible walls).
- **No tile grid.** Ground repeats with crossfaded windows as in corridor-ab; no visible squares.
- **Phone budget:** draw calls ≤ 12, texture memory ≤ 260 MB, videos ≤ 4 including Bolt. Check with `?debug=1` (perf line, [`tools/perf/README.md`](../tools/perf/README.md)).
- **Bolt** is `lock/bolt-gallop-cycle.mp4`, unchanged. Camera behind and above Bolt, as in corridor-ab.

Gate before PR: `node tools/playcheck/src/premerge.mjs` ([`tools/playcheck/README.md`](../tools/playcheck/README.md)) and `python3 tools/judge/judge.py` ([`tools/judge/README.md`](../tools/judge/README.md)). A score never overrides a hard law.

## Step 4 — Play and share

```bash
python3 -m http.server 8000   # from the repo root
# open http://localhost:8000/packs/<shardType>/play/index.html?seed=1&debug=1
```

Share: fork, push `shard/<shardType>`, open a PR to `StarBoltSprint/boltverse-odyssey` with the card from step 1, the prompts you used, and a 10 s phone clip. Post it on X with `#CreeTonEclat @grok @StarBoltSprint`. A maintainer reviews; nothing auto-merges. Only after merge is the shard in the public game.

Report to the player in one short message: shard name, story, question, what was generated, what passed, and the next manual step. If a repo tool let a defect through, file feedback ([`biome/docs/66-tool-feedback-loop.md`](../biome/docs/66-tool-feedback-loop.md)).
