#!/usr/bin/env node
/**
 * Phone counter thresholds. No browser, no pixels.
 *   node tools/perf/selftest.mjs
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PHONE, createPerfMonitor, fpsFromIntervals, judgePerf } from "./stats.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

test("1% low uses the slowest one percent", () => {
  const ms = new Array(100).fill(16.667);
  ms[50] = 50;
  const fps = fpsFromIntervals(ms);
  assert.ok(fps.fpsAvg > 50);
  assert.ok(Math.abs(fps.fps1Low - 20) < 0.05);
});

test("a steady 60 FPS window clears the phone floor", () => {
  const mon = createPerfMonitor();
  for (let i = 0; i < 120; i++) mon.noteFrame({ dtMs: 1000 / 60, workMs: 4 });
  mon.noteDraw(40);
  mon.noteTexture("ground", 8 * 1024 * 1024);
  mon.noteVideo("gallop");
  mon.noteHeap(64 * 1024 * 1024);
  const snap = mon.snapshot();
  assert.ok(snap.fpsAvg >= PHONE.fpsAvgMin);
  assert.ok(snap.fps1Low >= PHONE.fps1LowMin);
  assert.equal(snap.drawCalls, 40);
  assert.equal(snap.videoDecoders, 1);
  assert.equal(snap.scripted, true);
  const judged = judgePerf([{ id: "spawn", snap: { perf: snap } }]);
  for (const row of judged.rows) assert.equal(row.result, "PASS", row.id);
  assert.equal(judged.report.budgetApplied, true);
  assert.equal(judged.report.schema, "playcheck-perf/1");
});

test("a slow present interval and a large texture fail", () => {
  const mon = createPerfMonitor();
  for (let i = 0; i < 30; i++) mon.noteFrame({ dtMs: 80 });
  mon.noteDraw(400);
  mon.noteTexture("ring", PHONE.textureBytesMax + 1);
  mon.noteHeap(PHONE.heapBytesMax + 1);
  for (let i = 0; i < 8; i++) mon.noteVideo("v" + i);
  const snap = mon.snapshot();
  const judged = judgePerf([{ id: "spawn", snap: { perf: snap } }]);
  const byId = Object.fromEntries(judged.rows.map((r) => [r.id, r.result]));
  assert.equal(byId.fps_avg, "FAIL");
  assert.equal(byId.fps_1low, "FAIL");
  assert.equal(byId.frame_ms, "FAIL");
  assert.equal(byId.texture_mem, "FAIL");
  assert.equal(byId.draw_calls, "FAIL");
  assert.equal(byId.video_decoders, "FAIL");
  assert.equal(byId.js_heap, "FAIL");
});

test("missing perf on a real play view is FAIL", () => {
  const judged = judgePerf([{ id: "spawn", snap: { harness: false } }]);
  assert.ok(judged.rows.every((r) => r.result === "FAIL"));
  assert.equal(judged.report.budgetApplied, true);
});

test("the measurement fixture records numbers and does not apply the budget", () => {
  const judged = judgePerf([
    {
      id: "spawn",
      snap: {
        harness: true,
        perf: { fpsAvg: 8, fps1Low: 4, frameMsAvg: 80, textureBytes: 9e9, drawCalls: 900, videoDecoders: 20, heapBytes: 9e9 },
      },
    },
  ]);
  assert.ok(judged.rows.every((r) => r.result === "PASS"));
  assert.equal(judged.report.budgetApplied, false);
  assert.equal(judged.report.aggregate.drawCalls, 900);
});

test("swiftshader frame time is informational and does not fail the take", () => {
  const judged = judgePerf(
    [
      {
        id: "spawn",
        snap: {
          perf: {
            fpsAvg: 8,
            fps1Low: 4,
            frameMsAvg: 80,
            frameMs: 80,
            textureBytes: 1024,
            drawCalls: 10,
            videoDecoders: 1,
            heapBytes: 1024,
          },
        },
      },
    ],
    { softwareGl: true },
  );
  const byId = Object.fromEntries(judged.rows.map((r) => [r.id, r]));
  assert.equal(byId.fps_avg.result, "PASS");
  assert.equal(byId.fps_1low.result, "PASS");
  assert.equal(byId.frame_ms.result, "PASS");
  assert.equal(byId.fps_avg.partial, true);
  assert.equal(byId.active_videos.result, "PASS");
  assert.match(byId.perf_line.numbers.perfLine, /drawCalls=10, texMB=0\.001, activeVideos=1, jsMs=80/);
  assert.equal(judged.report.perfLine, byId.perf_line.numbers.perfLine);
});

test("overlay stays off unless perf=1 and does not cover controls", () => {
  const src = readFileSync(path.join(here, "overlay.js"), "utf8");
  assert.match(src, /params\.get\("perf"\) !== "1"/);
  assert.match(src, /pointer-events:none/);
  assert.match(src, /background:transparent/);
  assert.match(src, /top:8px/);
  assert.match(src, /right:8px/);
  assert.match(src, /max-height:22vh/);
  assert.doesNotMatch(src, /bottom:\s*\d+px/);
  assert.match(src, /fps avg >= 30/);
  assert.match(src, /1% low >= 20/);
  assert.match(src, /256 MiB/);
  assert.match(src, /window\.__perf = api/);
});
