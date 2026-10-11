Yes — build a thin Boltverse layer on top of three.js. A custom engine would cost far more time than it saves and would fight the AI agents. three.js already gives you WebGL2, LODs, InstancedMesh, Fog, environment maps, and a large mobile-performance body of knowledge. The layer’s job is to make zones declarative, agent-friendly, and automatically verifiable so Grok Build and your bots can produce playable zones with minimal human glue.

## 1. What the layer should contain

Keep it small and opinionated:

- Zone loader + segment manager: Reads one zone file, builds a fixed number of recyclable segments, pools objects, and uses InstancedMesh (or BatchedMesh) for repeated props. This is the heart of the endless runner.
- Placement & camera system: Stores world-space transforms. Can temporarily snap the camera to the key-image pose for verification and hero framing, then hands control to the runner camera.
- Lighting & atmosphere module: Sun/directional light + color extracted from the key image, FogExp2, environment/probe or 360 Imagine sky, optional cheap god-rays or screen-space light shafts. Baked bounce or simple light probes where you already have them.
- Default gameplay hooks: Lane system, collision (simple or BVH), and the “world wakes up” system (see #6). Every zone inherits these.
- Orchestrator command: One entry point (CLI or Grok Build tool) that takes a key image and emits a verified playable zone.
- Verification suite: Automated key-camera screenshot + perceptual diff, draw-call / triangle budgets, and basic quality gates that already exist in your Imagine-to-3D tool.
- Adaptive quality knobs: DPR cap, shadow quality, post-process toggles, LOD bias — tuned for the S20 FE class.

Everything else (player controller, score, UI) stays outside the layer.

## 2. What’s missing, ranked by impact on speed and quality

1. End-to-end orchestrator + automated visual/perf gates (highest leverage). Without this, every zone is manual and inconsistent. Directly multiplies agent productivity.
2. Mobile asset pipeline + draw-call discipline (KTX2/Basis textures, Draco or meshopt geometry, aggressive InstancedMesh, <80–100 draw calls). This is the difference between 50–60 fps and thermal throttling on an S20 FE. Tiki Dash (recent three.js endless runner) showed that collapsing forests into InstancedMeshes dropped draw calls from ~770 to ~160 and, combined with a 1.5 DPR cap, delivered ~57 fps on a mid-range 2021 Android. (Source: Discourse.threejs)
3. Robust segment recycling + object pooling. Prevents GC spikes and keeps memory and draw calls constant. Critical for endless.
4. World-consistent placement that survives camera movement. Current auto-placement is camera-matched; you need the same transforms to look correct from the runner camera.
5. Default “wake-up” system so the core fantasy is free on every zone.
6. Lighting/atmosphere matching + cheap Unreal-like effects that stay mobile-friendly (fog, simple probes, optional three-good-godrays or faked shafts).
7. Device profiling and adaptive quality. Ongoing, but an early version is needed before you declare a zone “verified.”

## 3. Zone file format

Use JSON with a JSON Schema. It is the most reliable format for Grok Build to read and write without syntax drift. Version the schema. Keep human-readable but strictly structured.

Sample schema (abbreviated but practical):

```json
{
  "$schema": "https://boltverse.odyssey/zone.v1.schema.json",
  "version": "1.0",
  "id": "desert_ruins_01",
  "keyImage": "key-city3.jpg",
  "keyCamera": {
    "position": [0, 2.2, 12],
    "target": [0, 1.0, 0],
    "fov": 48
  },
  "biome": {
    "groundMaterial": "sand_dunes",
    "sky": "sunset_equirect.jpg",
    "fog": { "color": "#e8a070", "density": 0.012 }
  },
  "lighting": {
    "sun": {
      "direction": [0.3, -0.6, -0.7],
      "color": "#ffcc88",
      "intensity": 1.4
    },
    "ambient": 0.15,
    "probes": []
  },
  "assets": [
    {
      "id": "tower_main",
      "glb": "tower_main.glb",
      "lods": ["tower_main_lod1.glb", "tower_main_lod2.glb"],
      "texturesKtx2": true
    }
  ],
  "segments": [
    {
      "length": 40,
      "objects": [
        {
          "asset": "tower_main",
          "position": [4.2, 0, -18],
          "rotation": [0, 12, 0],
          "scale": 1.0,
          "wake": { "type": "emerge", "speedThreshold": 12 }
        }
      ]
    }
  ],
  "wakeDefaults": {
    "type": "shaderReveal",
    "speedFactor": 1.0,
    "distanceAhead": 25
  },
  "gameplay": {
    "lanes": 3,
    "laneWidth": 3.5
  },
  "qualityGates": {
    "maxDrawCalls": 80,
    "maxLpipsKeyView": 0.18
  }
}
```

Grok Build can emit and patch this reliably; your loader validates against the schema.

## 4. End-to-end automatic pipeline

One orchestrator (Python or Node, called by Grok Build) with hard gates:

1. Key image → Grok Imagine multi-view turnaround, masks, optional 360 sky.
2. Existing Imagine-to-3D tool (masking, Depth Anything, projection, LODs, anti-morph, px/m / UV / key-image gates). Fail if gates fail.
3. Auto-placement + lighting extraction → populate zone.json.
4. Compress (KTX2, Draco/meshopt).
5. Build runtime bundle.
6. Headless render (Puppeteer + three.js or OffscreenCanvas) from exact keyCamera → compute LPIPS (preferred) or SSIM + optional Grok vision “match score.” Fail if above threshold.
7. Draw-call / triangle / memory proxy check.
8. Emit playable link + verification report.

Fail fast. Agents retry only the failing stage. This is the highest-impact missing piece.

## 5. Measuring placement and lighting

- Key match: Render from the exact key-camera pose stored in the zone file. Use LPIPS (perceptual, better for generated content) as primary metric, SSIM as secondary, plus a Grok vision “does this framing and lighting match the key image?” score. Thresholds live in the zone file or global config.
- Consistency when the player moves: All transforms are world-space. The key-camera pose is only a verification snapshot. Fog, LOD, and frustum culling hide distant differences. Re-render from a few offset cameras during the gate and confirm no large pops.
- Lighting: Extract sun direction/color (image analysis or Grok vision). Set the directional light + fog color. Re-render the key view and include lighting match in the same LPIPS/vision gate. Environment/360 sky from Imagine keeps reflections consistent.

## 6. “World wakes up on sprint” by default

Design it so every zone gets it for free with zero morphing or popping:

- Objects are pre-placed in an “asleep” state (slightly buried, lower opacity, or dark material).
- Each instance carries a wakeProgress attribute (0–1).
- A shared shader drives the effect: vertex offset to emerge from the ground (sand, rubble, etc.), or opacity/emissive ramp. Progress is a function of player speed × time or distance-ahead.
- For discrete cases, pre-generate 2–3 visual variants and blend or swap via instance visibility / LOD only when progress crosses a threshold (anti-pop via short cross-fade).
- wakeDefaults in the zone file (or a global base) apply automatically; individual objects can override. No per-zone custom code required.

This stays GPU-cheap and works with InstancedMesh.

## 7. Open-source projects and ideas worth copying

- Tiki Dash (three.js r184, Vite, TypeScript, mid-range Android target): InstancedMesh for vegetation, DPR cap at 1.5, live HUD for fps/draw calls. Excellent mobile budget reference. (Source: Discourse.threejs)
- Other three.js endless runners (Sky Fox, various Metro/Temple Run demos, CodePen lane runners): segment recycling, object pooling, lane logic, fog for depth.
- Atmosphere: three-good-godrays (screen-space), @pmndrs/sky (Hillaire atmospheric sky, WebGPU/TSL), built-in Fog/FogExp2.
- Image-to-3D pipelines (AssetFurnace, Depth-Anything-3 + Blender addons, TRELLIS/Hunyuan variants): multi-view and evaluation ideas, even if you stick with your own tool.
- Performance references: three.js community guidance of ~100 draw calls on mobile, KTX2, object pooling, and the recent web-optimization collections.

Steal the patterns; don’t import whole engines.

## 8. Step-by-step build order with rough effort

(With Grok Build doing most of the coding; calendar time assumes parallel agent work.)

1. Zone schema + loader + key-camera verification harness (1–1.5 weeks) — foundation.
2. Segment recycler + InstancedMesh/object pooling (1 week) — endless + performance.
3. Orchestrator wrapping existing Imagine-to-3D + placement + lighting extraction (1.5–2 weeks) — closes the loop.
4. Default wake-up shader/system + wakeDefaults (1 week) — gameplay fantasy for free.
5. Asset compression pipeline (KTX2 + geometry) + draw-call enforcer (1 week) — S20 FE fps.
6. Lighting/atmosphere polish + automated LPIPS/vision gates (1–1.5 weeks) — quality.
7. Adaptive quality + basic device profiling (0.5–1 week) — stability.
8. Multi-zone transitions (1 week) — after the first zone is solid.

Core playable verified pipeline: ~6–8 weeks of focused work. Profile early on real or emulated S20 FE-class hardware; the Tiki Dash numbers show that draw-call and DPR discipline matter more than raw triangle count.

Your existing Imagine-to-3D quality gate and partial auto-placement are strong foundations. The biggest unlock is the thin layer + single orchestrator that turns a key image into a verified playable zone without human glue. That is what lets the agents scale.
