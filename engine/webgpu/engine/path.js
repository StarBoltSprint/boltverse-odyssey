// engine/path.js — extracted from the meadow (v445) as a reusable module; cfg overrides the defaults
const f = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
export const PATH_DEFAULT = {"x0": 6, "a1": 9, "f1": 0.021, "a2": 4, "f2": 0.053, "p2": 1.3};
export function makePath(cfg = {}) { const c = { ...PATH_DEFAULT, ...cfg };
  return /* wgsl */`
fn pathX(z: f32) -> f32 { return ${f(c.x0)} + ${f(c.a1)} * sin(z * ${f(c.f1)}) + ${f(c.a2)} * sin(z * ${f(c.f2)} + ${f(c.p2)}); }        // v443 dirt path centre line
fn pathD(p: vec2f) -> f32 { return abs(p.x - pathX(p.y)) * 0.93; }
fn pathW(p: vec2f) -> f32 { let pd = pathD(p) + (vnoise(p * 1.3) - 0.5) * 0.45 + (vnoise(p * 5.0) - 0.5) * 0.18; return 1.0 - smoothstep(0.45, 1.35, pd); }  // v444p dirt weight, noisy edge
fn rutH(p: vec2f) -> f32 { // v445 wheel ruts: real depressed grooves with raised lips (metres)
  let sx = p.x - pathX(p.y); let wob = (vnoise(vec2f(p.y * 0.35, 1.7)) - 0.5) * 0.10;
  let a = sx - 0.36 + wob; let b = sx + 0.36 + wob;
  let g = exp(-pow(a / 0.085, 2.0)) + exp(-pow(b / 0.085, 2.0));
  let lip = exp(-pow((abs(a) - 0.155) / 0.045, 2.0)) + exp(-pow((abs(b) - 0.155) / 0.045, 2.0));
  let tread = 0.5 + 0.5 * sin(p.y * 41.0 + vnoise(p * 3.0) * 2.0);
  return -0.058 * g * (0.88 + 0.12 * tread) + 0.016 * lip * (0.7 + 0.6 * vnoise(p * 2.3)); }
`; }
