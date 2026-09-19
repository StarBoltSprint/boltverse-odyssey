import { useEffect, useRef, type RefObject } from "react";

export interface SkyMotion {
  x: number;
  y: number;
  yaw: number;
  pitch: number;
  flatten: number;
}

interface Speck {
  x: number;
  y: number;
  r: number;
  a: number;
  p: number;
  s: number;
  depth: number;
}

function frac(n: number) {
  return n - Math.floor(n);
}

function seedLayer(count: number, depth: number, rMin: number, rMax: number, aMin: number, aMax: number): Speck[] {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: rMin + Math.random() * (rMax - rMin),
    a: aMin + Math.random() * (aMax - aMin),
    p: Math.random() * Math.PI * 2,
    s: 0.28 + Math.random() * 1.15,
    depth,
  }));
}

function paint(
  ctx: CanvasRenderingContext2D,
  specks: Speck[],
  w: number,
  h: number,
  t: number,
  motion: SkyMotion,
  k: number,
  twinkle: boolean,
) {
  const pan = 1 - motion.flatten * 0.88;
  for (const s of specks) {
    const d = s.depth * pan * k;
    const px = frac(s.x - motion.x * d * 0.00011 - motion.yaw * d * 0.07) * w;
    const py = frac(s.y - motion.y * d * 0.00011 - motion.pitch * d * 0.09) * h;
    const tw = twinkle ? s.a * (0.58 + 0.42 * Math.sin(t * s.s + s.p)) : s.a;
    ctx.fillStyle = `rgba(232,238,248,${tw})`;
    ctx.beginPath();
    ctx.arc(px, py, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function Starfield({ motion }: { motion: RefObject<SkyMotion> }) {
  const farRef = useRef<HTMLCanvasElement>(null);
  const dustRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const far = farRef.current;
    const dust = dustRef.current;
    if (!far || !dust) return;
    const farCtx = far.getContext("2d");
    const dustCtx = dust.getContext("2d");
    if (!farCtx || !dustCtx) return;

    const farStars = seedLayer(110, 0.16, 0.15, 0.7, 0.1, 0.32);
    const midStars = seedLayer(70, 0.42, 0.35, 1.05, 0.16, 0.42);
    const nearStars = seedLayer(36, 0.78, 0.5, 1.25, 0.18, 0.4);
    const motes = seedLayer(22, 1.45, 0.7, 1.7, 0.1, 0.28);

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      for (const c of [far, dust]) {
        c.width = Math.floor(w * dpr);
        c.height = Math.floor(h * dpr);
        c.style.width = `${w}px`;
        c.style.height = `${h}px`;
      }
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      const t = (now - t0) / 1000;
      const m = motion.current;
      farCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      farCtx.clearRect(0, 0, w, h);
      paint(farCtx, farStars, w, h, t, m, 1, true);
      paint(farCtx, midStars, w, h, t, m, 1, true);
      paint(farCtx, nearStars, w, h, t, m, 1, true);

      dustCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dustCtx.clearRect(0, 0, w, h);
      const dustK = (1 - m.flatten) * (1 - m.flatten);
      if (dustK > 0.04) {
        paint(dustCtx, motes, w, h, t, m, dustK, false);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [motion]);

  return (
    <>
      <canvas
        ref={farRef}
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      />
      <canvas
        ref={dustRef}
        className="dust-field pointer-events-none absolute inset-0"
        aria-hidden="true"
      />
    </>
  );
}
