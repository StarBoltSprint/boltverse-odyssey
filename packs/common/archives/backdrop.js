/**
 * One full-phone backdrop for every menu.
 * Pause, Archives, and any later screen share this film.
 * The still shows until the video is playing, and again if the video fails.
 * Uniform scale only. Never above one device pixel per Imagine pixel.
 */

import { fitPixels } from "./layout.js";

export const HALL_LOOP = "packs/common/archives/art/hall-loop.mp4";

/** Opacity of the paw glow layer. The print itself is not scaled. */
export const PAW_GLOW = { min: 0.22, max: 0.58, periodS: 2.8 };

/**
 * While a menu film is on, world videos pause so the phone stays at four decoders.
 * Bolt is included in that pause: the menu covers the world.
 */
export function menuVideoHold(menuOpen) {
  if (!menuOpen) return { pauseSky: false, pauseGate: false, pauseBolt: false };
  return { pauseSky: true, pauseGate: true, pauseBolt: true };
}

export function decoderCount({ bolt = false, gate = false, skies = 0, menu = false } = {}) {
  return (bolt ? 1 : 0) + (gate ? 1 : 0) + (skies | 0) + (menu ? 1 : 0);
}

/** Placement for one Imagine frame on a phone box. Scale is never above 1. */
export function menuFrame(natW, natH, cssW, cssH, dpr) {
  const fit = fitPixels(natW, natH, cssW, cssH, dpr);
  const fills = fit.cssW + 0.51 >= cssW && fit.cssH + 0.51 >= cssH;
  return {
    mode: fit.mode,
    scale: fit.scale,
    cssW: fit.cssW,
    cssH: fit.cssH,
    left: (cssW - fit.cssW) / 2,
    top: (cssH - fit.cssH) / 2,
    fills,
    enlarged: fit.scale > 1 + 1e-6,
  };
}

const STYLE = `
#archives-backdrop {
  position: fixed; inset: 0; z-index: 7; display: none; overflow: hidden;
  pointer-events: none; background: #000;
}
#archives-backdrop.open { display: block; }
#archives-backdrop img, #archives-backdrop video {
  position: absolute; display: block; max-width: none; max-height: none;
  object-fit: contain;
}
html.archives-cover #view { visibility: hidden; }
`;

function sampleMatte(img) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return null;
  const c = document.createElement("canvas");
  c.width = 2;
  c.height = 2;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return null;
  const spots = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];
  let r = 0;
  let gv = 0;
  let b = 0;
  for (let i = 0; i < spots.length; i++) {
    g.clearRect(0, 0, 2, 2);
    g.drawImage(img, spots[i][0], spots[i][1], 1, 1, 0, 0, 1, 1);
    const p = g.getImageData(0, 0, 1, 1).data;
    r += p[0];
    gv += p[1];
    b += p[2];
  }
  return "rgb(" + Math.round(r / 4) + "," + Math.round(gv / 4) + "," + Math.round(b / 4) + ")";
}

export function mountMenuBackdrop(doc, { stillSrc, videoSrc }) {
  if (!doc.getElementById("archives-backdrop-style")) {
    const style = doc.createElement("style");
    style.id = "archives-backdrop-style";
    style.textContent = STYLE;
    doc.head.appendChild(style);
  }
  const root = doc.createElement("div");
  root.id = "archives-backdrop";
  const still = doc.createElement("img");
  still.alt = "";
  still.src = stillSrc;
  const video = doc.createElement("video");
  video.id = "archives-backdrop-video";
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.preload = "none";
  video.poster = stillSrc;
  root.append(still, video);

  let armed = false;
  let open = false;
  let box = { w: 360, h: 800, dpr: 1 };

  function dpr() {
    return box.dpr;
  }

  function place(el, natW, natH) {
    if (!natW || !natH) return;
    const frame = menuFrame(natW, natH, box.w, box.h, dpr());
    el.style.left = frame.left + "px";
    el.style.top = frame.top + "px";
    el.style.width = frame.cssW + "px";
    el.style.height = frame.cssH + "px";
  }

  function layout() {
    place(still, still.naturalWidth, still.naturalHeight);
    const vw = video.videoWidth || still.naturalWidth;
    const vh = video.videoHeight || still.naturalHeight;
    place(video, vw, vh);
  }

  function showStill(on) {
    still.style.visibility = on ? "visible" : "hidden";
    video.style.visibility = on ? "hidden" : "visible";
  }

  function syncPicture() {
    const live = open && video.readyState >= 2 && !video.paused && !video.error;
    showStill(!live);
  }

  function arm() {
    if (armed) return;
    armed = true;
    video.preload = "auto";
    video.src = videoSrc;
  }

  function setOpen(on) {
    open = !!on;
    root.classList.toggle("open", open);
    doc.documentElement.classList.toggle("archives-cover", open);
    if (open) {
      arm();
      layout();
      const play = video.play();
      if (play && play.catch) play.catch(() => { showStill(true); });
    } else if (!video.paused) {
      video.pause();
    }
    syncPicture();
  }

  still.addEventListener("load", () => {
    layout();
    try {
      const matte = sampleMatte(still);
      if (matte) root.style.background = matte;
    } catch (e) { /* keep the page black if the still cannot be read */ }
  });
  video.addEventListener("loadedmetadata", layout);
  video.addEventListener("playing", syncPicture);
  video.addEventListener("pause", syncPicture);
  video.addEventListener("error", () => showStill(true));

  return {
    el: root,
    setOpen,
    layout(w, h, deviceRatio) {
      box = { w, h, dpr: deviceRatio };
      layout();
    },
    videoOn() {
      return !!(open && video.readyState >= 2 && !video.paused && !video.error);
    },
  };
}
