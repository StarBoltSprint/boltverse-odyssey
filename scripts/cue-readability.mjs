/**
 * Lane cue readability L. COOKLANE.md · PLAY.md.
 * 3 samples = a vote, not a mean. One bad sample jumps a tier.
 * Prefer false negative. Doubt = not readable. Never average 10 visions until PASS.
 *
 *   mid NON        → recook (gesture missing)
 *   only off NON   → nudge off −2–4 frames  (not Imagine)
 *   only on NON    → nudge on  +2–4
 *   3/3            → Hang
 *   ambiguous      → recook side
 */

export const SAMPLES = 3;
export const L_PASS = 1;
export const L_GRAY = 0.5;
export const RHO_GLOW_MAX = 0.45;
export const NUDGE_FRAMES = 3;

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

/** Doubt / missing / ambiguous → false. Never « looks like yes ». */
export function sampleYes(s) {
  if (!s) return false;
  if (s.ambiguous || s.doubt || s.sideOk === false) return false;
  return s.gestureOk === true && s.glowOk === true && s.sideOk === true;
}

export function Lof(cue) {
  if (cue.ambiguous || cue.side === "both") return 0;
  const samples = cue.samples || [];
  if (samples.length === 0) return null;
  let yes = 0;
  for (const s of samples) if (sampleYes(s)) yes += 1;
  return yes / samples.length;
}

/** Isolate window noise from plate noise. Gray ≠ Imagine recook. */
export function actionL(cue) {
  if (cue.ambiguous || cue.side === "both") {
    return { action: "recook_side", code: "cue.ambiguous" };
  }
  const samples = cue.samples || [];
  if (samples.length < 3) return { action: "unscored", code: "cue.honesty_unscored" };
  const on = sampleYes(samples[0]);
  const mid = sampleYes(samples[1]);
  const off = sampleYes(samples[2]);
  if (on && mid && off) return { action: "hang", code: "L.pass" };
  if (!mid) return { action: "recook", code: "cue.honesty_mid" };
  if (on && !off) {
    return { action: "nudge_off", code: "L.gray", frames: -NUDGE_FRAMES };
  }
  if (!on && off) {
    return { action: "nudge_on", code: "L.gray", frames: NUDGE_FRAMES };
  }
  return { action: "nudge_window", code: "L.gray" };
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
    return { ok: true, code: "L.na", L: null, rho_glow: 0, actions: [] };
  }

  const rho = rhoGlow(duration, cues);
  if (rho > RHO_GLOW_MAX) {
    return { ok: false, code: "cue.farm_glow", L: null, rho_glow: rho, actions: [] };
  }

  const actions = cues.map((c) => ({ id: c.id, ...actionL(c), L: Lof(c) }));
  if (actions.some((a) => a.action === "unscored")) {
    return { ok: false, code: "cue.honesty_unscored", L: null, rho_glow: rho, actions };
  }

  let num = 0;
  let den = 0;
  for (const c of cues) {
    num += (Lof(c) || 0) * width(c);
    den += width(c);
  }
  const L = den > 0 ? num / den : 0;

  if (actions.some((a) => a.action === "recook" || a.action === "recook_side")) {
    return { ok: false, code: "cue.honesty", L, rho_glow: rho, actions };
  }
  if (actions.some((a) => String(a.action).startsWith("nudge"))) {
    return {
      ok: true,
      code: "L.gray",
      L,
      rho_glow: rho,
      actions,
      note: "nudge window — do not spend a cook cap",
    };
  }
  return { ok: true, code: "L.pass", L, rho_glow: rho, actions };
}
