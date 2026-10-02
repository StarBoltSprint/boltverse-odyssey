import assert from "node:assert/strict";
import test from "node:test";
import { lintPlaySource } from "./renderlint.mjs";

const TAKE10C = `
gl.bindTexture(gl.TEXTURE_2D, idTex);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
${"gl.bindTexture(gl.TEXTURE_2D, keep);\n".repeat(30)}function makeTex(img) {
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
}
function uploadVideo(v) {
  gl.bindTexture(gl.TEXTURE_2D, boltTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
}
function drawBatches() {
  for (const b of batches.values()) {
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(b.buf), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, b.buf.length / 5);
  }
}
function buildScene() {
  camQuad(buf, eye, right, up, ox, dim.y0, oz, dim.worldH, dim.worldW);
  camQuad(buf, eye, right, up, state.x, y0, state.z, worldH, worldW); // hero bolt
}
`;

test("take10c patterns fail and the id buffer is not a world texture", () => {
  const result = lintPlaySource(TAKE10C, "play.js");
  const rules = result.findings.map((f) => f.rule);
  assert.equal(result.ok, false);
  assert.ok(rules.includes("nearest_world"));
  assert.ok(rules.includes("buffer_rebuild"));
  assert.ok(rules.includes("instance_draws"));
  assert.ok(rules.includes("cam_quad"));
  const nearestLines = result.findings.filter((f) => f.rule === "nearest_world").map((f) => f.line);
  assert.ok(!nearestLines.includes(3) && !nearestLines.includes(4));
});

test("instanced static upload with mipmaps passes", () => {
  const src = `
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.bufferData(gl.ARRAY_BUFFER, groundVerts, gl.STATIC_DRAW);
  function draw() {
    for (let i = 0; i < batches; i++) {
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  `;
  assert.equal(lintPlaySource(src).ok, true);
});

test("a comment that names NEAREST is not a finding", () => {
  const src = `// TEXTURE_MIN_FILTER, gl.NEAREST is the counter-example\ngl.drawArrays(gl.TRIANGLES, 0, 3);\n`;
  assert.equal(lintPlaySource(src).ok, true);
});
