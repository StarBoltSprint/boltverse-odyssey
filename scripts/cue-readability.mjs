/**
 * Lane cue readability L. Laws: COOKLANE.md · PLAY.md.
 * Year-0: 3 samples. Possible L = 0, 1/3, 2/3, 1. Not a lab metric.
 *
 *   PASS = 3/3          (L_PASS 1.0 — 0.75 meant the same)
 *   GRAY = 2/3          (nudge the window, maybe keep the mp4)
 *   FAIL = 0 or 1/3     (recook)
 *
 * Do not lower PASS to ship a pack. Do not tie L to m.
 * Do not grow coyote to hide a hole.
 */

export const SAMPLES = 3;
export const L_PASS = 1;
export const L_GRAY = 0.5;
export const RHO_GLOW_MAX = 0.45;

export function sampleTimes(cue) {
  const on = Number(cue.on);
  const off = Number(cue.off);
  const mid = on + (off - on) / 2;
  return [on, mid, off];
}

function width(cue) {
  const w = Number(cue.off) - Number(cue.on);
  return w > 0 ? w : 0;
}

function sampleYes(s) {
  if (!s) return false;
  if (s.ambiguous || s.sideOk === false) return false;
  return !!(s.gestureOk && s.glowOk && s.sideOk);
}

export function Lof(cue) {
  if (cue.ambiguous || cue.side === "both") return 0;
  const samples = cue.samples || [];
  if (samples.length === 0) return null;
  let yes = 0;
  for (const s of samples) {
    if (sampleYes(s)) yes += 1;
  }
  return yes / samples.length;
}

export function rhoGlow(duration, cues) {
  const d = Number(duration);
  if (!(d > 0)) return 0;
  let lit = 0;
  for (const c of cues || []) lit += width(c);
  return lit / d;
}

export function smokeL({ duration, cues = [] } = {}) {
  if (!cues.length) {
    return { ok: true, code: "L.na", L: null, rho_glow: 0, yes: null };
  }

  const rho = rhoGlow(duration, cues);
  if (rho > RHO_GLOW_MAX) {
    return { ok: false, code: "cue.farm_glow", L: null, rho_glow: rho };
  }

  let num = 0;
  let den = 0;
  for (const c of cues) {
    const Li = Lof(c);
    const w = width(c);
    if (Li == null) {
      return {
        ok: false,
        code: "cue.honesty_unscored",
        L: null,
        cue: c.id,
        rho_glow: rho,
      };
    }
    num += Li * w;
    den += w;
  }
  const L = den > 0 ? num / den : 0;

  if (L < L_GRAY) {
    return { ok: false, code: "cue.honesty", L, rho_glow: rho, note: "1/3 or 0 — recook" };
  }
  if (L < L_PASS) {
    return {
      ok: true,
      code: "L.gray",
      L,
      rho_glow: rho,
      note: "2/3 — nudge on/off 2–4 frames",
    };
  }
  return { ok: true, code: "L.pass", L, rho_glow: rho, note: "3/3" };
}
