// Zone B on-phone auto-benchmark v6 (staging, 2026-10-10 14:05). Loaded by bench.html after window.__ready. Base = ratio 2,
// full quality, PRE on (SmiR's phone default). Thermally fair ABAB (each row vs its OWN neighbouring base segments, idle
// cool-down between rows). v5 bug: on the phone the first 3 rows came back empty (k=0: a segment got no interval within its
// 5 s cap, and the NaN also killed base0 / norm). v6: a segment waits up to 12 s for >= 12 intervals, retries up to 3 times
// when it got < 4, logs every segment (n, ms elapsed, raw median, rAF calls seen) into the result, and base0 is the first
// valid base. Phase 2: the game's own quality-first controller (ratio 2, emergency floor only) on normal vsync frames, 24 s.
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

const { createAdaptiveRes } = await import("./runtime/adaptive-res-v3.mjs?v=3");
const poseA = { x: st.x, z: st.z, yaw: st.yaw, pitch: st.pitch }, poseB = { ...poseA, pitch: -40 };
const F = window.__groundFill || (() => ({}));
const fill = (o) => () => { const prev = F(); F(o); return () => F(prev); };
// [name, pose, toggle]
const A = [
  ["ratio 1.75", poseA, ratio(1.75)],
  ["ratio 1.5", poseA, ratio(1.5)],
  ["HR8 retest (lossless switch)", poseA, fill({ hr8: true })],
  ["DOWN ratio 1.5", poseB, ratio(1.5)],
];
const list = A;

const K = 3, ivs = [], cpus = []; let lastRaf = 0, how = "pipe", rec = false, skip = 0, calls = 0;
const one = () => { if (mode === "direct") { R.setRenderTarget(null); R.render(P.world, P.camera); } else if (mode === "grade") P.render(); };
window.__benchRender = () => {
  const now = performance.now(); calls++;
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
say("Bench v6 : préparation des shaders…");
how = "off";
for (const [, pose, f] of list) { setPose(pose); const u = f(); one(); await sleep(60); u(); one(); }   // compile every variant now
how = "pipe";
for (let s = 8; s > 0; s--) { say(`Bench Zone B v6 : chauffe ${s} s… (≈1 min 30, ne touche pas l'écran)`); setPose(poseA); await sleep(1000); }
{ const inf = R.info, ar = inf.autoReset; inf.autoReset = false; inf.reset(); one(); info.calls = inf.render.calls; info.tris = inf.render.triangles; inf.reset(); inf.autoReset = ar;
  info.buf = [gl.drawingBufferWidth, gl.drawingBufferHeight]; }
const SET = 400, COOL = 1000, NMIN = 12, SKIP = 3, TMAX = 12000, segLog = [];
const seg = async (tag) => {
  for (let tr = 0; tr < 3; tr++) {
    ivs.length = 0; cpus.length = 0; skip = SKIP; rec = true; const t0 = performance.now(), c0 = calls;
    while (ivs.length < NMIN && performance.now() - t0 < TMAX) await sleep(50);
    rec = false;
    const n = ivs.length, m = med(ivs) / K;
    segLog.push([tag, tr, n, Math.round(performance.now() - t0), isFinite(m) ? +m.toFixed(1) : null, calls - c0]);
    if (n >= 4) return { ms: m, cpu: med(cpus), n };
  }
  return { ms: NaN, cpu: NaN, n: 0 };
};
const mean2 = (a) => { const v = a.filter(isFinite); return v.length ? v.reduce((t, x) => t + x, 0) / v.length : NaN; };
const fx = (x, d = 1) => (isFinite(x) ? +x.toFixed(d) : null);
const rows = []; let base0 = null;
for (let k = 0; k < list.length; k++) {
  const [name, pose, f] = list[k];
  say(`Bench v6 ${k + 1}/${list.length} : ${name.replace(/ · A\/B.*/, "")}`);
  setPose(pose); how = "pipe"; await sleep(SET);
  const b = [], r = []; let cpu = 0, n = 99;
  for (let rep = 0; rep < 2; rep++) {
    const sb = await seg(`${k}b${rep}`); b.push(sb.ms); n = Math.min(n, sb.n);
    const undo = f(); await sleep(SET); const x = await seg(`${k}r${rep}`); r.push(x.ms); if (isFinite(x.cpu)) cpu = x.cpu; n = Math.min(n, x.n); undo(); await sleep(SET);
  }
  how = "idle"; await sleep(COOL); how = "pipe";
  const bm = mean2(b), rm = mean2(r);
  if (base0 == null && pose === poseA && isFinite(bm)) base0 = bm;
  const sp = Math.max(isFinite(b[0] - b[1]) ? Math.abs(b[0] - b[1]) : 0, isFinite(r[0] - r[1]) ? Math.abs(r[0] - r[1]) : 0);
  const row = { n: name, b: fx(bm), ms: fx(rm), d: fx(rm - bm), p: fx((100 * (rm - bm)) / bm), cpu: fx(cpu),
    spread: fx(sp), fps: fx(1000 / rm, 0), bfps: fx(1000 / bm, 0), k: n };
  if (pose === poseA && base0 != null) row.norm = fx((rm / bm) * base0);
  rows.push(row);
}
// ---- phase 2: the real adaptive controller, normal frames (1 render per rAF, vsync), from ratio 2
setPose(poseA);
const U0 = { n: U.uGDetNear.value, f: U.uGDetFar.value };
const ctl = createAdaptiveRes({ cap: 2, floor: 1.25, warmupMs: 3000 });
let undoR = ratio(2)(), last = 0, t0 = 0; const fpsLog = [], trace = [];
window.__benchFrame = (now) => {
  if (!t0) { t0 = now; ctl.markReady(now); last = now; return; }
  const dt = now - last; last = now; fpsLog.push([now - t0, dt]);
  if (ctl.frame(dt, now)) {
    undoR(); undoR = ratio(ctl.level.ratio)();
    trace.push([+((now - t0) / 1000).toFixed(1), ctl.level.ratio, ctl.level.detail ? 1 : 0]);
  }
};
how = "game";
const AD = 24000;
for (let s = AD / 1000; s > 0; s--) { say(`Bench v6 : mode adaptatif réel ${s} s (ratio ${ctl.level.ratio}, qualité max)`); await sleep(1000); }
how = "off"; window.__benchFrame = null; undoR(); U.uGDetNear.value = U0.n; U.uGDetFar.value = U0.f;
const tail = fpsLog.filter(([t]) => t > AD - 8000).map(([, d]) => d);
const adaptive = { ratio: ctl.level.ratio, detail: ctl.level.detail, fps: +(1000 / med(tail)).toFixed(0), changes: ctl.changes, trace };
window.__benchRender = null;
const res = { v: 6, t: new Date().toISOString(), base0: base0 == null ? null : +base0.toFixed(1), info, rows, adaptive, segs: segLog };
const enc = btoa(unescape(encodeURIComponent(JSON.stringify(res)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
history.replaceState(null, "", `bench.html#r=${enc}`);
window.__benchShow(res, location.href);
