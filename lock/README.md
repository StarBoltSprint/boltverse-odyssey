**PRIORITY 0 — Bolt sprint for new biomes = REUSE, not invent.**
A fresh Grok in a new Build convo must **NOT** cook a new Bolt gallop from scratch (no new Imagine dog sprint). Pipeline is:
1. Empty road plate only (Video A) — biome décor, no dog.
2. Take sealed [`bolt-gallop-cycle.mp4`](bolt-gallop-cycle.mp4) as the Bolt motion asset (**96 fps** KEEP, already rear / green / rotary).
3. Key + despill cutout from that cycle.
4. Composite cutout onto the scrolling empty plate (AFF stack). Speed/scroll = plate; gait = locked cycle.

**PRIORITY 0 COMPOSITE GATE** — after REUSE (empty plate → key sealed cycle → composite), **BEFORE** any KEEP / Hang:

1. **SCALE (HARD)** — withers bbox height ~0.22–0.32 of frame; paws in the lower third; Bolt must **NOT** fill lane width. Same scale every play frame. Road perspective via ribbon `w(s)`, not a giant cutout. Smoke **FAIL** if dog ≈ truck in lane. Law: [`biome/docs/13-make-bolt-lane.md`](../biome/docs/13-make-bolt-lane.md).
2. **LIGHT (HARD)** — grade the cutout **FROM** the empty plate family (rim from plate sun side, frost desat/cool, ember warm, darker under-legs). Ban shipping one lit green-screen turnaround forever. Law: [`biome/docs/13b-anti-sticker-contact.md`](../biome/docs/13b-anti-sticker-contact.md).
3. **CONTACT (HARD)** — small paw contact shadow **multiply on the road** (not a full-body drop shadow, not baked in Imagine). Missing contact = float = **FAIL**. Law: 13b.
4. Order: key → despill ([`13c`](../biome/docs/13c-green-despill.md)) → plate grade → contact → shared grain.

**FAIL** if Grok keys the cycle and hangs without scale + light + contact proof (before/after stills or smoke).

**FAIL** if Grok invents a new Bolt sprint clip for a biome cook. Only SmiR can authorize a new cycle cook to replace the lock.
Style teacher [`bolt-back.jpg`](bolt-back.jpg) still applies if any still / repose is needed; motion teacher = the sealed cycle mp4.
Loop seam on the sealed cycle = **hard cut** on the closed period. Do **NOT** optical-flow morph last→first.
Hang ≠ wipe.

---

`bolt-back.jpg` is the Pack Bolt **style** source of truth for Sprint biomes. Strict rear, fluffy white German Shepherd, black void, rim light. Same bytes as [`biome/lock/bolt-back.jpg`](../biome/lock/bolt-back.jpg) — either path OK. **PRIORITY 0 TEACHER GATE:** attach / show this exact image in the Build chat before any Bolt still / repose, then `@ref` it. If the teacher is not shown → **STOP. No cook. FAIL.** Soft KEEP banned without teacher proof. The black void is STYLE only — biome cooks still go to flat `#00FF00` plus light bake from the empty plate. Hang ≠ wipe.

**HARD BAN as identity sources** (never `@ref` as Sprint biome Bolt teacher):
- `biome/master/bolt.mp4` / hung bolt — OUTPUT only
- `bolt-back-prev.jpg` — previous standing teacher (archive only — keep the file, never `@ref`)
- `bolt-gallop-cycle-24fps-prev.mp4` — previous 24fps cycle (archive only — keep the file, never `@ref`)
- `RIG-*` / `SEAL-*` / `example-*` / `sill-*` — Citadel hall locks, **NOT** Sprint biome Bolt teacher
- Any local `bolt-rear-*.jpg` invented in a Build sandbox

---

## Rotary-gallop cycle (motion asset — KEEP 96 fps, 2026-09-20)

Canonical cycle = **96 fps** (densified from the sealed 24fps hard-cut; same duration/cadence, more fluid). SmiR approved 96 over 24 / 48 / 240.

Empty-road plates stay **48 fps**. Bolt teacher at 96 is OK (more dog frames). Loop seam = **hard cut** on the closed period. Do **NOT** optical-flow morph last→first.

| File | Role |
|---|---|
| [`bolt-gallop-cycle.mp4`](bolt-gallop-cycle.mp4) | **CANONICAL** ~0.93s hard-cut closed rotary-gallop (**96 fps**, 768×1168, flat `#00FF00`, strict rear). **The** Bolt motion asset. REUSE it. Do not cook a new sprint. |
| [`bolt-gallop-cycle-first.jpg`](bolt-gallop-cycle-first.jpg) | First frame of that 96 fps cycle. Repose / still only if a still is needed. **Not** a license to I2V a new dog sprint. |
| [`bolt-gallop-cycle-12s-preview.mp4`](bolt-gallop-cycle-12s-preview.mp4) | Optional 12s looped preview of the same 96 fps cycle. **Preview only — not the cook source.** |
| [`bolt-gallop-cycle-24fps-prev.mp4`](bolt-gallop-cycle-24fps-prev.mp4) | Archive of the previous 24fps sealed cycle. Keep the file. Never `@ref` as the cook source. |

This hang does **not** wipe `biome/master/bolt.mp4`. Hang ≠ wipe.
