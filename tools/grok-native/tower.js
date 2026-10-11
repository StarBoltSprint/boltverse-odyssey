/**
 * three.js geometry kernel for the hero slab. No THREE import: the same
 * positions feed a BufferGeometry. Camera space matches slab_mesh.py
 * (X right, Y up, Z away from the camera).
 *
 *   node tools/grok-native/tower.js slab.json
 * prints {verts, checksum} for the python/Blender check.
 */
import fs from "fs";

function buildPositions(grid, fx, fy, cx, cy, z0, depthM) {
  const front = [];
  for (const row of grid) {
    for (const p of row) {
      let z = z0 - p.relief_m;
      if (z < 1e-3) z = 1e-3;
      const x = ((p.x - cx) * z) / fx;
      const y = ((cy - p.y) * z) / fy;
      front.push([x, y, z]);
    }
  }
  const back = [];
  for (const row of grid) {
    for (const p of row) {
      const z = z0 + depthM;
      const x = ((p.x - cx) * z) / fx;
      const y = ((cy - p.y) * z) / fy;
      back.push([x, y, z]);
    }
  }
  return front.concat(back);
}

function main() {
  const spec = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const pos = buildPositions(spec.grid, spec.fx, spec.fy, spec.cx, spec.cy, spec.Z0, spec.depth_m);
  const out = process.argv[3] || specOut(process.argv[2]);
  fs.writeFileSync(out, JSON.stringify(pos));
  process.stdout.write(JSON.stringify({ verts: pos.length, positions: out }) + "\n");
}

function specOut(slabPath) {
  return slabPath.replace(/\.json$/, "") + ".jspos.json";
}

const isMain = process.argv[1] && process.argv[1].endsWith("tower.js");
if (isMain) main();

export { buildPositions };
