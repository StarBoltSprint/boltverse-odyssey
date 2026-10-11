**Ranking by feasibility × speed (today, on a stylized scene like your key image)**

1. **Grok as coding architect** — highest feasibility + speed
2. **Imagine as scanner** (photogrammetry-style) — high feasibility, medium speed
3. **Imagine as consistency judge** — high feasibility, medium-high speed
4. **Debate loop** — medium feasibility, slower
5. **Growing library** — high long-term feasibility, not a per-zone speed win by itself

Target for a phone-quality zone (several towers + terrain + debris, low-to-mid poly, textured, playable): **2–6 minutes wall-clock** with parallel calls. Single tower facade: **30–90 seconds**.

---

### 1. Imagine as a scanner (“measurements, not pretty pictures”)

Push: Treat Imagine as a controlled multi-sensor suite.

- Clay / grey render → silhouette + form (already strong from previous test).
- 4–6 controlled relights (hard left, right, top, rim, soft fill) → photometric stereo normals written by Grok Build.
- Flat-color map → initial regions.
- Optional short orbit video (6–10 s) → classic SfM/MVS frames.
- Explicit “measurement” prompts: “output a side-view orthographic of the central tower with scale bar” or “height map of the dunes only.”

**Speed**: 45–120 s per tower (parallel image gen + light classical code). Full zone: 2–4 min.  
**Accuracy**: Relative geometry and large planes 75–88% of MoGe-2 on this style of content; normals ±8–12° on facades; metric scale still needs one vision anchor. Thin wires and deep occlusions weaker.  
**Cost**: 6–12 Imagine images (~$0.3–0.8) + optional video (~$0.5–1.5) + a few vision calls.  
**Biggest risk**: Inconsistent multi-view generation (towers drift or lighting changes between frames) breaks SfM. Mitigate with strong “exact same camera and geometry, only lighting changes” constraints and vision consistency checks.

### 2. Grok as a coding architect (vision → parametric code)

Push: Vision first extracts a structured scene graph (“central tower: ~200 m bevelled blade, 12° taper, bite on lower third, ladder on right face, rings at 80% height”). Grok then emits clean parametric three.js or Blender Python (extrusions, boolean bites, instanced debris, heightfield dunes).

Render-compare loop is short because the code is already semantic and editable.

**Speed**: Fastest single-tower path — 20–60 s (1–2 vision calls + code gen + 1–2 render checks). Zone: 1.5–3 min with parallel object generation.  
**Accuracy**: Excellent for major silhouettes, proportions, and clean mobile topology (often better than dense reconstruction for phone performance). Fine surface detail and exact organic dune shape lag pure photogrammetry.  
**Cost**: Low — mostly token usage (a few $0.05–0.2) + 1–3 clay/reference images.  
**Biggest risk**: Hallucinated proportions or missed features when vision under-describes. Mitigate with clay render as visual reference and one mandatory “diff against clay” vision step.

### 3. Debate loop (builder / critic / arbitrator)

Push: Three specialized Grok instances (or sequential roles in one agent):

- Builder emits geometry code or mesh parameters.
- Critic overlays render on original + clay and lists concrete errors (“left edge 14 px out, bite too high”).
- Arbitrator decides which changes to accept and rewrites the next prompt.

**Speed**: 2–5 min per tower (3–6 rounds). Zone: 8–15 min without heavy parallelization.  
**Accuracy**: Highest consistency — catches systematic errors the single-agent loop misses. Can reach 85–90% visual match on major forms.  
**Cost**: Higher token burn (3–5× a single loop) + renders.  
**Biggest risk**: Debates that fail to converge or oscillate on minor details. Cap rounds and force early termination on a vision score threshold.

### 4. Imagine as consistency judge

Push: Render your 3D from the estimated camera. Ask Imagine: “re-render this exact composition and camera in the precise style, lighting, and materials of the key image.” Compute a difference map (or have vision score the delta). Large changes = your geometry or texture is wrong.

**Speed**: 30–90 s per check. Fits inside other loops. Zone: adds 1–2 min.  
**Accuracy**: Very good at spotting silhouette, proportion, and major lighting mismatches. Weaker on subtle normal or texture errors.  
**Cost**: 1–2 Imagine images per judgment (~$0.05–0.15).  
**Biggest risk**: Imagine “improves” the scene stylistically even when your 3D is correct, creating false positives. Constrain the prompt extremely tightly (“change nothing except match the style of reference; preserve geometry exactly”).

### 5. Growing library of validated parts

Push: Every accepted tower, dune patch, debris piece, or player-created object is stored as parametric code + texture + validation score + usage tags. Future zones query the library first (“closest match to this silhouette”) and only generate deltas.

**Speed**: Near-zero for reused parts; first-time objects still pay the full cost. Over time, zone time drops toward 30–90 s.  
**Accuracy**: High once validated; new variants inherit quality.  
**Cost**: Storage + occasional re-validation.  
**Biggest risk**: Style drift or low-quality player content polluting the library. Require vision + human or multi-Grok validation gate before promotion.

---

### Invented / stronger ideas

- **Hybrid “scan-then-code”** (best of 1 + 2): Run a fast clay + flat-color + one orbit, extract measurements, then immediately switch to parametric code generation constrained by those measurements. Avoids full dense mesh while still grounding the numbers.
- **Orthographic measurement sheet**: Ask Imagine for a set of orthographic views (front, side, top) with explicit scale bars and dimension lines. Vision reads the numbers directly into the parametric generator. Extremely fast and phone-friendly.
- **Progressive LOD builder**: Generate a ultra-light proxy first (seconds), validate with the consistency judge, then refine only the failing regions. Keeps early feedback under 30 s.
- **Player-in-the-loop library seeding**: During play, let users “claim” or lightly edit an object; Grok turns the edit into a new validated parametric variant automatically.

---

### Fastest combination that keeps top phone quality (target: minutes per zone)

**Core pipeline (1.5–4 min per zone)**

1. **Vision scene graph + metric anchors** (10–20 s) — camera, object list, rough sizes.
2. **Parallel Imagine scanner** (30–60 s) — clay render, flat-color map, 3–4 relights, optional short orbit.
3. **Parametric code architect** (20–40 s) — Grok writes clean three.js / Blender code for each major object, constrained by the measurements and clay.
4. **One consistency-judge pass** (20–40 s) — render → Imagine style-match → difference map → targeted code fixes on failing objects only.
5. **Library lookup & commit** (background) — reuse any close match; store validated new parts.

**Why this wins**

- Parametric code keeps meshes light, editable, and phone-efficient (low draw calls, clean topology).
- Scanner measurements prevent pure hallucination.
- Single judge pass catches the biggest errors without a full debate.
- Library amortizes cost across zones and players.

**Realistic numbers for one zone** (4–6 towers + terrain):

- Wall-clock: 2–5 minutes.
- Imagine images: 8–15.
- API/token cost: $1–4.
- Quality: major forms and silhouettes 80–90% of current MoGe+SAM2 visual fidelity, with far better mobile performance and full editability.

This combination is the practical “Grok-native Bolt” path today. The pure coding-architect route is the absolute speed winner for simple towers; the scanner + judge layer is what keeps quality high enough for production.
