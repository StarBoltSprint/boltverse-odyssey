# Unreal-look fix 2 (11 Oct): framing + sunset glow
Read /workspace/zb-unreal-look-fix-1011/REPORT.md and sheet-phone.jpg. Brightness now matches, but the frame doesn't look like key-city3: wrong framing (eye 18 m at fov 80 hit the limit), no sun glow on the horizon, no warm orange backlight, and the sky is dominated by purple and rings.
1. Camera match: compare at the KEY aspect (16:9 landscape, as the key is), with a low camera (eye about 2-4 m), and widen the fov search. Use the auto-placement camera match if it exists. Report the IoU of the tower silhouettes against the key.
2. Sun: low sun at the key's horizon position, glowing disc + halo + warm rim/backlight on the tower edges. Pixels come from Imagine images only (existing sun/halo textures), and the engine sets only placement and intensity.
3. God rays: a real check with visible shafts in screen space between the towers (a radial-blur occlusion mask), not just sky brightness.
4. Fix the asset 404.
5. New BLOCKING check: per-region colour comparison against the key (sky, horizon around the sun, sand, towers) in the matched camera, each ΔE within its limit.
Deliver a before/after/key sheet in 16:9 + a phone sheet. Local commits only. No Imagine generation (bake-sand stays pending). Stop at PASS or after 2 rounds, with an honest report.
