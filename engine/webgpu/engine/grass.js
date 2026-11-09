// engine/grass.js — instanced 3D meadow grass (LOD rings). Needs COMMON: hash2, vnoise, lmk,
// groundAlbedoV, grassWind, terrH, flowerC, flowerCol, shadowW, giAmb, fogMix, tonemap, GI_ON.
export function makeGrassGPU(_cfg = {}) {
  return /* wgsl */`

const GR1 = 150u; const SR1 = 0.21; const GR2 = 130u; const SR2 = 0.60;
struct VO { @builtin(position) p: vec4f, @location(0) col: vec3f, @location(1) h: f32, @location(2) w: vec3f, @location(3) n: vec3f };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  // LOD rings (v439 far grass): ring0 = original dense patch; ring1/ring2 = sparser, wider, taller blades out to ~60 m.
  let G0 = u32(u.grid.w); let N0 = G0 * G0; let N1 = GR1 * GR1;
  var G = G0; var s = u.grid.z; var j = ii; var ctr = u.grid.xy; var ring = 0u;
  let fwd = normalize(u.bolt.xz - u.cam.xz + vec2f(1e-4));
  if (ii >= N0 + N1) { ring = 2u; j = ii - N0 - N1; G = GR2; s = SR2; ctr = u.cam.xz + fwd * 40.0; }
  else if (ii >= N0) { ring = 1u; j = ii - N0; G = GR1; s = SR1; ctr = u.cam.xz + fwd * 14.0; }
  let ho = select(vec2f(0.0), vec2f(311.0, 173.0) * f32(ring), ring > 0u);       // decorrelate rings
  let cell = vec2f(f32(j % G), f32(j / G)) - f32(G) * 0.5 + round(ctr / s);    // world cell id (stable per ring)
  let r1 = hash2(cell + ho); let r2 = hash2(cell + 17.3 + ho); let r3 = hash2(cell + 41.7 + ho); let r4 = hash2(cell + 93.1 + ho);
  let root = (cell + vec2f(r1, r2)) * s;
  let dist = length(root - u.cam.xz);
  var fade = 1.0 - smoothstep(6.0, 11.5, dist);
  if (ring == 1u) { fade = smoothstep(6.0, 11.5, dist) * (1.0 - smoothstep(22.0, 28.0, dist)); }
  if (ring == 2u) { fade = smoothstep(22.0, 28.0, dist) * (1.0 - smoothstep(42.0, 60.0, dist)); }
  let behind = dot(root - u.cam.xz, fwd) < -2.0;                               // cull blades behind the camera
  let lodS = select(1.0, s / 0.07, ring > 0u);                                   // coverage scale per ring
  let patchv = vnoise(root / 3.1) * 0.6 + vnoise(root / 0.9) * 0.4;
  let LM = lmk(root);
  let hd = hash2(root * 1.37 + vec2f(f32(ring) * 9.1, 3.3)); let fadeD = clamp((fade - hd) * 6.0 + 0.5, 0.0, 1.0); /* world-hash dither handover */
  let tuft = smoothstep(0.35, 0.85, vnoise(root / 0.55 + 4.2)); let H = (0.12 + 0.16 * r3) * mix(0.6, 1.3, patchv) * mix(0.65, 1.55, tuft) * fadeD * max(LM.w, 0.0) * select(1.0, select(0.80, 0.95, ring == 1u), ring > 0u) * select(1.0, 0.0, behind);
  let W = (0.016 + 0.010 * r4) * mix(1.0, lodS, select(0.30, 0.42, ring == 1u));
  // 7-point blade: 3 pairs + tip, 5 triangles
  var tri = array<u32,15>(0u,1u,2u, 2u,1u,3u, 2u,3u,4u, 4u,3u,5u, 4u,5u,6u);
  var far3 = array<u32,3>(0u,1u,6u);  /* ring1: full 5-tri blades (anti jagged); ring2: 1-tri */
  let k = select(tri[vi], select(far3[min(vi, 2u)], tri[vi], ring == 1u), ring > 0u); let lvl = f32(k / 2u) / 3.0; let side = select(-1.0, 1.0, (k % 2u) == 1u);
  let t = select(lvl, 1.0, k == 6u); let sd = select(side, 0.0, k == 6u);
  let ang = r1 * 6.2831; let dir = vec2f(cos(ang), sin(ang)); let perp = vec2f(-dir.y, dir.x);
  let wt = u.cam.w; /* irregular gusts: noise octaves scrolled in different directions + per-blade phase */
  let wind = grassWind(root, wt);
  let bend = (0.25 + 0.35 * r2) + wind * 0.25; let wdir = vec2f(0.80, 0.60) * (0.18 + 0.32 * wind);
  // brush aside near Bolt
  // v443 interactive grass: blades bend away from Bolt and his recent trail, recovering behind him
  let bd = root - u.bolt.xz; let bl = length(bd); let b1 = root - u.tr.xy; let b2 = root - u.tr.zw;
  let p0 = exp(-bl * bl * 4.0) * 1.0; let p1 = exp(-dot(b1, b1) * 5.0) * 0.55; let p2 = exp(-dot(b2, b2) * 6.0) * 0.22;
  let pv = normalize(bd + vec2f(1e-4)) * p0 + normalize(b1 + vec2f(1e-4)) * p1 + normalize(b2 + vec2f(1e-4)) * p2; let push = min(length(pv), 1.0);
  let off2 = (dir * bend + wdir) * t * t * H * (1.0 - 0.6 * push) + pv * 0.85 * t * H;
  let wpos = vec3f(root.x + perp.x * W * sd * (1.0 - t) + off2.x, terrH(root) + H * t * (1.0 - 0.45 * push), root.y + perp.y * W * sd * (1.0 - t) + off2.y);
  var o: VO; o.p = u.vp * vec4f(wpos, 1.0);
  let gc = groundAlbedoV(root);
  o.col = mix(gc * 0.55, gc * 1.35 + vec3f(0.03, 0.05, 0.0), t) * mix(0.85, 1.15, r4);
  let fl = smoothstep(0.78, 0.86, vnoise(root / 2.3 + 7.7)) * step(0.55, r2);
  let fc = select(select(vec3f(0.95, 0.93, 0.85), vec3f(0.95, 0.80, 0.20), r3 > 0.5), vec3f(0.62, 0.45, 0.85), r4 > 0.7);
  o.col *= select(LM.rgb, vec3f(1.0), LM.w < 0.0);
  o.col = mix(o.col, fc, fl * smoothstep(0.75, 0.95, t) * select(1.0, 0.0, ring > 0u));
  let fcl = flowerC(root) * step(0.15, r2);
  o.col = mix(o.col, flowerCol(root) * mix(0.85, 1.1, r4), fcl * smoothstep(0.70, 0.90, t) * select(0.25, 0.0, ring > 0u));
  o.h = t; o.w = wpos; o.n = normalize(vec3f(dir.x * 0.6, 1.0, dir.y * 0.6));
  return o;
}
@fragment fn fs(v: VO) -> @location(0) vec4f {
  let sh = shadowW(v.w); let sh2 = mix(sh, 1.0, v.h * 0.05);
  let L = clamp(dot(v.n, u.sun.xyz) * 0.6 + 0.45, 0.0, 1.0);
  let ao = mix(0.45, 1.0, v.h);
  var c = v.col * (vec3f(1.0, 0.96, 0.86) * 2.1 * L * sh2 + select(vec3f(0.40, 0.55, 0.75) * 0.5, giAmb(normalize(v.n + vec3f(0.0, 1.0, 0.0)), v.w) * 1.35, GI_ON) * mix(0.50, 1.0, sh2)) * ao;
  let V = normalize(u.cam.xyz - v.w); c += vec3f(0.55, 0.7, 0.2) * pow(max(dot(-V, u.sun.xyz), 0.0), 4.0) * v.h * 0.35; // translucency
  c = fogMix(c, length(v.w - u.cam.xyz));
  return tonemap(c);
}
`;
}
