# curvatureSample

Adaptive curvature resampling for Boltverse living-film ribbons.

Law: `biome/docs/12-lane-path-ribbon.md` + `biome/docs/12b-adaptive-curvature.md`.

```js
const { resamplePath, ribbonPoint } = require('./curvatureSample');

const table = resamplePath(
  { kind: 'catmull', alpha: 0.5, points: [[0.5,0.9],[0.5,0.5],[0.8,0.2]] },
  {
    thetaMaxDeg: 8,
    ellMax: 0.04,
    nShip: 48,
    width: 0.06,
    windows: [{ s: 0.12 }, { s: 0.72 }],
  }
);

const paw = ribbonPoint(table, /* s */ 0.4, /* lambda */ 1);
```

## Input

- `polyline` — already-clicked points
- `bezier` — `{ spans: [{ p0, p1, p2, p3 }] }`
- `catmull` — interpolating points, `alpha` 0.5 = centripetal

## Keep rules

A fine sample is kept if since the last keep:

- turning angle ≥ `thetaMaxDeg` (default 8°)
- arc length ≥ `ellMax` (default 0.04 UV)
- relative width change ≥ `wRelMax`
- it is an endpoint or a choice window (`windows[].s`)

Then thin to `nShip` by dropping the lowest-turn interior keeps, or fill to `nMin`.

Output `s` is arc-length in `[0,1]`. Normals are left-perp with a flip guard.

Cook use: draw centerline on empty road → `resamplePath` → write `path.json` next to the plate. Play only walks `s` and eases `lambda` — never raw Bézier `t`.

Run: `node demo.js`
