/**
 * Face colliders for Zone B hard parts. No browser.
 * The plaza arch stays open. Stone beside it blocks.
 * The Anchor mouth is blocked by opaque loft faces in the body band.
 * A free cell inside the footprint shows the field is not a solid box.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildFaceSolids } from "./hard.js";

const BODY_R = 0.3;
const loft = JSON.parse(readFileSync(new URL("../src/hard/loft.json", import.meta.url), "utf8"));
const raw = readFileSync(new URL("../src/hard/mesh.bin", import.meta.url));
const ab = new ArrayBuffer(raw.length);
new Uint8Array(ab).set(raw);
const view = new DataView(ab);
assert.equal(view.getUint32(0, true), 0x3148534d);
const nv = view.getUint32(4, true);
const ni = view.getUint32(8, true);
const srcV = new Float32Array(ab, 12, nv * 5);
const srcI = new Uint32Array(ab, 12 + nv * 5 * 4, ni);

function seatOf(p) {
  const g = 0.4;
  return g - (p.sink || 0) + (p.lift || 0);
}

const t0 = performance.now();
const cols = buildFaceSolids(loft, srcV, srcI, seatOf);
const buildMs = performance.now() - t0;

function clearance(x, z, part) {
  let best = 99;
  for (let i = 0; i < cols.length; i++) {
    if (part && cols[i].part !== part) continue;
    const col = cols[i].col;
    if (!col.near(x, z, 4)) continue;
    const d = col.sd(x, z);
    if (d < best) best = d;
  }
  return best;
}

function slide(x, z) {
  let cx = x;
  let cz = z;
  for (let iter = 0; iter < 4; iter++) {
    let moved = false;
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i].col;
      if (!col.near(cx, cz, BODY_R)) continue;
      const d = col.sd(cx, cz);
      if (d >= BODY_R) continue;
      const g = col.grad(cx, cz);
      if (g[0] === 0 && g[1] === 0) continue;
      cx += g[0] * (BODY_R - d);
      cz += g[1] * (BODY_R - d);
      moved = true;
    }
    if (!moved) break;
  }
  return [cx, cz];
}

const zArch = loft.arch.z;
const open = clearance(0, zArch);
const leg = cols.find((c) => c.name === "arch-leg");
const pier = clearance(leg.x, leg.z);
assert.ok(open > BODY_R, `plaza arch opening blocked sd=${open.toFixed(3)}`);
assert.ok(pier < BODY_R, `plaza arch leg is not solid sd=${pier.toFixed(3)}`);

let x = 0;
let z = 48;
for (let i = 0; i < 80; i++) {
  const next = slide(x, z + 0.4);
  x = next[0];
  z = next[1];
}
assert.ok(Math.abs(x) < 1.2, `north road shoved off the opening x=${x.toFixed(2)}`);
assert.ok(z > zArch + 4, `did not pass the plaza arch z=${z.toFixed(2)}`);

const zAnchor = loft.anchor.z;
const mouth = clearance(0, zAnchor, "anchor");
assert.ok(mouth < 0, `Anchor mouth should follow the bridged loft sd=${mouth.toFixed(3)}`);
let pierHit = false;
let pierSd = 99;
let gap = false;
let gapSd = -99;
for (let px = -18; px <= 18; px += 0.5) {
  const d = clearance(px, zAnchor, "anchor");
  if (d < pierSd) pierSd = d;
  if (d < BODY_R) pierHit = true;
  if (d > gapSd) gapSd = d;
  if (d > 0) gap = true;
}
assert.ok(pierHit, `Anchor piers have no body-band wall minSd=${pierSd.toFixed(3)}`);
assert.ok(gap, `Anchor field is a solid box maxSd=${gapSd.toFixed(3)}`);

const anchor = cols.find((c) => c.part === "anchor");
assert.ok(anchor.col.wallCells > 0, "Anchor face field is empty");
assert.equal(anchor.col.sealed, 0, "Anchor opening was sealed by the hollow fill");

const play = readFileSync(new URL("./play.js", import.meta.url), "utf8");
assert.match(play, /const SHOW_HUD = \/\[\?&\]debug=1\(&\|\$\)\/\.test\(location\.search\)/);
assert.match(play, /if \(!SHOW_HUD\)/);
assert.doesNotMatch(play, /URLSearchParams\(location\.search\)\.has\("debug"\)/);
assert.match(play, /planetVideo\.loop = true/);
assert.match(play, /const spinning = uploadPlanet\(\)/);
assert.match(play, /const tex = spinning \? planetTex : p\.tex/);
assert.doesNotMatch(play, /makeStill\(img, "planet"\)[\s\S]{0,400}planetVideo/);

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
assert.match(html, /#hud\s*\{[^}]*display:\s*none/s);

const terrain = readFileSync(new URL("./terrain.js", import.meta.url), "utf8");
assert.match(terrain, /const bloomOn = 0/);
assert.match(terrain, /return 1/);

console.log(JSON.stringify({
  buildMs: Math.round(buildMs),
  parts: cols.length,
  archOpenM: Number(open.toFixed(3)),
  archPierM: Number(pier.toFixed(3)),
  passedZ: Number(z.toFixed(2)),
  passedX: Number(x.toFixed(2)),
  anchorMouthM: Number(mouth.toFixed(3)),
  anchorPierM: Number(pierSd.toFixed(3)),
  anchorGapM: Number(gapSd.toFixed(3)),
  anchorWalls: anchor.col.wallCells,
  anchorSealed: anchor.col.sealed,
}, null, 2));
