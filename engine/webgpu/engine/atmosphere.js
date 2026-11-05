// engine/atmosphere.js — physical single-scattering sky (Rayleigh + Mie, ozone tint), valid from the ground to orbit.
// Units: km. cfg.alt = camera altitude (km) added on top of the biome's world height; cfg.blend = how much the physical
// sky replaces the biome's painted sky at ground level (it always takes over with altitude: Paw-to-Galaxy).
const f = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
export const ATMO_DEFAULT = { alt: 0, blend: 0.35, exposure: 14, mie: 0.004, g: 0.76, turbidity: 1.0, steps: 12, lsteps: 4 };
export function makeAtmosphere(cfg = {}) { const c = { ...ATMO_DEFAULT, ...cfg };
  return /* wgsl */`
const AT_RG = 6360.0; const AT_RA = 6420.0; const AT_BR = vec3f(5.8e-3, 13.5e-3, 33.1e-3); const AT_BM = ${f(c.mie * c.turbidity)};
const AT_OZ = vec3f(0.65e-3, 1.88e-3, 0.085e-3); const AT_ALT = ${f(c.alt)};
fn atRay(o: vec3f, d: vec3f, R: f32) -> vec2f { let b = dot(o, d); let cc = dot(o, o) - R * R; let h = b * b - cc; if (h < 0.0) { return vec2f(1e9, -1e9); } let s = sqrt(h); return vec2f(-b - s, -b + s); }
fn atDens(p: vec3f) -> vec3f { let h = max(length(p) - AT_RG, 0.0); return vec3f(exp(-h / 8.0), exp(-h / 1.2), max(0.0, 1.0 - abs(h - 25.0) / 15.0)); }
fn atmoSky(dir: vec3f, sunD: vec3f, camY: f32) -> vec3f {   // camY in metres of the biome
  let o = vec3f(0.0, AT_RG + max(AT_ALT + camY * 0.001, 0.002), 0.0);
  var t = atRay(o, dir, AT_RA); if (t.y < 0.0) { return vec3f(0.0); } t.x = max(t.x, 0.0);
  let tg = atRay(o, dir, AT_RG); if (tg.x > 0.0) { t.y = min(t.y, tg.x); }
  let N = ${c.steps}u; let ds = (t.y - t.x) / f32(N); var od = vec3f(0.0); var sR = vec3f(0.0); var sM = vec3f(0.0);
  for (var i = 0u; i < N; i++) { let p = o + dir * (t.x + ds * (f32(i) + 0.5)); let dn = atDens(p) * ds; od += dn;
    let tl = atRay(p, sunD, AT_RA).y; let lg = atRay(p, sunD, AT_RG); if (lg.x > 0.0) { continue; }
    let dl = tl / ${f(c.lsteps)}; var ol = vec3f(0.0); for (var j = 0u; j < ${c.lsteps}u; j++) { ol += atDens(p + sunD * dl * (f32(j) + 0.5)) * dl; }
    let tau = AT_BR * (od.x + ol.x) + AT_BM * 1.1 * (od.y + ol.y) + AT_OZ * (od.z + ol.z); let at = exp(-tau);
    sR += at * dn.x; sM += at * dn.y; }
  let mu = dot(dir, sunD); let g = ${f(c.g)};
  let pR = 3.0 / (16.0 * 3.14159) * (1.0 + mu * mu); let pM = 3.0 / (8.0 * 3.14159) * ((1.0 - g * g) * (1.0 + mu * mu)) / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
  var col = (sR * AT_BR * pR + sM * AT_BM * pM) * ${f(c.exposure)};
  if (tg.x > 0.0) { let gp = o + dir * tg.x; let n = normalize(gp); let tr = exp(-(AT_BR * od.x + AT_BM * od.y)); col += vec3f(0.06, 0.09, 0.05) * max(dot(n, sunD), 0.0) * tr * ${f(c.exposure)} * 0.12; }   // planet surface seen from above
  else { let stars = step(0.9985, fract(sin(dot(floor(dir * 420.0), vec3f(12.9898, 78.233, 37.719))) * 43758.5)); col += vec3f(stars) * exp(-length(AT_BR * od.x)) * 0.8; }   // stars show through thin air
  return col; }
fn atmoBlend(alt: f32) -> f32 { return clamp(${f(c.blend)} + smoothstep(0.5, 12.0, AT_ALT + alt * 0.001), 0.0, 1.0); }
`; }
