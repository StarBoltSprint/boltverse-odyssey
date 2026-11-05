// engine/trees.js — extracted from the meadow (v445) as a reusable module; cfg overrides the defaults
const f = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
export const TREES_DEFAULT = {"sway": 0.045};
export function makeTreesGPU(cfg = {}) { const c = { ...TREES_DEFAULT, ...cfg };
  return /* wgsl */`
// ---- v440 3D trees: trunk -> 6 branches -> 18 twigs (seeded per tree), leaf-cluster cards at twig ends, 2-layer drifting wind
struct Seg { a: vec3f, b: vec3f, r0: f32, r1: f32 };
fn hs(sd: f32, k: f32) -> f32 { return hash2(vec2f(sd * 91.7 + k * 1.37, k * 0.711 + sd * 3.1)); }
fn rotY(v: vec3f, a: f32) -> vec3f { let c = cos(a); let s = sin(a); return vec3f(v.x * c - v.z * s, v.y, v.x * s + v.z * c); }
fn tTop(sd: f32, con: bool) -> vec3f { return vec3f((hs(sd, 1.0) - 0.5) * 0.10, select(0.70, 0.98, con), (hs(sd, 2.0) - 0.5) * 0.10); }
fn brSeg(sd: f32, i: u32, con: bool) -> Seg { let fi = f32(i); var s: Seg;
  let tt = select(0.25 + 0.075 * fi, 0.26 + 0.115 * fi, con); s.a = tTop(sd, con) * tt;
  let az = fi * 2.39996 + sd * 6.2831 + (hs(sd, 10.0 + fi) - 0.5) * 0.7;
  let el = select(0.30 + 0.45 * hs(sd, 20.0 + fi) + 0.05 * fi, -0.22 + 0.15 * hs(sd, 20.0 + fi), con);
  let L = select((0.50 - 0.035 * fi) * (0.8 + 0.4 * hs(sd, 30.0 + fi)), (0.36 - 0.05 * fi) * (0.85 + 0.3 * hs(sd, 30.0 + fi)), con);
  s.b = s.a + rotY(vec3f(cos(el), sin(el), 0.0), az) * L; s.r0 = select(0.026 - 0.0022 * fi, 0.009 - 0.001 * fi, con); s.r1 = 0.004; return s; }
fn twSeg(sd: f32, j: u32, con: bool) -> Seg { let br = brSeg(sd, j / 3u, con); let k = f32(j % 3u); var s: Seg;
  s.a = mix(br.a, br.b, 0.40 + 0.28 * k); let bd = normalize(br.b - br.a);
  let side = select(-1.0, 1.0, ((j + u32(sd * 7.0)) % 2u) == 0u) * (0.55 + 0.5 * hs(sd, 40.0 + f32(j))) * select(1.0, 0.25, k > 1.5);
  let d = normalize(rotY(bd, side) + vec3f(0.0, select(0.55, 0.10, con), 0.0));
  s.b = s.a + d * length(br.b - br.a) * select(0.55, 0.42, con) * (1.0 - 0.15 * k); s.r0 = 0.004; s.r1 = 0.0015; return s; }
fn tSeg(sd: f32, i: u32, con: bool) -> Seg { if (i == 0u) { var s: Seg; s.a = vec3f(0.0); s.b = tTop(sd, con); s.r0 = select(0.050, 0.036, con); s.r1 = select(0.018, 0.008, con); return s; }
  if (i < 7u) { return brSeg(sd, i - 1u, con); } return twSeg(sd, i - 7u, con); }
fn treeWind(tp: vec2f) -> vec2f { let wt = u.cam.w;
  let w = (vnoise(tp * 0.11 + vec2f(wt * 0.23, wt * 0.07)) - 0.5) * 0.9 + (vnoise(tp * 0.37 + vec2f(-wt * 0.11, wt * 0.31)) - 0.5) * 0.5;
  return vec2f(0.8, 0.6) * (0.35 + w) + vec2f(-0.6, 0.8) * (0.25 * sin(wt * 1.3 + tp.x * 0.2)); }
fn treeV(vi0: u32, ii: u32, mid: bool) -> VO {
  var vi = vi0; if (mid) { if (vi0 >= 210u) { let q = vi0 - 210u; let cl0 = q / 12u; vi = 750u + select(54u + cl0 - 18u, cl0, cl0 < 18u) * 12u + q % 6u; } }  // v442 LOD: far = exact subset of near (trunk+limbs, 22 camera-facing clusters)
  var o: VO; o.p = OFF; o.col = vec3f(0); o.w = vec3f(0); o.n = vec3f(0, 1, 0); o.k = vec2f(1, 1); o.x4 = vec4f(0);
  let T = trees[ii]; let tp = T.xy; let H = T.z; let sd = T.w; let con = fract(sd * 7.0) > 0.88;
  let NS = 25u; var lp: vec3f; let wv = treeWind(tp); let wt = u.cam.w;
  // v441 continuous LOD: one model; twigs/leaf clusters are thinned by a stable per-element rank (shrink, never pop),
  // and the whole tree dithers out over 115-145 m while the far crown dithers in (complementary screen dither).
  let td = length(tp - u.cam.xz); let keep = 1.0 - smoothstep(40.0, 140.0, td); let dis = 0.0;   // v442: no dither; by 140 m near model == far subset exactly
  if (vi < NS * 30u) { // tapered 5-sided segment
    let si = vi / 30u; let sg = tSeg(sd, si, con); let q = vi % 30u;
    var sk = 1.0; if (si >= 7u) { let rs = hs(sd, 200.0 + f32(si)); sk = smoothstep(rs, rs + 0.12, keep * 1.12); if (sk <= 0.0) { return o; } } let quad = q / 6u; let c = q % 6u;
    var du = array<u32,6>(0u,1u,1u,0u,1u,0u); var dv = array<u32,6>(0u,0u,1u,0u,1u,1u);
    let th = f32(quad + du[c]) / 5.0 * 6.2831853; let vv = f32(dv[c]);
    let ax = normalize(sg.b - sg.a); let e1 = normalize(cross(ax, select(vec3f(0, 1, 0), vec3f(1, 0, 0), abs(ax.y) > 0.9))); let e2 = cross(ax, e1);
    let r = mix(sg.r0, sg.r1, vv) * sk; o.x4 = vec4f(0.0, 0.0, 0.0, dis);
    lp = (mix(sg.a, sg.b, vv) + (e1 * cos(th) + e2 * sin(th)) * r) * H;
    o.col = vec3f(0.22, 0.17, 0.12); o.k = vec2f(select(0.8, 0.65, vi >= 30u), 1.0); o.mt = 2u;
    o.n = vec3f(th / 6.2831853, (dot(sg.a, ax) + vv * length(sg.b - sg.a)) * H, r * H); }
  else { // leaf-cluster cards: 2 crossed quads per cluster
    let q = vi - NS * 30u; let cl = q / 12u; let qq = (q / 6u) % 2u; let c = q % 6u;
    let NC = 58u; if (cl >= NC) { return o; }
    var ctr: vec3f; var sz: f32;
    if (cl < NC - 4u) { let sgi = 7u + cl % 18u; let sg = tSeg(sd, sgi, con); let k = f32(cl / 18u);
      ctr = mix(sg.a, sg.b, 0.28 + 0.27 * k) + (vec3f(hs(sd, 40.0 + f32(cl)), hs(sd, 45.0 + f32(cl)), hs(sd, 47.0 + f32(cl))) - 0.5) * 0.11; sz = select(0.135, 0.12, con); if (cl < 18u) { sz *= mix(1.0, 1.8, 1.0 - keep); } else { let rc = hs(sd, 300.0 + f32(cl)) * 0.88 + 0.02; sz *= smoothstep(rc, rc + 0.1, keep); } }
    else { ctr = tTop(sd, con) + vec3f(hs(sd, 50.0 + f32(cl)) - 0.5, -0.25, hs(sd, 60.0 + f32(cl)) - 0.5) * select(0.34, 0.16, con); sz = select(0.15, 0.10, con) * mix(1.0, 1.6, 1.0 - keep); }
    if (qq == 1u) { sz *= smoothstep(0.55, 0.9, keep); } else { sz *= mix(1.0, 1.15, smoothstep(0.9, 0.55, keep)); }   // crossed quad fades out by 140 m => far LO = facing quads only
    if (sz <= 0.0) { return o; } let cs = f32(cl) + sd * 13.0; sz *= (0.8 + 0.45 * hs(sd, 70.0 + f32(cl))) * select(1.0, 0.75, con);
    var qx = array<f32,6>(-1.0, 1.0, 1.0, -1.0, 1.0, -1.0); var qy = array<f32,6>(-1.0, -1.0, 1.0, -1.0, 1.0, 1.0);
    let cxy = vec2f(qx[c], qy[c]);
    let wc = vec3f(tp.x, 0.0, tp.y) + ctr * H; let toC = normalize(wc - u.cam.xyz);
    var rx: vec3f; var ry: vec3f;
    if (qq == 0u) { rx = normalize(cross(toC, vec3f(0, 1, 0))); ry = cross(rx, toC); }   // camera-facing card
    else { let a = cs * 2.7; rx = vec3f(cos(a), 0.0, sin(a)); ry = normalize(vec3f(-sin(a) * 0.7, 0.7, cos(a) * 0.7)); }
    let ra = cs * 1.9; let rc = vec2f(cxy.x * cos(ra) - cxy.y * sin(ra), cxy.x * sin(ra) + cxy.y * cos(ra));  // spin the card texture
    lp = ctr * H + (rx * rc.x + ry * rc.y) * sz * H;
    lp += vec3f(sin(wt * 3.1 + cs * 5.0), 0.5 * sin(wt * 2.3 + cs), cos(wt * 2.7 + cs * 3.0)) * 0.006 * H * (1.0 + length(wv)); // leaf flutter
    let cc = select(vec3f(0.0, 0.60, 0.0), vec3f(0.0, 0.58, 0.0), con);
    let nrm = normalize(ctr - cc + vec3f(0.0, 0.25, 0.0));
    o.n = nrm; o.x4 = vec4f(cxy + 1.0, hs(sd, 80.0 + f32(cl)), dis); o.mt = 5u;
    let leaf = mix(groundAlbedoV(tp) * 0.30, vec3f(0.06, 0.13, 0.06), 0.70);
    o.col = mix(select(leaf, leaf * vec3f(0.8, 0.85, 0.95), con), HAZE * 0.25, 0.06) * 0.68 * mix(0.75, 1.25, hs(sd, 90.0 + f32(cl))) * select(1.0, 0.62, cl < 54u && cl / 18u == 0u && !con);   // lush v442: inner clusters darker
    o.k = vec2f(mix(0.45, 1.05, clamp(dot(nrm, normalize(ctr - cc)) * 0.5 + 0.5, 0.0, 1.0)) * mix(0.7, 1.0, clamp(ctr.y * 1.3, 0.0, 1.0)), 0.0); }
  let hb = clamp(lp.y / H, 0.0, 1.2); let bend = hb * hb * ${f(c.sway)} * H;   // trunk base fixed, crown sways
  lp += vec3f(wv.x * bend, -0.15 * bend * length(wv) * hb, wv.y * bend);
  let w = vec3f(tp.x + lp.x, lp.y + terrH(tp) - 0.05, tp.y + lp.z); o.p = u.vp * vec4f(w, 1.0); o.w = w; return o; }
@vertex fn vs_tree(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO { return treeV(vi, ii, false); }
@vertex fn vs_treeMid(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO { return treeV(vi, ii, true); }
@vertex fn vs_treeFar(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO { // far LOD: one low-poly crown
  var o: VO; o.mt = 4u; let T = trees[ii]; let H = T.z; let sd = T.w; let d = sph(vi, 3u, 7u); let con = fract(sd * 7.0) > 0.88;
  let nz = 1.0 + 0.45 * (vnoise(d.xz * 2.6 + sd * 31.0) - 0.5) + 0.2 * (vnoise(d.xy * 6.0 + sd * 7.0) - 0.5);
  let lp = (vec3f(0.0, 0.58, 0.0) + d * select(vec3f(0.42, 0.34, 0.42), vec3f(0.30, 0.44, 0.30), con) * nz) * H;
  let wv = treeWind(T.xy) * (lp.y / H) * (lp.y / H) * ${f(c.sway)} * H; let w = vec3f(T.x + lp.x + wv.x, max(lp.y, 0.0) + terrH(T.xy) - 0.05, T.y + lp.z + wv.y); o.p = u.vp * vec4f(w, 1.0); o.w = w; o.n = vec3f(0, 1, 0); o.x4 = vec4f(0.0, 0.0, 0.0, 1.0 - smoothstep(112.0, 135.0, length(T.xy - u.cam.xz)));
  let leaf = mix(groundAlbedoV(T.xy) * 0.30, vec3f(0.06, 0.13, 0.06), 0.70); o.col = mix(select(leaf, leaf * vec3f(0.8, 0.85, 0.95), con), HAZE * 0.25, 0.12) * mix(0.8, 1.2, hash2(vec2f(sd, f32(vi / 6u))));
  o.n = normalize(d + 0.45 * (vec3f(hash2(vec2f(f32(vi), sd)), hash2(vec2f(sd, f32(vi) * 1.7)), hash2(vec2f(f32(vi) * 0.3, sd + 2.0))) - 0.5)); o.col *= 0.85;
  o.k = vec2f(mix(0.40, 1.0, d.y * 0.5 + 0.5), 0.0); o.mt = 4u; return o; }
`; }
