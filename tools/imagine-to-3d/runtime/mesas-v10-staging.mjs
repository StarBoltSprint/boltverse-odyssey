// STAGING (not live): Zone B sandstone mesas v2 (2026-10-09, steering 16:59). Imagine -> 3D tool (zb-preview-1008-tools/imagine-to-3d).
// Mesh: blocky stratified cliffs (strata.py): strata from the Imagine front plate's bedding lines, each layer an angular
// prism on the Imagine visual-hull outline, straight faces <= 16 m, vertical fracture steps, caprock overhangs + undercuts,
// chamfered ledges, fallen blocks + scree. 3 silhouette-preserving LODs + dithered distance crossfade (no pop).
// Colour: sectioned Imagine plates (key-city3 crops -> Imagine), sampled 1:1 at native 80 px/m (walls),
// 64 px/m (caps), 320 px/m (block faces): per-vertex plate id + plate pixel coords, no stretch, no repetition.
// Light: sun * N.L * static world-fixed shadow + neutral ambient (slight cool), no violet fill. Code never paints rock.
import { FOG_GLSL, fogUniforms, headingToDir } from "../runtime/biome-runtime.js?v=7";
import { HAZE_GLSL } from "../air.mjs?v=48";

const MV = "9";
// avenue frame (objects.mjs D2): point(s, lat) = O + F*s + R*lat
const AV_O = [0.287, 1.349], AV_F = [0.97933, -0.20233], AV_R = [0.20817, 0.97938];
const avXZ = (s, lat) => [AV_O[0] + AV_F[0] * s + AV_R[0] * lat, AV_O[1] + AV_F[1] * s + AV_R[1] * lat];
// placements as in key-city3: left mid-ground mesa behind the left towers, a second wall further left,
// the hazy right butte past the spire/arch side, a far band, and distant mesas all round (free roam 360).
// face: the plate front (+Z) turns toward the hero camera (s=-52) for the key-facing ones.
export const MESA_LAYOUT = [
  { id: "L-mid",   s: 110,  lat: -150, scale: 1.25, face: true,  mirror: false },
  { id: "L-mid2",  s: 195,  lat: -175, scale: 1.05, yaw: 250,    mirror: true },
  { id: "L-far",   s: 310,  lat: -250, scale: 1.6,  face: true,  mirror: true },
  { id: "R-butte", s: 300,  lat: 205,  scale: 1.7,  face: true,  mirror: false },
  { id: "R-mid",   s: 110,  lat: 215,  scale: 1.35, yaw: 200,    mirror: true },
  { id: "R-band",  s: 600,  lat: 320,  scale: 2.0,  yaw: 25,     mirror: false },
  { id: "B-left",  s: -290, lat: -175, scale: 1.7,  yaw: 140,    mirror: false },
  { id: "B-right", s: -320, lat: 185,  scale: 1.5,  yaw: 300,    mirror: true },
  { id: "B-far",   s: -520, lat: 10,   scale: 2.2,  yaw: 80,     mirror: false },
];
const HERO = avXZ(-52, 0);


function loadTex(THREE, url) {
  return new Promise((res, rej) => new THREE.TextureLoader().load(url, res, undefined, rej));
}
// LOD bands (metres from the mesa origin): [in0, in1, out0, out1]; dithered complementary fade inside each band
// albedo grade toward the key's lit sandstone faces (measured: key crop vs staging capture, see PROGRESS-mesas.md)
export const WARM = [0.78, 0.9, 1.0];   // grade toward key-city3 rock (crop-L: lit (128,87,80), shade (60,40,35)); 0.5/0.88/1.45 turned shaded faces grey (p1 sheet). No blue boost: no violet
// NO-MORPH LODs (SmiR 20:52): LOD0 and LOD1 are the SAME shell (same strata cuts, faces, blocks, plate windows/UVs);
// LOD0 only adds a 1 m grid whose depth-relief displacement (attribute aD) fades to exactly 0 by RELIEF_FADE[1] m,
// before the LOD0->LOD1 dither band, so the dither never shifts geometry. Far LOD2 retired (it changed the silhouette).
export const LOD_BANDS = [[-1, -1, 280, 320], [280, 320, 1e9, 1e9]];
export const RELIEF_FADE = [140, 260];   // m, camera to mesa origin (same measure as the LOD bands)
export const LOD0_BUILD = [430, 620];
export const LOD0_FETCH = 760;           // start downloading LOD0 below this distance (before the build threshold)
export const RELIEF_IN_MS = 3000;        // if LOD0 arrives late (already inside the relief range) its relief grows in over 3 s

function rockMaterial(THREE, biome, P, tex, shadowLight, band, o) {
  const fog = fogUniforms(biome); const NW = P.walls.length;
  const g = (n) => new THREE.Vector3(...P.gains[n].map((x) => Math.pow(x, 0.55)));
  const u = {
    uW: { value: P.walls.map((n) => tex[n]) }, uB: { value: tex[P.block] }, uC0: { value: tex[P.caps[0]] }, uC1: { value: tex[P.caps[1]] },
    uWG: { value: P.walls.map(g) }, uBG: { value: g(P.block) }, uCG0: { value: g(P.caps[0]) }, uCG1: { value: g(P.caps[1]) },
    uSunDir: { value: new THREE.Vector3(...o.sunDir) }, uSunCol: { value: new THREE.Vector3(...o.sunCol) },
    uAmb: { value: new THREE.Vector3(...o.amb) }, uSky: { value: new THREE.Vector3(...o.sky) }, uGain: { value: o.gain },
    uFogW: { value: o.fogW }, uHazeW: { value: o.hazeW },
    uBand: { value: new THREE.Vector4(...band) }, uRelief: { value: new THREE.Vector2(...RELIEF_FADE) }, uRelAmt: { value: 1 }, uDebug: { value: o.debug || 0 }, uWarm: { value: new THREE.Vector3(...o.warm) },
    uShadowMap: { value: null }, uShadowMatrix: { value: shadowLight ? shadowLight.shadow.matrix : new THREE.Matrix4() },
    uShadowOn: { value: 0 }, uShadowDepthM: { value: 1000 },
    uFogC0: { value: new THREE.Vector3(...fog.uFogC0) }, uFogC1: { value: new THREE.Vector3(...fog.uFogC1) },
    uFogC2: { value: new THREE.Vector3(...fog.uFogC2) }, uFogD: { value: new THREE.Vector3(...fog.uFogD) },
    uFogA: { value: new THREE.Vector3(...fog.uFogA) }, uFogDesat: { value: fog.uFogDesat }, uFogHeight: { value: fog.uFogHeight },
  };
  const m = new THREE.ShaderMaterial({
    uniforms: u, fog: false, lights: false,
    vertexShader: `
attribute float aPl; attribute vec2 aPx; attribute vec3 aTn; attribute vec3 aD; attribute vec3 aN0;
attribute float aPl2; attribute vec2 aPx2; attribute float aBw;
uniform vec2 uRelief; uniform float uRelAmt;
flat varying float vPl; varying vec2 vPx; varying vec3 vTn; varying vec3 vW; varying vec3 vN; flat varying vec3 vC;
flat varying float vPl2; varying vec2 vPx2; varying float vBw;
void main(){
  vPl = aPl; vPx = aPx; vTn = aTn; vPl2 = aPl2; vPx2 = aPx2; vBw = aBw;
  vC = modelMatrix[3].xyz;
  float rf = (1.0 - smoothstep(uRelief.x, uRelief.y, distance(cameraPosition, vC))) * uRelAmt;   // relief fade (0 inside the LOD band)
  vec4 w = modelMatrix * vec4(position + aD * rf, 1.0); vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normalize(mix(aN0, normal, rf)));
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `
precision highp float;
uniform sampler2D uW[${NW}]; uniform sampler2D uB, uC0, uC1, uShadowMap;
uniform vec3 uWG[${NW}]; uniform vec3 uWarm; uniform vec3 uBG, uCG0, uCG1;
uniform vec3 uSunDir, uSunCol, uAmb, uSky; uniform float uGain, uFogW, uHazeW, uShadowOn, uShadowDepthM, uDebug;
uniform vec4 uBand; uniform mat4 uShadowMatrix;
flat varying float vPl; varying vec2 vPx; varying vec3 vTn; varying vec3 vW; varying vec3 vN; flat varying vec3 vC;
flat varying float vPl2; varying vec2 vPx2; varying float vBw;
${FOG_GLSL}
${HAZE_GLSL}
float unp(vec4 v){ return dot(v, (255.0 / 256.0) / vec4(16777216.0, 65536.0, 256.0, 1.0)); }
float lit(vec3 wp, vec3 n){
  if (uShadowOn < 0.5) return 1.0;
  vec4 sc = uShadowMatrix * vec4(wp + n * 0.6, 1.0); vec3 p = sc.xyz / sc.w;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float l = 0.0; vec2 tx = vec2(1.0 / 2048.0);
  for (int y = 0; y < 2; y++) for (int x = 0; x < 2; x++) l += 1.0 - step(1.6, (p.z - unp(texture(uShadowMap, p.xy + (vec2(float(x), float(y)) - 0.5) * tx))) * uShadowDepthM);
  return l * 0.25;   // v10: 2x2 PCF (4 fetches instead of 9, fps)
}
float bayer4(vec2 f){ ivec2 i = ivec2(mod(f, 4.0)); int k = i.x + i.y * 4;
  int b[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5); return (float(b[k]) + 0.5) / 16.0; }
vec3 wallTex(int p, vec2 uv, vec2 gx, vec2 gy){
${Array.from({ length: NW - 1 }, (_, k) => `  if (p == ${k}) return textureGrad(uW[${k}], uv, gx, gy).rgb * uWG[${k}];`).join("\n")}
  return textureGrad(uW[${NW - 1}], uv, gx, gy).rgb * uWG[${NW - 1}];
}
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 capCell(vec2 xz, vec2 off, vec2 gx, vec2 gy){
  // 16 m cells, one whole Imagine cap plate per cell (64 px/m), random plate + 90-degree rotation per cell
  vec2 q = (xz + off) / 16.0; vec2 id = floor(q); vec2 f = q - id;
  float h = h21(id + off * 0.137); float r = floor(h * 4.0);
  vec2 uv = f; vec2 a = gx, b = gy;
  if (r == 1.0) { uv = vec2(1.0 - f.y, f.x); a = vec2(-gx.y, gx.x); b = vec2(-gy.y, gy.x); }
  else if (r == 2.0) { uv = 1.0 - f; a = -gx; b = -gy; }
  else if (r == 3.0) { uv = vec2(f.y, 1.0 - f.x); a = vec2(gx.y, -gx.x); b = vec2(gy.y, -gy.x); }
  return fract(h * 7.31) < 0.5 ? textureGrad(uC0, uv, a, b).rgb * uCG0 : textureGrad(uC1, uv, a, b).rgb * uCG1;
}
void main(){
  float d = distance(cameraPosition, vC);
  float th = bayer4(gl_FragCoord.xy);
  if (d < uBand.y) { if (th >= clamp((d - uBand.x) / (uBand.y - uBand.x), 0.0, 1.0)) discard; }
  if (d > uBand.z) { if (th < clamp((d - uBand.z) / (uBand.w - uBand.z), 0.0, 1.0)) discard; }
  vec3 n = normalize(vN);
  int p = int(floor(vPl + 0.5));
  vec3 alb;
  // gradients from continuous coords outside any branch
  vec2 gpx = dFdx(vPx), gpy = dFdy(vPx), gwx = dFdx(vW.xz), gwy = dFdy(vW.xz);
  vec2 gqx = dFdx(vPx2), gqy = dFdy(vPx2);
  if (p >= 0) {
    vec2 sz = vec2(1280.0, 720.0);
    vec2 uv = vPx / sz; vec2 gx = gpx / sz, gy = gpy / sz;
    if (p == ${NW}) alb = textureGrad(uB, uv, gx, gy).rgb * uBG;
    else {
      alb = wallTex(p, uv, gx, gy);
      if (vBw > 0.002) {   // v10 joint seam: height-blend into the neighbouring window (seams dissolve inside the joint)
        vec3 b2 = wallTex(int(floor(vPl2 + 0.5)), vPx2 / sz, gqx / sz, gqy / sz);
        float h1 = dot(alb, vec3(0.33)), h2 = dot(b2, vec3(0.33));
        float m1 = h1 + (1.0 - vBw), m2 = h2 + vBw, mx = max(m1, m2) - 0.18;
        float w1 = max(m1 - mx, 0.0), w2 = max(m2 - mx, 0.0);
        alb = (alb * w1 + b2 * w2) / (w1 + w2);
      }
      alb *= vTn;
    }
  } else {
    vec2 xz = vW.xz; vec2 gx = gwx / 16.0, gy = gwy / 16.0;
    vec2 fa = fract(xz / 16.0) - 0.5, fb = fract((xz + 8.0) / 16.0) - 0.5;
    float wa = 0.5 - max(abs(fa.x), abs(fa.y)), wb = 0.5 - max(abs(fb.x), abs(fb.y));
    wa = pow(wa + 0.001, 3.0); wb = pow(wb + 0.001, 3.0);
    alb = (capCell(xz, vec2(0.0), gx, gy) * wa + capCell(xz, vec2(8.0), gx, gy) * wb) / (wa + wb);
  }
  if (uDebug > 1.5) { gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0); return; }   // silhouette mask (outline IoU vs key)
  if (uDebug > 0.5) { gl_FragColor = vec4(alb, 1.0); return; }
  alb *= uWarm;   // grade toward the key's lit sandstone faces (measured, see learn/ notes)
  alb *= uGain;
  float nl = max(dot(n, uSunDir), 0.0);
  float sh = lit(vW, n);
  float up = 0.5 + 0.5 * n.y;
  vec3 c = alb * (uSunCol * nl * sh + uAmb + uSky * up + uAmb * 0.9 * (1.0 - up));   // v10: neutral ground bounce under overhangs (no black slots)
  float fd = distance(vW, cameraPosition);
  float far = smoothstep(200.0, 550.0, fd);
  c = mix(c, biomeFog(c, fd, vW.y), mix(uFogW, 0.9, far));
  c = mix(c, zbHaze(c, vW, cameraPosition), mix(uHazeW, 0.9, far));
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
  m.userData.u = u;
  return m;
}

// vertex normals welded by position (1 cm): vertices duplicated at window seams / plate changes share one smooth
// normal unless the surfaces meet at a crease (> ~50 deg, e.g. wall -> bench top); fallen blocks stay faceted.
function smoothNormals(pos, index, nWeld) {
  const n = pos.length / 3, vn = new Float32Array(n * 3);
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t] * 3, b = index[t + 1] * 3, c = index[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { vn[k] += nx; vn[k + 1] += ny; vn[k + 2] += nz; }
  }
  const nrm = (i) => { const l = Math.hypot(vn[i * 3], vn[i * 3 + 1], vn[i * 3 + 2]) || 1; return [vn[i * 3] / l, vn[i * 3 + 1] / l, vn[i * 3 + 2] / l]; };
  const groups = new Map();
  for (let i = 0; i < nWeld; i++) {
    const key = Math.round(pos[i * 3] * 100) + "," + Math.round(pos[i * 3 + 1] * 100) + "," + Math.round(pos[i * 3 + 2] * 100);
    const g = groups.get(key); if (g) g.push(i); else groups.set(key, [i]);
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const m = nrm(i); out[i * 3] = m[0]; out[i * 3 + 1] = m[1]; out[i * 3 + 2] = m[2]; }
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const ns = g.map(nrm);
    for (let a = 0; a < g.length; a++) {
      let sx = 0, sy = 0, sz = 0;
      for (let b = 0; b < g.length; b++) {
        const d = ns[a][0] * ns[b][0] + ns[a][1] * ns[b][1] + ns[a][2] * ns[b][2];
        if (d > 0.64) { const k = g[b] * 3; sx += vn[k]; sy += vn[k + 1]; sz += vn[k + 2]; }
      }
      const l = Math.hypot(sx, sy, sz) || 1, k = g[a] * 3; out[k] = sx / l; out[k + 1] = sy / l; out[k + 2] = sz / l;
    }
  }
  return out;
}

function insidePoly(x, z, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
function nearestOnPoly(x, z, poly) {
  let best = Infinity, bx = x, bz = z;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i], [cx, cz] = poly[(i + 1) % poly.length];
    const dx = cx - ax, dz = cz - az, L = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L));
    const px = ax + dx * t, pz = az + dz * t, d = (px - x) ** 2 + (pz - z) ** 2;
    if (d < best) { best = d; bx = px; bz = pz; }
  }
  return [bx, bz, Math.sqrt(best)];
}
function offsetPoly(poly, d) {
  let cx = 0, cz = 0; for (const [x, z] of poly) { cx += x; cz += z; } cx /= poly.length; cz /= poly.length;
  return poly.map(([x, z]) => { const dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz) || 1; return [x + dx / l * d, z + dz / l * d]; });
}

function buildDrift(THREE, field, ring, pileMax, outM, inM, sinkTo) {
  // sand drift skirt from inside the rock foot out onto the dunes, ground material (Imagine ground plates)
  const inner = offsetPoly(ring, -inM), outer = offsetPoly(ring, outM);
  const rings = 6, segs = ring.length, pos = [], rows = [];
  for (let j = 0; j <= rings; j++) {
    const t = j / rings, row = [];
    for (let i = 0; i < segs; i++) {
      const x = inner[i][0] + (outer[i][0] - inner[i][0]) * t, z = inner[i][1] + (outer[i][1] - inner[i][1]) * t;
      const wob = 0.75 + 0.25 * Math.sin(i * 0.9 + 1.7) * Math.sin(i * 0.37);
      const pile = pileMax * wob * Math.pow(1 - t, 1.6);
      row.push(pos.length / 3); pos.push(x, field.surfaceHeight(x, z) + pile, z);
    }
    rows.push(row);
  }
  const bot = [];
  for (let i = 0; i < segs; i++) { const [x, z] = outer[i]; bot.push(pos.length / 3); pos.push(x, field.surfaceHeight(x, z) - 0.45, z); }
  const idx = [];
  for (let j = 0; j < rings; j++) for (let i = 0; i < segs; i++) {
    const a = rows[j][i], b = rows[j][(i + 1) % segs], c = rows[j + 1][i], d = rows[j + 1][(i + 1) % segs];
    idx.push(a, c, b, b, c, d);
  }
  for (let i = 0; i < segs; i++) { const a = rows[rings][i], b = rows[rings][(i + 1) % segs]; idx.push(a, b, bot[(i + 1) % segs], a, bot[(i + 1) % segs], bot[i]); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}


export async function mountMesas({ THREE, biome, field, world, camera, renderer }) {
  // v10: geometry shipped gzip (.bin.gz, ~3.3x smaller); DecompressionStream where available, raw .bin otherwise
  const getBin = async (url, gz) => {
    if (gz && typeof DecompressionStream !== "undefined") {
      try { const r = await fetch(`${url}.gz?v=${MV}`); if (r.ok) return await new Response(r.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer(); } catch (e) { console.warn("mesa gz", url, e); }
    }
    return await (await fetch(`${url}?v=${MV}`)).arrayBuffer();
  };
  const P = await (await fetch(`./mesas/plates/plates.json?v=${MV}`)).json();
  const names = [...P.walls, P.block, ...P.caps];
  const geoInfo = {}, bins = {};
  const QS = new URLSearchParams(location.search);
  const SD = QS.get("mesaStrata") || "strata4";   // strata4 = packed (q16, indexed, LOD0 on demand) from strata3
  const [texs] = await Promise.all([
    Promise.all(names.map((n) => loadTex(THREE, `./mesas/plates/${n}.jpg?v=${MV}`))),
    Promise.all(MESA_LAYOUT.map(async (L) => {
      geoInfo[L.id] = await (await fetch(`./mesas/${SD}/${L.id}-geo.json?v=${MV}`)).json();
      // packed (q16, indexed): only LOD1 at mount (~1-2 MB/mesa); LOD0 (relief grid) is fetched on demand near the camera
      bins[L.id] = { 1: await getBin(`./mesas/${SD}/${L.id}-lod1.bin`, geoInfo[L.id].gz) };
    })),
  ]);
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const tex = {};
  names.forEach((n, i) => {
    const t = texs[i];
    t.colorSpace = THREE.SRGBColorSpace; t.flipY = false;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.anisotropy = aniso; t.needsUpdate = true; tex[n] = t;
  });
  const dbg = window.__zbDebug || {};
  const shadowLight = dbg.sun || null;
  const ground = dbg.ground || null;
  let sunL = null; world.traverse((o) => { if (o.isDirectionalLight && o !== shadowLight && !sunL) sunL = o; });
  const sd = sunL ? new THREE.Vector3().subVectors(sunL.position, sunL.target.position).normalize()
    : (() => { const h = headingToDir(90); const e = (8 * Math.PI) / 180; return new THREE.Vector3(h[0] * Math.cos(e), Math.sin(e), h[1] * Math.cos(e)); })();
  const sc0 = sunL ? sunL.color.clone().multiplyScalar(sunL.intensity) : new THREE.Color(0xffb089).multiplyScalar(1.35);
  const opts = { sunDir: sd.toArray(), sunCol: [sc0.r, sc0.g, sc0.b], amb: [0.15, 0.155, 0.17], sky: [0.07, 0.072, 0.08], gain: 1.0, fogW: 0.12, hazeW: 0.2,
    warm: WARM, debug: new URLSearchParams(location.search).get("mesaMask") ? 2 : 0 };
  const mats = [];   // every per-mesa rock material (shadow map / tuning uniforms are set on all of them)
  const casterMat = new THREE.MeshBasicMaterial({ colorWrite: false });
  const items = [];
  const group = new THREE.Group(); group.name = "zb-mesas";
  const driftGeos = [];
  const lodTris = [];
  for (const L of MESA_LAYOUT) {
    const gi = geoInfo[L.id], bin = bins[L.id];
    const [x, z] = avXZ(L.s, L.lat);
    let yawDeg = L.yaw ?? 0;
    if (L.face) yawDeg = (Math.atan2(HERO[0] - x, HERO[1] - z) * 180) / Math.PI;
    const yaw = (yawDeg * Math.PI) / 180, mx = L.mirror ? -1 : 1;
    const toWorld = ([px, pz]) => { const lx = px * mx, lz = pz; return [x + lx * Math.cos(yaw) + lz * Math.sin(yaw), z - lx * Math.sin(yaw) + lz * Math.cos(yaw)]; };
    const ringLocal = (r) => r.map(([a, b]) => [a, -b]);   // hull z3 -> three local z
    // star-shaped radial envelope of the foot ring (fracture steps can fold the raw ring): collider, drift, gate solid
    const raw = ringLocal(gi.rings[0].ring), NB = 96, rB = new Array(NB).fill(0);
    for (const [a, b] of raw) { const k = ((Math.round((Math.atan2(b, a) / (2 * Math.PI)) * NB) % NB) + NB) % NB; rB[k] = Math.max(rB[k], Math.hypot(a, b)); }
    for (let k = 0; k < NB; k++) if (!rB[k]) { let p = k, q = k; while (!rB[(p + NB) % NB]) p--; while (!rB[q % NB]) q++; rB[k] = Math.max(rB[(p + NB) % NB], rB[q % NB]); }
    const base = rB.map((r, k) => { const r2 = Math.max(r, rB[(k + 1) % NB], rB[(k + NB - 1) % NB]); const t = (k / NB) * 2 * Math.PI; return [Math.cos(t) * r2, Math.sin(t) * r2]; });
    let maxR = 0; for (const r of gi.rings) for (const [a, b] of r.ring) maxR = Math.max(maxR, Math.hypot(a, b));
    const ringW = base.map(toWorld);
    let minG = Infinity, maxG = -Infinity;
    for (const [wx, wz] of ringW) { const h = field.surfaceHeight(wx, wz); minG = Math.min(minG, h); maxG = Math.max(maxG, h); }
    const baseY = minG - 0.6 * L.scale;
    const meshes = [];
    // LOD0 (1 m depth-relief grid, the heaviest) is built lazily near the camera and freed far away (phone memory)
    const buildGeo = (li) => {
      const ld = gi.lods[li], n = ld.verts, buf = bin[li], Q = gi.qscale, ST = gi.stride || 12;
      const q = new Int16Array(buf, 0, n * ST);
      const index = ld.index16 ? new Uint16Array(buf, n * ST * 2, ld.indexCount) : new Uint32Array(buf, n * ST * 2, ld.indexCount);
      const pl2 = new Float32Array(n), px2 = new Float32Array(n * 2), bw = new Float32Array(n);
      const pos = new Float32Array(n * 3), pl = new Float32Array(n), px = new Float32Array(n * 2), tn = new Float32Array(n * 3), dp = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const k = i * ST;
        pos[i * 3] = q[k] / Q[0]; pos[i * 3 + 1] = q[k + 1] / Q[1]; pos[i * 3 + 2] = q[k + 2] / Q[2];
        pl[i] = q[k + 3] / Q[3]; px[i * 2] = q[k + 4] / Q[4]; px[i * 2 + 1] = q[k + 5] / Q[5];
        tn[i * 3] = q[k + 6] / Q[6]; tn[i * 3 + 1] = q[k + 7] / Q[7]; tn[i * 3 + 2] = q[k + 8] / Q[8];
        dp[i * 3] = q[k + 9] / Q[9]; dp[i * 3 + 1] = q[k + 10] / Q[10]; dp[i * 3 + 2] = q[k + 11] / Q[11];
        if (ST === 16) { pl2[i] = q[k + 12] / Q[12]; px2[i * 2] = q[k + 13] / Q[13]; px2[i * 2 + 1] = q[k + 14] / Q[14]; bw[i] = q[k + 15] / Q[15]; }
        else { pl2[i] = pl[i]; px2[i * 2] = px[i * 2]; px2[i * 2 + 1] = px[i * 2 + 1]; }
      }
      // fallen blocks (36 verts each, after the cliff verts) sit on their own dune height: never float
      if (ld.blockVertStart != null) for (let b = ld.blockVertStart; b + 36 <= n; b += 36) {
        let bx = 0, bz = 0; for (let i = b; i < b + 36; i++) { bx += pos[i * 3]; bz += pos[i * 3 + 2]; } bx /= 36; bz /= 36;
        const [wx, wz] = toWorld([bx, bz]); const dy = field.surfaceHeight(wx, wz) - baseY;
        for (let i = b; i < b + 36; i++) pos[i * 3 + 1] += Math.max(0, dy);
      }
      const g = new THREE.BufferGeometry(); g.setIndex(new THREE.BufferAttribute(index, 1));
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("aPl", new THREE.BufferAttribute(pl, 1));
      g.setAttribute("aPx", new THREE.BufferAttribute(px, 2));
      g.setAttribute("aTn", new THREE.BufferAttribute(tn, 3));
      g.setAttribute("aPl2", new THREE.BufferAttribute(pl2, 1)); g.setAttribute("aPx2", new THREE.BufferAttribute(px2, 2)); g.setAttribute("aBw", new THREE.BufferAttribute(bw, 1));
      const uvA = new Float32Array(n * 2); for (let i = 0; i < n; i++) if (pl[i] >= 0) { uvA[i * 2] = px[i * 2] / 1280; uvA[i * 2 + 1] = 1 - px[i * 2 + 1] / 720; }
      g.setAttribute("uv", new THREE.BufferAttribute(uvA, 2));
      // base normals (aN0) + displaced-relief normals (normal); the shader mixes them with the relief fade
      // v10: normals smoothed across window seams / duplicated vertices (welded by position, 50 deg crease)
      const nBlk = ld.blockVertStart ?? n;
      g.setAttribute("aN0", new THREE.BufferAttribute(smoothNormals(pos, index, nBlk), 3));
      const pd = new Float32Array(pos); for (let i = 0; i < n * 3; i++) pd[i] += dp[i];
      g.setAttribute("normal", new THREE.BufferAttribute(smoothNormals(pd, index, nBlk), 3));
      g.setAttribute("aD", new THREE.BufferAttribute(dp, 3));
      g.computeBoundingSphere(); g.boundingSphere.radius += 2;
      return g;
    };
    gi.lods.slice(0, LOD_BANDS.length).forEach((ld, li) => {
      const g = li === 0 ? new THREE.BufferGeometry() : buildGeo(li);
      // per-mesa materials (same program): LOD0 carries its own relief-amount fade, LOD1 can drop its inner band
      // while this mesa's LOD0 is not downloaded yet (fallback: identical shell, no hole)
      const mm = rockMaterial(THREE, biome, P, tex, shadowLight, LOD_BANDS[li], opts);
      mats.push(mm);
      const m = new THREE.Mesh(g, mm); m.name = `mesa-${L.id}-lod${li}`; m.frustumCulled = true;
      m.position.set(x, baseY, z); m.rotation.y = yaw; m.scale.set(mx, 1, 1);
      m.visible = false; m.userData.built = li !== 0;
      if (opts.debug === 2) m.layers.enable(3);   // mask mode: approach-morph test renders layer 3 only
      group.add(m); meshes.push(m);
      lodTris[li] = (lodTris[li] || 0) + ld.indexCount / 3;
    });
    const caster = new THREE.Mesh(meshes[1].geometry, casterMat);
    caster.layers.set(1); caster.castShadow = true; caster.position.copy(meshes[1].position); caster.rotation.copy(meshes[1].rotation); caster.scale.copy(meshes[1].scale);
    group.add(caster);
    driftGeos.push(buildDrift(THREE, field, ringW, 2.2, 14 * L.scale, 2.0, baseY));
    const hTop = gi.rings[gi.rings.length - 1].y1;
    items.push({ id: L.id, x, z, yaw: yawDeg, scale: L.scale, mirror: !!L.mirror, baseY, minG, maxG, sink: maxG - baseY, heightM: hTop,
      solid: ringW, collider: offsetPoly(ringW, 1.0), meshes, caster, maxR, gi, buildGeo, bin });
  }
  world.add(group);
  group.updateMatrixWorld(true);
  let drift = null;
  if (ground) {
    let vc = 0, ic = 0; for (const g of driftGeos) { vc += g.attributes.position.count; ic += g.index.count; }
    const Pp = new Float32Array(vc * 3), N = new Float32Array(vc * 3), I = new Uint32Array(ic); let v = 0, k = 0;
    for (const g of driftGeos) { Pp.set(g.attributes.position.array, v * 3); N.set(g.attributes.normal.array, v * 3); for (const a of g.index.array) I[k++] = a + v; v += g.attributes.position.count; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(Pp, 3)); g.setAttribute("normal", new THREE.BufferAttribute(N, 3)); g.setIndex(new THREE.BufferAttribute(I, 1));
    g.computeBoundingSphere();
    drift = new THREE.Mesh(g, ground.material); drift.name = "mesa-drifts"; drift.frustumCulled = false;
    let towerDrift = null; world.traverse((o) => { if (o.name === "sand-drifts") towerDrift = o; });
    if (towerDrift && towerDrift.onBeforeRender) drift.onBeforeRender = towerDrift.onBeforeRender;
    world.add(drift);
  }
  let shadowFit = null;
  if (shadowLight) {
    shadowLight.shadow.camera.layers.enable(1);
    const towersFp = ((window.__objectsGate && window.__objectsGate.footprints) || []).map((f) => ({ solid: f.solid, top: 170, base: -6 }));
    const casters = [...towersFp, ...items.filter((it) => Math.hypot(it.x - 200, it.z + 40) < 520).map((it) => ({ solid: offsetPoly(it.solid, 3), top: it.baseY + it.heightM + 2, base: it.baseY - 2 }))];
    const shCam = shadowLight.shadow.camera;
    const sdir = new THREE.Vector3().subVectors(shadowLight.position, shadowLight.target.position).normalize();
    let cx = 0, cz = 0, n = 0; for (const c of casters) for (const [x, z] of c.solid) { cx += x; cz += z; n++; } cx /= n; cz /= n;
    const D = 1500;
    shadowLight.position.set(cx + sdir.x * D, sdir.y * D, cz + sdir.z * D); shadowLight.target.position.set(cx, 0, cz);
    shadowLight.updateMatrixWorld(); shadowLight.target.updateMatrixWorld();
    shCam.position.copy(shadowLight.position); shCam.lookAt(shadowLight.target.position); shCam.updateMatrixWorld(true);
    const inv = shCam.matrixWorldInverse, v = new THREE.Vector3();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const c of casters) for (const [x, z] of c.solid) for (const y of [c.base, c.top]) {
      v.set(x, y, z).applyMatrix4(inv);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z);
    }
    shCam.left = x0 - 4; shCam.right = x1 + 4; shCam.bottom = y0 - 4; shCam.top = y1 + 4;
    shCam.near = Math.max(1, -z1 - 20); shCam.far = -z0 + 900; shCam.updateProjectionMatrix();
    if (ground && ground.material.uniforms.uShadowDepthM) ground.material.uniforms.uShadowDepthM.value = shCam.far - shCam.near;
    for (const m of mats) m.userData.u.uShadowDepthM.value = shCam.far - shCam.near;
    renderer.shadowMap.needsUpdate = true;
    shadowFit = { casters: casters.length, mesaCasters: casters.length - towersFp.length,
      texelM: +(Math.max(shCam.right - shCam.left, shCam.top - shCam.bottom) / 2048).toFixed(3),
      extentM: [+(shCam.right - shCam.left).toFixed(1), +(shCam.top - shCam.bottom).toFixed(1)], depthM: +(shCam.far - shCam.near).toFixed(1) };
  }
  let warm = 6;
  const cp = new THREE.Vector3();
  function update(cam) {
    if (warm > 0) { warm--; renderer.shadowMap.needsUpdate = true; }
    for (const m of mats) {
      const u = m.userData.u;
      if (shadowLight && shadowLight.shadow.map && u.uShadowMap.value !== shadowLight.shadow.map.texture) { u.uShadowMap.value = shadowLight.shadow.map.texture; u.uShadowOn.value = 1; }
    }
    const c = (cam || camera).getWorldPosition(cp);
    for (const it of items) {
      const d = Math.hypot(c.x - it.x, c.y - it.baseY, c.z - it.z);
      const m0 = it.meshes[0];
      // LOD0 streaming: download < LOD0_FETCH, build < LOD0_BUILD[0] (both well before it becomes visible at 320 m),
      // free the geometry > LOD0_BUILD[1] (hysteresis; the downloaded bytes stay cached)
      if (!it.bin[0] && !it.fetching && d < LOD0_FETCH) {
        it.fetching = true;
        getBin(`./mesas/${SD}/${it.id}-lod0.bin`, it.gi.gz).then((b) => { const dl = +(QS.get("mesaLod0Delay") || 0); if (dl) setTimeout(() => { it.bin[0] = b; }, dl); else it.bin[0] = b; }).catch((e) => { it.fetching = false; console.warn("mesa lod0", it.id, e); });
      }
      if (!m0.userData.built && it.bin[0] && d < LOD0_BUILD[0]) {
        m0.geometry.dispose(); m0.geometry = it.buildGeo(0); m0.userData.built = true;
        it.relT0 = d < RELIEF_FADE[1] ? performance.now() : -1e9;   // late arrival inside the relief range: grow in
      } else if (m0.userData.built && d > LOD0_BUILD[1]) { m0.geometry.dispose(); m0.geometry = new THREE.BufferGeometry(); m0.userData.built = false; }
      m0.material.userData.u.uRelAmt.value = QS.has("mesaRelAmt") ? +QS.get("mesaRelAmt") : Math.min(1, Math.max(0, (performance.now() - (it.relT0 ?? -1e9)) / RELIEF_IN_MS));
      // LOD1 inner band: dropped while this mesa's LOD0 is not built yet (never a hole, shell identical)
      const b1 = it.meshes[1].material.userData.u.uBand.value; const fb = !m0.userData.built;
      b1.x = fb ? -1 : LOD_BANDS[1][0]; b1.y = fb ? -1 : LOD_BANDS[1][1];
      const bandsNow = [LOD_BANDS[0], fb ? [-1, -1, LOD_BANDS[1][2], LOD_BANDS[1][3]] : LOD_BANDS[1]];
      it.meshes.forEach((m, li) => { const b = bandsNow[li]; m.visible = m.userData.built && d >= b[0] && d <= b[3]; });
    }
  }
  function collide(st) {
    for (const it of items) {
      const c = it.collider;
      if (Math.hypot(st.x - it.x, st.z - it.z) > it.maxR + 20) continue;
      if (insidePoly(st.x, st.z, c)) { const [nx, nz] = nearestOnPoly(st.x, st.z, c); st.x = nx; st.z = nz; }
    }
  }
  window.__mesasGate = {
    version: MV, method: "strata-v2", strataDir: SD,
    count: items.length,
    lods: lodTris.map((t) => Math.round(t)), lodBands: LOD_BANDS,
    perMesa: items.map((it) => ({ id: it.id, lods: it.gi.lods.map((l) => ({ tris: l.tris, relief: !!l.stretch.relief, nonManifoldEdges: l.stretch.nonManifoldEdges ?? null, wallOut: l.stretch.wallOut ?? null, minPxPerM: +l.stretch.minPxPerM.toFixed(1), p01PxPerM: +l.stretch.p01PxPerM.toFixed(1), maxStretch: +l.stretch.maxStretch.toFixed(3), layers: l.layers, blocks: l.blocks })),
      strata: it.gi.strata.length - 1, repeatClash: it.gi.repeatClash ?? null, adjSamePlate: it.gi.adjSamePlate ?? null })),
    textures: Object.fromEntries(Object.entries(tex).map(([k, t]) => [k, { w: t.image.width, h: t.image.height, aniso: t.anisotropy, mips: t.generateMipmaps, minFilter: t.minFilter === THREE.LinearMipmapLinearFilter ? "trilinear" : t.minFilter }])),
    anisoMax: aniso,
    pxPerM: { wall: P.pxm.wall, cap: P.pxm.cap, block: P.pxm.block },
    stretch: Math.max(...items.flatMap((it) => it.gi.lods.map((l) => l.stretch.maxStretch))),
    minPxPerM: Math.min(...items.flatMap((it) => it.gi.lods.map((l) => l.stretch.minPxPerM)), P.pxm.cap),
    items: items.map((it) => ({ id: it.id, x: +it.x.toFixed(1), z: +it.z.toFixed(1), yaw: +it.yaw.toFixed(1), scale: it.scale, baseY: +it.baseY.toFixed(2),
      minGround: +it.minG.toFixed(2), maxGround: +it.maxG.toFixed(2), heightM: +it.heightM.toFixed(1), solid: it.solid })),
    shadow: shadowFit, drift: !!drift,
    light: { sunDir: opts.sunDir.map((v) => +v.toFixed(3)), sunCol: opts.sunCol.map((v) => +v.toFixed(3)), amb: opts.amb, sky: opts.sky, warm: opts.warm, foundSun: !!sunL },
  };
  window.__mesasTune = (o) => { for (const m of mats) { const u = m.userData.u;
    if (o.gain != null) u.uGain.value = o.gain; if (o.fogW != null) u.uFogW.value = o.fogW; if (o.hazeW != null) u.uHazeW.value = o.hazeW;
    if (o.amb) u.uAmb.value.set(...o.amb); if (o.sky) u.uSky.value.set(...o.sky); if (o.debug != null) u.uDebug.value = o.debug; }
    const u = mats[0].userData.u; return { gain: u.uGain.value, fogW: u.uFogW.value, hazeW: u.uHazeW.value, amb: u.uAmb.value.toArray(), sky: u.uSky.value.toArray() }; };
  return { update, collide, items };
}
