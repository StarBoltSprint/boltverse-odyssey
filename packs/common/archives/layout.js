/**
 * Phone chrome. The paw sits in a reserved top-right corner.
 * That corner is not the camera-tilt swipe. The stick stays bottom-left.
 * Imagine pixels are never enlarged and never scaled on one axis only.
 */

export function fitPixels(naturalW, naturalH, boxCssW, boxCssH, dpr) {
  const d = Math.min(2, Math.max(1, Number(dpr) || 1));
  const natW = Math.max(1, naturalW);
  const natH = Math.max(1, naturalH);
  const boxDevW = Math.max(1, boxCssW) * d;
  const boxDevH = Math.max(1, boxCssH) * d;
  const contain = Math.min(1, boxDevW / natW, boxDevH / natH);
  const cover = Math.max(boxDevW / natW, boxDevH / natH);
  const mode = cover <= 1 ? "cover" : "contain";
  const scale = mode === "cover" ? cover : contain;
  return { mode, scale, cssW: (natW * scale) / d, cssH: (natH * scale) / d };
}

/** Whole image, uniform shrink, never above 1 device pixel per source pixel. */
export function containBox(naturalW, naturalH, boxCssW, boxCssH, dpr) {
  const d = Math.min(2, Math.max(1, Number(dpr) || 1));
  const natW = Math.max(1, naturalW);
  const natH = Math.max(1, naturalH);
  const scale = Math.min(1, (Math.max(1, boxCssW) * d) / natW, (Math.max(1, boxCssH) * d) / natH);
  return { mode: "contain", scale, cssW: (natW * scale) / d, cssH: (natH * scale) / d };
}

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function chromeLayout(vw, vh, pawW = 56, pawH = 56) {
  const stick = { x: 18, y: vh - 28 - 108, w: 108, h: 108 };
  const reserve = { x: Math.max(0, vw - 96), y: 0, w: Math.min(96, vw), h: 96 };
  const paw = { x: vw - 16 - pawW, y: 16, w: pawW, h: pawH };
  return { stick, reserve, paw };
}

export function pointInLook(x, y, vw, vh) {
  const { stick, reserve } = chromeLayout(vw, vh);
  const inside = (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  return !inside(stick) && !inside(reserve);
}

export function plateBox(vw, vh) {
  const w = Math.min(300, Math.max(180, vw - 36));
  const aboveStick = vh - 28 - 108 - 24;
  const h = Math.min(460, Math.max(220, aboveStick - 88));
  const x = Math.round((vw - w) / 2);
  const y = Math.max(88, Math.min(aboveStick - h, Math.round((aboveStick - h) * 0.45)));
  return { x, y, w, h };
}

export function cardBox(vw, vh) {
  const w = Math.min(210, Math.max(140, vw - 96 - 28));
  const h = Math.min(156, Math.max(120, Math.round(vh * 0.2)));
  const x = 12;
  const y = 12;
  return { x, y, w, h };
}

/** Pickup card opacity. Fade in, hold, fade out. Total stays inside 2–3 s. */
export function cardOpacity(t, total = 2500) {
  const fadeIn = 200;
  const fadeOut = 700;
  if (t <= 0 || t >= total) return 0;
  if (t < fadeIn) return t / fadeIn;
  if (t > total - fadeOut) return (total - t) / fadeOut;
  return 1;
}
