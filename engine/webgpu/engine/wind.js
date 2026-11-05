// engine/wind.js — reusable grass wind (irregular gusts: 2 scrolled noise octaves + per-blade phase). Needs vnoise, hash2.
const f = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
export const WIND_DEFAULT = { gust: 0.9, detail: 0.5, flutter: 0.08, scale: 0.11 };
export function makeWindGPU(cfg = {}) { const c = { ...WIND_DEFAULT, ...cfg };
  return /* wgsl */`
fn grassWind(root: vec2f, wt: f32) -> f32 {
  let wj = hash2(root * 2.7 + 1.9) * 6.28;
  return (vnoise(root * ${f(c.scale)} + vec2f(wt * 0.23, wt * 0.07)) - 0.5) * ${f(c.gust)}
       + (vnoise(root * ${f(c.scale * 3.36)} + vec2f(-wt * 0.11, wt * 0.31)) - 0.5) * ${f(c.detail)}
       + sin(wt * 2.3 + wj) * ${f(c.flutter)};
}`; }
