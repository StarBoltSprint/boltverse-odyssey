/**
 * Lane cue readability L. Laws: COOKLANE.md (L bands) · PLAY.md.
 * Does not see the film. Year-0 fills samples[] (eye / vision).
 *
 *   L_i ≈ n_yes / 3     (on, mid, off)
 *   L   = Σ (L_i × width_i) / Σ width_i
 *
 * Ambiguous L/R → L_i = 0. Zero cues → L.na (not a FAIL).
 */

export const L_PASS = 0.75;
export const L_GRAY = 0.55;
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
    if (cue.ambiguous) return 0;
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
    return { ok: true, code: "L.na", L: null, rho_glow: 0 };
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
      return { ok: false, code: "cue.honesty_unscored", L: null, cue: c.id, rho_glow: rho };
    }
    num += Li * w;
    den += w;
  }
  const L = den > 0 ? num / den : 0;

  if (L < L_GRAY) {
    return { ok: false, code: "cue.honesty", L, rho_glow: rho };
  }
  if (L < L_PASS) {
    return { ok: true, code: "L.gray", L, rho_glow: rho, note: "nudge on/off 2–4 frames" };
  }
  return { ok: true, code: "L.pass", L, rho_glow: rho };
}
