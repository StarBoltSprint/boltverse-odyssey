import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { lintPlaySource } from "./renderlint.mjs";

const SRC = new URL("../../../packs/zone-a/play/details.js", import.meta.url);

test("detail cards are static instanced draws with mipmaps; only feature rocks collide", () => {
  const src = readFileSync(SRC, "utf8");
  const result = lintPlaySource(src, "details.js");
  assert.equal(result.ok, true, JSON.stringify(result.findings));
  assert.match(src, /drawArraysInstanced/);
  assert.match(src, /STATIC_DRAW/);
  assert.match(src, /LINEAR_MIPMAP_LINEAR/);
  assert.match(src, /generateMipmap/);
  // Micro cards never collide. Feature rocks collide on their measured visible width.
  assert.match(src, /bodyWPx/);
  assert.equal((src.match(/colliders\.push\(/g) || []).length, 1);
  assert.doesNotMatch(src, /camQuad/);
  assert.match(src, /features\.json/);
  assert.match(src, /STATIC_DRAW/);
});
