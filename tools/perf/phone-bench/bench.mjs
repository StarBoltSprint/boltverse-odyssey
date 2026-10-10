// Zone B on-phone auto-benchmark v3 (staging, 2026-10-10). Loaded by bench.html after window.__ready.
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
const r2 = Math.min(2, window.devicePixelRatio || 1);
const NONE = () => () => {};
// [name, pose, toggle, settle ms]
const A = [
  ["base · ratio 2", poseA, NONE],
  ["ratio 1.5", poseA, ratio(1.5)],
  ["ratio 1.0", poseA, ratio(1.0)],
  ["readback only (no render)", poseA, readOnly],
  ["OLD draw order (g=13)", poseA, oldOrder],
  ["OLD POM loop (sincos per step)", poseA, def("G_OLDPOM"), 2500],
  ["OLD = g13 (order + POM loop)", poseA, both(oldOrder, def("G_OLDPOM")), 2500],
  ["ground hidden", poseA, () => { P.ground.visible = false; return () => (P.ground.visible = true); }],
  ["ground flat colour (vertex only)", poseA, groundFlat, 2500],
  ["ground: tower-shadow 9-tap off", poseA, setU("uShadowOn", 0)],
  ["ground: road layer off", poseA, setU("uRoadOn", 0)],
  ["ground: implicit derivatives [diag]", poseA, def("G_IMPLICIT"), 2500],
  ["ground: aniso 8 [diag]", poseA, aniso(8), 2000],
  ["ground: bombing off [diag]", poseA, setU("uGroundBomb", 0)],
  ["ground: single layer [diag]", poseA, setU("uGroundEdge", 1e-4)],
  ["ground: POM <6 m, 4 steps [diag]", poseA, both(setU("uGroundPomFade", 6), setU("uGroundPomSteps", 4))],
  ["ground: detail <12 m [diag]", poseA, both(setU("uGDetNear", 6), setU("uGDetFar", 12))],
  ["CUT A: POM6/4 + det12 + aniso8 [diag, look≠]", poseA, cutA, 2000],
  ["CUT B: A + implicit deriv. [diag, look≠]", poseA, cutB, 2500],
  ["CUT C: B + shadow9 & road off [diag, look≠]", poseA, cutC, 2500],
  ["ground detail off", poseA, setU("uGDetOn", 0)],
  ["POM off", poseA, setU("uGroundPom", 0)],
  ["shadows off (three)", poseA, shadowsOff, 2000],
  ["veils+god-rays+beam off", poseA, hide(/^(air-sand-veils|sky1-godrays|spire-beam|spire-emit-lod\d)$/)],
  ["sand particles off", poseA, hide(/^air-sand-grains$/)],
  ["planet/ring/sky simple", poseA, skySimple],
  ["towers hidden", poseA, hide(/^(inst-|spire-)/)],
  ["mesas hidden", poseA, hide(/^(zb-mesas|mesa-)/)],
  ["grade pass off (direct)", poseA, gradeOff],
  ["ground only (all objects+sky off)", poseA, both(hide(/^(inst-|spire-|zb-mesas|mesa-|air-|sky1-|sand-drifts|avenue-slabs|mag-rail)/), skySimple)],
  ["DOWN base · ratio 2", poseB, NONE],
  ["DOWN ratio 1.5", poseB, ratio(1.5)],
  ["DOWN OLD draw order (g=13)", poseB, oldOrder],
  ["DOWN OLD = g13 (order + POM loop)", poseB, both(oldOrder, def("G_OLDPOM")), 2500],
  ["DOWN CUT A [diag, look≠]", poseB, cutA, 2000],
  ["DOWN CUT B [diag, look≠]", poseB, cutB, 2500],
  ["DOWN CUT C [diag, look≠]", poseB, cutC, 2500],
  ["base again · ratio 2", poseA, NONE],
];
const B = [["v58 path (opt=0, MSAA 1.5, no detail)", poseA, NONE], ["DOWN v58 path", poseB, NONE]];
const list = PHASE === "a" ? A : B;

const K = 3, ivs = [], cpus = [], syncs = []; let lastRaf = 0, how = "off";
const one = () => { if (mode === "direct") { R.setRenderTarget(null); R.render(P.world, P.camera); } else if (mode === "grade") P.render(); };
const px = new Uint8Array(4);
window.__benchRender = () => {
  const now = performance.now();
  if (how === "pipe") {
    if (lastRaf) ivs.push(now - lastRaf); lastRaf = now;
    const t0 = performance.now(); for (let k = 0; k < K; k++) one(); cpus.push((performance.now() - t0) / K);
  } else if (how === "sync") {
    const t0 = performance.now(); one(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); syncs.push(performance.now() - t0);
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
  timerQuery: !!gl.getExtension("EXT_disjoint_timer_query_webgl2"),
};
for (let s = 8; s > 0; s--) { say(`Bench Zone B v3 : chauffe ${s} s… (≈3 min, ne touche pas l'écran)`); setPose(poseA); await sleep(1000); }
{ // per-frame geometry counts at the base pose
  const inf = R.info, ar = inf.autoReset; inf.autoReset = false; inf.reset(); one(); info.calls = inf.render.calls; info.tris = inf.render.triangles; inf.reset(); inf.autoReset = ar;
  info.terrainTris = window.__terrain && window.__terrain.tris; info.buf = [gl.drawingBufferWidth, gl.drawingBufferHeight];
}
const rows = [];
for (let k = 0; k < list.length; k++) {
  const [name, pose, f, settle = 1000] = list[k];
  setPose(pose); const undo = f();
  say(`Bench v3 ${PHASE.toUpperCase()} ${k + 1}/${list.length} : ${name}`);
  await sleep(settle);
  ivs.length = 0; cpus.length = 0; syncs.length = 0; lastRaf = 0; how = "pipe";
  await sleep(2500);
  how = "sync"; await sleep(900); how = "off";
  undo();
  rows.push({ n: name, ms: +(med(ivs) / K).toFixed(1), cpu: +med(cpus).toFixed(1), sync: +med(syncs).toFixed(1), f: ivs.length });
}
window.__benchRender = null;
if (PHASE === "a") {
  sessionStorage.setItem("zbBenchA3", JSON.stringify({ info, rows }));
  say("Bench : phase 2 (chemin v58), rechargement…"); await sleep(600);
  location.replace(`bench.html?phase=b&opt=0&gdet=0&lockq=1&dyn=0&hud=0&grain=0&cb=${Date.now()}`);
} else {
  let a = null; try { a = JSON.parse(sessionStorage.getItem("zbBenchA3")); } catch {}
  const res = { v: 3, order: window.__order, t: new Date().toISOString(), info: (a && a.info) || info, rows: ((a && a.rows) || []).concat(rows) };
  const enc = btoa(unescape(encodeURIComponent(JSON.stringify(res)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  history.replaceState(null, "", `bench.html#r=${enc}`);
  window.__benchShow(res, location.href);
}
