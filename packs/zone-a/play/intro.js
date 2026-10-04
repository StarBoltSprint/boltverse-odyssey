/**
 * Zone title at game start: a UI text overlay (DOM, not the WebGL view; no game pixel is drawn).
 * It never blocks play (no tap, no Start button, no controls lecture): Bolt is live under it.
 * Opacity-only fade in / hold / fade out, then the node is removed. `?intro=0` turns it off.
 * The title is the biome kit `name` (A: "The Howling Eclipse"), so every zone reuses it.
 */

export const INTRO_TIMING = { delayMs: 350, inMs: 1400, holdMs: 2600, outMs: 1800 };

export function introEnabled(search) {
  return !/[?&]intro=0\b/.test(search || "");
}

export function showIntro(doc, title, opts) {
  if (!doc || !title) return null;
  const t = { ...INTRO_TIMING, ...(opts || {}) };
  const root = doc.createElement("div");
  root.id = "intro";
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");
  const kicker = doc.createElement("div");
  kicker.className = "intro-kicker";
  kicker.textContent = (opts && opts.kicker) || "Boltverse Odyssey";
  const name = doc.createElement("div");
  name.className = "intro-title";
  name.textContent = title;
  root.appendChild(kicker);
  root.appendChild(name);
  doc.body.appendChild(root);
  const total = t.delayMs + t.inMs + t.holdMs + t.outMs;
  // Keyframe stops as fractions of the whole run; easing per segment keeps the ramps soft.
  const a = t.delayMs / total;
  const b = (t.delayMs + t.inMs) / total;
  const c = (t.delayMs + t.inMs + t.holdMs) / total;
  const frames = [
    { opacity: 0, offset: 0 },
    { opacity: 0, offset: a, easing: "cubic-bezier(0.33, 0, 0.2, 1)" },
    { opacity: 1, offset: b },
    { opacity: 1, offset: c, easing: "cubic-bezier(0.4, 0, 0.6, 1)" },
    { opacity: 0, offset: 1 },
  ];
  let anim = null;
  if (root.animate) {
    anim = root.animate(frames, { duration: total, fill: "forwards" });
    anim.onfinish = () => root.remove();
  } else {
    setTimeout(() => root.remove(), total);
  }
  return { root, anim, total };
}
