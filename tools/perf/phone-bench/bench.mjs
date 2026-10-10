// Zone B on-phone auto-benchmark v4 (staging, 2026-10-10). Loaded by bench.html after window.__ready.
// v4 = THERMALLY FAIR: every row is measured as base/row/base/row (ABAB, 1.2 s each after a 0.4 s settle), a 1 s idle
// cool-down (nothing rendered) between rows, every program pre-compiled in the warm-up. A row is reported against ITS OWN
// neighbouring base segments (delta ms and ratio), and "norm" = ratio x the first (coolest) base, so a phone that heats up
// over the run (v3: base 45 -> 57 ms) no longer shifts the rows. ~2-2.5 min, no reload.
// Metric v2 (v1's sync readback serialised CPU+GPU and inflated everything, v58 read 38.8 ms while it runs ~60 fps):
//  "ms" = PIPELINED: K=3 renders per animation frame, no readback; median rAF interval / 3 = per-frame cost of the busiest
//         side (GPU or CPU), not capped by vsync while > 5.6 ms.
//  "cpu" = JS time of the 3 render calls / 3 (submit side). "sync" = v1 metric (1 render + 1 px readback), 1 s, for reference.
const QS = new URLSearchParams(location.search), PHASE = QS.get("phase") === "b" ? "b" : "a";
const P = window.__gdProf, G = window.__gd, st = window.__st, R = P.renderer, gl = R.getContext(), U = G.groundU, THREE = window.__gdTHREE;
const ui = document.createElement("div");
ui.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:99;padding:10px 12px;font:600 15px/1.35 system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.55)";
document.body.appendChild(ui);
const say = (t) => (ui.textContent = t);
const by = (re) => { const a = []; P.world.traverse((o) => { if (re.test(o.name || "")) a.push(o); }); return a; };
const hide = (re) => () => { const a = by(re).filter((o) => o.visible); a.forEach((o) => (o.visible = false)); return () => a.forEach((o) => (o.visible = true)); };
const setU = (k, v) => () => { if (!U[k]) return () => {}; const o = U[k].value; U[k].value = v; return () => (U[k].value = o); };
const both = (...fs) => () => { const u = fs.map((f) => f()); return () => u.reverse().forEach((x) => x()); };
const pr0 = R.getPixelRatio();
const ratio = (r, canvasR) => () => {
  const g0 = P.grade && P.grade.scale;
  R.setPixelRatio(canvasR ?? r); R.setSize(innerWidth, innerHeight, false); if (P.grade && "scale" in P.grade) P.grade.scale = r / (canvasR ?? r);
  return () => { R.setPixelRatio(pr0); R.setSize(innerWidth, innerHeight, false); if (P.grade && "scale" in P.grade) P.grade.scale = g0; };
};
const skySimple = () => {
  const m0 = P.sky.material, kids = P.sky.children.filter((c) => c.visible);
  P.sky.material = new THREE.MeshBasicMaterial({ color: 0x8a6a78, side: THREE.BackSide, depthWrite: false, fog: false });
  kids.forEach((c) => (c.visible = false));
  return () => { P.sky.material.dispose(); P.sky.material = m0; kids.forEach((c) => (c.visible = true)); };
};
const shadowsOff = () => { R.shadowMap.enabled = false; return () => { R.shadowMap.enabled = true; R.shadowMap.needsUpdate = true; }; };
const gm = P.ground.material;
const def = (k) => () => { gm.defines = { ...(gm.defines || {}), [k]: 1 }; gm.needsUpdate = true; return () => { const d = { ...gm.defines }; delete d[k]; gm.defines = d; gm.needsUpdate = true; }; };
const groundFlat = () => { const m = new THREE.MeshBasicMaterial({ color: 0x9a6650 }); P.ground.material = m; return () => { P.ground.material = gm; m.dispose(); }; };
const groundTex = [U.uGroundTex && U.uGroundTex.value, U.uGroundNrm && U.uGroundNrm.value, U.uGDet && U.uGDet.value].filter(Boolean);
const aniso = (a) => () => { const o = groundTex.map((t) => t.anisotropy); groundTex.forEach((t) => { t.anisotropy = a; t.needsUpdate = true; }); return () => groundTex.forEach((t, i) => { t.anisotropy = o[i]; t.needsUpdate = true; }); };
const oldOrder = () => {   // g=13 order: sky dome first (-1), ground among the opaques (0)
  const saved = []; P.world.traverse((o) => saved.push([o, o.renderOrder]));
  P.sky.renderOrder = -1; P.ground.renderOrder = 0; P.world.traverse((o) => { if (o.renderOrder === 3) o.renderOrder = 0; });
  return () => saved.forEach(([o, r]) => (o.renderOrder = r));
};
let mode = "grade";
const gradeOff = () => { mode = "direct"; return () => (mode = "grade"); };
const readOnly = () => { mode = "none"; return () => (mode = "grade"); };
// candidate ground cuts (look-preserving): POM only < 6 m with 4 steps, detail full < 6 m fading to 12 m, aniso 8 on the ground arrays
const cutA = both(setU("uGroundPomFade", 6), setU("uGroundPomSteps", 4), setU("uGDetNear", 6), setU("uGDetFar", 12), aniso(8));
const cutB = both(cutA, def("G_IMPLICIT"));
const cutC = both(cutB, setU("uShadowOn", 0), setU("uRoadOn", 0));


const poseA = { x: st.x, z: st.z, yaw: st.yaw, pitch: st.pitch }, poseB = { ...poseA, pitch: -40 };
const NONE = () => () => {};
const F = window.__groundFill || (() => ({}));
const fill = (o) => () => { const prev = F(); F(o); return () => F(prev); };
const groundHidden = () => { P.ground.visible = false; return () => (P.ground.visible = true); };
// [name, pose, toggle]. Lossless candidates first; references after. [diag] = changes the look, never a proposal.
const A = [
  ["HR8: POM heights from an R8 copy (lossless)", poseA, fill({ hr8: true })],
  ["PRE: ground depth prepass (lossless)", poseA, fill({ pre: true })],
  ["HR8 + PRE (lossless)", poseA, fill({ hr8: true, pre: true })],
  ["OLD = g13 (order + POM loop)", poseA, both(oldOrder, def("G_OLDPOM"))],
  ["ratio 1.5 (ref)", poseA, ratio(1.5)],
  ["ground hidden (ref)", poseA, groundHidden],
  ["POM off [diag]", poseA, setU("uGroundPom", 0)],
  ["ground detail off [diag]", poseA, setU("uGDetOn", 0)],
  ["tower-shadow 9-tap off [diag]", poseA, setU("uShadowOn", 0)],
  ["sky simple [diag]", poseA, skySimple],
  ["objects hidden (ref)", poseA, hide(/^(inst-|spire-|zb-mesas|mesa-|sand-drifts|avenue-slabs|mag-rail)/)],
  ["readback only (no render)", poseA, readOnly],
  ["DOWN HR8 + PRE (lossless)", poseB, fill({ hr8: true, pre: true })],
  ["DOWN OLD = g13", poseB, both(oldOrder, def("G_OLDPOM"))],
  ["DOWN ground hidden (ref)", poseB, groundHidden],
];
const list = A;

const K = 3, ivs = [], cpus = []; let lastRaf = 0, how = "off";
const one = () => { if (mode === "direct") { R.setRenderTarget(null); R.render(P.world, P.camera); } else if (mode === "grade") P.render(); };
window.__benchRender = () => {
  const now = performance.now();
  if (how === "idle") { lastRaf = 0; return; }
  if (how === "pipe") {
    if (lastRaf) ivs.push(now - lastRaf); lastRaf = now;
    const t0 = performance.now(); for (let k = 0; k < K; k++) one(); cpus.push((performance.now() - t0) / K);
  } else one();
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const setPose = (p) => { st.x = p.x; st.z = p.z; st.yaw = p.yaw; st.pitch = p.pitch; st.y = G.field.surfaceHeight(p.x, p.z) + 1.5; };

const dbg = gl.getExtension("WEBGL_debug_renderer_info");
const info = {
  gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
  maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE), aniso: R.capabilities.getMaxAnisotropy(), dpr: window.devicePixelRatio,
  css: `${innerWidth}x${innerHeight}`, ua: (navigator.userAgent.match(/Chrome\/[\d.]+/) || [""])[0],
};
say("Bench v4 : préparation des shaders…");
for (const [, pose, f] of list) { setPose(pose); const u = f(); one(); await sleep(60); u(); one(); }   // compile every variant now
for (let s = 8; s > 0; s--) { say(`Bench Zone B v4 : chauffe ${s} s… (≈2 min 30, ne touche pas l'écran)`); setPose(poseA); await sleep(1000); }
{ const inf = R.info, ar = inf.autoReset; inf.autoReset = false; inf.reset(); one(); info.calls = inf.render.calls; info.tris = inf.render.triangles; inf.reset(); inf.autoReset = ar;
  info.buf = [gl.drawingBufferWidth, gl.drawingBufferHeight]; }
const SEG = 1200, SET = 400, COOL = 1000;
const seg = async () => { ivs.length = 0; cpus.length = 0; lastRaf = 0; how = "pipe"; await sleep(SEG); how = "off"; return { ms: med(ivs) / K, cpu: med(cpus) }; };
const rows = []; let base0 = null;
for (let k = 0; k < list.length; k++) {
  const [name, pose, f] = list[k];
  say(`Bench v4 ${k + 1}/${list.length} : ${name}`);
  setPose(pose); how = "off"; await sleep(SET);
  const b = [], r = []; let cpu = 0;
  for (let rep = 0; rep < 2; rep++) {
    b.push((await seg()).ms);
    const undo = f(); await sleep(SET); const x = await seg(); r.push(x.ms); cpu = x.cpu; undo(); await sleep(SET);
  }
  how = "idle"; await sleep(COOL); how = "off";
  const bm = (b[0] + b[1]) / 2, rm = (r[0] + r[1]) / 2;
  if (base0 == null && pose === poseA) base0 = bm;
  const row = { n: name, b: +bm.toFixed(1), ms: +rm.toFixed(1), d: +(rm - bm).toFixed(1), p: +((100 * (rm - bm)) / bm).toFixed(1), cpu: +cpu.toFixed(1),
    spread: +Math.max(Math.abs(b[0] - b[1]), Math.abs(r[0] - r[1])).toFixed(1) };
  if (pose === poseA) row.norm = +((rm / bm) * base0).toFixed(1);
  rows.push(row);
}
window.__benchRender = null;
const res = { v: 4, t: new Date().toISOString(), base0: +base0.toFixed(1), fill: F(), info, rows };
const enc = btoa(unescape(encodeURIComponent(JSON.stringify(res)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
history.replaceState(null, "", `bench.html#r=${enc}`);
window.__benchShow(res, location.href);
