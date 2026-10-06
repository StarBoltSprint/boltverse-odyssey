---
name: boltverse-imagine-prompts
description: Write a Grok Imagine image or video prompt for Boltverse Odyssey with the game's rules applied. Use for Echo Shard cards, menus, planets, sky video layers, grounds, hard objects, thumbnails, X making-of videos, and lore art.
---

# Boltverse Imagine Prompts

**Purpose:** Whenever a Grok Imagine image or video prompt is asked for Boltverse Odyssey, apply the game's rules automatically. The game is a living painted film: every visible pixel is Imagine. Objects are real solids rebuilt from Imagine views (frigate method), never flat cards, billboards, or sprites. Only the sky is a backdrop. Never drift toward a classic 3D-game look.

**When to use:** Echo Shard cards, menus, planets, skies, grounds, hard objects, thumbnails, X making-of videos, lore art.

Method pages that win over this skill: [`docs/METHOD.md`](../../../docs/METHOD.md), the sky video layer method [`docs/METHOD/sky-video-layers.md`](../../../docs/METHOD/sky-video-layers.md), and the Imagine limits [`biome/docs/64-imagine-build-limits.md`](../../../biome/docs/64-imagine-build-limits.md).

## Step 1: Detect the mode (ask one question if unclear)

- SHOWCASE (Echo Shard cards, menu backgrounds, planet hero shots, thumbnails, making-of videos): strong composition.
- GAME ASSET (hard-object views, ground tiles, sky layers): strict technical framing, zero artistic composition, because composition breaks tiling and 3D reconstruction.

## Always

- Bolt = the existing StarBoltSprint Bolt, a full-white German Shepherd (décor skin accents allowed). Use the Bolt reference image. Never invent another hero, dog, or avatar. Game assets never show Bolt.
- Sharp edges, distinctive silhouettes. No circles, egg-pods, or blob rocks. Hull marks are etched, angular, dark violet.
- One sun. Give azimuth, elevation, and kelvin only if the scene names them. Same light across a set.
- Negatives: no text, no HUD, no watermark, no extra animals, no mirrored or cloned edges, no green fringe.
- Lore flavour (showcase only): shards (éclats) born from the Great Sundering and awakened by the Lightning EMP, "each shard a different possibility, a different sky, a different law". Thunderwolf, the Citadel, cyan/violet lightning accents.

## Step 2: Rules per type

- **Hard objects:** orthographic, no perspective, no tilt, no ground, no stars. One frozen object, centered on a flat black background, small empty margin, nothing touching the corners. Mid-tone skin, panels and seams readable at phone size. One plate per view, same object and light: port and starboard sides (bow right), top (bow right), belly (same side up as the top, not mirrored), square stern cap, cross-sections looking toward the bow, and each protruding part as a side view plus a front cap.
- **Skies:** a nearly empty base (gradient and distant stars), no ground. Nebula, clouds, shooting stars, and planet are each a separate seamless looping video layer: locked camera, no zoom, first frame = last frame. Nebula, clouds/haze, and shooting stars sit on pure black (they are keyed additively). The planet sits on flat chroma green (a black background cannot be keyed without eating the night side). Shooting stars sparse, varied directions. One sun. Slices continue the neighbour's edge, never mirrored. Ask for the highest resolution the mode allows: 1080p for single-image image-to-video, 720p when first/last frames or keyframes are pinned; never the 480p default. Stills at the 2k token. Each layer has its own period (13 / 17 / 29 s family). Never ping-pong a rotation or a meteor.
- **Planets** (worked example and checks: [`docs/METHOD/sky-video-layers.md`](../../../docs/METHOD/sky-video-layers.md)):
  - A photograph, never drawn: spacecraft photo of a gas giant, fine cloud texture, true colour. One sun from the zone's sun side, a real terminator and night side, limb darkening, ring shadow on the disk.
  - Framing: centered, the disk fills about 85–90% of the frame height, the whole ring and the moons inside the frame with a margin of at least 6%. No crop. 16:9 with a ring, 1:1 without.
  - Background: one flat chroma green, no gradient, no vignette, no stars. No glow, rim light, halo, outline, lens flare, or bloom on any edge.
  - Ring: one thin ellipse, behind the planet at the top, in front at the bottom. Moons separate with clean edges.
  - Video: "the planet turns slowly on its axis; cloud bands and storms move together across the disk at the same speed; rigid rotation; no morphing, no new storms appearing, no swelling; locked camera." 6–10 s.
  - Loop: pin the master still as first and last frame and put up to 4 keyframes inside (1/3 s grid) that are **the same planet turned on its axis** (e.g. 60° of longitude per step), made as edits of one 2k master still. Ends alone, or one mid keyframe, hold the disk still. Alternative to test: one 2k still, 1080p image-to-video with no pins, 10–15 s, then keep a frame subset whose ends match.
  - After the cook (state this in the self-check): ship the Imagine file by stream copy only (`ffmpeg -map 0:v:0 -c:v copy -an -dn`), then `python3 tools/sky/layer_source.py check` must PASS. Never scale, crop, or re-encode. Prove rotation on the frames (a band strip shifts one way across the loop, the storm moves with the bands), check the seam (wrap step ≤ 1.5× a normal step, no hold over 0.4 s), and look at it at phone size. A mean frame difference is not proof of a spin.
- **Grounds:** a square, seamless, orthographic photo shot straight down. No horizon, no sky, no Bolt. About 0.90 m across, even grain, edges that tile, a physically structured material (plates, cracks, grains). Make variants by editing.
- **Menus/UI:** a futuristic high-tech Citadel with dark metal, glass, cyan/violet holograms, and a window to space. Never stone or gothic. Video loops at 9:16, 720p.

## Step 3: Showcase composition checklist

One focal point · rule of thirds or golden spiral, described in words (no phi or 0.618) · leading lines · foreground, midground, and background layers · stated light direction · negative space for titles (no text in the image) · level centered horizon unless the camera tilt is stated · three-point perspective only for drone or planet-arrival shots · no camera shake.

## Output format

1. **Mode:** SHOWCASE or GAME ASSET, plus the asset type.
2. **Final Imagine prompt:** one paste-ready block (image or video; aspect, resolution, duration, first/last-frame and keyframe pins when relevant).
3. **Self-check:** 4 to 6 ticks, e.g. Bolt correct or absent · no flat card · framing rule met · loop or tiling stated · no text · composition used (showcase) or none (asset). For a sky layer add: background (black or green) · resolution for the mode · lossless ingest + `layer_source.py` · rotation or drift proof.
