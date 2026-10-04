/**
 * Biome-to-biome post blend along a path. Numbers only: it never draws a pixel.
 *
 * Law 67 post (light distance fog, one light grade per biome, subtle capped bloom) is the only
 * thing that changes between two biomes on a path. Each biome kit carries a numbers-only
 * `post` block; the fog colour is never typed: it is sampled from that biome's own Imagine sky
 * horizon band (null until that sky exists, then the previous fog colour is kept).
 * The blend weight is a smoothstep of the distance travelled along the path polyline.
 */

// Zone A step 1 values (docs/METHOD/ground.md §8): the default when a kit has no post block.
export const DEFAULT_POST = Object.freeze({
  fogDensity: 0.015,
  fogCap: 0.58,
  gradeMix: 0.26,
  saturation: 1.05,
  bloomGain: 0.11,
  bloomThreshold: 0.78,
});

// "Light" stays light: a kit cannot push the post past these (law 67).
export const POST_LIMITS = Object.freeze({
  fogDensity: [0, 0.03],
  fogCap: [0, 0.65],
  gradeMix: [0, 0.4],
  saturation: [0.9, 1.15],
  bloomGain: [0, 0.15],
  bloomThreshold: [0.7, 0.95],
});

const KEYS = Object.keys(DEFAULT_POST);

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** Post numbers of a kit (missing or out-of-range numbers fall back / clamp). */
export function postOf(kit, fog) {
  const src = (kit && kit.post) || {};
  const out = { id: (kit && kit.id) || null, fog: fog || null };
  for (const k of KEYS) {
    const v = Number.isFinite(src[k]) ? src[k] : DEFAULT_POST[k];
    out[k] = clamp(v, POST_LIMITS[k][0], POST_LIMITS[k][1]);
  }
  return out;
}

export function smoothstep(e0, e1, x) {
  if (e1 <= e0) return x >= e1 ? 1 : 0;
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Polyline [[x, z], ...] → cumulative lengths + a projector (distance along, lateral). */
export function measurePath(points) {
  const pts = Array.isArray(points) ? points.filter((p) => Array.isArray(p) && p.length >= 2) : [];
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const length = cum[cum.length - 1] || 0;
  function project(x, z) {
    if (pts.length < 2) return { s: 0, d: Infinity };
    let best = { s: 0, d: Infinity };
    for (let i = 1; i < pts.length; i++) {
      const ax = pts[i - 1][0];
      const az = pts[i - 1][1];
      const bx = pts[i][0] - ax;
      const bz = pts[i][1] - az;
      const L2 = bx * bx + bz * bz || 1e-9;
      const t = clamp(((x - ax) * bx + (z - az) * bz) / L2, 0, 1);
      const d = Math.hypot(x - (ax + bx * t), z - (az + bz * t));
      if (d < best.d) best = { s: cum[i - 1] + t * Math.sqrt(L2), d };
    }
    return best;
  }
  return { points: pts, cum, length, project };
}

/** Linear mix of two post sets (fog colour mixes only when both colours exist). */
export function mixPost(a, b, t, out) {
  const o = out || {};
  for (const k of KEYS) o[k] = a[k] + (b[k] - a[k]) * t;
  const fa = a.fog;
  const fb = b.fog || a.fog;
  o.fog = fa && fb ? [0, 1, 2].map((i) => fa[i] + (fb[i] - fa[i]) * t) : (fa || fb || null);
  return o;
}

/**
 * from / to: postOf(...) sets. path: polyline from this zone's exit toward the next biome.
 * The blend starts `startM` along the path and is complete at `endM` (default: path end).
 * `width` keeps the blend off when Bolt is far from the path (never a wall, only post).
 * Hooks (placeholders until zone B exists): onApproach(t) once when t first rises above 0
 * (preload the next zone), onArrive() once when t reaches 1 (hand off to the next zone).
 */
export function createBiomeBlend(opts) {
  const path = measurePath(opts.path);
  const startM = Number.isFinite(opts.startM) ? opts.startM : 0;
  const endM = Number.isFinite(opts.endM) ? opts.endM : path.length;
  const width = Number.isFinite(opts.widthM) ? opts.widthM : 12;
  const from = opts.from || postOf(null);
  let to = opts.to || from;
  let override = null;
  let approached = false;
  let arrived = false;
  const cur = mixPost(from, from, 0, {});
  const info = { active: path.length > 0, to: to.id, s: 0, d: Infinity, t: 0, length: path.length };
  return {
    info: () => ({ ...info }),
    setTarget(next) { to = next || from; info.to = to.id; },
    setOverride(t) { override = t == null ? null : clamp(Number(t) || 0, 0, 1); },
    update(x, z) {
      let t = 0;
      if (path.length > 0) {
        const p = path.project(x, z);
        info.s = p.s;
        info.d = p.d;
        const lateral = 1 - smoothstep(width * 0.6, width, p.d);
        t = smoothstep(startM, endM, p.s) * lateral;
      }
      info.t = override != null ? override : t;
      // Hooks follow the walked distance only, never a QC override.
      if (t > 0 && !approached) {
        approached = true;
        if (opts.onApproach) opts.onApproach(t);
      }
      if (t >= 0.999 && !arrived) {
        arrived = true;
        if (opts.onArrive) opts.onArrive();
      }
      return mixPost(from, to, info.t, cur);
    },
  };
}
