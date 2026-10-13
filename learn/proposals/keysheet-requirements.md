# Keysheet requirements: per-region lighting (Tools Engineer → Director's builder)

Key input: `/workspace/kitrelief-out/terrace-spec/gate/key.jpg` (not the `spec-final.jpg` side-by-side).
Addition to the `keysheet.json` schema, so `features` can gate the light, not only shapes.

`lighting.regions.<sky|wall|snow|ice|doorway>`, each from that region's union mask:
- `L_hist` (CIELAB L*, 32 bins, normalised), `ab_hist` (a*,b* 16x16), `lab_mean`, `lab_std`
- `snow.L_top5` : mean L* of the brightest 5 % of snow pixels (highlight level)
- `doorway.L_bottom5` : mean L* of the darkest 5 % of doorway pixels (recess black level)

`lighting.contrast_falloff`: RMS contrast (L* std) of spire and falls vs foreground (mound, wrecks), with MoGe-2 depth median of each, so aerial-perspective haze is a number.

`lighting.key_light_dir`: direction estimated from lit/shadow transitions along snow edges (MoGe-2 normals at lit snow vs shadowed snow), as a unit vector in camera space plus azimuth/elevation; mark `confidence`.

`lighting.moon`: pixel centre, radius, and direction in camera space (via MoGe-2 intrinsics).

Gate use (proposal): per region, histogram distance (EMD on L*) and ΔE2000 of means within 6; snow top 5 % and doorway bottom 5 % within 5 L*; falloff ratio within 15 %; light direction within 15°; moon within 2 % of frame. Each region scored on its own, minimum not average.
