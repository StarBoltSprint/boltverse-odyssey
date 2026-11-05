// engine/gi.js — approximate image-based light: sky dome irradiance (sun-aware) + one-bounce light off the sunlit ground below.
// Cheap enough for phones (no textures, no loops). Needs groundAlbedoV(xz) and terrH(xz) from the biome.
const f = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
const v3 = (a) => `vec3f(${a.map(f).join(', ')})`;
export const GI_DEFAULT = { sky: [0.40, 0.54, 0.78], horizon: [0.62, 0.68, 0.70], sky_k: 0.62, bounce: 0.55, sunCol: [1.0, 0.96, 0.86] };
export function makeGI(cfg = {}) { const c = { ...GI_DEFAULT, ...cfg };
  return /* wgsl */`
fn giAmb(n: vec3f, w: vec3f) -> vec3f {
  let up = n.y * 0.5 + 0.5;
  let sunUp = max(u.sun.y, 0.0);
  let skyC = mix(${v3(c.horizon)}, ${v3(c.sky)}, smoothstep(0.35, 1.0, up)) * (0.5 + 0.5 * sunUp)
           + ${v3(c.sunCol)} * 0.25 * pow(max(dot(n, u.sun.xyz) * 0.5 + 0.5, 0.0), 3.0) * sunUp;   // brighter sky dome toward the sun
  let hAbove = max(w.y - terrH(w.xz), 0.0);
  let gnd = groundAlbedoV(w.xz) * ${v3(c.sunCol)} * 2.2 * sunUp * ${f(c.bounce)} * exp(-hAbove * 0.08);   // sunlit grass bounces green up
  return (skyC * up * ${f(c.sky_k)} + gnd * (1.0 - up)) ; }
`; }
