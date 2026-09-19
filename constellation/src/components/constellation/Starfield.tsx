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
  cr: number;
  cg: number;
  cb: number;
  glow: boolean;
  spike: boolean;
}

interface Galaxy {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rot: number;
  cr: number;
  cg: number;
  cb: number;
  a: number;
  depth: number;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  len: number;
}

function frac(n: number) {
  return n - Math.floor(n);
}

function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedLayer(
  rng: () => number,
  count: number,
  depth: number,
  rMin: number,
  rMax: number,
  aMin: number,
  aMax: number,
  spiked = false,
): Speck[] {
  return Array.from({ length: count }, () => {
    const kind = rng();
    let cr = 232;
    let cg = 238;
    let cb = 248;
    if (kind < 0.12) {
      cr = 255;
      cg = 214;
      cb = 168;
    } else if (kind < 0.22) {
      cr = 255;
      cg = 236;
      cb = 214;
    } else if (kind > 0.86) {
      cr = 168;
      cg = 196;
      cb = 255;
    } else if (kind > 0.74) {
      cr = 196;
      cg = 214;
      cb = 255;
    }
    const r = rMin + rng() * (rMax - rMin);
    const glow = r > (rMin + rMax) * 0.46 && rng() > 0.5;
    return {
      x: rng(),
      y: rng(),
      r,
      a: aMin + rng() * (aMax - aMin),
      p: rng() * Math.PI * 2,
      s: 0.22 + rng() * 1.35,
      depth,
      cr,
      cg,
      cb,
      glow,
      spike: spiked && glow && rng() > 0.35,
    };
  });
}

function seedGalaxies(rng: () => number, count: number): Galaxy[] {
  return Array.from({ length: count }, () => ({
    x: rng(),
    y: rng(),
    rx: 18 + rng() * 38,
    ry: 5 + rng() * 12,
    rot: rng() * Math.PI,
    cr: 170 + rng() * 50,
    cg: 180 + rng() * 40,
    cb: 210 + rng() * 30,
    a: 0.045 + rng() * 0.07,
    depth: 0.08 + rng() * 0.18,
  }));
}

function wrapPos(s: { x: number; y: number; depth: number }, motion: SkyMotion, t: number, w: number, h: number, k: number) {
  const pan = 1 - motion.flatten * 0.88;
  const d = s.depth * pan * k;
  const drift = t * 0.0045 * s.depth;
  const px = frac(s.x - motion.x * d * 0.00009 - motion.yaw * d * 0.08 + drift) * w;
  const py = frac(s.y - motion.y * d * 0.00009 - motion.pitch * d * 0.1) * h;
  return { px, py, d };
}

function paintStars(
  ctx: CanvasRenderingContext2D,
  specks: Speck[],
  w: number,
  h: number,
  t: number,
  motion: SkyMotion,
  k: number,
  twinkle: boolean,
) {
  const flatten = 1 - motion.flatten * 0.7;
  for (const s of specks) {
    const { px, py } = wrapPos(s, motion, t, w, h, k);
    const tw = (twinkle ? s.a * (0.52 + 0.48 * Math.sin(t * s.s + s.p)) : s.a) * flatten;
    if (tw < 0.04) continue;
    if (s.glow && tw > 0.1) {
      ctx.fillStyle = `rgba(${s.cr},${s.cg},${s.cb},${tw * 0.18})`;
      ctx.beginPath();
      ctx.arc(px, py, s.r * 5.4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (s.spike && tw > 0.14) {
      const len = s.r * 9 + 6;
      ctx.strokeStyle = `rgba(${s.cr},${s.cg},${s.cb},${tw * 0.38})`;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(px - len, py);
      ctx.lineTo(px + len, py);
      ctx.moveTo(px, py - len * 0.7);
      ctx.lineTo(px, py + len * 0.7);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(${s.cr},${s.cg},${s.cb},${tw})`;
    if (s.r < 0.55) {
      ctx.fillRect(px, py, 1.1, 1.1);
    } else {
      ctx.beginPath();
      ctx.arc(px, py, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function paintGalaxies(
  ctx: CanvasRenderingContext2D,
  galaxies: Galaxy[],
  w: number,
  h: number,
  t: number,
  motion: SkyMotion,
) {
  const fade = 1 - motion.flatten * 0.85;
  if (fade < 0.08) return;
  for (const g of galaxies) {
    const { px, py } = wrapPos(g, motion, t, w, h, 1);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(g.rot + motion.yaw * 0.15);
    ctx.scale(1, g.ry / g.rx);
    const rad = ctx.createRadialGradient(0, 0, 0, 0, 0, g.rx);
    rad.addColorStop(0, `rgba(${g.cr},${g.cg},${g.cb},${g.a * fade * 1.6})`);
    rad.addColorStop(0.45, `rgba(${g.cr},${g.cg},${g.cb},${g.a * fade * 0.5})`);
    rad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rad;
    ctx.beginPath();
    ctx.arc(0, 0, g.rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function paintVeils(ctx: CanvasRenderingContext2D, w: number, h: number, motion: SkyMotion, t: number) {
  const a = (1 - motion.flatten * 0.8) * (0.85 + 0.15 * Math.sin(t * 0.07));
  if (a < 0.05) return;
  const ox = -motion.x * 0.02 - motion.yaw * 48;
  const oy = -motion.y * 0.02 - motion.pitch * 40;
  const blobs: Array<[number, number, number, number, string]> = [
    [0.22 + ox / w, 0.28 + oy / h, 0.55, 0.11 * a, "48,62,118"],
    [0.78 + ox / w, 0.7 + oy / h, 0.48, 0.09 * a, "72,38,58"],
    [0.62 + ox / w, 0.22 + oy / h, 0.36, 0.07 * a, "36,78,92"],
    [0.38 + ox / w, 0.78 + oy / h, 0.4, 0.06 * a, "58,42,28"],
  ];
  for (const [x, y, r, alpha, rgb] of blobs) {
    const g = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * Math.max(w, h));
    g.addColorStop(0, `rgba(${rgb},${alpha})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

function loadImg(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function Starfield({ motion }: { motion: RefObject<SkyMotion> }) {
  const farRef = useRef<HTMLCanvasElement>(null);
  const dustRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const far = farRef.current;
    const dust = dustRef.current;
    if (!far || !dust) return;
    const farCtx = far.getContext("2d", { alpha: true });
    const dustCtx = dust.getContext("2d", { alpha: true });
    if (!farCtx || !dustCtx) return;

    const rng = mulberry32(0x51a7);
    const farStars = seedLayer(rng, 280, 0.12, 0.12, 0.48, 0.1, 0.32);
    const midStars = seedLayer(rng, 110, 0.38, 0.28, 0.95, 0.16, 0.46);
    const nearStars = seedLayer(rng, 42, 0.72, 0.5, 1.35, 0.2, 0.48, true);
    const motes = seedLayer(rng, 34, 1.38, 0.7, 1.8, 0.08, 0.26);
    const galaxies = seedGalaxies(rng, 7);

    const meteor: Meteor = { x: 0, y: 0, vx: 0, vy: 0, life: 0, len: 0 };
    let nextMeteor = 3 + rng() * 6;

    let plates: { far: HTMLImageElement | null; milky: HTMLImageElement | null; near: HTMLImageElement | null } = {
      far: null,
      milky: null,
      near: null,
    };
    void Promise.all([
      loadImg("/sky/nebula-far.jpg?v=sky1"),
      loadImg("/sky/milky.jpg?v=sky1"),
      loadImg("/sky/nebula-near.jpg?v=sky1"),
    ]).then(([a, b, c]) => {
      plates = { far: a, milky: b, near: c };
    });

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

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    const t0 = performance.now();
    let last = t0;
    const loop = (now: number) => {
      const t = (now - t0) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const m = motion.current;
      const live = 1 - m.flatten;

      farCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      farCtx.clearRect(0, 0, w, h);

      const drawPlate = (img: HTMLImageElement | null, depth: number, alpha: number, scale: number) => {
        if (!img || alpha < 0.02) return;
        const ox = -m.x * depth * 0.035 - m.yaw * depth * 90 + Math.sin(t * 0.03) * 8 * depth;
        const oy = -m.y * depth * 0.035 - m.pitch * depth * 70;
        const dw = w * scale;
        const dh = h * scale;
        farCtx.globalAlpha = alpha;
        farCtx.drawImage(img, ox - (dw - w) / 2, oy - (dh - h) / 2, dw, dh);
        farCtx.globalAlpha = 1;
      };

      farCtx.globalCompositeOperation = "screen";
      drawPlate(plates.milky, 0.12, 0.42 * (0.55 + 0.45 * live), 1.55);
      drawPlate(plates.far, 0.22, 0.5 * (0.6 + 0.4 * live), 1.7);
      drawPlate(plates.near, 0.55, 0.28 * live, 1.9);
      farCtx.globalCompositeOperation = "source-over";

      paintVeils(farCtx, w, h, m, t);
      paintGalaxies(farCtx, galaxies, w, h, t, m);
      paintStars(farCtx, farStars, w, h, t, m, 1, !reduced);
      paintStars(farCtx, midStars, w, h, t, m, 1, !reduced);
      paintStars(farCtx, nearStars, w, h, t, m, 1, !reduced);

      if (!reduced) {
        if (meteor.life > 0) {
          meteor.life -= dt;
          meteor.x += meteor.vx * dt;
          meteor.y += meteor.vy * dt;
          const fade = Math.max(0, meteor.life / 0.8);
          const hyp = Math.hypot(meteor.vx, meteor.vy) || 1;
          const nx = meteor.vx / hyp;
          const ny = meteor.vy / hyp;
          const g = farCtx.createLinearGradient(
            meteor.x,
            meteor.y,
            meteor.x - nx * meteor.len,
            meteor.y - ny * meteor.len,
          );
          g.addColorStop(0, `rgba(255,244,230,${0.85 * fade * live})`);
          g.addColorStop(0.35, `rgba(210,220,255,${0.35 * fade * live})`);
          g.addColorStop(1, "rgba(210,220,255,0)");
          farCtx.strokeStyle = g;
          farCtx.lineWidth = 1.6;
          farCtx.beginPath();
          farCtx.moveTo(meteor.x, meteor.y);
          farCtx.lineTo(meteor.x - nx * meteor.len, meteor.y - ny * meteor.len);
          farCtx.stroke();
          farCtx.fillStyle = `rgba(255,248,236,${0.9 * fade * live})`;
          farCtx.beginPath();
          farCtx.arc(meteor.x, meteor.y, 1.4, 0, Math.PI * 2);
          farCtx.fill();
        } else {
          nextMeteor -= dt;
          if (nextMeteor <= 0 && m.flatten < 0.7) {
            meteor.x = rng() * w * 0.7;
            meteor.y = rng() * h * 0.4;
            meteor.vx = 420 + rng() * 260;
            meteor.vy = 150 + rng() * 180;
            meteor.life = 0.55 + rng() * 0.3;
            meteor.len = 70 + rng() * 50;
            nextMeteor = 7 + rng() * 12;
          }
        }
      }

      dustCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dustCtx.clearRect(0, 0, w, h);
      const dustK = live * live;
      if (dustK > 0.04) {
        paintStars(dustCtx, motes, w, h, t, m, dustK, false);
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
