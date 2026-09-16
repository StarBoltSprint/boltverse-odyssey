/**
 * LanePlayer — r19wide B-stack compositor.
 * Recipe only. Do not publish a new grok.me from this file.
 *
 * VER = r19wide (road empty-plate + Bolt luma cutout).
 * Kitchen Live stack: /master/road.mp4?v=r19wide + /master/bolt.mp4?v=r19wide
 *
 * Locks (biome/PLAY.md):
 *  - road empty-plate + bolt cutout
 *  - seek-sync (road is master clock)
 *  - loop forever + watchdog
 *  - no wallet / keys
 *  - swipe = découpe plant, not 3-take L/M/R
 */
import { useEffect, useRef, useState } from "react";

export const VER = "r19wide";

const ROAD_SRC = `/master/road.mp4?v=${VER}`;
const BOLT_SRC = `/master/bolt.mp4?v=${VER}`;
const ROAD_POSTER = "/master/road.jpg";

const SWIPE_PX = 12;
const SLIDE_MS = 260;
const PLANT_PCT = 44;
const SEEK_SLOP = 0.08;
const SYNC_MS = 400;
const HINT_MS = 5200;
const SHOW_HINT = true;

function clampLane(n: number) {
  if (n < -1) return -1;
  if (n > 1) return 1;
  return n;
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function armVideo(el: HTMLVideoElement) {
  el.muted = true;
  el.defaultMuted = true;
  el.loop = true;
  el.playsInline = true;
  el.autoplay = true;
  el.setAttribute("playsinline", "");
  el.setAttribute("webkit-playsinline", "");
  el.setAttribute("muted", "");
  el.setAttribute("loop", "");
}

function keepPlaying(el: HTMLVideoElement | null) {
  if (!el) return;
  armVideo(el);
  if (el.ended) {
    try {
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
  }
  if (el.paused || el.ended) el.play().catch(() => {});
}

type PointerMark = { x: number; y: number; t: number; used: boolean };

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getX: () => number;
      setKeys: (keys: string[]) => void;
    };
  }
}

export function LanePlayer() {
  const roadRef = useRef<HTMLVideoElement>(null);
  const boltRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef<HTMLDivElement>(null);
  const laneRef = useRef(0);
  const xRef = useRef(0);
  const rafRef = useRef(0);
  const markRef = useRef<PointerMark | null>(null);
  const nudgeRef = useRef<(dir: number) => void>(() => {});
  const [lane, setLane] = useState(0);
  const [hint, setHint] = useState(SHOW_HINT);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }, []);

  const plantX = (pct: number) => {
    xRef.current = pct;
    const wrap = wrapRef.current;
    if (wrap) wrap.style.transform = `translate3d(${pct}%,0,0)`;
  };

  const kickPlay = () => {
    keepPlaying(roadRef.current);
    keepPlaying(boltRef.current);
  };

  const seekSync = () => {
    const road = roadRef.current;
    const bolt = boltRef.current;
    keepPlaying(road);
    keepPlaying(bolt);
    if (!road || !bolt || road.readyState < 2 || bolt.readyState < 2) return;
    const clock = road.currentTime;
    if (!Number.isFinite(clock)) return;
    const dur = bolt.duration;
    const target = Number.isFinite(dur) && dur > 0 ? clock % dur : clock;
    const now = bolt.currentTime;
    if (Number.isFinite(now) && Math.abs(now - target) > SEEK_SLOP) {
      try {
        bolt.currentTime = target;
      } catch {
        /* ignore */
      }
    }
  };

  const restartLoop = () => {
    const road = roadRef.current;
    const bolt = boltRef.current;
    if (road) {
      armVideo(road);
      try {
        road.currentTime = 0;
      } catch {
        /* ignore */
      }
      road.play().catch(() => {});
    }
    if (bolt) {
      armVideo(bolt);
      try {
        bolt.currentTime = 0;
      } catch {
        /* ignore */
      }
      bolt.play().catch(() => {});
    }
  };

  const slideTo = (dest: number, ms: number, wobble: number) => {
    if (reducedRef.current) {
      plantX(dest);
      return;
    }
    cancelAnimationFrame(rafRef.current);
    const from = xRef.current;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      const eased = easeOutCubic(t);
      const wave = Math.sin(Math.PI * t) * wobble;
      plantX(from + (dest - from) * eased + wave);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  nudgeRef.current = (dir: number) => {
    const next = clampLane(laneRef.current + dir);
    kickPlay();
    seekSync();
    setHint(false);
    if (next === laneRef.current) {
      slideTo(next * PLANT_PCT, 160, dir * 5.5);
      return;
    }
    laneRef.current = next;
    setLane(next);
    slideTo(next * PLANT_PCT, SLIDE_MS, dir * 5);
  };

  const swipeFrom = (x: number, y: number) => {
    const mark = markRef.current;
    if (!mark || mark.used) return;
    const dx = x - mark.x;
    const dy = y - mark.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dy) > Math.abs(dx) * 2.2) return;
    mark.used = true;
    nudgeRef.current(dx < 0 ? -1 : 1);
  };

  const tapSides = (x: number) => {
    const mark = markRef.current;
    if (!mark || mark.used) return;
    mark.used = true;
    const w = window.innerWidth || 1;
    if (x < w * 0.38) nudgeRef.current(-1);
    else if (x > w * 0.62) nudgeRef.current(1);
  };

  useEffect(() => {
    fetch(ROAD_SRC, { credentials: "same-origin" }).catch(() => {});
    fetch(BOLT_SRC, { credentials: "same-origin" }).catch(() => {});
    const road = roadRef.current;
    const bolt = boltRef.current;
    const touch = touchRef.current;
    if (road) armVideo(road);
    if (bolt) armVideo(bolt);
    kickPlay();
    seekSync();

    const begin = (x: number, y: number) => {
      markRef.current = { x, y, t: performance.now(), used: false };
      kickPlay();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === "KeyA" || e.code === "ArrowLeft") {
        e.preventDefault();
        nudgeRef.current(-1);
      } else if (e.code === "KeyD" || e.code === "ArrowRight") {
        e.preventDefault();
        nudgeRef.current(1);
      }
    };

    const onVis = () => {
      if (document.visibilityState === "visible") {
        kickPlay();
        seekSync();
      }
    };

    const onEnded = () => {
      restartLoop();
    };

    const onTouchStart = (e: TouchEvent) => {
      const t = e.changedTouches[0] || e.touches[0];
      if (t) begin(t.clientX, t.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) {
        swipeFrom(t.clientX, t.clientY);
        if (markRef.current?.used) e.preventDefault();
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (t) {
        swipeFrom(t.clientX, t.clientY);
        tapSides(t.clientX);
      }
      markRef.current = null;
    };
    const onPointerDown = (e: PointerEvent) => begin(e.clientX, e.clientY);
    const onPointerMove = (e: PointerEvent) => swipeFrom(e.clientX, e.clientY);
    const onPointerUp = (e: PointerEvent) => {
      swipeFrom(e.clientX, e.clientY);
      tapSides(e.clientX);
      markRef.current = null;
    };

    const opts: AddEventListenerOptions = { passive: false, capture: true };
    const host = touch ?? document;
    host.addEventListener("touchstart", onTouchStart, opts);
    host.addEventListener("touchmove", onTouchMove, opts);
    host.addEventListener("touchend", onTouchEnd, opts);
    host.addEventListener("touchcancel", onTouchEnd, opts);
    window.addEventListener("pointerdown", onPointerDown, opts);
    window.addEventListener("pointermove", onPointerMove, opts);
    window.addEventListener("pointerup", onPointerUp, opts);
    window.addEventListener("pointercancel", onPointerUp, opts);
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVis);
    road?.addEventListener("ended", onEnded);
    bolt?.addEventListener("ended", onEnded);

    window.__controlsTest = {
      getYaw: () => -laneRef.current * 0.35,
      getSpeed: () => 1,
      getX: () => laneRef.current,
      setKeys: (keys) => {
        const set = new Set(keys);
        if (set.has("KeyA") || set.has("ArrowLeft")) nudgeRef.current(-1);
        if (set.has("KeyD") || set.has("ArrowRight")) nudgeRef.current(1);
      },
    };

    const hintTimer = window.setTimeout(() => setHint(false), HINT_MS);
    const syncTimer = window.setInterval(() => {
      seekSync();
    }, SYNC_MS);

    return () => {
      host.removeEventListener("touchstart", onTouchStart, opts);
      host.removeEventListener("touchmove", onTouchMove, opts);
      host.removeEventListener("touchend", onTouchEnd, opts);
      host.removeEventListener("touchcancel", onTouchEnd, opts);
      window.removeEventListener("pointerdown", onPointerDown, opts);
      window.removeEventListener("pointermove", onPointerMove, opts);
      window.removeEventListener("pointerup", onPointerUp, opts);
      window.removeEventListener("pointercancel", onPointerUp, opts);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
      road?.removeEventListener("ended", onEnded);
      bolt?.removeEventListener("ended", onEnded);
      if (hintTimer) window.clearTimeout(hintTimer);
      window.clearInterval(syncTimer);
      cancelAnimationFrame(rafRef.current);
      delete window.__controlsTest;
    };
  }, []);

  return (
    <div
      className="master-player lane-player"
      role="application"
      aria-label="BOLT lane run. Swipe or tap sides to change lanes."
    >
      <svg width="0" height="0" aria-hidden="true" className="lane-svg-defs">
        <filter id="bolt-luma" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  1 -2 1 0 1"
            result="a"
          />
          <feComponentTransfer in="a" result="hard">
            <feFuncA type="table" tableValues="0 0 0 0.2 0.85 1 1 1 1 1" />
          </feComponentTransfer>
          <feComposite in="SourceGraphic" in2="hard" operator="in" />
        </filter>
      </svg>
      <div className="lane-stage">
        <video
          ref={roadRef}
          className="is-live road-vid"
          src={ROAD_SRC}
          poster={ROAD_POSTER}
          muted
          loop
          playsInline
          preload="auto"
          autoPlay
        />
        <div ref={wrapRef} className="bolt-wrap">
          <video
            ref={boltRef}
            className="bolt-vid is-luma"
            src={BOLT_SRC}
            muted
            loop
            playsInline
            preload="auto"
            autoPlay
          />
        </div>
      </div>
      <div ref={touchRef} className="lane-touch" />
      <div className="lane-pips" aria-hidden="true">
        {[-1, 0, 1].map((n) => (
          <span key={n} className={lane === n ? "is-on" : undefined} />
        ))}
      </div>
      {hint ? <p className="lane-hint">swipe or tap sides</p> : null}
    </div>
  );
}

export default function LaneRoute() {
  return <LanePlayer />;
}
