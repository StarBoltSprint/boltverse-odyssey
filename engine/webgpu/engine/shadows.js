// engine/shadows.js — extracted from the meadow (v445) as a reusable module; cfg overrides the defaults
const f = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
export const SHADOWS_DEFAULT = {"floor": 0.3, "bolt": 1};
export function makeShadows(cfg = {}) { const c = { ...SHADOWS_DEFAULT, ...cfg };
  return /* wgsl */`
// v442 cascaded sun shadow map: 2 cascades side by side in a 2048x1024 depth atlas, 4-tap PCF
var<private> csmSkip: bool = false;
fn csmTap(M: mat4x4f, ci: f32, bias: f32, w: vec3f, four: bool) -> f32 {
  let q = M * vec4f(w, 1.0); let uv = vec2f((q.x * 0.5 + 0.5 + ci) * 0.5, 0.5 - q.y * 0.5); let z = q.z - bias;
  if (!four) { return textureSampleCompareLevel(smap, scmp, uv, z); }
  let tx = vec2f(0.8 / 2048.0, 0.8 / 1024.0);
  return 0.25 * (textureSampleCompareLevel(smap, scmp, uv + vec2f(-tx.x, -tx.y), z) + textureSampleCompareLevel(smap, scmp, uv + vec2f(tx.x, -tx.y), z)
        + textureSampleCompareLevel(smap, scmp, uv + vec2f(-tx.x, tx.y), z) + textureSampleCompareLevel(smap, scmp, uv + vec2f(tx.x, tx.y), z)); }
fn csm(w: vec3f) -> f32 {   // v442: 2 cascades, 4-tap PCF near, 1 tap (hw 2x2 compare) far, blended seam
  if (u.misc.w > 0.5 || csmSkip) { return 1.0; }
  let q0 = u.c0 * vec4f(w, 1.0); let e0 = max(abs(q0.x), abs(q0.y));
  let q1 = u.c1 * vec4f(w, 1.0); let e1 = max(abs(q1.x), abs(q1.y));
  var s1 = 1.0; if (e1 < 0.99) { s1 = mix(1.0, csmTap(u.c1, 1.0, 0.00045, w, false), smoothstep(0.99, 0.85, e1)); }
  if (e0 >= 0.95) { return s1; }
  let s0 = csmTap(u.c0, 0.0, 0.00010, w, true);
  return mix(s0, s1, smoothstep(0.75, 0.95, e0)); }
fn shadowW(w: vec3f) -> f32 { return min(mix(1.0, boltSh(w), ${f(c.bolt)}), mix(${f(c.floor)}, 1.0, csm(w))); }
fn boltA(f: u32, uv: vec2f) -> f32 { if (any(uv < vec2f(0.0)) || any(uv > vec2f(1.0))) { return 0.0; }
  let g = vec2f(f32(f % 8u), f32(f / 8u)); return textureSampleLevel(atex, samp, (g + clamp(uv, vec2f(0.003), vec2f(0.997))) / vec2f(8.0, 4.0), 0.0).a; }
fn boltSh(w: vec3f) -> f32 { // v445: the drawn Bolt sprite (same gallop frame, same card + bank) projected along the sun => shadow matches Bolt
  let b = u.bolt.xyz;
  if (length(w.xz - b.xz) > 5.0 || w.y - b.y > 1.6) { return 1.0; }
  let toE = normalize(u.sun.xz + vec2f(1e-4)); let nrm = vec3f(toE.x, 0.0, toE.y); let rt = vec3f(-toE.y, 0.0, toE.x);   // caster card turned to face the sun => full silhouette, never edge-on
  let L = u.sun.xyz;
  let tt = dot(b + nrm * 0.02 - w, nrm) / dot(L, nrm); if (tt <= 0.0) { return 1.0; }
  let r = w + L * tt - b; let rx = dot(r, rt); let ry = r.y;
  let cr = cos(u.bp.x); let sr = -sin(u.bp.x); let lx = rx * cr + ry * sr; let ly = -rx * sr + ry * cr;   // undo the bank
  let uv = vec2f(-lx / 0.395092 + 0.5, 1.0 - ((ly + 0.035) / 1.15 + 0.0092025));
  let ff = u.bp.w; let fa = u32(floor(ff)) % 32u; let fb = (fa + 1u) % 32u; let k = fract(ff);
  let pen = (0.006 + 0.022 * clamp(tt, 0.0, 1.5)) * vec2f(1.0 / 0.395092, 1.0 / 1.15);   // penumbra grows with distance to the caster
  var a = 0.0;
  for (var j = 0; j < 5; j++) { let o = select(vec2f(0.0), vec2f(cos(f32(j) * 1.5708), sin(f32(j) * 1.5708)) * pen, j > 0);
    a += mix(boltA(fa, uv + o), boltA(fb, uv + o), k) * select(0.15, 0.40, j == 0); }
  a = smoothstep(0.10, 0.85, a);
  let con = smoothstep(0.0, 0.32, length(w.xz - b.xz));   // tiny contact darkening under the paws
  return mix(1.0, 0.30, a) * mix(0.72, 1.0, con);
}
`; }
