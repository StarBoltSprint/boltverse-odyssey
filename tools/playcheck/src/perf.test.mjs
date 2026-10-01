import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createJudge } from "./checks.mjs";
import { writeReport } from "./report.mjs";
import { normalizeLayout } from "./layout.mjs";

const layout = normalizeLayout({
  id: "t",
  zone: { center: [0, 0], radius_m: 20 },
  edge_ring: { radius_m: 18, hulls: [{ id: "edge-0", heading_deg: 0, width_deg: 360 }] },
  gates: [{ id: "to-path", heading_deg: 90, width_m: 4 }],
  interior_objects: [],
  fog_band: { patches: 24 },
  view: { mag_max: 1 },
});

const OLD = [
  "webgl_errors",
  "webgl_clean",
  "mag_max",
  "mag",
  "stops_visible",
  "collider_eq_visual",
  "layout_rendered",
  "ring_closed",
  "gate",
  "near_lens",
  "fog_band",
  "black_regions",
  "tile_repeat",
  "backdrop_res",
  "single_hero",
  "single_bolt",
  "idle_gallop_switch",
  "fullscreen",
  "debug_hook",
];

test("existing playcheck rows stay, and perf rows are additive", () => {
  const judge = createJudge(layout);
  judge.add({
    id: "spawn",
    kind: "spawn",
    width: 8,
    height: 8,
    rgba: new Uint8Array(8 * 8 * 4),
    snap: { mag: 0.5, heroCount: 1, canvas: { width: 720, height: 1600 }, nearestVisibleM: 4, objectIds: null },
  });
  const judged = judge.finish({ glErrors: [], consoleErrors: [] });
  const ids = judged.rows.map((r) => r.id);
  for (const id of OLD) assert.ok(ids.includes(id), id);
  for (const id of ["fps_avg", "fps_1low", "frame_ms", "js_heap", "texture_mem", "video_decoders", "draw_calls"]) {
    assert.equal(judged.rows.find((r) => r.id === id).result, "FAIL");
  }
  assert.equal(judged.perf.schema, "playcheck-perf/1");
  assert.equal(judged.perf.budgetApplied, true);
});

test("report.json keeps the previous keys and adds perf", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "playcheck-perf-"));
  try {
    const json = writeReport(dir, {
      url: "http://127.0.0.1/play",
      layoutPath: "/tmp/clearing.json",
      layoutId: "t",
      video: null,
      stills: [],
      steps: [],
      rows: [{ id: "debug_hook", result: "PASS", numbers: { frames: 1 }, detail: "ok", heuristic: false, partial: false }],
      notes: [],
      generatedAt: "2026-10-01T00:00:00.000Z",
      perf: {
        schema: "playcheck-perf/1",
        thresholds: { fpsAvgMin: 30, fps1LowMin: 20, textureBytesMax: 268435456 },
        budgetApplied: true,
        harness: false,
        aggregate: { fpsAvg: 60, samples: 1 },
        samples: [{ step: "01-spawn", fpsAvg: 60 }],
      },
    });
    assert.equal(json.tool, "playcheck");
    assert.ok(json.viewport);
    assert.ok(json.summary);
    assert.equal(json.perf.schema, "playcheck-perf/1");
    const disk = JSON.parse(readFileSync(path.join(dir, "report.json"), "utf8"));
    assert.equal(disk.rows[0].id, "debug_hook");
    assert.equal(disk.perf.aggregate.fpsAvg, 60);
    const md = readFileSync(path.join(dir, "report.md"), "utf8");
    assert.match(md, /playcheck-perf\/1/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
