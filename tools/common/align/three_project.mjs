// Project world points with the staging three.js camera.
// argv: fov w h x y z yaw pitch near far x0 y0 z0 x1 y1 z1 ...
// Prints JSON [u, v, ndcZ, ...] in pixels, origin top-left.
import * as THREE from "/workspace/kc-staging/zb/three.module.js";

const nums = process.argv.slice(2).map(Number);
const [fov, w, h, x, y, z, yaw, pitch, near, far] = nums;
const cam = new THREE.PerspectiveCamera(fov, w / h, near, far);
cam.position.set(x, y, z);
cam.rotation.order = "XYZ";
cam.rotation.set((pitch * Math.PI) / 180, (-yaw * Math.PI) / 180, 0);
cam.updateMatrixWorld(true);
const out = [];
for (let i = 10; i < nums.length; i += 3) {
  const v = new THREE.Vector3(nums[i], nums[i + 1], nums[i + 2]);
  v.project(cam);
  out.push((v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h, v.z);
}
process.stdout.write(JSON.stringify(out));
