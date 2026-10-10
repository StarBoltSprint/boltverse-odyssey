
function loadTex(THREE, url) {
  return new Promise((res, rej) => new THREE.TextureLoader().load(url, res, undefined, rej));
}
// LOD bands (metres from the mesa origin): [in0, in1, out0, out1]; dithered complementary fade inside each band
export const LOD_BANDS = [[-1, -1, 130, 160], [130, 160, 620, 700], [620, 700, 1e9, 1e9]];   // LOD0 carries the 1 m depth relief

function rockMaterial(THREE, biome, P, tex, shadowLight, band, o) {
  const fog = fogUniforms(biome);
  const g = (n) => new THREE.Vector3(...P.gains[n].map((x) => Math.pow(x, 0.55)));
  const u = {
    uW: { value: P.walls.map((n) => tex[n]) }, uB: { value: tex[P.block] }, uC0: { value: tex[P.caps[0]] }, uC1: { value: tex[P.caps[1]] },
    uWG: { value: P.walls.map(g) }, uBG: { value: g(P.block) }, uCG0: { value: g(P.caps[0]) }, uCG1: { value: g(P.caps[1]) },
    uSunDir: { value: new THREE.Vector3(...o.sunDir) }, uSunCol: { value: new THREE.Vector3(...o.sunCol) },
    uAmb: { value: new THREE.Vector3(...o.amb) }, uSky: { value: new THREE.Vector3(...o.sky) }, uGain: { value: o.gain },
    uFogW: { value: o.fogW }, uHazeW: { value: o.hazeW },
    uBand: { value: new THREE.Vector4(...band) }, uDebug: { value: 0 },
    uShadowMap: { value: null }, uShadowMatrix: { value: shadowLight ? shadowLight.shadow.matrix : new THREE.Matrix4() },
    uShadowOn: { value: 0 }, uShadowDepthM: { value: 1000 },
    uFogC0: { value: new THREE.Vector3(...fog.uFogC0) }, uFogC1: { value: new THREE.Vector3(...fog.uFogC1) },
    uFogC2: { value: new THREE.Vector3(...fog.uFogC2) }, uFogD: { value: new THREE.Vector3(...fog.uFogD) },
    uFogA: { value: new THREE.Vector3(...fog.uFogA) }, uFogDesat: { value: fog.uFogDesat }, uFogHeight: { value: fog.uFogHeight },
  };
  const m = new THREE.ShaderMaterial({
    uniforms: u, fog: false, lights: false,
    vertexShader: `
attribute float aPl; attribute vec2 aPx;
flat varying float vPl; varying vec2 vPx; varying vec3 vW; varying vec3 vN; flat varying vec3 vC;
void main(){
  vPl = aPl; vPx = aPx;
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vC = modelMatrix[3].xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `
precision highp float;
uniform sampler2D uW[8]; uniform sampler2D uB, uC0, uC1, uShadowMap;
uniform vec3 uWG[8]; uniform vec3 uBG, uCG0, uCG1;
uniform vec3 uSunDir, uSunCol, uAmb, uSky; uniform float uGain, uFogW, uHazeW, uShadowOn, uShadowDepthM, uDebug;
uniform vec4 uBand; uniform mat4 uShadowMatrix;
flat varying float vPl; varying vec2 vPx; varying vec3 vW; varying vec3 vN; flat varying vec3 vC;
${FOG_GLSL}
${HAZE_GLSL}
float unp(vec4 v){ return dot(v, (255.0 / 256.0) / vec4(16777216.0, 65536.0, 256.0, 1.0)); }
float lit(vec3 wp, vec3 n){
  if (uShadowOn < 0.5) return 1.0;
  vec4 sc = uShadowMatrix * vec4(wp + n * 0.6, 1.0); vec3 p = sc.xyz / sc.w;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float l = 0.0; vec2 tx = vec2(1.0 / 2048.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) l += 1.0 - step(1.6, (p.z - unp(texture(uShadowMap, p.xy + vec2(float(x), float(y)) * tx))) * uShadowDepthM);
  return l / 9.0;
}
float bayer4(vec2 f){ ivec2 i = ivec2(mod(f, 4.0)); int k = i.x + i.y * 4;
  int b[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5); return (float(b[k]) + 0.5) / 16.0; }
vec3 wallTex(int p, vec2 uv, vec2 gx, vec2 gy){
  if (p == 0) return textureGrad(uW[0], uv, gx, gy).rgb * uWG[0];
  if (p == 1) return textureGrad(uW[1], uv, gx, gy).rgb * uWG[1];
  if (p == 2) return textureGrad(uW[2], uv, gx, gy).rgb * uWG[2];
  if (p == 3) return textureGrad(uW[3], uv, gx, gy).rgb * uWG[3];
  if (p == 4) return textureGrad(uW[4], uv, gx, gy).rgb * uWG[4];
  if (p == 5) return textureGrad(uW[5], uv, gx, gy).rgb * uWG[5];
  if (p == 6) return textureGrad(uW[6], uv, gx, gy).rgb * uWG[6];
  return textureGrad(uW[7], uv, gx, gy).rgb * uWG[7];
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
  if (p >= 0) {
    vec2 sz = vec2(1280.0, 720.0);
    vec2 uv = vPx / sz; vec2 gx = gpx / sz, gy = gpy / sz;
    alb = p == 8 ? textureGrad(uB, uv, gx, gy).rgb * uBG : wallTex(p, uv, gx, gy);
  } else {
    vec2 xz = vW.xz; vec2 gx = gwx / 16.0, gy = gwy / 16.0;
    vec2 fa = fract(xz / 16.0) - 0.5, fb = fract((xz + 8.0) / 16.0) - 0.5;
    float wa = 0.5 - max(abs(fa.x), abs(fa.y)), wb = 0.5 - max(abs(fb.x), abs(fb.y));
    wa = pow(wa + 0.001, 3.0); wb = pow(wb + 0.001, 3.0);
    alb = (capCell(xz, vec2(0.0), gx, gy) * wa + capCell(xz, vec2(8.0), gx, gy) * wb) / (wa + wb);
  }
  if (uDebug > 0.5) { gl_FragColor = vec4(alb, 1.0); return; }
  alb *= uGain;
  float nl = max(dot(n, uSunDir), 0.0);
  float sh = lit(vW, n);
  float up = 0.5 + 0.5 * n.y;
  vec3 c = alb * (uSunCol * nl * sh + uAmb + uSky * up);
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

