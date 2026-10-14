import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { faceStretch } from "../../common/archives/solid.js";
import { HILL_H, HILL_PART, hillRepeat } from "./hills.js";

const root = new URL("../src/", import.meta.url);
const lofts = JSON.parse(readFileSync(new URL("solids/lofts.json", root), "utf8"));
const features = JSON.parse(readFileSync(new URL("details/features.json", root), "utf8"));
const micros = JSON.parse(readFileSync(new URL("details/manifest.json", root), "utf8"));

function pngSize(url) {
  const b = readFileSync(url);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function variantPlate(list, type) {
  const v = (list || []).find((row) => row.type === type);
  if (!v) return null;
  return {
    plateW: v.rectW || v.contentW || v.contentH,
    plateH: v.rectH || v.contentH,
    contentH: v.contentH,
  };
}

test("every loft face stays at stretch ≤ 1.02", () => {
  const feat = {};
  for (const v of features.variants || []) {
    if (!feat[v.type]) feat[v.type] = variantPlate(features.variants, v.type);
  }
  const micro = {};
  for (const v of micros.variants || []) {
    const key = v.type + ":" + (micro[v.type] ? micro[v.type].n : 0);
    if (!micro[v.type]) micro[v.type] = { n: 0 };
    micro[key] = variantPlate([v], v.type);
    micro[v.type].n += 1;
  }
  const crystalImg = pngSize(new URL("solids/crystal-skin.png", root));
  const rows = [];
  for (const name of Object.keys(lofts.parts)) {
    const part = lofts.parts[name];
    let plateW = part.contentH;
    let plateH = part.contentH;
    if (name === "crystal") {
      const side = part.rects.side;
      plateW = (side[2] - side[0]) * crystalImg.w;
      plateH = (side[3] - side[1]) * crystalImg.h;
    } else if (feat[name]) {
      plateW = feat[name].plateW;
      plateH = feat[name].plateH;
    } else if (micro[name]) {
      plateW = micro[name].plateW;
      plateH = micro[name].plateH;
    }
    const item = {
      part,
      x: 0,
      y: 0,
      z: 0,
      yaw: 0.4,
      worldH: 1.2,
      contentH: part.contentH || plateH,
      plateW,
      plateH,
      side: name === "crystal" ? part.rects.side : [0, 0, 1, 1],
      slot: 0,
    };
    const stretch = faceStretch(item);
    const verts = item.faceStretch === stretch ? 0 : 0;
    rows.push({ name, stretch, plateW, plateH, verts });
    assert.ok(stretch <= 1.02, name + " stretch " + stretch.toFixed(3));
  }
  const crest = feat.crest;
  const repeats = hillRepeat(1793.48, crest.plateH, HILL_H);
  const hill = faceStretch({
    part: HILL_PART,
    x: 0, y: 0, z: 0, yaw: 1,
    worldH: HILL_H,
    contentH: crest.contentH,
    plateW: crest.plateW,
    plateH: crest.plateH,
    vTiles: repeats,
    side: [0, 0, 1, 1],
  });
  assert.ok(hill <= 1.02, "hill stretch " + hill.toFixed(3) + " N=" + repeats);
  assert.ok(rows.length >= 12);
});
