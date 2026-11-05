// engine/footprints.js — extracted from the meadow (v445) as a reusable module; cfg overrides the defaults
const f = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
export const FOOTPRINTS_DEFAULT = {"life": 10};
export function makeFootprints(cfg = {}) { const c = { ...FOOTPRINTS_DEFAULT, ...cfg };
  return /* wgsl */`
fn pH(q: vec2f, dm: f32) -> f32 { return (rutH(q) + (textureSampleLevel(tDirt, samp, q * 0.42, 1.5).g - 0.45) * 0.035) * dm; }
fn printsAt(p: vec2f) -> vec3f { // v445 paw print depth (0..1) at p, p+x, p+z
  var d = vec3f(0.0); let e = 0.008;
  for (var i = 0u; i < 96u; i++) { let P = prints[i]; let age = u.cam.w - P.w; if (age < 0.0 || age > ${f(c.life)}) { continue; }
    let q0 = p - P.xy; if (dot(q0, q0) > 0.012) { continue; }
    let fw = vec2f(-sin(P.z), -cos(P.z)); let rt = vec2f(-fw.y, fw.x); let fade = 1.0 - smoothstep(5.5, 10.0, age);
    for (var j = 0; j < 3; j++) { let q = q0 + select(select(vec2f(0.0, e), vec2f(e, 0.0), j == 1), vec2f(0.0), j == 0);
      let l = vec2f(dot(q, rt), dot(q, fw)) / 1.3;
      var s = 1.0 - smoothstep(0.65, 1.0, length((l - vec2f(0.0, -0.010)) / vec2f(0.027, 0.023)));
      s = max(s, 1.0 - smoothstep(0.55, 1.0, length(l - vec2f(-0.027, 0.020)) / 0.0105));
      s = max(s, 1.0 - smoothstep(0.55, 1.0, length(l - vec2f(-0.010, 0.032)) / 0.0110));
      s = max(s, 1.0 - smoothstep(0.55, 1.0, length(l - vec2f(0.010, 0.032)) / 0.0110));
      s = max(s, 1.0 - smoothstep(0.55, 1.0, length(l - vec2f(0.027, 0.020)) / 0.0105));
      d[j] = max(d[j], s * fade); } }
  return d; }
`; }
