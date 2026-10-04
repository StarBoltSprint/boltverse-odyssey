import assert from "node:assert/strict";
import test from "node:test";
import { createJudge } from "./checks.mjs";
import { normalizeLayout } from "./layout.mjs";
import { footContact, hotspotFixes, stairCrown, untexturedSurfaces } from "./frames.mjs";

const layout = normalizeLayout({
  id: "t",
  zone: { center: [0, 0], radius_m: 20 },
  edge_ring: { radius_m: 18, hulls: [{ id: "edge-0", heading_deg: 0, width_deg: 360 }] },
  gates: [{ id: "to-path", heading_deg: 90, width_m: 4 }],
  interior_objects: [],
  near_lens: { cull_m: 1.2 },
  fog_band: { patches: 32 },
  view: { mag_max: 1 },
  backdrop: { ring: "backdrop/ring.png" },
});

function fill(rgba, w, x, y, bw, bh, rgb) {
  for (let row = y; row < y + bh; row++) {
    for (let col = x; col < x + bw; col++) {
      const i = (row * w + col) * 4;
      rgba[i] = rgb[0];
      rgba[i + 1] = rgb[1];
      rgba[i + 2] = rgb[2];
      rgba[i + 3] = 255;
    }
  }
}

function noise(rgba, w, x, y, bw, bh, lo, hi, salt) {
  for (let row = y; row < y + bh; row++) {
    for (let col = x; col < x + bw; col++) {
      const n = (row * 17 + col * 31 + salt) % (hi - lo);
      const i = (row * w + col) * 4;
      rgba[i] = lo + n;
      rgba[i + 1] = lo + ((n * 3) % (hi - lo));
      rgba[i + 2] = lo + ((n * 5) % (hi - lo));
      rgba[i + 3] = 255;
    }
  }
}

test("a floating foot fails and a small frame is skipped", () => {
  const w = 120;
  const h = 160;
  const rgba = new Uint8Array(w * h * 4);
  fill(rgba, w, 0, 0, w, h, [190, 200, 210]);
  noise(rgba, w, 0, 120, w, 40, 20, 100, 3);
  noise(rgba, w, 30, 30, 50, 58, 5, 90, 9);
  const gap = footContact(rgba, w, h);
  assert.ok(gap.hits.length >= 1, JSON.stringify(gap));
  const tiny = footContact(new Uint8Array(8 * 8 * 4), 8, 8);
  assert.equal(tiny.skipped, "small");
});

test("jagged black fails and a night-sky band does not", () => {
  const w = 160;
  const h = 120;
  const rgba = new Uint8Array(w * h * 4);
  noise(rgba, w, 0, 0, w, h, 40, 180, 1);
  fill(rgba, w, 20, 30, 80, 50, [0, 0, 0]);
  const black = untexturedSurfaces(rgba, w, h);
  assert.ok(black.hits.some((hit) => hit.kind === "black"), JSON.stringify(black.hits));

  const night = new Uint8Array(w * h * 4);
  noise(night, w, 0, 0, w, h, 40, 180, 2);
  fill(night, w, 0, 0, w, 50, [8, 10, 14]);
  const sky = untexturedSurfaces(night, w, h);
  assert.equal(sky.hits.length, 0, JSON.stringify(sky));
});

test("a stair crown fails and a smooth diagonal does not", () => {
  const w = 160;
  const h = 120;
  const rgba = new Uint8Array(w * h * 4);
  fill(rgba, w, 0, 0, w, h, [210, 215, 220]);
  for (let x = 20; x < 140; x++) {
    const step = 28 + Math.floor((x - 20) / 8) * 5;
    fill(rgba, w, x, step, 1, h - step, [40, 36, 30]);
  }
  const stair = stairCrown(rgba, w, h);
  assert.equal(stair.stair, true, JSON.stringify(stair));

  const smooth = new Uint8Array(w * h * 4);
  fill(smooth, w, 0, 0, w, h, [210, 215, 220]);
  for (let x = 0; x < w; x++) {
    const edge = 20 + x;
    if (edge < h) fill(smooth, w, x, edge, 1, h - edge, [40, 36, 30]);
  }
  const ramp = stairCrown(smooth, w, h);
  assert.equal(ramp.stair, false, JSON.stringify(ramp));
});

test("magnification hotspots name the three fixes and fail the row", () => {
  const fixes = hotspotFixes(26, 0.99, 1, 70, 1);
  const text = fixes.join(" ");
  assert.match(text, /move the camera out to/);
  assert.match(text, /set scale to/);
  assert.match(text, /recook the skin/);
  assert.match(text, /do not enlarge/);

  const judge = createJudge(layout);
  judge.add({
    id: "stop-gate",
    kind: "gate",
    width: 8,
    height: 8,
    rgba: new Uint8Array(8 * 8 * 4),
    snap: {
      mag: 3.668,
      magHits: [{ id: "ship-hero", mag: 3.668, stop: "stop-gate", dist_m: 4.2, scale: 1, texelsPerM: 70 }],
      heroCount: 1,
      heroVisible: 0.9,
      state: "IDLE",
      spd: 0,
      canvas: { width: 720, height: 1600 },
      nearestVisibleM: 4.2,
      objectIds: { width: 8, height: 8, labels: [""], b64: Buffer.from(new Uint16Array(64).buffer).toString("base64") },
    },
  });
  const { rows } = judge.finish({ glErrors: [], consoleErrors: [] });
  const hot = rows.find((r) => r.id === "mag_hotspots");
  const hint = rows.find((r) => r.id === "fix_hint");
  assert.equal(hot.result, "FAIL");
  assert.match(hot.detail, /ship-hero/);
  assert.match(hot.detail, /move the camera out to/);
  assert.match(hot.detail, /set scale to/);
  assert.match(hot.detail, /recook the skin/);
  assert.equal(hint.result, "PASS");
  assert.equal(hint.numbers.object, "ship-hero");
  const foot = rows.find((r) => r.id === "foot_contact");
  assert.equal(foot.result, "PASS");
});
