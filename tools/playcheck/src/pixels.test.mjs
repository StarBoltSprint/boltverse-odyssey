import assert from "node:assert/strict";
import test from "node:test";
import { autocorrPeak, blackRectangles, colorVisible, floorRepeat } from "./pixels.mjs";

function fill(w, h, fn) {
  const rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x, y);
      const i = (y * w + x) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

test("flat black rectangle is a hit, a top night band is not", () => {
  const w = 160;
  const h = 320;
  const rgba = fill(w, h, (x, y) => {
    if (y < 80) return [8, 10, 18];
    if (x > 40 && x < 120 && y > 120 && y < 200) return [0, 0, 0];
    return [40 + (x % 7) * 8, 50 + (y % 5) * 6, 30];
  });
  const found = blackRectangles(rgba, w, h, { block: 8, minAreaFrac: 0.01 });
  assert.ok(found.skyIgnored >= 1);
  assert.ok(found.hits.length >= 1);
  assert.ok(found.hits[0].y > 80);
});

test("checker repeats and noise does not", () => {
  const w = 200;
  const h = 80;
  const checker = fill(w, h, (x) => ((Math.floor(x / 8) % 2) ? [230, 230, 230] : [12, 12, 12]));
  const hit = floorRepeat(checker, w, h, { y0: 0.1, y1: 0.9 });
  assert.equal(hit.periodic, true);
  const noise = fill(w, h, (x, y) => {
    let n = (x * 374761393 + y * 668265263) >>> 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
    const r = n & 255;
    const g = (n >>> 8) & 255;
    const b = (n >>> 16) & 255;
    return [r, g, b];
  });
  const miss = floorRepeat(noise, w, h, { y0: 0.1, y1: 0.9 });
  assert.equal(miss.periodic, false);
});

test("a flat object is visible when unlabeled ground is a different colour", () => {
  const w = 80;
  const h = 80;
  const rgba = fill(w, h, (x, y) => (x < 40 ? [190, 60, 40] : [70, 80, 60]));
  const data = new Uint16Array(w * h);
  for (let y = 40; y < h; y++) {
    for (let x = 0; x < 40; x++) data[y * w + x] = 1;
  }
  const ids = { width: w, height: h, data, labels: ["", "rock"] };
  const hit = colorVisible(rgba, w, h, ids, "rock");
  assert.equal(hit.visible, true);
  const same = colorVisible(fill(w, h, () => [70, 80, 60]), w, h, ids, "rock");
  assert.equal(same.visible, false);
});

test("a smooth ramp is not tile repetition", () => {
  const sig = Array.from({ length: 80 }, (_, i) => i);
  const stat = autocorrPeak(sig);
  assert.equal(stat.periodic, false);
});

test("a wide checker is repetition even when neighbours mostly match", () => {
  const sig = Array.from({ length: 200 }, (_, i) => (Math.floor(i / 20) % 2 ? 220 : 20));
  const stat = autocorrPeak(sig);
  assert.equal(stat.periodic, true);
  assert.ok(stat.mad < 12);
});
