/**
 * Phone performance numbers. No pixels.
 * The overlay displays these. playcheck judges them.
 * Thresholds are a mid-range phone at 720×1600, not a desktop GPU.
 */

export const PHONE = {
  fpsAvgMin: 30,
  fps1LowMin: 20,
  frameMsMax: 1000 / 30,
  heapBytesMax: 384 * 1024 * 1024,
  textureBytesMax: 256 * 1024 * 1024,
  videoDecodersMax: 6,
  activeVideosMax: 4,
  drawCallsMax: 150,
};

export const PERF_SCHEMA = "playcheck-perf/1";

const WINDOW = 300;

export function fpsFromIntervals(ms) {
  if (!ms.length) {
    return { fpsAvg: 0, fps1Low: 0, frameMs: 0, frameMsAvg: 0, samples: 0 };
  }
  const avg = mean(ms);
  const sorted = ms.slice().sort((a, b) => b - a);
  const n = Math.max(1, Math.ceil(sorted.length * 0.01));
  const worst = mean(sorted.slice(0, n));
  return {
    fpsAvg: 1000 / avg,
    fps1Low: 1000 / worst,
    frameMs: ms[ms.length - 1],
    frameMsAvg: avg,
    samples: ms.length,
  };
}

export function createPerfMonitor() {
  const intervals = [];
  const textures = new Map();
  const videos = new Set();
  let draws = 0;
  let scripted = false;
  let heapBytes = null;

  function pushInterval(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return;
    intervals.push(ms);
    if (intervals.length > WINDOW) intervals.shift();
  }

  return {
    noteFrame({ dtMs, workMs } = {}) {
      scripted = true;
      const dt = Number(dtMs);
      const work = Number(workMs);
      if (Number.isFinite(dt) && dt > 0) pushInterval(dt);
      else if (Number.isFinite(work) && work > 0) pushInterval(work);
    },
    notePresent(ms) {
      pushInterval(Number(ms));
    },
    noteDraw(count) {
      const n = Number(count);
      if (Number.isFinite(n) && n >= 0) draws = n;
    },
    noteTexture(id, bytes) {
      const n = Number(bytes);
      if (!id || !Number.isFinite(n) || n < 0) return;
      textures.set(String(id), n);
    },
    releaseTexture(id) {
      textures.delete(String(id));
    },
    noteVideo(id) {
      if (id) videos.add(String(id));
    },
    releaseVideo(id) {
      videos.delete(String(id));
    },
    noteHeap(bytes) {
      const n = Number(bytes);
      heapBytes = Number.isFinite(n) && n >= 0 ? n : null;
    },
    textureBytes() {
      let sum = 0;
      for (const n of textures.values()) sum += n;
      return sum;
    },
    snapshot(extra = {}) {
      const fps = fpsFromIntervals(intervals);
      const domVideos = Number(extra.domVideos) || 0;
      return {
        fpsAvg: round(fps.fpsAvg),
        fps1Low: round(fps.fps1Low),
        frameMs: round(fps.frameMs),
        frameMsAvg: round(fps.frameMsAvg),
        samples: fps.samples,
        heapBytes: heapBytes == null ? null : Math.round(heapBytes),
        textureBytes: Math.round(this.textureBytes()),
        videoDecoders: Math.max(videos.size, domVideos),
        drawCalls: draws,
        scripted,
      };
    },
  };
}

/**
 * @param {Array<{snap?: object, id?: string}>} frames
 */
export function formatPerfLine(agg) {
  const a = agg || {};
  return `Perf: drawCalls=${field(a.drawCalls)}, texMB=${megabytes(a.textureBytes)}, activeVideos=${field(a.videoDecoders)}, jsMs=${field(a.jsMs)}`;
}

export function judgePerf(frames, options = {}) {
  const softwareGl = !!options.softwareGl;
  const list = frames || [];
  const harness = list.length > 0 && list.every((f) => f.snap && f.snap.harness === true);
  const perfs = [];
  for (const f of list) {
    const p = f.snap && f.snap.perf;
    if (p && typeof p === "object") perfs.push({ step: f.id || "", ...p });
  }
  const budgetApplied = !harness;
  const aggregate = aggregatePerf(perfs);
  const report = {
    schema: PERF_SCHEMA,
    thresholds: { ...PHONE },
    budgetApplied,
    harness,
    aggregate,
    perfLine: formatPerfLine(aggregate),
    samples: perfs.map(compactSample),
  };
  const rows = [
    rowFpsAvg(aggregate, perfs, budgetApplied, softwareGl),
    rowFps1(aggregate, perfs, budgetApplied, softwareGl),
    rowFrame(aggregate, perfs, budgetApplied, softwareGl),
    rowHeap(aggregate, perfs, budgetApplied),
    rowTex(aggregate, perfs, budgetApplied),
    rowDecoders(aggregate, perfs, budgetApplied),
    rowActive(aggregate, perfs, budgetApplied),
    rowDraws(aggregate, perfs, budgetApplied),
    rowPerfLine(aggregate, perfs, budgetApplied),
  ];
  return { rows, report };
}

function aggregatePerf(perfs) {
  if (!perfs.length) {
    return {
      fpsAvg: null,
      fps1Low: null,
      frameMs: null,
      frameMsAvg: null,
      heapBytes: null,
      heapAvailable: false,
      textureBytes: null,
      videoDecoders: null,
      drawCalls: null,
      jsMs: null,
      samples: 0,
    };
  }
  const last = perfs[perfs.length - 1];
  const heaps = perfs.map((p) => p.heapBytes).filter((n) => Number.isFinite(n));
  return {
    fpsAvg: num(last.fpsAvg),
    fps1Low: num(last.fps1Low),
    frameMs: num(last.frameMs),
    frameMsAvg: num(last.frameMsAvg),
    heapBytes: heaps.length ? Math.max(...heaps) : null,
    heapAvailable: heaps.length > 0,
    textureBytes: Math.max(...perfs.map((p) => num(p.textureBytes) || 0)),
    videoDecoders: Math.max(...perfs.map((p) => num(p.videoDecoders) || 0)),
    drawCalls: Math.max(...perfs.map((p) => num(p.drawCalls) || 0)),
    jsMs: num(last.workMs) ?? num(last.jsMs) ?? num(last.frameMsAvg),
    samples: perfs.length,
  };
}

function rowFpsAvg(agg, perfs, budgetApplied, softwareGl) {
  if (softwareGl && perfs.length) return softwareRow("fps_avg", { fpsAvg: agg.fpsAvg, min: PHONE.fpsAvgMin, samples: agg.samples });
  return budgetRow(
    "fps_avg",
    perfs,
    budgetApplied,
    agg.fpsAvg != null && agg.fpsAvg + 1e-6 >= PHONE.fpsAvgMin,
    { fpsAvg: agg.fpsAvg, min: PHONE.fpsAvgMin, samples: agg.samples },
    `Average FPS is the inverse of the mean present interval over the last ${WINDOW} frames. A mid-range phone needs at least ${PHONE.fpsAvgMin}.`,
  );
}

function rowFps1(agg, perfs, budgetApplied, softwareGl) {
  if (softwareGl && perfs.length) return softwareRow("fps_1low", { fps1Low: agg.fps1Low, min: PHONE.fps1LowMin, samples: agg.samples });
  return budgetRow(
    "fps_1low",
    perfs,
    budgetApplied,
    agg.fps1Low != null && agg.fps1Low + 1e-6 >= PHONE.fps1LowMin,
    { fps1Low: agg.fps1Low, min: PHONE.fps1LowMin, samples: agg.samples },
    `1% low is the inverse of the mean of the slowest 1% of those intervals (at least one frame). A mid-range phone needs at least ${PHONE.fps1LowMin}.`,
  );
}

function rowFrame(agg, perfs, budgetApplied, softwareGl) {
  const ms = agg.frameMsAvg;
  if (softwareGl && perfs.length) return softwareRow("frame_ms", { frameMsAvg: ms, frameMs: agg.frameMs, max: round(PHONE.frameMsMax) });
  return budgetRow(
    "frame_ms",
    perfs,
    budgetApplied,
    ms != null && ms <= PHONE.frameMsMax + 1e-3,
    { frameMsAvg: ms, frameMs: agg.frameMs, max: round(PHONE.frameMsMax) },
    `Mean present-frame time must stay at or under ${round(PHONE.frameMsMax)} ms, the same 30 FPS budget.`,
  );
}

function rowHeap(agg, perfs, budgetApplied) {
  if (!perfs.length) return missingRow("js_heap", budgetApplied);
  if (!budgetApplied) return harnessRow("js_heap", { heapBytes: agg.heapBytes, max: PHONE.heapBytesMax, available: agg.heapAvailable });
  if (!agg.heapAvailable) {
    return {
      id: "js_heap",
      result: "PASS",
      numbers: { heapBytes: null, max: PHONE.heapBytesMax, available: false },
      detail:
        "performance.memory was not reported. The 384 MiB mid-range tab budget was not measured. A reported heap above that budget is FAIL.",
      heuristic: false,
      partial: true,
    };
  }
  const ok = agg.heapBytes <= PHONE.heapBytesMax;
  return {
    id: "js_heap",
    result: ok ? "PASS" : "FAIL",
    numbers: { heapBytes: agg.heapBytes, max: PHONE.heapBytesMax, available: true },
    detail: ok
      ? `JS heap ${agg.heapBytes} bytes is within the 384 MiB mid-range tab budget.`
      : `JS heap ${agg.heapBytes} bytes is above the 384 MiB mid-range tab budget.`,
    heuristic: false,
    partial: false,
  };
}

function rowTex(agg, perfs, budgetApplied) {
  return budgetRow(
    "texture_mem",
    perfs,
    budgetApplied,
    agg.textureBytes != null && agg.textureBytes <= PHONE.textureBytesMax,
    { textureBytes: agg.textureBytes, max: PHONE.textureBytesMax },
    `Estimated GPU texture memory is the sum of registered textures (width × height × bytes per pixel, one slot per id). Mid-range phone budget is 256 MiB.`,
  );
}

function rowDecoders(agg, perfs, budgetApplied) {
  return budgetRow(
    "video_decoders",
    perfs,
    budgetApplied,
    agg.videoDecoders != null && agg.videoDecoders <= PHONE.videoDecodersMax,
    { videoDecoders: agg.videoDecoders, max: PHONE.videoDecodersMax },
    `Concurrent video decoders (registered ids, or video elements with a source, whichever is larger). Mid-range phone budget is ${PHONE.videoDecodersMax}. Law 65's phone cap is the active_videos row (${PHONE.activeVideosMax}).`,
  );
}

function rowActive(agg, perfs, budgetApplied) {
  return budgetRow(
    "active_videos",
    perfs,
    budgetApplied,
    agg.videoDecoders != null && agg.videoDecoders <= PHONE.activeVideosMax,
    { activeVideos: agg.videoDecoders, max: PHONE.activeVideosMax },
    `Law 65: at most ${PHONE.activeVideosMax} videos may decode at once on a phone. Pause or unload the rest.`,
  );
}

function rowPerfLine(agg, perfs, budgetApplied) {
  const line = formatPerfLine(agg);
  const present =
    perfs.length > 0 &&
    agg.drawCalls != null &&
    agg.textureBytes != null &&
    agg.videoDecoders != null &&
    agg.jsMs != null;
  if (!perfs.length) {
    const missing = missingRow("perf_line", budgetApplied);
    missing.numbers = { ...missing.numbers, perfLine: line };
    missing.detail = `Law 65 requires this line on every playcheck report. ${line}`;
    return missing;
  }
  if (!budgetApplied) {
    const recorded = harnessRow("perf_line", { perfLine: line, drawCalls: agg.drawCalls, texMB: megabytes(agg.textureBytes), activeVideos: agg.videoDecoders, jsMs: agg.jsMs });
    return recorded;
  }
  return {
    id: "perf_line",
    result: present ? "PASS" : "FAIL",
    numbers: {
      perfLine: line,
      drawCalls: agg.drawCalls,
      texMB: megabytes(agg.textureBytes),
      activeVideos: agg.videoDecoders,
      jsMs: agg.jsMs,
    },
    detail: present
      ? `${line} Law 65. SwiftShader frame time is informational and is not this row.`
      : `${line} One of drawCalls, texMB, activeVideos, jsMs was not reported.`,
    heuristic: false,
    partial: false,
  };
}

function softwareRow(id, numbers) {
  return {
    id,
    result: "PASS",
    numbers: { ...numbers, softwareGl: true, informational: true },
    detail:
      "SwiftShader (software rendering, no GPU). This frame time is informational and is not a pass or a fail. Law 65.",
    heuristic: false,
    partial: true,
  };
}

function rowDraws(agg, perfs, budgetApplied) {
  return budgetRow(
    "draw_calls",
    perfs,
    budgetApplied,
    agg.drawCalls != null && agg.drawCalls <= PHONE.drawCallsMax,
    { drawCalls: agg.drawCalls, max: PHONE.drawCallsMax },
    `Peak draw calls in a presented frame. Mid-range phone budget is ${PHONE.drawCallsMax}. Instanced fog is one draw.`,
  );
}

function budgetRow(id, perfs, budgetApplied, ok, numbers, detail) {
  if (!perfs.length) return missingRow(id, budgetApplied);
  if (!budgetApplied) return harnessRow(id, numbers);
  return {
    id,
    result: ok ? "PASS" : "FAIL",
    numbers,
    detail: ok ? `${detail} Within budget.` : `${detail} Outside the budget.`,
    heuristic: false,
    partial: false,
  };
}

function missingRow(id, budgetApplied) {
  if (!budgetApplied) {
    return harnessRow(id, { samples: 0 });
  }
  return {
    id,
    result: "FAIL",
    numbers: { samples: 0 },
    detail: "snapshot().perf was not reported. Unmeasured is not a PASS.",
    heuristic: false,
    partial: false,
  };
}

function harnessRow(id, numbers) {
  return {
    id,
    result: "PASS",
    numbers: { ...numbers, budgetApplied: false },
    detail:
      "Measurement fixture (snap.harness). Numbers are recorded for reportview. The mid-range phone budget is not applied, so this harness does not change the existing playcheck exit code.",
    heuristic: false,
    partial: true,
  };
}

function compactSample(p) {
  return {
    step: p.step,
    fpsAvg: num(p.fpsAvg),
    fps1Low: num(p.fps1Low),
    frameMs: num(p.frameMs),
    frameMsAvg: num(p.frameMsAvg),
    heapBytes: Number.isFinite(Number(p.heapBytes)) ? Number(p.heapBytes) : null,
    textureBytes: num(p.textureBytes),
    videoDecoders: num(p.videoDecoders),
    drawCalls: num(p.drawCalls),
    scripted: !!p.scripted,
  };
}

function mean(xs) {
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function round(n) {
  if (!Number.isFinite(n)) return n;
  return Math.round(n * 1000) / 1000;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function field(v) {
  return v == null ? "missing" : String(v);
}

function megabytes(bytes) {
  if (bytes == null) return "missing";
  return (Number(bytes) / (1024 * 1024)).toFixed(3);
}
