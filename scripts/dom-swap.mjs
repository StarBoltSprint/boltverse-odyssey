/**
 * DOM swap. Chains plates. Does not grade cues.
 * Laws: ENGINE.md · PLAY.md (three machines).
 * Finger during swap = video-hold tap gate, not this file.
 *
 * joinEnded order (anti-clone):
 *   1 still.src arrive + opacity 1
 *   2 vis opacity 0 + pause
 *   3 kick hid: mute, playsInline, rate 1, play()
 *   4 swap only if paused === false
 *   5 gen++ so a stale ended is ignored
 *
 * Fades: sprint join 0 · hall walk tap 280 optional · veil = hall Enter only.
 */

export const DISSOLVE_MS = 280;
export const CURTAIN_MS = 500;

function setOp(el, op, ms = 0) {
  if (!el || !el.style) return;
  el.style.transition = ms ? `opacity ${ms}ms linear` : "none";
  el.style.opacity = String(op);
}

function armEnded(el, gen, getGen, fn) {
  if (!el) return;
  el.onended = () => {
    if (gen !== getGen()) return;
    fn?.();
  };
}

export function bootDom({ still, videoA, videoB, veil } = {}) {
  let vis = videoA;
  let hid = videoB;
  let gen = 0;
  const getGen = () => gen;

  function failSafe() {
    if (still) {
      still.style.transition = "none";
      still.style.opacity = "1";
    }
    for (const v of [videoA, videoB]) {
      if (!v) continue;
      setOp(v, 0, 0);
      try {
        v.pause();
      } catch {
        /* */
      }
    }
    if (veil) setOp(veil, 0, 0);
    return { ok: false, fail: true, gen };
  }

  async function paintStill(src) {
    if (!still || !src) return;
    if (still.src !== src && !String(still.src).endsWith(src)) still.src = src;
    still.style.transition = "none";
    still.style.opacity = "1";
    if (still.decode) {
      try {
        await still.decode();
      } catch {
        /* still may already be complete */
      }
    }
  }

  async function kick({
    src,
    still: stillSrc,
    loop = false,
    fadeMs = 0,
    hold,
    onEnded,
    hideStill = false,
  } = {}) {
    const myGen = ++gen;
    hold?.beginSwap?.();
    if (hideStill && still) setOp(still, 0, 0);
    else if (stillSrc) await paintStill(stillSrc);

    if (!hid) {
      hold?.setPlayFail?.(true);
      return failSafe();
    }

    hid.muted = true;
    hid.defaultMuted = true;
    hid.playsInline = true;
    hid.loop = !!loop;
    hid.playbackRate = 1;
    hid.src = src;
    try {
      hid.currentTime = 0;
    } catch {
      /* */
    }

    try {
      await hid.play();
    } catch {
      if (myGen !== gen) return { ok: false, stale: true, gen: myGen };
      hold?.setPlayFail?.(true);
      return failSafe();
    }
    if (myGen !== gen) return { ok: false, stale: true, gen: myGen };
    if (hid.paused !== false) {
      hold?.setPlayFail?.(true);
      return failSafe();
    }

    setOp(hid, 1, fadeMs);
    setOp(vis, 0, fadeMs);
    try {
      vis?.pause?.();
    } catch {
      /* */
    }
    const out = vis;
    vis = hid;
    hid = out;
    hold?.endSwapIfPlaying?.(vis);
    armEnded(vis, myGen, getGen, onEnded);
    return { ok: true, gen: myGen };
  }

  async function joinEnded({ src, still: stillSrc, loop = false, hold, onEnded } = {}) {
    if (!src) return failSafe();
    await paintStill(stillSrc);
    setOp(vis, 0, 0);
    try {
      vis?.pause?.();
    } catch {
      /* */
    }
    return kick({ src, still: stillSrc, loop, fadeMs: 0, hold, onEnded });
  }

  /** Hall Enter only. Double rAF. Never on a Lane join. */
  function liftVeil({ emptySrc, ms = CURTAIN_MS } = {}) {
    if (!veil) return;
    if (emptySrc) veil.src = emptySrc;
    veil.style.transition = "none";
    veil.style.opacity = "1";
    const raf =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : (fn) => setTimeout(fn, 16);
    raf(() => {
      raf(() => {
        veil.style.transition = `opacity ${ms}ms linear`;
        veil.style.opacity = "0";
      });
    });
  }

  return {
    kick,
    joinEnded,
    failSafe,
    liftVeil,
    paintStill,
    gen: getGen,
    vis: () => vis,
    hid: () => hid,
  };
}
