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
  const perf = judgePerf(frames);
  for (const perfRow of perf.rows) rows.push(perfRow);

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
