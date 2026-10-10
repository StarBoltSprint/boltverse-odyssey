// Zone B on-phone auto-benchmark v5 (staging, 2026-10-10 13:30). Loaded by bench.html after window.__ready. PRE (ground depth
// prepass) is ON in the base (phone v4: -5.8 ms, spread 0.5). Same thermally fair ABAB method as v4 (each row vs its OWN
// neighbouring base segments, 1 s idle cool-down between rows), with a steadier segment: v4's 1.2 s segments held only ~8
// intervals at 45 ms x 3 renders and the first 2-3 (GPU queue still filling) read fast -> bases of 14-31 ms. v5 keeps the
// pipeline full between segments, discards the first 4 intervals of each segment and records >= 10.
// Phase 2 = the real adaptive controller (runtime/adaptive-res.mjs, normal 1-render frames, vsync) for 36 s from ratio 2:
// where it settles and the median fps there. Rows [look] change the image slightly (A/B mean diff in the label); never default.
//  "ms" = PIPELINED: K=3 renders per animation frame, no readback; median rAF interval / 3. fps = 1000 / ms (uncapped).
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

const { createAdaptiveRes } = await import("./runtime/adaptive-res.mjs?v=2");
const poseA = { x: st.x, z: st.z, yaw: st.yaw, pitch: st.pitch }, poseB = { ...poseA, pitch: -40 };
const F = window.__groundFill || (() => ({}));
const fill = (o) => () => { const prev = F(); F(o); return () => F(prev); };
const lookA = both(setU("uGroundPomFade", 8));
const lookB = both(setU("uGDetNear", 10), setU("uGDetFar", 20));
// [name, pose, toggle]
const A = [
  ["ratio 1.75", poseA, ratio(1.75)],
  ["ratio 1.5", poseA, ratio(1.5)],
  ["HR8 retest (lossless switch)", poseA, fill({ hr8: true })],
  ["[look] a: POM < 8 m (was 10), adaptive steps · A/B mean <=0.21/255", poseA, lookA],
  ["[look] b: detail fades 10-20 m (was 15-30) · A/B mean <=0.05/255", poseA, lookB],
  ["[look] a+b · A/B mean <=0.26/255", poseA, both(lookA, lookB)],
  ["DOWN [look] a+b", poseB, both(lookA, lookB)],
];
const list = A;

const K = 3, ivs = [], cpus = []; let lastRaf = 0, how = "pipe", rec = false, skip = 0;
const one = () => { if (mode === "direct") { R.setRenderTarget(null); R.render(P.world, P.camera); } else if (mode === "grade") P.render(); };
window.__benchRender = () => {
  const now = performance.now();
  if (how === "idle") { lastRaf = 0; return; }
  if (how === "pipe") {
    if (rec && lastRaf) { if (skip > 0) skip--; else ivs.push(now - lastRaf); }
    lastRaf = now;
    const t0 = performance.now(); for (let k = 0; k < K; k++) one(); if (rec && !skip) cpus.push((performance.now() - t0) / K);
  } else if (how === "game") { if (window.__benchFrame) window.__benchFrame(now); one(); }
  else one();
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const setPose = (p) => { st.x = p.x; st.z = p.z; st.yaw = p.yaw; st.pitch = p.pitch; st.y = G.field.surfaceHeight(p.x, p.z) + 1.5; };

const dbg = gl.getExtension("WEBGL_debug_renderer_info");
const info = {
  gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
  maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE), aniso: R.capabilities.getMaxAnisotropy(), dpr: window.devicePixelRatio,
  css: `${innerWidth}x${innerHeight}`, ua: (navigator.userAgent.match(/Chrome\/[\d.]+/) || [""])[0], fill: F(),
};
say("Bench v5 : préparation des shaders…");
how = "off";
for (const [, pose, f] of list) { setPose(pose); const u = f(); one(); await sleep(60); u(); one(); }   // compile every variant now
how = "pipe";
for (let s = 8; s > 0; s--) { say(`Bench Zone B v5 : chauffe ${s} s… (≈2 min, ne touche pas l'écran)`); setPose(poseA); await sleep(1000); }
{ const inf = R.info, ar = inf.autoReset; inf.autoReset = false; inf.reset(); one(); info.calls = inf.render.calls; info.tris = inf.render.triangles; inf.reset(); inf.autoReset = ar;
  info.buf = [gl.drawingBufferWidth, gl.drawingBufferHeight]; }
const SET = 400, COOL = 1000, NMIN = 10, SKIP = 4, TMAX = 5000;
const seg = async () => {
  ivs.length = 0; cpus.length = 0; skip = SKIP; rec = true; const t0 = performance.now();
  while (ivs.length < NMIN && performance.now() - t0 < TMAX) await sleep(50);
  rec = false; return { ms: med(ivs) / K, cpu: med(cpus), n: ivs.length };
};
const rows = []; let base0 = null;
for (let k = 0; k < list.length; k++) {
  const [name, pose, f] = list[k];
  say(`Bench v5 ${k + 1}/${list.length} : ${name.replace(/ · A\/B.*/, "")}`);
  setPose(pose); how = "pipe"; await sleep(SET);
  const b = [], r = []; let cpu = 0, n = 99;
  for (let rep = 0; rep < 2; rep++) {
    const sb = await seg(); b.push(sb.ms); n = Math.min(n, sb.n);
    const undo = f(); await sleep(SET); const x = await seg(); r.push(x.ms); cpu = x.cpu; n = Math.min(n, x.n); undo(); await sleep(SET);
  }
  how = "idle"; await sleep(COOL); how = "pipe";
  const bm = (b[0] + b[1]) / 2, rm = (r[0] + r[1]) / 2;
  if (base0 == null && pose === poseA) base0 = bm;
  const row = { n: name, b: +bm.toFixed(1), ms: +rm.toFixed(1), d: +(rm - bm).toFixed(1), p: +((100 * (rm - bm)) / bm).toFixed(1), cpu: +cpu.toFixed(1),
    spread: +Math.max(Math.abs(b[0] - b[1]), Math.abs(r[0] - r[1])).toFixed(1), fps: +(1000 / rm).toFixed(0), bfps: +(1000 / bm).toFixed(0), k: n };
  if (pose === poseA) row.norm = +((rm / bm) * base0).toFixed(1);
  rows.push(row);
}
// ---- phase 2: the real adaptive controller, normal frames (1 render per rAF, vsync), from ratio 2
setPose(poseA);
const U0 = { n: U.uGDetNear.value, f: U.uGDetFar.value };
const ctl = createAdaptiveRes({ cap: 2, hasDetail: true, warmupMs: 3000 });
let undoR = ratio(2)(), last = 0, t0 = 0; const fpsLog = [], trace = [];
window.__benchFrame = (now) => {
  if (!t0) { t0 = now; ctl.markReady(now); last = now; return; }
  const dt = now - last; last = now; fpsLog.push([now - t0, dt]);
  if (ctl.frame(dt, now)) {
    undoR(); undoR = ratio(ctl.level.ratio)();
    U.uGDetNear.value = ctl.level.detail ? U0.n : 8; U.uGDetFar.value = ctl.level.detail ? U0.f : 16;
    trace.push([+((now - t0) / 1000).toFixed(1), ctl.level.ratio, ctl.level.detail ? 1 : 0]);
  }
};
how = "game";
const AD = 36000;
for (let s = AD / 1000; s > 0; s--) { say(`Bench v5 : mode adaptatif réel ${s} s (ratio ${ctl.level.ratio}${ctl.level.detail ? "" : " · détail 16 m"})`); await sleep(1000); }
how = "off"; window.__benchFrame = null; undoR(); U.uGDetNear.value = U0.n; U.uGDetFar.value = U0.f;
const tail = fpsLog.filter(([t]) => t > AD - 8000).map(([, d]) => d);
const adaptive = { ratio: ctl.level.ratio, detail: ctl.level.detail, fps: +(1000 / med(tail)).toFixed(0), changes: ctl.changes, trace };
window.__benchRender = null;
const res = { v: 5, t: new Date().toISOString(), base0: +base0.toFixed(1), info, rows, adaptive };
const enc = btoa(unescape(encodeURIComponent(JSON.stringify(res)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
history.replaceState(null, "", `bench.html#r=${enc}`);
window.__benchShow(res, location.href);
