# tools/scatter — props scatter + detail layers

```bash
python3 tools/scatter/scatter.py run --spec tools/scatter/examples/zd-terrace.scatter.json --out out/
python3 tools/scatter/detail.py run --spec detail.json --out out/
```

**scatter.py** — rocks, debris, snow tufts on kit tops and ground. Per prop type: density from a key mask (SAM / colour, mapped on `extent_m`, row 0 = far edge), `slope_deg` and `height_m` rules on the heightfield, Bridson Poisson-disk `min_spacing_m`, `max_instances`. Nothing within `path.clearance_m` (+ prop radius) of the walkable polyline. Output `scatter.json`: one instanced mesh (= one draw call) per type, `[x, y, z, yaw, scale]` per instance. Budgets: draw calls, instances, triangles (instances × prop tris). Same seed → byte-identical file.

**detail.py** — dirt, accumulated snow, cracks, moss as 0..1 mask layers (+ seeded decals) that weight Imagine materials in the shader. Drivers: key mask, `up_facing` (snow on tops only), `cavity` (dirt/moss in low spots), `edges` (cracks on strong key edges). Layers never paint colour.

Exit 0 PASS, 1 FAIL (budget, path clearance, empty layer), 2 usage.

## Honest limits
- Height and slope come from the heightfield you give; there is no ray test against kit meshes yet (props on kit tops need the tops as a heightfield).
- Prop meshes are referenced by id (`library:...`); this tool places, it does not model.

## Self-test
```bash
python3 tools/scatter/selftest.py
```
