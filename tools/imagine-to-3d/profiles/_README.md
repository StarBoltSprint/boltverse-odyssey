# imagine-to-3d type profiles

One file per object type (classify.py output). Each profile:
- `gate.profile` = the tools/object-gate profile it is gated with (read-only reuse, merged over `_base.yaml`);
  `gate.tighten` may only make a gate threshold STRICTER (load_profile() raises otherwise).
- `views` = the Imagine view set (8-12 cameras, yaw/elev in degrees, yaw 0 = the key camera side).
- `geometry` = reconstruction strategy (coarse.py) + relief amplitude limits (metres, shell displacement only).
- `texel` = native Imagine px/m targets used by views.py to precompute the metres each plate covers.
- `thresholds` = upgrade-stage thresholds (views IoU, compare.py LPIPS/SSIM/dE/checklist, fix loop).
- `pbr` = maps pbr.py bakes and the expected metal/roughness ranges.
Quality rule (SmiR): nothing here ever lowers texture resolution or geometry for phone performance.
