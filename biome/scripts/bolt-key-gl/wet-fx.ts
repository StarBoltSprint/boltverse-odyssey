/** Ground FX — law 16 + 22. Euler droplets + road-sliding prints. Not SPH. Not Box2D.
 * Port into Live (lane-player) next to makeCompositor. Spawn on plant / STRIDE_HZ.
 * Chase cam: prints slide DOWN the screen (toward camera) with the plate.
 * KEEP frost: MAX_PRINTS 10, MAX_DROPS 28, fade 0.52/s, emit 7 crystals.
 */

export type Wet = {
  x: number;
  y: number;
  r: number;
  a: number;
  vx: number;
  vy: number;
  vr: number;
  bounces: number;
};

export const MAX_PRINTS = 10;
export const MAX_DROPS = 28;
export const G_PX = 1680;
export const ROAD_DRAG = 48;

export type FxKind = "water" | "dust" | "ash" | "glitter";

export function fxKindOf(ch: string): FxKind {
  const k = (ch || "").toLowerCase();
  if (k === "frost" || k === "ice" || k === "snow" || k === "tide" || k === "wet" || k === "rain") return "water";
  if (k === "war" || k === "ash" || k === "ember") return "ash";
  if (k === "crystal") return "glitter";
  return "dust";
}

export function capWet(list: Wet[], n: number) {
  if (list.length > n) list.splice(0, list.length - n);
}

export function packWet(out: Float32Array, list: Wet[], n: number, cw: number, ch: number) {
  out.fill(0);
  const max = Math.min(n, list.length);
  for (let i = 0; i < max; i++) {
    const m = list[i]!;
    const o = i * 4;
    out[o] = m.x / cw;
    out[o + 1] = 1 - m.y / ch;
    out[o + 2] = Math.max(m.r / ch, 0.002);
    out[o + 3] = m.a;
  }
}

export function emitSplash(drops: Wet[], x: number, y: number, dir: number, pw: number, kind: FxKind = "water") {
  const n = kind === "dust" || kind === "ash" ? 5 : 7;
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1);
    const r = kind === "dust" ? 3 + t * 5 : 2.2 + t * 7.2;
    const up = kind === "water" ? 210 : 120;
    drops.push({
      x: x + (Math.random() - 0.5) * pw * 0.22,
      y: y - 2 - Math.random() * 7,
      r,
      a: 0.76 + Math.random() * 0.22,
      vx: dir * (65 + t * 150 + Math.random() * 70) + (Math.random() - 0.5) * 85,
      vy: -(up + Math.random() * 190) + (1 - t) * 50,
      vr: 0,
      bounces: 0,
    });
  }
}

export function stepDrops(drops: Wet[], prints: Wet[], dt: number, groundY: number, ch: number) {
  const born: Wet[] = [];
  for (const d of drops) {
    const k = 4.4 / Math.max(d.r, 2.2);
    d.vx -= d.vx * k * dt;
    d.vy -= d.vy * k * dt;
    d.vy += G_PX * dt + ROAD_DRAG * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (d.y + d.r * 0.32 >= groundY && d.vy > 0) {
      d.y = groundY - d.r * 0.32;
      const impact = d.vy;
      if (impact > 110 && d.bounces < 2 && d.r > 3.2) {
        const e = 0.16 + Math.min(0.18, d.r * 0.012);
        d.vy = -impact * e;
        d.vx *= 0.52;
        d.r *= 0.68;
        d.a *= 0.88;
        d.bounces += 1;
        if (d.r > 4.2 && born.length < 6) {
          const bits = d.r > 6 ? 2 : 1;
          for (let i = 0; i < bits; i++) {
            born.push({
              x: d.x,
              y: d.y - 2,
              r: Math.max(2, d.r * (0.35 + Math.random() * 0.2)),
              a: d.a * 0.7,
              vx: d.vx * 0.4 + (Math.random() - 0.5) * 140,
              vy: -impact * (0.12 + Math.random() * 0.18),
              vr: 0,
              bounces: d.bounces,
            });
          }
        }
      } else {
        prints.push({
          x: d.x,
          y: groundY + 3,
          r: Math.max(8, d.r * 1.8),
          a: Math.min(0.68, 0.28 + d.a * 0.4),
          vx: 0,
          vy: ch * 0.16,
          vr: d.r * 2.2,
          bounces: 0,
        });
        d.a = 0;
      }
    }
    d.a -= dt * (d.bounces ? 1.65 : 0.48);
  }
  for (const b of born) drops.push(b);
}

export function stepPrints(prints: Wet[], dt: number, ch: number) {
  for (const m of prints) {
    m.y += m.vy * dt;
    m.r += m.vr * dt;
    m.a -= dt * 0.52;
  }
  let w = 0;
  for (let i = 0; i < prints.length; i++) {
    const m = prints[i]!;
    if (m.a > 0.04 && m.y < ch + 24) prints[w++] = m;
  }
  prints.length = w;
}

export function compactDrops(drops: Wet[], ch: number) {
  let w = 0;
  for (let i = 0; i < drops.length; i++) {
    const d = drops[i]!;
    if (d.a > 0.05 && d.y < ch + 12 && d.r > 1.2) drops[w++] = d;
  }
  drops.length = w;
}
