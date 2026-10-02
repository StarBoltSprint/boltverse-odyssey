/**
 * PASS/FAIL rows from captured frames.
 * A row with no measurement is FAIL. Data agreement alone never PASSes a rendered row.
 */

import {
  angDist,
  inGateSpan,
  layoutLabels,
  ringRays,
  surfaceGap,
} from "./layout.mjs";
import {
  backdropMag,
  blackRectangles,
  colorVisible,
  components,
  countLabels,
  decodeIds,
  fogStreakFrac,
  floorRepeat,
  round,
  windowCount,
  windowCountAny,
} from "./pixels.mjs";
import { judgeTransition } from "../../../biome/scripts/zone-flow/zoneFlow.mjs";
import { judgePerf } from "../../perf/stats.mjs";

const WEBGL_RE = /webgl|invalid_|gl_invalid|texsubimage|teximage|geterror/i;

export function createJudge(layout) {
  const frames = [];
  return {
    add(frame) {
      const ids = decodeIds(frame.snap && frame.snap.objectIds);
      const counts = countLabels(ids);
      const rec = {
        id: frame.id,
        kind: frame.kind,
        snap: frame.snap || {},
        width: frame.width || 0,
        height: frame.height || 0,
        ids,
        counts,
        rgba: frame.rgba || null,
      };
      frames.push(rec);
    },
    finish(extras = {}) {
      return finish(layout, frames, extras);
    },
  };
}

function finish(layout, frames, extras) {
  const labels = layoutLabels(layout);
  const objectLabels = [...labels.hulls, ...labels.gates, ...labels.interiors];
  const gl = collectGl(extras);
  const rows = [];

  rows.push(rowDebug(frames));
  rows.push(rowWebgl(gl));
  rows.push(rowWebglClean(gl));
  rows.push(rowFullscreen(frames, layout));
  const mag = rowMag(frames, layout);
  rows.push(mag);
  rows.push({
    ...mag,
    id: "mag",
    detail: "Doc 63 name for the same HUD magnification peak as mag_max. Above the layout limit is FAIL.",
  });
  rows.push(rowSingleHero(frames));
  rows.push(rowIdleGallop(frames));
  rows.push(rowSingleBolt(frames, rows));
  rows.push(rowStops(frames, layout, objectLabels));
  rows.push(rowCollider(frames, layout, objectLabels));
  rows.push(rowLayout(frames, layout));
  rows.push(rowRing(frames, layout));
  rows.push(rowGate(frames, layout));
  rows.push(rowNear(frames, layout));
  rows.push(rowFog(frames, layout));
  rows.push(rowBlack(frames));
  rows.push(rowTiles(frames));
  rows.push(rowBackdrop(frames, layout));
  rows.push(rowBoltGrounded(frames));
  pushAcceptance(rows, frames, layout);
  pushTransition(rows, frames);
  const perf = judgePerf(frames, { softwareGl: !!extras.softwareGl });
  for (const perfRow of perf.rows) rows.push(perfRow);
  if (extras.sourceLint) rows.push(rowSource(extras.sourceLint));

  const failed = rows.filter((r) => r.result !== "PASS").length;
  return {
    rows,
    failed,
    passed: rows.length - failed,
    glErrors: gl.errors,
    consoleErrors: gl.console,
    perf: perf.report,
  };
}

function transitionSamples(frames) {
  const samples = [];
  for (const frame of frames) {
    const snap = frame.snap || {};
    const block = snap.transition;
    if (!block) continue;
    if (Array.isArray(block)) samples.push(...block);
    else if (Array.isArray(block.samples)) samples.push(...block.samples);
    else samples.push(block);
  }
  return samples;
}

function pushAcceptance(rows, frames, layout) {
  const marked = frames.some((f) => f.snap && f.snap.acceptance);
  if (!marked) return;
  rows.push(rowHeroVisible(frames));
  rows.push(rowSteer(frames));
  rows.push(rowGateBearing(frames, layout));
  rows.push(rowWreckLocked(frames));
  rows.push(rowSolidsLocked(frames, layout));
  rows.push(rowHandedness(frames));
  rows.push(rowNoPop(frames, layout));
}

function rowHeroVisible(frames) {
  const spawn = frames.find((f) => f.kind === "spawn") || frames[0];
  const base = spawn ? Number(spawn.snap.heroPixels) : NaN;
  if (!Number.isFinite(base) || base < 1) {
    return row("hero_visible", "FAIL", { spawn: base }, "Spawn hero pixel count was not measured.");
  }
  const bad = [];
  let worst = 1;
  for (const f of frames) {
    const n = Number(f.snap.heroPixels);
    const frac = Number.isFinite(n) ? n / base : 0;
    if (frac < worst) worst = frac;
    if (!(frac >= 0.6)) bad.push({ id: f.id, heroPixels: n, frac: round(frac) });
  }
  const result = bad.length ? "FAIL" : "PASS";
  return row(
    "hero_visible",
    result,
    { spawn: base, worstFrac: round(worst), bad: bad.slice(0, 6), frames: frames.length },
    "Hero pixels must stay at or above 60% of the spawn count on every walked frame.",
  );
}

function rowSteer(frames) {
  let worst = 1;
  const bad = [];
  let n = 0;
  for (const f of frames) {
    const r = f.snap.camRight;
    if (!r || r.length < 3) continue;
    n++;
    const yaw = (Number(f.snap.hdg) || 0) * Math.PI / 180;
    const ex = Math.cos(yaw);
    const ez = -Math.sin(yaw);
    const dot = r[0] * ex + r[2] * ez;
    if (dot < worst) worst = dot;
    if (dot < 0.95) bad.push({ id: f.id, dot: round(dot), hdg: round(Number(f.snap.hdg) || 0) });
  }
  if (!n) return row("steer_direction", "FAIL", {}, "camRight was not reported.");
  const result = bad.length ? "FAIL" : "PASS";
  return row(
    "steer_direction",
    result,
    { frames: n, worstDot: round(worst), bad: bad.slice(0, 4) },
    "Camera right is cross(up, forward). A positive heading faces +X on screen right. Dot with that right must be ≥ 0.95.",
  );
}

function rowGateBearing(frames, layout) {
  const gate = layout.gates[0];
  if (!gate) return row("gate_bearing", "FAIL", {}, "No gate.");
  let worst = 0;
  let at = null;
  let samples = 0;
  for (const f of frames) {
    const g = f.snap.gate;
    if (!g || !Number.isFinite(Number(g.bearing_deg))) continue;
    const x = Number(f.snap.x) || 0;
    const z = Number(f.snap.z) || 0;
    const hdg = Number(f.snap.hdg) || 0;
    const rad = (gate.heading * Math.PI) / 180;
    const gx = Math.sin(rad) * layout.edgeRadius;
    const gz = Math.cos(rad) * layout.edgeRadius;
    const abs = (Math.atan2(gx - x, gz - z) * 180) / Math.PI;
    const expect = wrap180deg(abs - hdg);
    const err = Math.abs(wrap180deg(Number(g.bearing_deg) - expect));
    samples++;
    if (err > worst) {
      worst = err;
      at = f.id;
    }
  }
  if (!samples) return row("gate_bearing", "FAIL", {}, "No gate bearing was reported.");
  const result = worst <= 1 ? "PASS" : "FAIL";
  return row(
    "gate_bearing",
    result,
    { worstDeg: round(worst), at, limit: 1, samples },
    "HUD gate bearing is atan2 from Bolt to the gate, minus heading. Error above 1° is FAIL.",
  );
}

function wrap180deg(a) {
  let x = a % 360;
  if (x < 0) x += 360;
  if (x > 180) x -= 360;
  return x;
}

function rowSource(lint) {
  const findings = Array.isArray(lint.findings) ? lint.findings : [];
  if (lint.skipped) {
    return row(
      "render_source",
      "PASS",
      { skipped: lint.skipped, findings: findings.length },
      "Measurement fixture. Law 65 source lint is recorded and not applied.",
      { partial: true },
    );
  }
  if (!lint.scanned) {
    return row(
      "render_source",
      "FAIL",
      { scanned: false, findings: findings.length },
      findings[0]?.detail || "Play source was not scanned. Pass a local build or --source <play.js>. Unmeasured is not a PASS.",
    );
  }
  if (!findings.length) {
    return row(
      "render_source",
      "PASS",
      { scanned: true, files: lint.files || 0, findings: 0 },
      "Law 65 source scan. No NEAREST world texture, no per-batch typed-array upload, no per-object draw loop, no camQuad on a solid.",
    );
  }
  const sample = findings.slice(0, 8).map((f) => `${f.file}:${f.line} ${f.rule}`);
  return row("render_source", "FAIL", { scanned: true, findings: findings.length, sample }, `Law 65 source scan failed. ${sample.join("; ")}`);
}

function rowSolidsLocked(frames, layout) {
  const host = frames.find((f) => f.snap && f.snap.solidLock && Array.isArray(f.snap.solidLock.objects));
  if (!host) return row("solids_world_locked", "FAIL", {}, "No 5° orbit audit. Unmeasured is not a PASS.");
  const got = new Map(host.snap.solidLock.objects.map((o) => [o.id, o]));
  const need = [];
  for (const o of layout.interiors) need.push(o.id);
  const rings = (layout.hulls || []).filter((h) => String(h.asset || "").includes("ring-b")).slice(0, 4);
  for (const h of rings) need.push(h.id);
  const bad = [];
  for (const id of need) {
    const o = got.get(id);
    if (!o) {
      bad.push({ id, reason: "missing" });
      continue;
    }
    if (o.identical !== 0 || !(Number(o.cardMin) > 3 / 255)) bad.push({ id, identical: o.identical, cardMin: o.cardMin, steps: o.steps });
  }
  const result = bad.length || !need.length ? "FAIL" : "PASS";
  return row(
    "solids_world_locked",
    result,
    { objects: need.length, bad: bad.slice(0, 8), limitIdentical: 0, cardMae: round(3 / 255) },
    "Every interior and four ring stones: 0 identical consecutive 5° crops, and the four cardinal renders differ by more than 3/255.",
  );
}

function rowHandedness(frames) {
  const host = frames.find((f) => f.snap && f.snap.handedness && Number(f.snap.handedness.bearings) > 0);
  if (!host) return row("hull_handedness", "FAIL", {}, "No mirror check. Unmeasured is not a PASS.");
  const h = host.snap.handedness;
  const ok = h.beats === h.bearings && h.bearings >= 8;
  return row(
    "hull_handedness",
    ok ? "PASS" : "FAIL",
    { beats: h.beats, bearings: h.bearings, worstSame: round(Number(h.worstSame) || 0) },
    "At each 45° bearing the render correlates better with the same-yaw view than with its horizontal mirror.",
  );
}

function rowNoPop(frames, layout) {
  const seq = frames.filter((f) => f.ids && (f.kind === "ring" || f.kind === "turn" || f.kind === "spawn"));
  const pops = [];
  for (let i = 1; i < seq.length; i++) {
    const a = seq[i - 1];
    const b = seq[i];
    const dh = Math.abs(wrap180deg((Number(b.snap.hdg) || 0) - (Number(a.snap.hdg) || 0)));
    if (dh > 20) continue;
    const labels = b.ids.labels || [];
    for (let li = 1; li < labels.length; li++) {
      const name = labels[li];
      if (!name || name === "hero" || name === "ground" || name === "fog" || String(name).startsWith("gate")) continue;
      const prev = a.counts.get(name) || 0;
      const next = b.counts.get(name) || 0;
      if (prev > 3000 && next < prev * 0.2 && centerInView(layout, b.snap, name)) {
        pops.push({ id: b.id, name, prev, next });
      }
    }
  }
  const flagged = frames.filter((f) => Number(f.snap && f.snap.popCount) > 0).length;
  const result = pops.length || flagged ? "FAIL" : "PASS";
  return row(
    "no_pop",
    result,
    { pops: pops.length, flagged, sample: pops.slice(0, 4) },
    "No in-frustum object above 3000 px may drop below 20% of that count between consecutive turn samples.",
  );
}

function centerInView(layout, snap, name) {
  const list = [...(layout.hulls || []), ...(layout.interiors || [])];
  const o = list.find((item) => item.id === name);
  if (!o || !o.position) return true;
  const hdg = ((Number(snap.hdg) || 0) * Math.PI) / 180;
  const fwdX = Math.sin(hdg);
  const fwdZ = Math.cos(hdg);
  const eyeX = (Number(snap.x) || 0) - fwdX * 6.4;
  const eyeZ = (Number(snap.z) || 0) - fwdZ * 6.4;
  const dx = o.position[0] - eyeX;
  const dz = o.position[1] - eyeZ;
  const vz = dx * fwdX + dz * fwdZ;
  const vx = dx * Math.cos(hdg) - dz * Math.sin(hdg);
  if (vz < 1) return false;
  return Math.abs(vx / vz) < Math.tan((22.7 * Math.PI) / 180 / 2) * 0.75;
}

function rowWreckLocked(frames) {
  const orbit = frames.filter((f) => f.kind === "wreck-orbit" && f.rgba && f.rgba.length);
  if (orbit.length < 4) {
    return row("wreck_world_locked", "FAIL", { frames: orbit.length }, "Need four wreck-local bearings with screenshots.");
  }
  let worst = Infinity;
  const pairs = [];
  for (let i = 0; i < orbit.length; i++) {
    for (let j = i + 1; j < orbit.length; j++) {
      const mae = meanAbs(orbit[i].rgba, orbit[j].rgba);
      pairs.push({ a: orbit[i].id, b: orbit[j].id, mae: round(mae) });
      if (mae < worst) worst = mae;
    }
  }
  const result = worst > 3 / 255 ? "PASS" : "FAIL";
  return row(
    "wreck_world_locked",
    result,
    { frames: orbit.length, worstMae: round(worst), limit: round(3 / 255), pairs: pairs.slice(0, 8) },
    "Orbit screenshots at different wreck-local bearings must differ by more than 3/255 mean absolute error. A camera-facing card that does not change is FAIL.",
  );
}

function meanAbs(a, b) {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let s = 0;
  const step = Math.max(4, Math.floor(n / 40000) * 4);
  let c = 0;
  for (let i = 0; i < n; i += step) {
    s += Math.abs(a[i] - b[i]);
    if (i + 1 < n) s += Math.abs(a[i + 1] - b[i + 1]);
    if (i + 2 < n) s += Math.abs(a[i + 2] - b[i + 2]);
    c += 3;
  }
  return c ? s / c : 0;
}

function pushTransition(rows, frames) {
  const samples = transitionSamples(frames);
  if (!samples.length) return;
  const judged = judgeTransition(samples);
  rows.push(
    row(
      "transition_black",
      judged.black.ok ? "PASS" : "FAIL",
      {
        blacks: judged.black.blacks,
        frames: judged.black.frames,
        lumaMax: judged.black.lumaMax,
        frac: judged.black.frac,
      },
      "A transition frame is black when luma stays under 12 on at least 92% of sampled pixels. No black frame is allowed. Rows appear only when snapshot().transition is present.",
    ),
  );
  rows.push(
    row(
      "transition_hitch",
      judged.hitch.ok ? "PASS" : "FAIL",
      { maxHitchMs: judged.hitch.maxHitchMs, limitMs: judged.hitch.limitMs, frames: judged.hitch.frames },
      "Largest transition frame gap must stay at or under 100 ms.",
    ),
  );
}

function row(id, result, numbers, detail, extra = {}) {
  return { id, result, numbers, detail, heuristic: !!extra.heuristic, partial: !!extra.partial };
}

function rowDebug(frames) {
  const ready = frames.length > 0 && frames.every((f) => f.snap && f.ids);
  if (!frames.length) {
    return row("debug_hook", "FAIL", { frames: 0 }, "window.__play.snapshot() never returned a frame. Unmeasured is not a PASS.");
  }
  const missing = frames.filter((f) => !f.ids).map((f) => f.id);
  if (missing.length) {
    return row(
      "debug_hook",
      "FAIL",
      { frames: frames.length, missingIds: missing.slice(0, 8) },
      "Debug hook is up but at least one frame has no object-ID buffer. A colour screenshot alone is not the ID check.",
    );
  }
  return row("debug_hook", "PASS", { frames: frames.length, labels: frames[0].snap.objectIds.labels }, "snapshot() and object-ID buffer present on every captured step.");
}

function collectGl(extras) {
  const errors = [];
  for (const e of extras.glErrors || []) {
    errors.push(typeof e === "string" ? e : formatGl(e));
  }
  const consoleHits = [];
  for (const line of extras.consoleErrors || []) {
    if (WEBGL_RE.test(line)) {
      consoleHits.push(line);
      errors.push(line);
    }
  }
  const uniq = [];
  const seen = new Set();
  for (const e of errors) {
    const key = e.slice(0, 240);
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(e);
  }
  return { errors: uniq, console: consoleHits, count: uniq.length };
}

function formatGl(e) {
  if (!e) return "webgl error";
  const name = e.name || e.code || "error";
  const op = e.op ? `${e.op} ` : "";
  return `WebGL ${op}${name}`.trim();
}

function rowWebgl(gl) {
  if (gl.count === 0) {
    return row("webgl_errors", "PASS", { count: 0 }, "No WebGL errors from gl.getError or the console during the walk.");
  }
  return row(
    "webgl_errors",
    "FAIL",
    { count: gl.count, errors: gl.errors.slice(0, 12) },
    "Any WebGL error is FAIL, including texSubImage3D INVALID_OPERATION / INVALID_VALUE.",
  );
}

function rowWebglClean(gl) {
  const result = gl.count === 0 ? "PASS" : "FAIL";
  return row("webgl_clean", result, { count: gl.count }, "Doc 63 name for the same WebGL capture as webgl_errors.");
}

function rowFullscreen(frames, layout) {
  if (!frames.length) return row("fullscreen", "FAIL", {}, "No frame to measure.");
  const bad = [];
  for (const f of frames) {
    const c = f.snap.canvas || {};
    const cw = Number(c.width);
    const ch = Number(c.height);
    const sw = f.width;
    const sh = f.height;
    const canvasOk = Math.abs(cw - layout.viewW) <= 2 && Math.abs(ch - layout.viewH) <= 2;
    const shotOk = !sw || (Math.abs(sw - layout.viewW) <= 2 && Math.abs(sh - layout.viewH) <= 2);
    if (!canvasOk || !shotOk) bad.push({ id: f.id, canvas: [cw, ch], shot: [sw, sh] });
  }
  if (bad.length) {
    return row(
      "fullscreen",
      "FAIL",
      { expected: [layout.viewW, layout.viewH], bad: bad.slice(0, 4) },
      "Play view must be full-screen portrait 720×1600 (360×800 CSS at DPR 2). Letterbox is FAIL.",
    );
  }
  return row("fullscreen", "PASS", { width: layout.viewW, height: layout.viewH, frames: frames.length }, "Canvas backing store and screenshots are 720×1600.");
}

function rowMag(frames, layout) {
  let max = -Infinity;
  let at = null;
  const missing = [];
  for (const f of frames) {
    const m = Number(f.snap.mag);
    const sources = f.snap.magSources || {};
    const candidates = [m, ...Object.values(sources).map(Number)].filter((n) => Number.isFinite(n));
    if (!candidates.length) {
      missing.push(f.id);
      continue;
    }
    const local = Math.max(...candidates);
    if (local > max) {
      max = local;
      at = f.id;
    }
  }
  if (!Number.isFinite(max)) {
    return row("mag_max", "FAIL", { mag_max: null }, "HUD magnification was not reported. Missing is not a PASS.");
  }
  const limit = layout.magMax;
  const result = max > limit + 1e-3 || missing.length ? "FAIL" : "PASS";
  const detail =
    result === "PASS"
      ? `Peak magnification ${max} at ${at}, limit ${limit}.`
      : `Peak magnification ${max} at ${at}, limit ${limit}. Above 1.0 is FAIL.`;
  return row("mag_max", result, { mag_max: round(max), at, limit, missing: missing.length }, detail);
}

function heroStats(frame) {
  const reported = Number(frame.snap.heroCount);
  const blobs = components(frame.ids, "hero", 4);
  return { reported, blobs: blobs.length, areas: blobs };
}

function rowSingleHero(frames) {
  if (!frames.length) return row("single_hero", "FAIL", {}, "No frame.");
  const bad = [];
  for (const f of frames) {
    const h = heroStats(f);
    if (h.reported !== 1 || h.blobs !== 1) bad.push({ id: f.id, heroCount: h.reported, blobs: h.blobs });
  }
  if (bad.length) {
    return row("single_hero", "FAIL", { bad: bad.slice(0, 6), frames: frames.length }, "Exactly one hero blob in the object-ID buffer, and heroCount === 1.");
  }
  return row("single_hero", "PASS", { frames: frames.length, heroCount: 1, blobs: 1 }, "One hero on every captured frame.");
}

function rowIdleGallop(frames) {
  const gallop = frames.filter((f) => f.kind === "gallop");
  const idle = frames.filter((f) => f.kind === "idle");
  const g = gallop[gallop.length - 1];
  const i = idle[idle.length - 1];
  const numbers = {
    gallop: g ? { state: g.snap.state, spd: g.snap.spd } : null,
    idle: i ? { state: i.snap.state, spd: i.snap.spd } : null,
  };
  if (!g || !i) {
    return row("idle_gallop_switch", "FAIL", numbers, "The walk did not capture both a gallop step and an idle step.");
  }
  const gOk = g.snap.state === "GALLOP" && Number(g.snap.spd) >= 0.3;
  const iOk = i.snap.state === "IDLE" && Number(i.snap.spd) <= 0.05;
  const stuck = frames.filter((f) => Number(f.snap.spd) >= 0.5 && f.snap.state === "IDLE").map((f) => f.id);
  const result = gOk && iOk && !stuck.length ? "PASS" : "FAIL";
  return row(
    "idle_gallop_switch",
    result,
    { ...numbers, movingWhileIdle: stuck.slice(0, 4) },
    result === "PASS"
      ? "State is GALLOP while moving and IDLE after the stop."
      : "Gallop must follow speed, and a stop must reach IDLE. A frozen gallop at speed 0 is FAIL.",
  );
}

function rowSingleBolt(frames, rows) {
  const hero = rows.find((r) => r.id === "single_hero");
  const sw = rows.find((r) => r.id === "idle_gallop_switch");
  const result = hero?.result === "PASS" && sw?.result === "PASS" ? "PASS" : "FAIL";
  return row(
    "single_bolt",
    result,
    { single_hero: hero?.result, idle_gallop_switch: sw?.result },
    "Doc 63 single_bolt: one hero in frame, and both idle and gallop captured.",
  );
}

function ahead(frame, objectLabels) {
  const win = windowCountAny(frame.ids, objectLabels, 0.32, 0.28, 0.68, 0.62);
  const frac = win.window ? win.n / win.window : 0;
  let best = null;
  let bestN = 0;
  for (const [label, n] of Object.entries(win.by)) {
    if (n > bestN) {
      best = label;
      bestN = n;
    }
  }
  let color = { visible: false, reason: "no-label" };
  if (best && frame.rgba) color = colorVisible(frame.rgba, frame.width, frame.height, frame.ids, best);
  const covered = win.n >= 12 && frac >= 0.015 && (!frame.rgba || color.visible);
  return { frac: round(frac), pixels: win.n, label: best, color, covered };
}

function rowStops(frames, layout, objectLabels) {
  const stops = frames.filter((f) => f.kind === "stop");
  if (!stops.length) {
    return row("stops_visible", "FAIL", { stops: 0 }, "No outward stop was captured. An untested stop is not a PASS.");
  }
  const detail = stops.map((f) => {
    const vis = ahead(f, objectLabels);
    const gap = surfaceGap(layout, Number(f.snap.x) || 0, Number(f.snap.z) || 0);
    return {
      id: f.id,
      heading: round(Number(f.snap.hdg) || 0),
      dist: round(gap.dist),
      gap: round(gap.gap),
      blocked: !!f.snap.blocked,
      contact: !!f.snap.blocked || gap.gap <= 0.5,
      ...vis,
    };
  });
  const invisible = detail.filter((d) => !d.covered || !d.contact);
  const result = invisible.length ? "FAIL" : "PASS";
  return row(
    "stops_visible",
    result,
    { stops: detail.length, invisible: invisible.length, rows: detail },
    result === "PASS"
      ? "Every stop has a layout object covering the view ahead, and those pixels are not empty ground or flat black."
      : "A stop with nothing visible ahead is FAIL (invisible collider).",
    { partial: true },
  );
}

function rowCollider(frames, layout, objectLabels) {
  const stops = frames.filter((f) => f.kind === "stop");
  if (!stops.length) return row("collider_eq_visual", "FAIL", {}, "No stops to compare with the layout surfaces.");
  const detail = stops.map((f) => {
    const vis = ahead(f, objectLabels);
    const gap = surfaceGap(layout, Number(f.snap.x) || 0, Number(f.snap.z) || 0);
    const near = gap.gap <= 0.5;
    return {
      id: f.id,
      heading: round(Number(f.snap.hdg) || 0),
      dist: round(gap.dist),
      gap: round(gap.gap),
      surface: gap.which,
      near,
      visible: vis.covered,
    };
  });
  const bad = detail.filter((d) => !d.near || !d.visible);
  return row(
    "collider_eq_visual",
    bad.length ? "FAIL" : "PASS",
    { tolerance_m: 0.5, stops: detail.length, bad: bad.length, rows: detail },
    "Stop must be within 0.5 m of a layout surface AND that surface must be visible. Data distance without pixels is FAIL.",
    { partial: true },
  );
}

function seenLabel(frame, label) {
  const n = frame.counts.get(label) || 0;
  if (n < 8) return false;
  if (!frame.rgba) return true;
  return colorVisible(frame.rgba, frame.width, frame.height, frame.ids, label).visible;
}

function rowLayout(frames, layout) {
  const expected = [];
  for (const h of layout.hulls) {
    const facing = frames.filter((f) => (f.kind === "ring" || f.kind === "turn" || f.kind === "spawn") && angDist(Number(f.snap.hdg) || 0, h.heading) <= h.width / 2 + 8);
    const saw = facing.some((f) => seenLabel(f, h.id));
    expected.push({ id: h.id, kind: "edge", facing: facing.length, saw });
  }
  for (const g of layout.gates) {
    const facing = frames.filter((f) => angDist(Number(f.snap.hdg) || 0, g.heading) <= Math.max(12, g.halfDeg + 6));
    const saw = facing.some((f) => seenLabel(f, g.label) || seenLabel(f, g.id));
    expected.push({ id: g.label, kind: "gate", facing: facing.length, saw });
  }
  for (const o of layout.interiors) {
    const facing = frames.filter((f) => f.kind === "approach" && f.id.includes(o.id));
    const any = frames.filter((f) => {
      const dx = o.position[0] - (Number(f.snap.x) || 0);
      const dz = o.position[1] - (Number(f.snap.z) || 0);
      const bearing = (Math.atan2(dx, dz) * 180) / Math.PI;
      return Math.hypot(dx, dz) < 12 && angDist(Number(f.snap.hdg) || 0, bearing) < 35;
    });
    const pool = facing.length ? facing : any;
    const saw = pool.some((f) => seenLabel(f, o.id));
    expected.push({ id: o.id, kind: "interior", facing: pool.length, saw });
  }
  const missing = expected.filter((e) => !e.saw || e.facing === 0);
  return row(
    "layout_rendered",
    missing.length ? "FAIL" : "PASS",
    { objects: expected.length, missing: missing.map((m) => m.id), rows: expected },
    missing.length
      ? "An object that was in view and wrote no visible pixels is absent, even if it is in the layout file."
      : "Every layout object wrote visible pixels on a frame that faced it.",
    { partial: true },
  );
}

function rowRing(frames, layout) {
  const rays = ringRays(layout);
  const ringFrames = frames.filter((f) => f.kind === "ring" || f.kind === "turn");
  const headings = [];
  for (let deg = 0; deg < 360; deg += 10) {
    const nearest = ringFrames.reduce((best, f) => {
      const d = angDist(Number(f.snap.hdg) || 0, deg);
      if (!best || d < best.d) return { f, d };
      return best;
    }, null);
    const gate = inGateSpan(deg, layout.gates);
    let edgePixels = 0;
    let label = null;
    if (nearest && nearest.d <= 8) {
      const win = windowCountAny(nearest.f.ids, layout.hulls.map((h) => h.id), 0.36, 0.22, 0.64, 0.5);
      edgePixels = win.n;
      label = Object.entries(win.by).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    }
    const ok = gate || (nearest && nearest.d <= 8 && edgePixels >= 8);
    headings.push({ deg, gate, edgePixels, label, ok, sample: nearest ? nearest.f.id : null });
  }
  const dataOk = rays.misses.length === 0;
  const renderMiss = headings.filter((h) => !h.ok);
  const result = dataOk && renderMiss.length === 0 && ringFrames.length >= 8 ? "PASS" : "FAIL";
  return row(
    "ring_closed",
    result,
    {
      dataHits: rays.hit,
      dataMisses: rays.misses.slice(0, 12),
      dataMissCount: rays.misses.length,
      gateSkip: rays.gateSkip,
      renderHeadings: headings.length,
      renderMiss: renderMiss.length,
      renderMissDeg: renderMiss.map((h) => h.deg).slice(0, 12),
    },
    "Data rays and the 36 rendered headings both have to close. A collider ring with no pixels is FAIL. Gate span is the allowed opening.",
    { partial: ringFrames.length < 36 },
  );
}

function rowGate(frames, layout) {
  const gate = layout.gates[0];
  if (!gate) return row("gate", "FAIL", {}, "Layout has no gate.");
  const facing = frames.filter((f) => angDist(Number(f.snap.hdg) || 0, gate.heading) <= Math.max(10, gate.halfDeg + 4));
  let best = null;
  for (const f of facing) {
    const win = windowCount(f.ids, gate.label, 0.3, 0.2, 0.7, 0.62);
    const alt = windowCount(f.ids, gate.id, 0.3, 0.2, 0.7, 0.62);
    const n = Math.max(win.n, alt.n);
    const color = f.rgba ? colorVisible(f.rgba, f.width, f.height, f.ids, win.n >= alt.n ? gate.label : gate.id) : { visible: n >= 8 };
    if (!best || n > best.n) best = { id: f.id, n, color, snap: f.snap };
  }
  const end = frames.filter((f) => f.kind === "gate").pop();
  const bearing = best ? Number(best.snap.gate && best.snap.gate.bearing_deg) : null;
  const dist = best ? Number(best.snap.gate && best.snap.gate.dist_m) : null;
  const layoutDist = layout.edgeRadius;
  const distOk = Number.isFinite(dist) && Math.abs(dist - layoutDist) <= Math.max(1.5, layoutDist * 0.2);
  const bearingOk = Number.isFinite(bearing) && Math.abs(bearing) <= 12;
  const visible = !!(best && best.n >= 10 && best.color.visible);
  const trigger = !!(end && end.snap.pathTrigger);
  const result = visible && distOk && bearingOk && trigger ? "PASS" : "FAIL";
  return row(
    "gate",
    result,
    {
      id: gate.id,
      pixels: best ? best.n : 0,
      color: best ? best.color.reason || best.color.visible : "no-facing-frame",
      bearing_deg: Number.isFinite(bearing) ? round(bearing) : null,
      dist_m: Number.isFinite(dist) ? round(dist) : null,
      layoutDist: round(layoutDist),
      pathTrigger: trigger,
    },
    "The gate frame must be visible from the centre, the HUD bearing and distance must match, and walking the opening must hit the path trigger.",
  );
}

function rowNear(frames, layout) {
  const samples = [];
  let worst = Infinity;
  let worstId = null;
  let missing = 0;
  for (const f of frames) {
    const n = Number(f.snap.nearestVisibleM);
    if (!Number.isFinite(n)) {
      missing++;
      continue;
    }
    samples.push(n);
    if (n < worst) {
      worst = n;
      worstId = f.id;
    }
  }
  if (!samples.length) {
    return row("near_lens", "FAIL", { cull_m: layout.cullM }, "nearestVisibleM was not reported. That distance has to come from fragments that passed the alpha test.");
  }
  const result = worst + 1e-3 < layout.cullM || missing ? "FAIL" : "PASS";
  return row(
    "near_lens",
    result,
    { cull_m: layout.cullM, nearest_m: round(worst), at: worstId, missing, samples: samples.length },
    "Nearest non-hero fragment that passed alpha must stay outside near_lens.cull_m. Partial: the distance is the renderer’s fragment metric, cross-checked only by being present on every frame.",
    { partial: true, heuristic: true },
  );
}

function rowFog(frames, layout) {
  const dataOk = layout.fogPatches >= 20;
  let pixels = 0;
  let streak = { frac: 0, samples: 0 };
  let colored = false;
  for (const f of frames) {
    pixels += f.counts.get("fog") || 0;
    if (f.rgba && (f.counts.get("fog") || 0) > 20) {
      const s = fogStreakFrac(f.rgba, f.width, f.height, f.ids);
      if (s.samples > streak.samples) streak = s;
      if (colorVisible(f.rgba, f.width, f.height, f.ids, "fog").visible) colored = true;
    }
  }
  const hard = streak.samples >= 20 && streak.frac > 0.18;
  const rendered = pixels >= 80 && colored && !hard;
  const result = dataOk && rendered ? "PASS" : "FAIL";
  return row(
    "fog_band",
    result,
    {
      patches: layout.fogPatches,
      fogPixels: pixels,
      colored,
      streakFrac: streak.frac,
      streakSamples: streak.samples,
    },
    "Fog must be in the file (20+ patches) and in the picture. Hard streak edges are a heuristic FAIL.",
    { heuristic: true, partial: true },
  );
}

function rowBlack(frames) {
  const hits = [];
  let skyIgnored = 0;
  for (const f of frames) {
    if (!f.rgba) continue;
    const found = blackRectangles(f.rgba, f.width, f.height);
    skyIgnored += found.skyIgnored;
    for (const h of found.hits) hits.push({ id: f.id, ...h });
  }
  const measured = frames.filter((f) => f.rgba).length;
  if (!measured) return row("black_regions", "FAIL", {}, "No screenshot to scan.", { heuristic: true });
  hits.sort((a, b) => b.areaFrac - a.areaFrac);
  const result = hits.length ? "FAIL" : "PASS";
  return row(
    "black_regions",
    result,
    { hits: hits.slice(0, 6), hitCount: hits.length, skyBandsIgnored: skyIgnored, scanned: measured },
    "Large flat near-black rectangles are FAIL. A full-width night-sky band that touches the top is ignored. Heuristic.",
    { heuristic: true },
  );
}

function rowTiles(frames) {
  let worst = { periodic: false, peak: 0, lag: 0 };
  let scanned = 0;
  const flagged = [];
  for (const f of frames) {
    if (!f.rgba) continue;
    if (!["spawn", "turn", "stop", "gate"].includes(f.kind)) continue;
    scanned++;
    const stat = floorRepeat(f.rgba, f.width, f.height);
    if (stat.peak > worst.peak) worst = { ...stat, id: f.id };
    if (stat.periodic) flagged.push({ id: f.id, peak: stat.peak, lag: stat.lag, prominence: stat.prominence });
  }
  if (!scanned) return row("tile_repeat", "FAIL", {}, "No ground frame to measure.", { heuristic: true });
  const result = flagged.length ? "FAIL" : "PASS";
  return row(
    "tile_repeat",
    result,
    { scanned, worstPeak: worst.peak, worstLag: worst.lag, worstAt: worst.id, flagged: flagged.slice(0, 4) },
    "Autocorrelation on the ground band. Obvious tile or checker repetition is FAIL. A smooth gradient is not. Heuristic.",
    { heuristic: true },
  );
}

function rowBoltGrounded(frames) {
  if (!frames.length) return row("bolt_grounded", "FAIL", {}, "No frame to measure Bolt's feet.");
  const bad = [];
  let checked = 0;
  for (const f of frames) {
    if (!f.ids || !f.snap) continue;
    const box = labelBox(f.ids, "hero");
    checked++;
    const src = f.snap.boltSource || {};
    const quad = f.snap.boltQuad || {};
    const sw = Number(src.w);
    const sh = Number(src.h);
    const qw = Number(quad.w);
    const qh = Number(quad.h);
    const srcAspect = sw > 0 && sh > 0 ? sw / sh : null;
    const quadAspect = qw > 0 && qh > 0 ? qw / qh : null;
    const aspectErr = srcAspect && quadAspect ? Math.abs(quadAspect - srcAspect) / srcAspect : 1;
    const screenH = f.ids.height || f.height || 1600;
    const screenW = f.ids.width || f.width || 720;
    const onScreen = !!(box && box.minX > 1 && box.minY > 1 && box.maxX < screenW - 2 && box.maxY < screenH - 2);
    const ground = groundUnder(f.ids, box);
    const gapFrac = box && ground != null ? (ground - box.maxY) / screenH : 1;
    const feetOk = box && ground != null && gapFrac >= -0.02 && gapFrac <= 0.05;
    const insideQuad = !!(
      box &&
      Number.isFinite(Number(quad.x)) &&
      box.minX >= Number(quad.x) - 3 &&
      box.maxX <= Number(quad.x) + qw + 3 &&
      box.minY >= Number(quad.y) - 3 &&
      box.maxY <= Number(quad.y) + qh + 3
    );
    const aspectOk = aspectErr <= 0.02 && insideQuad;
    if (!onScreen || !feetOk || !aspectOk) {
      bad.push({
        id: f.id,
        onScreen,
        feetOk,
        aspectOk,
        gapFrac: round(gapFrac),
        aspectErr: round(aspectErr),
        srcAspect: srcAspect ? round(srcAspect) : null,
        quadAspect: quadAspect ? round(quadAspect) : null,
      });
    }
  }
  if (!checked) return row("bolt_grounded", "FAIL", {}, "Hero pixels were not in the ID buffer.");
  const result = bad.length ? "FAIL" : "PASS";
  return row(
    "bolt_grounded",
    result,
    { frames: checked, bad: bad.length, rows: bad.slice(0, 6) },
    result === "PASS"
      ? "Hero bbox is fully on screen, feet are within 5% of the ground, and the sprite quad matches the source aspect."
      : "Bolt must stay fully on screen, feet within 5% of ground contact, unstretched (quad aspect = source).",
  );
}

function labelBox(ids, label) {
  const idx = ids.labels.indexOf(label);
  if (idx < 0) return null;
  let minX = 1e9;
  let minY = 1e9;
  let maxX = -1;
  let maxY = -1;
  let n = 0;
  const w = ids.width;
  const h = ids.height;
  const data = ids.data;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (data[row + x] !== idx) continue;
      n++;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (!n) return null;
  return { minX, minY, maxX, maxY, n };
}

function groundUnder(ids, box) {
  if (!box) return null;
  const idx = ids.labels.indexOf("ground");
  if (idx < 0) return null;
  const x = Math.max(0, Math.min(ids.width - 1, Math.round((box.minX + box.maxX) / 2)));
  for (let y = box.maxY; y < ids.height; y++) {
    if (ids.data[y * ids.width + x] === idx) return y;
  }
  return null;
}

function rowBackdrop(frames, layout) {
  let worst = null;
  let missing = 0;
  for (const f of frames) {
    const mag = backdropMag(f.snap.backdrop);
    if (mag.mag == null) {
      missing++;
      continue;
    }
    if (!worst || mag.mag > worst.mag) worst = { ...mag, id: f.id };
  }
  if (!worst) {
    return row(
      "backdrop_res",
      "FAIL",
      { missing },
      layout.hasBackdrop
        ? "Backdrop source size was not reported, so upscale cannot be cleared."
        : "No backdrop metrics. If the layout names a ring, the renderer must report source pixels versus on-screen pixels.",
      { partial: true },
    );
  }
  const result = worst.mag > 1.001 || missing ? "FAIL" : "PASS";
  return row(
    "backdrop_res",
    result,
    { mag: worst.mag, magW: worst.magW, magH: worst.magH, slice: worst.slice, sourceW: worst.sourceW, sourceH: worst.sourceH, screenW: worst.screenW, screenH: worst.screenH, fovDeg: worst.fov, at: worst.id, missing },
    "Backdrop magnification is on-screen pixels divided by the source pixels of the visible ring slice (and by source height). Above 1.0 is an upscale, FAIL. The sizes come from the live renderer, not from a hand-written table.",
    { partial: true },
  );
}

export function glErrorName(code) {
  const table = {
    1280: "INVALID_ENUM",
    1281: "INVALID_VALUE",
    1282: "INVALID_OPERATION",
    1285: "OUT_OF_MEMORY",
    1286: "INVALID_FRAMEBUFFER_OPERATION",
    37442: "CONTEXT_LOST_WEBGL",
  };
  return table[code] || `0x${Number(code).toString(16)}`;
}
