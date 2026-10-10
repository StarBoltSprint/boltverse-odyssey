// Zone B phone comparison (staging, 2026-10-10): the same frozen view, tap to toggle.
//  A = native ratio 2 (the default: full quality, PRE on)
//  B = ratio 1.5 scene, upscaled to 2 with an edge-preserving Catmull-Rom (bicubic, 9 taps via 5 bilinear fetches, de-ringed by
//      clamping to the 2x2 neighbourhood like FSR1 EASU) and then RCAS (FidelityFX RCAS lobe) at full resolution
//  C = ratio 1.5 with the game's current path (bilinear + RCAS 0.6 inside the grade pass)
// fps of each: pipelined (3 renders per frame, median interval / 3, no vsync cap), measured ABAB-style at start (3 s per mode x 2).
const P = window.__gdProf, R = P.renderer, THREE = window.__gdTHREE, st = window.__st, G = window.__gd;
const QS = new URLSearchParams(location.search), LOW = +(QS.get("low") || 1.5), SH = QS.has("sharp") ? +QS.get("sharp") : 0.8;
const pose = { x: st.x, z: st.z, yaw: st.yaw, pitch: QS.has("pitch") ? +QS.get("pitch") : st.pitch };
const ui = (id, css) => { const d = document.createElement("div"); d.id = id; if (css) d.style.cssText = css; document.body.appendChild(d); return d; };
const lab = ui("lab"), tap = ui("tap"), bar = ui("bar");
const VERT = `out vec2 vUv;\nvoid main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); vUv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
const rt = (w, h) => { const t = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
  t.texture.colorSpace = THREE.SRGBColorSpace; return t; };
const pass = (frag, uniforms) => {
  const m = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, uniforms, vertexShader: VERT, depthTest: false, depthWrite: false,
    fragmentShader: "precision highp float;\nprecision highp sampler2D;\nin vec2 vUv;\nout vec4 outColor;\n" + frag });
  const s = new THREE.Scene(), tri = new THREE.Mesh(new THREE.BufferGeometry(), m);
  tri.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3)); tri.geometry.setDrawRange(0, 3); tri.frustumCulled = false; s.add(tri);
  return { s, m };
};
// pass 1: de-ringed Catmull-Rom upsample (linear light: the sRGB8 targets decode on read and encode on write)
const up = pass(`uniform sampler2D tLow;
void main() {
  vec2 sz = vec2(textureSize(tLow, 0)), p = vUv * sz - 0.5, f = fract(p), c = floor(p) + 0.5;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f)), w1 = 1.0 + f * f * (-2.5 + 1.5 * f), w2 = f * (0.5 + f * (2.0 - 1.5 * f)), w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2, t0 = (c - 1.0) / sz, t3 = (c + 2.0) / sz, t12 = (c + w2 / w12) / sz;
  vec3 r = (texture(tLow, vec2(t12.x, t0.y)).rgb * w12.x * w0.y + texture(tLow, vec2(t0.x, t12.y)).rgb * w0.x * w12.y
         + texture(tLow, t12).rgb * w12.x * w12.y + texture(tLow, vec2(t3.x, t12.y)).rgb * w3.x * w12.y + texture(tLow, vec2(t12.x, t3.y)).rgb * w12.x * w3.y);
  r /= (w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y);
  ivec2 q = ivec2(c - 0.5);   // de-ring: clamp to the 2x2 source texels around the sample (as EASU does)
  vec3 a = texelFetch(tLow, q, 0).rgb, b = texelFetch(tLow, q + ivec2(1, 0), 0).rgb, d = texelFetch(tLow, q + ivec2(0, 1), 0).rgb, e = texelFetch(tLow, q + ivec2(1, 1), 0).rgb;
  outColor = vec4(clamp(r, min(min(a, b), min(d, e)), max(max(a, b), max(d, e))), 1.0);
}`, { tLow: { value: null } });
// pass 2: RCAS at full resolution (drawn into the grade pass's scene target; the grade then runs as usual)
const rc = pass(`uniform sampler2D tUp; uniform float uSharp;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec3 e = texelFetch(tUp, p, 0).rgb, b = texelFetch(tUp, p + ivec2(0, -1), 0).rgb, d = texelFetch(tUp, p + ivec2(-1, 0), 0).rgb;
  vec3 f = texelFetch(tUp, p + ivec2(1, 0), 0).rgb, h = texelFetch(tUp, p + ivec2(0, 1), 0).rgb;
  vec3 mn4 = min(min(b, d), min(f, h)), mx4 = max(max(b, d), max(f, h));
  vec3 hitMin = mn4 / (4.0 * mx4 + 1e-4), hitMax = (1.0 - mx4) / (4.0 * mn4 - 4.0 - 1e-4);
  vec3 lr = max(-hitMin, hitMax);
  float lobe = max(-0.1875, min(max(lr.r, max(lr.g, lr.b)), 0.0)) * uSharp;
  outColor = vec4((lobe * (b + d + f + h) + e) / (4.0 * lobe + 1.0), 1.0);
}`, { tUp: { value: null }, uSharp: { value: SH } });
const cam2 = new THREE.Camera();
let lowRT = null, upRT = null;
const g0 = P.grade.scale;
const modes = {
  A: { name: "A · natif ratio 2", draw() { P.grade.scale = 1; P.render(); } },
  B: { name: `B · ${LOW} → 2 bicubique dé-ringé + RCAS ${SH}`, draw() {
    const s = R.getDrawingBufferSize(new THREE.Vector2()), w = Math.round(s.x * LOW / 2), h = Math.round(s.y * LOW / 2);
    if (!lowRT || lowRT.width !== w || lowRT.height !== h) { lowRT?.dispose(); lowRT = rt(w, h); }
    if (!upRT || upRT.width !== s.x || upRT.height !== s.y) { upRT?.dispose(); upRT = rt(s.x, s.y); }
    R.setRenderTarget(lowRT); R.clear(); R.render(P.world, P.camera);
    up.m.uniforms.tLow.value = lowRT.texture; R.setRenderTarget(upRT); R.render(up.s, cam2);
    rc.m.uniforms.tUp.value = upRT.texture; P.grade.scale = 1; P.grade.render(R, rc.s, cam2);
  } },
  C: { name: `C · ${LOW} → 2 chemin du jeu (bilinéaire + RCAS 0.6)`, draw() { P.grade.scale = LOW / 2; P.render(); } },
};
let mode = "A", K = 1, ivs = [], last = 0, rec = false;
window.__benchRender = () => {
  const now = window.__realNow();
  if (rec && last) ivs.push(now - last); last = now;
  st.x = pose.x; st.z = pose.z; st.yaw = pose.yaw; st.pitch = pose.pitch;
  for (let k = 0; k < K; k++) modes[mode].draw();
  live.push(now); while (live.length && now - live[0] > 2000) live.shift();
};
const live = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const res = { A: [], B: [], C: [] };
const show = () => {
  const f = (m) => (res[m].length ? Math.round(1000 / (res[m].reduce((t, x) => t + x, 0) / res[m].length)) : "?");
  const lv = live.length > 2 ? Math.round((1000 * (live.length - 1)) / (live[live.length - 1] - live[0])) : "?";
  lab.innerHTML = `${modes[mode].name}<br><span style="font-weight:500;font-size:13px">mesuré (sans plafond vsync) : A ${f("A")} fps · B ${f("B")} fps · C ${f("C")} fps · affichage ${lv} fps</span>`;
  [...bar.children].forEach((b) => b.classList.toggle("on", b.dataset.m === mode));
};
for (const m of ["A", "B", "C"]) { const b = document.createElement("button"); b.textContent = m; b.dataset.m = m; b.onclick = (e) => { e.stopPropagation(); mode = m; show(); }; bar.appendChild(b); }
tap.addEventListener("pointerdown", (e) => { e.preventDefault(); mode = mode === "A" ? "B" : "A"; show(); });
// freeze, warm up, measure ABCABC (3 renders per frame, median interval / 3)
await sleep(3000); window.__tFreeze = window.__realNow(); window.__skyT = 333.333; window.__airT = 33.333;
K = 3;
for (const m of ["A", "B", "C"]) { mode = m; lab.textContent = `préparation ${m}…`; await sleep(1500); }
for (let rep = 0; rep < 2; rep++) for (const m of ["A", "B", "C"]) {
  mode = m; lab.textContent = `mesure ${m} (${rep + 1}/2)… ne touche pas l'écran`; await sleep(600);
  ivs = []; rec = true; const t0 = window.__realNow(); while (ivs.length < 14 && window.__realNow() - t0 < 15000) await sleep(50); rec = false;
  if (ivs.length >= 4) res[m].push(med(ivs.slice(3)) / 3);
}
K = 1; mode = "A"; show(); setInterval(show, 1000);
window.__cmp = { res, modes: Object.keys(modes) };
