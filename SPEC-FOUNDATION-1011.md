# Foundation pass (11 Oct): fix the shared tools that made 3 steps fail
Today fusion-fix2, terrain and placement all FAILED, partly because of broken foundations. Fix ONLY these shared foundations, in tools/ (the imagine-to-3d / common modules), with selftests:
1. Models on disk (CPU), cached once for everyone: Depth Anything V2 Large, MoGe-2, SAM2 (small + base). One shared python module (tools/common/vision_models.py) with load-once and a cache keyed by image hash (depth, masks). Check disk space first and keep it lean.
2. Headless render harness: renders must wait until the scene has fully loaded (no "Chargement… 17/20" frames). Add a blocking check that fails any capture showing the loading screen or an empty frame.
3. Gate checklist cameras: each checklist view (close 8 m, low portrait, far, ortho faces) must be framed on the TARGET object's bounding box. Add a blocking check that the object covers at least 25% of the frame (ortho faces at least 60% and not black).
4. Timing per stage + cheap gates first (silhouette/colour in seconds before any heavy build), as a shared helper.
5. Write docs/METHOD/foundation-tools.md. Local commits only. Generate no Imagine images; don't touch live.
Deliver REPORT.md: models + sizes, a cache demo, a before/after capture of the loading-screen fix, a checklist camera sheet for the fusion tower showing the tower framed.
