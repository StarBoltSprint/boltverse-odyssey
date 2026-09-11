/**
 * HOLD: the picture is not running → the coyote judge sleeps.
 * Still stays. No spinner. Resume = reread currentTime, never a 2s wall-clock tap.
 * Laws: PLAY.md · ENGINE.md
 *
 * Reasons (any one → isHeld):
 *   pause | hidden | stall | play-fail | swap | cook | seek | ended-wait
 * cook must not happen on a tap. If it does, HOLD + decay, not Imagine on the 9:16.
 */

export const REASONS = [
  "pause",
  "hidden",
  "stall",
  "play-fail",
  "swap",
  "cook",
  "seek",
  "ended-wait",
];

export function makeHold(init = {}) {
  const flags = Object.fromEntries(REASONS.map((r) => [r, !!init[r]]));
  const set = (reason, on) => {
    if (!REASONS.includes(reason)) return isHeld();
    flags[reason] = !!on;
    return isHeld();
  };
  const isHeld = () => REASONS.some((r) => flags[r]);
  const why = () => REASONS.filter((r) => flags[r]);
  return {
    set,
    isHeld,
    why,
    flags,
    beginSwap: () => set("swap", true),
    endSwapIfPlaying: (vid) => {
      if (vid && vid.paused === false) set("swap", false);
      return isHeld();
    },
    setPlayFail: (on) => set("play-fail", on),
    setEndedWait: (on) => set("ended-wait", on),
    setCook: (on) => set("cook", on),
  };
}

/** One finger in the queue. Flush on resume at the *current* currentTime. */
export function makeTapGate() {
  let queued = null;
  return {
    input(tap) {
      if (tap) queued = tap;
      return queued;
    },
    flush() {
      const t = queued;
      queued = null;
      return t;
    },
    peek() {
      return queued;
    },
  };
}

/**
 * Wire a <video>. onTime fires only when !held.
 * onHold(held, why[]) — mute diegetic when held; bus 2 grade only if !held.
 */
export function attachHold(video, { onHold, onTime, doc } = {}) {
  const hold = makeHold();
  const gate = makeTapGate();
  const documentRef = doc || (typeof document !== "undefined" ? document : null);
  let last = false;

  const emitHold = () => {
    const h = hold.isHeld();
    if (h !== last) {
      last = h;
      onHold?.(h, hold.why());
    }
    return h;
  };

  const onTimeupdate = () => {
    if (hold.isHeld()) return;
    onTime?.(video.currentTime, gate.flush());
  };

  if (video && typeof video.addEventListener === "function") {
    video.addEventListener("pause", () => {
      if (!hold.flags.swap && !hold.flags["ended-wait"]) hold.set("pause", true);
      emitHold();
    });
    video.addEventListener("play", () => {
      hold.set("pause", false);
      hold.set("play-fail", false);
      hold.set("stall", false);
      emitHold();
    });
    video.addEventListener("waiting", () => {
      hold.set("stall", true);
      emitHold();
    });
    video.addEventListener("stalled", () => {
      hold.set("stall", true);
      emitHold();
    });
    video.addEventListener("playing", () => {
      hold.set("stall", false);
      emitHold();
    });
    video.addEventListener("seeking", () => {
      hold.set("seek", true);
      emitHold();
    });
    video.addEventListener("seeked", () => {
      hold.set("seek", false);
      emitHold();
    });
    video.addEventListener("timeupdate", onTimeupdate);
  }

  if (documentRef && documentRef.addEventListener) {
    const vis = () => {
      hold.set("hidden", documentRef.hidden === true || documentRef.visibilityState === "hidden");
      emitHold();
    };
    documentRef.addEventListener("visibilitychange", vis);
    vis();
  }

  emitHold();

  return {
    hold,
    gate,
    isHeld: () => hold.isHeld(),
    why: () => hold.why(),
    beginSwap: () => {
      hold.beginSwap();
      emitHold();
    },
    endSwapIfPlaying: (hid) => {
      hold.endSwapIfPlaying(hid);
      emitHold();
    },
    setPlayFail: (on) => {
      hold.setPlayFail(on);
      emitHold();
    },
    setEndedWait: (on) => {
      hold.setEndedWait(on);
      emitHold();
    },
    /** Resume: flush one queued tap against *this* currentTime. */
    resumeTap: () => {
      if (hold.isHeld()) return null;
      const tap = gate.flush();
      onTime?.(video ? video.currentTime : 0, tap);
      return tap;
    },
  };
}
