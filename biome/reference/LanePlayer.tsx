/**
 * LanePlayer — r38 B-stack compositor.
 * Dual road hold. Canvas chroma (Vlahos) + crown sat kill. Pure X plant.
 */
import { useEffect, useRef, useState } from "react";

type LaneI = -1 | 0 | 1;

export type ControlsProbe = {
  getYaw: () => number;
  getSpeed: () => number;
  getX: () => number;
  setKeys: (codes: string[]) => void;
};

declare global {
  interface Window {
    __controlsTest?: ControlsProbe;
  }
}

const VER = "r38lock";
/**
 * HARD LOCK Sprint dealer playlist. Never shuffle. Never random at boot.
 * Story: canyon → cars/spectacle → duel → night → war.
 * After war3 wrap to canyon (same order). Lane mix may vary WITHIN a plate.
 * Law: biome/docs/11-plate-order.md
 */
const PLATES = [
  `/master/road.mp4?v=${VER}`, // canyon empty
  `/master/road-bar.mp4?v=${VER}`, // canyon jersey
  `/master/road-blast.mp4?v=${VER}`, // canyon meteor
  `/master/road-car.mp4?v=${VER}`, // cars
  `/master/road-gap.mp4?v=${VER}`, // cars
  `/master/road-show.mp4?v=${VER}`, // spectacle
  `/master/road-duel.mp4?v=${VER}`, // duel
  `/master/road-gate.mp4?v=${VER}`, // dusk → night
  `/master/road-night.mp4?v=${VER}`, // night
  `/master/road-war1.mp4?v=${VER}`, // war
  `/master/road-war2.mp4?v=${VER}`,
  `/master/road-war3.mp4?v=${VER}`,
];
const ROAD_SRC = PLATES[0]!;
const BOLT_MP4 = `/master/bolt.mp4?v=${VER}`;
const ROAD_POSTER = `/master/road.jpg?v=${VER}`;

const SWIPE_PX = 12;
const MOVE_MS = 220;
const SHIFT = 42;
const JUMP_MS = 520;
const JUMP_PEAK = 0.2;
const WATCHDOG_MS = 400;
const SHOW_HINT = true;
const BOLT_SCALE = [1, 1, 1, 0.97, 0.96, 0.9, 0.92, 0.9, 0.9, 0.9, 0.9, 0.9];

type Hazard = {
  lanes: readonly LaneI[];
  jumpClears: boolean;
  t0: number;
  t1: number;
  tPass: number;
};

const HAZARDS: (Hazard | null)[] = [
  null,
  { lanes: [0], jumpClears: true, t0: 0.4, t1: 0.56, tPass: 0.52 },
  { lanes: [0], jumpClears: true, t0: 0.78, t1: 0.93, tPass: 0.88 },
  { lanes: [-1, 0], jumpClears: true, t0: 0.74, t1: 0.88, tPass: 0.84 },
  { lanes: [-1, 1], jumpClears: true, t0: 0.62, t1: 0.8, tPass: 0.76 },
  { lanes: [-1, 1], jumpClears: true, t0: 0.56, t1: 0.82, tPass: 0.78 },
  { lanes: [-1, 0], jumpClears: true, t0: 0.76, t1: 0.92, tPass: 0.86 },
  null,
  { lanes: [-1, 1], jumpClears: true, t0: 0.56, t1: 0.84, tPass: 0.8 },
  null,
  null,
  { lanes: [-1], jumpClears: true, t0: 0.62, t1: 0.82, tPass: 0.76 },
];

function visualLane(x: number): LaneI {
  return clampLane(Math.round(x / SHIFT));
}

/** Next file in the locked playlist. No random. No occupancy shuffle. */
function nextPlate(cur: number): number {
  return (cur + 1) % PLATES.length;
}

function isAirborne(jumpAt: number, now: number) {
  if (!jumpAt) return false;
  const t = now - jumpAt;
  return t >= 0 && t < JUMP_MS * 0.82;
}

function clampLane(n: number): LaneI {
  if (n < -1) return -1;
  if (n > 1) return 1;
  return n as LaneI;
}

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function arm(v: HTMLVideoElement) {
  v.muted = true;
  v.defaultMuted = true;
  v.loop = false;
  v.playsInline = true;
  v.autoplay = false;
  v.controls = false;
  v.disablePictureInPicture = true;
  v.removeAttribute("controls");
  v.removeAttribute("loop");
  v.setAttribute("playsinline", "");
  v.setAttribute("webkit-playsinline", "");
  v.setAttribute("muted", "");
  v.setAttribute("controlslist", "nodownload nofullscreen noremoteplayback");
  v.setAttribute("disablepictureinpicture", "");
}

function platePath(src: string) {
  return src.split("?")[0] || src;
}

function srcIs(v: HTMLVideoElement, plate: string) {
  const p = platePath(plate);
  const cur = v.currentSrc || "";
  const raw = v.getAttribute("src") || v.src || "";
  return cur.includes(p) || raw.includes(p);
}

function armNext(v: HTMLVideoElement, plate: string) {
  if (!srcIs(v, plate)) {
    v.preload = "auto";
    v.src = plate;
  }
  v.pause();
  try {
    if (v.readyState >= 1 && v.currentTime > 0.05) v.currentTime = 0;
  } catch {
    /* ignore */
  }
}

function hardPlay(v: HTMLVideoElement | null) {
  if (!v) return;
  arm(v);
  if (v.ended) {
    try {
      v.currentTime = 0.001;
    } catch {
      /* seek can throw mid-teardown */
    }
  }
  if (v.paused || v.ended) {
    void v.play().catch(() => {});
  }
}

function grab(src: HTMLVideoElement, hold: HTMLCanvasElement): boolean {
  if (src.readyState < 2 || src.seeking || src.videoWidth < 2) return false;
  const vw = src.videoWidth;
  const vh = src.videoHeight;
  if (hold.width !== vw || hold.height !== vh) {
    hold.width = vw;
    hold.height = vh;
  }
  const ctx = hold.getContext("2d");
  if (!ctx) return false;
  try {
    ctx.drawImage(src, 0, 0, vw, vh);
    return true;
  } catch {
    return false;
  }
}

/** Drop the green packaging. Soft edge. No yellow wash on the fur. */
function keyGreen(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const m = r > b ? r : b;
    const greenness = g - m;
    if (greenness > 16 && g > 40) {
      data[i + 3] = 0;
    } else if (greenness > 4 && g > 30) {
      const t = (greenness - 4) / 12;
      data[i + 3] = Math.max(0, Math.min(255, data[i + 3]! * (1 - t)));
      data[i + 1] = g + (m - g) * t;
    } else if (g > m) {
      data[i + 1] = m;
    }
  }
}

/** 1px alpha falloff so the cutout isn't a sticker. */
function featherAlpha(data: Uint8ClampedArray, w: number, h: number) {
  const a = new Uint8Array(w * h);
  for (let p = 0, i = 3; p < a.length; p++, i += 4) a[p] = data[i]!;
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const p = row + x;
      const v = a[p]!;
      if (v < 16) continue;
      let n = 0;
      if (a[p - 1]! < 16) n++;
      if (a[p + 1]! < 16) n++;
      if (a[p - w]! < 16) n++;
      if (a[p + w]! < 16) n++;
      if (n) data[p * 4 + 3] = (v * (4 - n)) / 4;
    }
  }
}

/** Gold pipe sits ~80px on the skull (sat ~0.55). Fur is ~0.28. Never slice. */
function killCrown(data: Uint8ClampedArray, w: number, h: number) {
  let yTop = h;
  const yMax = (h * 0.75) | 0;
  for (let y = 0; y < yMax && yTop === h; y += 2) {
    const base = y * w * 4;
    for (let x = 0; x < w; x += 2) {
      if (data[base + x * 4 + 3]! > 40) {
        yTop = y;
        break;
      }
    }
  }
  if (yTop >= h) return;
  const end = yTop + 100 < h ? yTop + 100 : h;
  for (let y = yTop; y < end; y++) {
    const base = y * w * 4;
    for (let x = 0; x < w; x++) {
      const i = base + x * 4;
      if (data[i + 3]! < 40) continue;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const mx = r > g ? r : g;
      const v = mx > b ? mx : b;
      const mn = r < g ? (r < b ? r : b) : g < b ? g : b;
      const sat = v === 0 ? 0 : (v - mn) / v;
      if (sat > 0.44 && r > b + 16 && r >= g) data[i + 3] = 0;
    }
  }
}

/** Body centroid + paw span. Stride 2 — shape only. */
function scanBlob(data: Uint8ClampedArray, w: number, h: number) {
  let sx = 0;
  let sy = 0;
  let n = 0;
  let x0 = w;
  let x1 = 0;
  let y0 = h;
  let y1 = 0;
  for (let y = 0; y < h; y += 2) {
    const base = y * w * 4;
    for (let x = 0; x < w; x += 2) {
      if (data[base + x * 4 + 3]! > 40) {
        sx += x;
        sy += y;
        n++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (n < 40) {
    return { y: (h * 0.86) | 0, x0: (w * 0.4) | 0, x1: (w * 0.6) | 0, cx: w * 0.5, cy: h * 0.7 };
  }
  let px0 = w;
  let px1 = 0;
  const pawTop = Math.max(y0, y1 - ((h * 0.07) | 0));
  for (let y = pawTop; y <= y1; y += 2) {
    const base = y * w * 4;
    for (let x = x0; x <= x1; x += 2) {
      if (data[base + x * 4 + 3]! > 40) {
        if (x < px0) px0 = x;
        if (x > px1) px1 = x;
      }
    }
  }
  if (px1 <= px0) {
    px0 = x0;
    px1 = x1;
  }
  return { y: y1, x0: px0, x1: px1, cx: sx / n, cy: sy / n };
}

function bootImage(src: string) {
  const im = new Image();
  im.decoding = "async";
  im.src = src;
  return im;
}

export function LanePlayer() {
  const roadARef = useRef<HTMLVideoElement>(null);
  const roadBRef = useRef<HTMLVideoElement>(null);
  const boltRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roadHoldRef = useRef<HTMLCanvasElement | null>(null);
  const boltHoldRef = useRef<HTMLCanvasElement | null>(null);
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const pawsRef = useRef({ y: 1089, x0: 310, x1: 418, cx: 364, cy: 907 });
  const roadIdx = useRef(0);
  const plateRef = useRef(0);
  const pendingPlate = useRef(-1);
  const armedFrom = useRef(-1);
  const roadPrimed = useRef(false);
  const haveRoad = useRef(false);
  const haveBolt = useRef(false);
  const boltFrame = useRef(-1);
  const posterRef = useRef<HTMLImageElement | null>(null);
  const [booted, setBooted] = useState(false);
  const touchRef = useRef<HTMLDivElement>(null);
  const laneRef = useRef<LaneI>(0);
  const xRef = useRef(0);
  const moveRaf = useRef(0);
  const drawRaf = useRef(0);
  const ptr = useRef<{ x: number; y: number; t: number; used: boolean } | null>(null);
  const goRef = useRef<(dir: -1 | 1) => void>(() => {});
  const jumpRef = useRef<() => void>(() => {});
  const jumpAt = useRef(0);
  const trauma = useRef(0);
  const hitFlash = useRef(0);
  const blocked = useRef(false);
  const passed = useRef(false);
  const hitPlate = useRef(-1);
  const scaleRef = useRef(1);
  const [lane, setLane] = useState<LaneI>(0);
  const [hint, setHint] = useState(SHOW_HINT);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }, []);

  const applyX = (x: number) => {
    xRef.current = x;
  };

  const activeRoad = () => (roadIdx.current === 0 ? roadARef.current : roadBRef.current);

  const playPair = () => {
    if (blocked.current) return;
    hardPlay(activeRoad());
    hardPlay(boltRef.current);
  };

  const setBlocked = (on: boolean) => {
    if (blocked.current === on) return;
    blocked.current = on;
    const a = activeRoad();
    const bolt = boltRef.current;
    if (on) {
      a?.pause();
      bolt?.pause();
      hitFlash.current = performance.now();
      if (!reduced.current) trauma.current = 1;
      return;
    }
    if (a) {
      a.playbackRate = 1;
      hardPlay(a);
    }
    if (bolt) {
      bolt.playbackRate = 1;
      hardPlay(bolt);
    }
  };

  const tween = (toX: number, ms: number) => {
    if (reduced.current) {
      applyX(toX);
      return;
    }
    cancelAnimationFrame(moveRaf.current);
    const fromX = xRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const u = Math.min(1, (now - start) / ms);
      applyX(fromX + (toX - fromX) * easeOut(u));
      if (u < 1) moveRaf.current = requestAnimationFrame(tick);
    };
    moveRaf.current = requestAnimationFrame(tick);
  };

  const go = (dir: -1 | 1) => {
    const next = clampLane(laneRef.current + dir);
    playPair();
    setHint(false);
    if (next === laneRef.current) {
      tween(next * SHIFT, 120);
      return;
    }
    laneRef.current = next;
    setLane(next);
    tween(next * SHIFT, MOVE_MS);
  };
  goRef.current = go;

  const jump = () => {
    playPair();
    setHint(false);
    const now = performance.now();
    if (jumpAt.current && now - jumpAt.current < JUMP_MS) return;
    jumpAt.current = now;
  };
  jumpRef.current = jump;

  const readSwipe = (x: number, y: number) => {
    const p = ptr.current;
    if (!p || p.used) return;
    const dx = x - p.x;
    const dy = y - p.y;
    if (Math.abs(dx) < SWIPE_PX && Math.abs(dy) < SWIPE_PX) return;
    if (Math.abs(dy) >= Math.abs(dx) && dy < -SWIPE_PX) {
      p.used = true;
      jumpRef.current();
      return;
    }
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dy) > Math.abs(dx) * 2.2) return;
    p.used = true;
    goRef.current(dx < 0 ? -1 : 1);
  };

  const finishTap = (x: number) => {
    const p = ptr.current;
    if (!p || p.used) return;
    p.used = true;
    const w = window.innerWidth || 1;
    if (x < w * 0.38) goRef.current(-1);
    else if (x > w * 0.62) goRef.current(1);
  };

  useEffect(() => {
    posterRef.current = bootImage(ROAD_POSTER);
    const mark = () => setBooted(true);
    posterRef.current.decode?.().then(mark).catch(mark);
    posterRef.current.onload = mark;

    const roadA = roadARef.current;
    const roadB = roadBRef.current;
    const bolt = boltRef.current;
    const canvas = canvasRef.current;
    const touch = touchRef.current;
    if (roadA) arm(roadA);
    if (roadB) {
      arm(roadB);
      roadB.preload = "none";
      roadB.pause();
      try {
        roadB.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    if (bolt) arm(bolt);
    playPair();

    const paint = () => {
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx || !bolt) {
        drawRaf.current = requestAnimationFrame(paint);
        return;
      }

      const a = roadIdx.current === 0 ? roadA : roadB;
      const b = roadIdx.current === 0 ? roadB : roadA;
      if (a && b) {
        if (armedFrom.current !== plateRef.current || pendingPlate.current < 0) {
          pendingPlate.current = nextPlate(plateRef.current);
          armedFrom.current = plateRef.current;
        }
        const next = pendingPlate.current;
        const nextSrc = PLATES[next]!;
        if (!srcIs(b, nextSrc)) {
          armNext(b, nextSrc);
          roadPrimed.current = false;
        }
        const d = a.duration;
        if (d && isFinite(d) && d > 0.4) {
          const tail = a.currentTime >= d - 0.28;
          const nextReady =
            srcIs(b, nextSrc) &&
            b.readyState >= 2 &&
            !b.seeking &&
            b.videoWidth > 2;
          if (tail && nextReady) {
            if (b.currentTime >= 0.12) {
              try {
                b.currentTime = 0.001;
              } catch {
                /* ignore */
              }
            }
            roadIdx.current = 1 - roadIdx.current;
            plateRef.current = next;
            roadPrimed.current = false;
            a.pause();
            try {
              a.currentTime = 0;
            } catch {
              /* ignore */
            }
            hardPlay(b);
          } else if (tail && !nextReady && a.currentTime >= d - 0.02) {
            try {
              a.currentTime = Math.max(0.001, d - 0.4);
            } catch {
              /* ignore */
            }
          }
        }
      }

      const road = roadIdx.current === 0 ? roadA : roadB;
      const vw = (road && road.videoWidth) || 720;
      const vh = (road && road.videoHeight) || 1280;
      if (vw > 2 && vh > 2 && (canvas.width !== vw || canvas.height !== vh)) {
        canvas.width = vw;
        canvas.height = vh;
      }

      if (!roadHoldRef.current) roadHoldRef.current = document.createElement("canvas");
      if (!boltHoldRef.current) boltHoldRef.current = document.createElement("canvas");
      if (!offRef.current) offRef.current = document.createElement("canvas");
      const roadHold = roadHoldRef.current;
      const boltHold = boltHoldRef.current;
      const off = offRef.current;

      if (road && grab(road, roadHold)) haveRoad.current = true;

      if (bolt.readyState >= 2 && !bolt.seeking && bolt.videoWidth > 2) {
        const frame = (bolt.currentTime * 24 + 0.02) | 0;
        const needKey = frame !== boltFrame.current || !haveBolt.current;
        if (needKey) {
          boltFrame.current = frame;
          if (off.width !== vw || off.height !== vh) {
            off.width = vw;
            off.height = vh;
          }
          const offCtx = off.getContext("2d", { willReadFrequently: true });
          if (offCtx) {
            offCtx.drawImage(bolt, 0, 0, vw, vh);
            const img = offCtx.getImageData(0, 0, vw, vh);
            keyGreen(img.data);
            killCrown(img.data, vw, vh);
            featherAlpha(img.data, vw, vh);
            pawsRef.current = scanBlob(img.data, vw, vh);
            offCtx.putImageData(img, 0, 0);
            if (boltHold.width !== vw || boltHold.height !== vh) {
              boltHold.width = vw;
              boltHold.height = vh;
            }
            const bh = boltHold.getContext("2d");
            if (bh) {
              bh.clearRect(0, 0, vw, vh);
              bh.drawImage(off, 0, 0, vw, vh);
              haveBolt.current = true;
            }
          }
        }
      }

      if (bolt.duration && isFinite(bolt.duration) && bolt.currentTime >= bolt.duration - 0.08) {
        try {
          bolt.currentTime = 0.001;
        } catch {
          /* ignore */
        }
      }

      if (haveRoad.current) {
        const now = performance.now();
        const hz = HAZARDS[plateRef.current] ?? null;
        let onBox = false;
        if (hz && road && road.duration > 0.4) {
          if (hitPlate.current !== plateRef.current) {
            hitPlate.current = plateRef.current;
            passed.current = false;
          }
          const u = road.currentTime / road.duration;
          const inWin = u >= hz.t0 && u <= hz.t1;
          const lane = visualLane(xRef.current);
          const onIt = hz.lanes.includes(lane);
          const cleared = hz.jumpClears && isAirborne(jumpAt.current, now);
          if (u >= hz.tPass && !onIt) passed.current = true;
          if (blocked.current && !onIt) passed.current = true;
          onBox = inWin && onIt && !cleared && !passed.current;
        }
        setBlocked(onBox);
      }

      ctx.save();
      if (trauma.current > 0.02 && !reduced.current) {
        const s = trauma.current * trauma.current;
        ctx.translate((Math.random() - 0.5) * 18 * s, (Math.random() - 0.5) * 12 * s);
        trauma.current *= 0.88;
      } else {
        trauma.current = 0;
      }
      if (haveRoad.current) {
        ctx.drawImage(roadHold, 0, 0, canvas.width, canvas.height);
      } else {
        const poster = posterRef.current;
        if (poster && poster.naturalWidth > 2) {
          if (canvas.width !== 720 || canvas.height !== 1280) {
            canvas.width = 720;
            canvas.height = 1280;
          }
          ctx.drawImage(poster, 0, 0, canvas.width, canvas.height);
        }
      }
      if (haveBolt.current) {
        const dx = (xRef.current / 100) * canvas.width;
        const cw = canvas.width;
        const ch = canvas.height;
        const paws = pawsRef.current;
        const want = BOLT_SCALE[plateRef.current] ?? 1;
        scaleRef.current += (want - scaleRef.current) * 0.14;
        const s = scaleRef.current;
        const dw = cw * s;
        const dh = ch * s;
        const destX = dx + (cw - dw) / 2;
        const pawY = paws.y || ch * 0.86;
        let jy = 0;
        if (jumpAt.current) {
          const t = (performance.now() - jumpAt.current) / JUMP_MS;
          if (t >= 1) jumpAt.current = 0;
          else jy = Math.sin(Math.min(1, t) * Math.PI) * ch * JUMP_PEAK;
        }
        const destY = pawY * (1 - s) - jy;
        const feet = destY + pawY * s;
        const pw = Math.max(48, (paws.x1 - paws.x0) * s);
        const cx = destX + ((paws.x0 + paws.x1) / 2) * s;
        ctx.fillStyle = "rgba(8,6,14,0.2)";
        ctx.beginPath();
        ctx.ellipse(cx, feet + 6, pw * 0.62 * (jy ? 0.7 : 1), 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(8,6,14,0.32)";
        ctx.beginPath();
        ctx.ellipse(cx, feet + 3, pw * 0.4 * (jy ? 0.7 : 1), 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.drawImage(boltHold, destX, destY, dw, dh);
      }
      ctx.restore();

      if (blocked.current) {
        ctx.fillStyle = "rgba(190,28,48,0.14)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      if (hitFlash.current) {
        const k = 1 - (performance.now() - hitFlash.current) / 220;
        if (k <= 0) hitFlash.current = 0;
        else {
          ctx.fillStyle = `rgba(190,28,48,${0.32 * k})`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }

      drawRaf.current = requestAnimationFrame(paint);
    };
    drawRaf.current = requestAnimationFrame(paint);

    const startAt = (x: number, y: number) => {
      ptr.current = { x, y, t: performance.now(), used: false };
      playPair();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === "KeyA" || e.code === "ArrowLeft") {
        e.preventDefault();
        goRef.current(-1);
      } else if (e.code === "KeyD" || e.code === "ArrowRight") {
        e.preventDefault();
        goRef.current(1);
      } else if (e.code === "KeyW" || e.code === "ArrowUp" || e.code === "Space") {
        e.preventDefault();
        jumpRef.current();
      }
    };

    const onVis = () => {
      if (document.visibilityState === "visible") playPair();
    };

    const onEnded = (e: Event) => {
      const v = e.target as HTMLVideoElement;
      const inactive = roadIdx.current === 0 ? roadB : roadA;
      if (v === inactive) {
        v.pause();
        try {
          v.currentTime = 0;
        } catch {
          /* ignore */
        }
        return;
      }
      try {
        v.currentTime = 0.001;
      } catch {
        /* ignore */
      }
      void v.play().catch(() => {});
    };

    const onTs = (e: Event) => {
      const ev = e as TouchEvent;
      const t = ev.changedTouches[0] || ev.touches[0];
      if (!t) return;
      startAt(t.clientX, t.clientY);
    };
    const onTm = (e: Event) => {
      const ev = e as TouchEvent;
      const t = ev.touches[0];
      if (!t) return;
      readSwipe(t.clientX, t.clientY);
      if (ptr.current?.used) e.preventDefault();
    };
    const onTe = (e: Event) => {
      const t = (e as TouchEvent).changedTouches[0];
      if (t) {
        readSwipe(t.clientX, t.clientY);
        finishTap(t.clientX);
      }
      ptr.current = null;
    };

    const onPd = (e: PointerEvent) => {
      startAt(e.clientX, e.clientY);
    };
    const onPm = (e: PointerEvent) => {
      readSwipe(e.clientX, e.clientY);
    };
    const onPu = (e: PointerEvent) => {
      readSwipe(e.clientX, e.clientY);
      finishTap(e.clientX);
      ptr.current = null;
    };

    const opts: AddEventListenerOptions = { passive: false, capture: true };
    const host: EventTarget = touch ?? document;
    host.addEventListener("touchstart", onTs, opts);
    host.addEventListener("touchmove", onTm, opts);
    host.addEventListener("touchend", onTe, opts);
    host.addEventListener("touchcancel", onTe, opts);
    window.addEventListener("pointerdown", onPd, opts);
    window.addEventListener("pointermove", onPm, opts);
    window.addEventListener("pointerup", onPu, opts);
    window.addEventListener("pointercancel", onPu, opts);
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVis);
    roadA?.addEventListener("ended", onEnded);
    roadB?.addEventListener("ended", onEnded);
    bolt?.addEventListener("ended", onEnded);

    window.__controlsTest = {
      getYaw: () => -laneRef.current * 0.35,
      getSpeed: () => 1,
      getX: () => laneRef.current,
      setKeys: (codes: string[]) => {
        const t = new Set(codes);
        if (t.has("KeyA") || t.has("ArrowLeft")) goRef.current(-1);
        if (t.has("KeyD") || t.has("ArrowRight")) goRef.current(1);
        if (t.has("KeyW") || t.has("ArrowUp") || t.has("Space")) jumpRef.current();
      },
    };

    const hide = window.setTimeout(() => setHint(false), 5200);
    const warm = window.setTimeout(() => {
      if (roadB && !roadB.currentSrc) {
        roadB.src = PLATES[1]!;
        roadB.preload = "auto";
      }
    }, 900);
    const beat = window.setInterval(() => playPair(), WATCHDOG_MS);

    return () => {
      host.removeEventListener("touchstart", onTs, opts);
      host.removeEventListener("touchmove", onTm, opts);
      host.removeEventListener("touchend", onTe, opts);
      host.removeEventListener("touchcancel", onTe, opts);
      window.removeEventListener("pointerdown", onPd, opts);
      window.removeEventListener("pointermove", onPm, opts);
      window.removeEventListener("pointerup", onPu, opts);
      window.removeEventListener("pointercancel", onPu, opts);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
      roadA?.removeEventListener("ended", onEnded);
      roadB?.removeEventListener("ended", onEnded);
      bolt?.removeEventListener("ended", onEnded);
      window.clearTimeout(hide);
      window.clearTimeout(warm);
      window.clearInterval(beat);
      cancelAnimationFrame(moveRaf.current);
      cancelAnimationFrame(drawRaf.current);
      delete window.__controlsTest;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="master-player lane-player"
      role="application"
      aria-label="BOLT lane run. Swipe or tap sides to change lanes. Swipe up to jump."
    >
      <div className="lane-stage">
        <canvas ref={canvasRef} className={booted ? "lane-canvas" : "lane-canvas is-wait"} />
        <div className="lane-decoders" aria-hidden>
          <video
            ref={boltRef}
            className="bolt-vid"
            src={BOLT_MP4}
            muted
            playsInline
            preload="auto"
            autoPlay
            // @ts-expect-error React 19 fetchPriority
            fetchPriority="high"
            controls={false}
            disablePictureInPicture
            controlsList="nodownload nofullscreen noremoteplayback"
          />
          <video
            ref={roadARef}
            className="road-vid"
            src={ROAD_SRC}
            muted
            playsInline
            preload="auto"
            autoPlay
            controls={false}
            disablePictureInPicture
            controlsList="nodownload nofullscreen noremoteplayback"
          />
          <video
            ref={roadBRef}
            className="road-vid"
            muted
            playsInline
            preload="none"
            controls={false}
            disablePictureInPicture
            controlsList="nodownload nofullscreen noremoteplayback"
          />
        </div>
      </div>
      <div ref={touchRef} className="lane-touch" />
      <div className="lane-pips" aria-hidden>
        {([-1, 0, 1] as LaneI[]).map((n) => (
          <span key={n} className={lane === n ? "is-on" : undefined} />
        ))}
      </div>
      {hint ? <p className="lane-hint">swipe sides · swipe up to jump</p> : null}
    </div>
  );
}
