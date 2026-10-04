import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { lintPlaySource } from "./renderlint.mjs";

const SRC = new URL("../../../packs/zone-a/play/details.js", import.meta.url);

test("detail cards are one static instanced draw with mipmaps and no collider", () => {
  const src = readFileSync(SRC, "utf8");
  const result = lintPlaySource(src, "details.js");
  assert.equal(result.ok, true, JSON.stringify(result.findings));
  assert.match(src, /drawArraysInstanced/);
  assert.match(src, /STATIC_DRAW/);
  assert.match(src, /LINEAR_MIPMAP_LINEAR/);
  assert.match(src, /generateMipmap/);
  assert.doesNotMatch(src, /collider/);
  assert.doesNotMatch(src, /camQuad/);
});
