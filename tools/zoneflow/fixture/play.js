/**
 * Applies zone-flow weights to already-cooked (here: synthetic) plates.
 * Does not draw, shade, or colour a world pixel.
 * Bolt sources stay the lock paths. A missing idle file is left missing.
 */

import { createFlow, BOLT_GALLOP, BOLT_IDLE } from "../../../biome/scripts/zone-flow/zoneFlow.mjs";

const world = await fetch("./world.json").then((r) => r.json());
const zones = {};
for (const [id, path] of Object.entries(world.zones)) {
  const name = path.split("/").pop();
  zones[id] = await fetch("./" + name).then((r) => r.json());
}

const flow = createFlow(world, { zones });
const els = {
  "clearing-a": document.getElementById("plate-clearing-a"),
  "clearing-b": document.getElementById("plate-clearing-b"),
  "path-ab": document.getElementById("plate-path-ab"),
  bolt: document.getElementById("plate-bolt"),
};
const readout = document.getElementById("readout");
let boltSrc = "";
let last = null;
let lastFrame = performance.now();

function setSrc(el, src) {
  if (!src) {
    if (el.tagName === "VIDEO") {
      el.pause();
      el.removeAttribute("src");
      el.load();
    } else {
      el.removeAttribute("src");
    }
    return;
  }
  if (el.tagName === "VIDEO") {
    if (el.getAttribute("src") !== src) {
      el.src = src;
      el.load();
    }
    el.play().catch(() => {});
  } else if (el.getAttribute("src") !== src) {
    el.src = src;
  }
}

function apply(sample) {
  for (const el of Object.values(els)) {
    if (el !== els.bolt) el.style.opacity = "0";
  }
  const media = flow.media();
  for (const [id, info] of Object.entries(media)) {
    const el = els[id];
    if (!el || !info.live || !info.src) continue;
    setSrc(el, info.src.split("/").pop());
  }
  for (const plate of sample.plates) {
    const el = els[plate.id];
    if (!el) continue;
    if (plate.id === "bolt") {
      const src = plate.src === BOLT_IDLE ? "../../../" + BOLT_IDLE : "../../../" + BOLT_GALLOP;
      if (boltSrc !== plate.src) {
        boltSrc = plate.src;
        setSrc(el, src);
      }
      el.playbackRate = 1;
    } else if (el.tagName === "VIDEO" && plate.kind === "corridor") {
      el.playbackRate = plate.playbackRate;
    }
    el.style.opacity = String(plate.opacity);
  }
  for (const id of sample.cleared) {
    const el = els[id];
    if (el) setSrc(el, "");
  }
  last = sample;
  readout.textContent = [
    "TEST FIXTURE — not Imagine",
    sample.mode,
    sample.bolt,
    "rate " + sample.rate.toFixed(2),
    "along " + sample.along.toFixed(1),
  ].join(" · ");
}

const script = [];
script.push({ dt: 0.05, x: 0, z: 0, heading: 0, speed: 0, n: 4 });
script.push({ dt: 0.05, x: 0, z: 11, heading: 0, speed: 4, n: 2 });
script.push({ dt: 0.02, x: 0, z: 17, heading: 0, speed: 4, n: 30 });
script.push({ dt: 0.2, x: 0, z: 17, heading: 0, speed: 0, n: 2 });
script.push({ dt: 0.25, x: 0, z: 17, heading: 0, speed: 4, n: 40 });
script.push({ dt: 0.05, x: 0, z: 0, heading: 0, speed: 0, n: 4 });

let cursor = 0;
let left = 0;
function nextPose(hitchMs) {
  if (left <= 0) {
    if (cursor >= script.length) return null;
    left = script[cursor].n;
    cursor += 1;
  }
  left -= 1;
  return { ...script[cursor - 1], hitchMs, black: false };
}

function tick(now) {
  const hitchMs = Math.min(1000, now - lastFrame);
  lastFrame = now;
  const pose = nextPose(hitchMs);
  if (!pose) {
    window.__zoneDemo = {
      ok: last && last.mode === "zone" && last.zoneId === "clearing-b" && flow.media()["clearing-a"].src === "",
      mode: last && last.mode,
      zoneId: last && last.zoneId,
      unloaded: last && last.unloaded,
      rate: last && last.rate,
    };
    return;
  }
  apply(flow.step(pose));
  requestAnimationFrame(tick);
}

window.__zoneDemo = null;
requestAnimationFrame(tick);
