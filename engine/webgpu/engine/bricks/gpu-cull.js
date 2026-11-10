// Frustum sphere cull. Planes come from the same view-projection the page uploads.
// The GPU runs cullWgsl on those planes. This function is the reference.

export function planesFromVP(m) {
  const row = (r) => [m[r], m[4 + r], m[8 + r], m[12 + r]];
  const add = (a, b, s) => [a[0] + s * b[0], a[1] + s * b[1], a[2] + s * b[2], a[3] + s * b[3]];
  const r0 = row(0), r1 = row(1), r2 = row(2), r3 = row(3);
  const raw = [add(r3, r0, 1), add(r3, r0, -1), add(r3, r1, 1), add(r3, r1, -1), r2, add(r3, r2, -1)];
  return raw.map(normPlane);
}

function normPlane(p) {
  const l = Math.hypot(p[0], p[1], p[2]) || 1;
  return [p[0] / l, p[1] / l, p[2] / l, p[3] / l];
}

export function sphereVisible(planes, c, r) {
  for (let i = 0; i < 6; i++) {
    const p = planes[i];
    if (p[0] * c[0] + p[1] * c[1] + p[2] * c[2] + p[3] < -r) return false;
  }
  return true;
}

export function cullList(planes, spheres) {
  const vis = new Uint32Array(spheres.length);
  for (let i = 0; i < spheres.length; i++) {
    const s = spheres[i];
    vis[i] = sphereVisible(planes, s.center, s.radius) ? 1 : 0;
  }
  return vis;
}

export function cullWgsl() {
  return /* wgsl */`
struct Sphere { center: vec3f, radius: f32 }
@group(0) @binding(0) var<storage, read> spheres: array<Sphere>;
@group(0) @binding(1) var<storage, read_write> vis: array<u32>;
@group(0) @binding(2) var<uniform> planes: array<vec4f, 6>;
@compute @workgroup_size(64)
fn cs(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&spheres)) { return; }
  let s = spheres[i];
  var on = true;
  for (var p = 0u; p < 6u; p++) {
    let pl = planes[p];
    if (dot(pl.xyz, s.center) + pl.w < -s.radius) { on = false; }
  }
  vis[i] = select(0u, 1u, on);
}
`;
}
