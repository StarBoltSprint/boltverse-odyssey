/**
 * Toggleable phone performance overlay.
 * Visible only when the URL has ?perf=1. Off by default.
 * Transparent, pointer-events none, pinned to the top-right so it does not cover
 * bottom controls (stick, map). It does not draw, shade, or colour a world pixel.
 *
 * Thresholds match tools/perf/stats.mjs PHONE:
 *   fps avg >= 30, 1% low >= 20, frame <= 33.333 ms,
 *   JS heap <= 384 MiB, textures <= 256 MiB,
 *   video decoders <= 6, draw calls <= 150.
 */
(function () {
  if (typeof window === "undefined") return;
  const WINDOW = 300;
  const intervals = [];
  const textures = new Map();
  const videos = new Set();
  let draws = 0;
  let scripted = false;
  let heapBytes = null;

  function mean(xs) {
    let s = 0;
    for (const x of xs) s += x;
    return s / xs.length;
  }

  function pushInterval(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return;
    intervals.push(ms);
    if (intervals.length > WINDOW) intervals.shift();
  }

  function fpsNow() {
    if (!intervals.length) return { fpsAvg: 0, fps1Low: 0, frameMs: 0, frameMsAvg: 0, samples: 0 };
    const avg = mean(intervals);
    const sorted = intervals.slice().sort((a, b) => b - a);
    const n = Math.max(1, Math.ceil(sorted.length * 0.01));
    const worst = mean(sorted.slice(0, n));
    return {
      fpsAvg: 1000 / avg,
      fps1Low: 1000 / worst,
      frameMs: intervals[intervals.length - 1],
      frameMsAvg: avg,
      samples: intervals.length,
    };
  }

  function domVideos() {
    if (typeof document === "undefined") return 0;
    const nodes = document.querySelectorAll("video");
    let n = 0;
    for (const v of nodes) {
      if (v.currentSrc || v.src) n += 1;
    }
    return n;
  }

  function readHeap() {
    const mem = performance && performance.memory;
    if (mem && Number.isFinite(mem.usedJSHeapSize)) heapBytes = mem.usedJSHeapSize;
  }

  function round(n) {
    return Math.round(n * 1000) / 1000;
  }

  function snapshot() {
    readHeap();
    const fps = fpsNow();
    let tex = 0;
    for (const n of textures.values()) tex += n;
    return {
      fpsAvg: round(fps.fpsAvg),
      fps1Low: round(fps.fps1Low),
      frameMs: round(fps.frameMs),
      frameMsAvg: round(fps.frameMsAvg),
      samples: fps.samples,
      heapBytes: heapBytes == null ? null : Math.round(heapBytes),
      textureBytes: Math.round(tex),
      videoDecoders: Math.max(videos.size, domVideos()),
      drawCalls: draws,
      scripted,
    };
  }

  function fmtBytes(n) {
    if (n == null) return "n/a";
    if (n >= 1048576) return (n / 1048576).toFixed(1) + " MiB";
    if (n >= 1024) return (n / 1024).toFixed(1) + " KiB";
    return n + " B";
  }

  const api = {
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
    snapshot,
  };

  window.__perf = api;

  const params = new URLSearchParams(window.location.search);
  if (params.get("perf") !== "1") return;

  function mount() {
    if (!document.body) return;
    const el = document.createElement("div");
    el.id = "perf-overlay";
    el.setAttribute("data-perf", "1");
    el.style.cssText = [
      "position:fixed",
      "top:8px",
      "right:8px",
      "z-index:4",
      "max-height:22vh",
      "overflow:hidden",
      "pointer-events:none",
      "background:transparent",
      "color:#e8f6f2",
      "font:11px/1.3 ui-monospace,monospace",
      "text-shadow:0 1px 2px #000",
      "white-space:pre",
    ].join(";");
    document.body.appendChild(el);
    (function paint() {
      const s = snapshot();
      el.textContent =
        "fps " + s.fpsAvg.toFixed(1) + "   1% " + s.fps1Low.toFixed(1) + "\n" +
        "frame " + s.frameMs.toFixed(1) + " ms\n" +
        "heap " + fmtBytes(s.heapBytes) + "\n" +
        "tex " + fmtBytes(s.textureBytes) + "\n" +
        "decoders " + s.videoDecoders + "\n" +
        "draws " + s.drawCalls;
      requestAnimationFrame(paint);
    })();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
