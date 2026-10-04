import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ORDER = [
  "webgl_errors",
  "webgl_clean",
  "mag_max",
  "mag",
  "fix_hint",
  "stops_visible",
  "collider_eq_visual",
  "solids_world_locked",
  "layout_rendered",
  "ring_closed",
  "gate",
  "near_lens",
  "fog_band",
  "black_regions",
  "foot_contact",
  "untextured",
  "mag_hotspots",
  "stair_crown",
  "tile_repeat",
  "backdrop_res",
  "single_hero",
  "single_bolt",
  "idle_gallop_switch",
  "fullscreen",
  "debug_hook",
  "transition_black",
  "transition_hitch",
  "fps_avg",
  "fps_1low",
  "frame_ms",
  "js_heap",
  "texture_mem",
  "video_decoders",
  "active_videos",
  "draw_calls",
  "perf_line",
  "render_source",
  "boundary_visible",
  "discovery",
  "no_pop",
  "cells",
  "fade_in",
  "preload_ahead",
];

export function writeReport(dir, payload) {
  mkdirSync(dir, { recursive: true });
  const rows = payload.rows.slice().sort((a, b) => orderOf(a.id) - orderOf(b.id));
  const json = {
    tool: "playcheck",
    url: payload.url,
    layout: payload.layoutPath,
    layoutId: payload.layoutId,
    viewport: { css: [360, 800], dpr: 2, framebuffer: [720, 1600] },
    video: payload.video,
    stills: payload.stills,
    steps: payload.steps,
    rows,
    summary: {
      passed: rows.filter((r) => r.result === "PASS").length,
      failed: rows.filter((r) => r.result !== "PASS").length,
      result: rows.every((r) => r.result === "PASS") ? "PASS" : "FAIL",
    },
    notes: payload.notes,
    generatedAt: payload.generatedAt,
    perf: payload.perf || null,
    perfLine: payload.perf?.perfLine || "Perf: drawCalls=missing, texMB=missing, activeVideos=missing, jsMs=missing",
  };
  if (Array.isArray(payload.waypoints)) json.waypoints = payload.waypoints;
  writeFileSync(path.join(dir, "report.json"), JSON.stringify(json, null, 2));
  writeFileSync(path.join(dir, "report.md"), markdown(json));
  return json;
}

function orderOf(id) {
  const i = ORDER.indexOf(id);
  return i === -1 ? 100 : i;
}

function markdown(json) {
  const lines = [];
  lines.push("# playcheck");
  lines.push("");
  lines.push(`Result: **${json.summary.result}** (${json.summary.passed} pass, ${json.summary.failed} fail)`);
  lines.push("");
  lines.push(`URL: \`${json.url}\``);
  lines.push("");
  lines.push(`Layout: \`${json.layout}\` (\`${json.layoutId}\`)`);
  lines.push("");
  lines.push("Viewport: 360×800 CSS, device pixel ratio 2, framebuffer 720×1600, full screen.");
  lines.push("");
  lines.push(json.perfLine);
  lines.push("");
  if (json.video) {
    lines.push(`Video: \`${json.video.file}\` (${json.video.width}×${json.video.height}, ${json.video.fps} fps, ${json.video.seconds}s, ${json.video.bytes} bytes)`);
    lines.push("");
  } else {
    lines.push("Video: not recorded (`--no-video`).");
    lines.push("");
  }
  lines.push("This file is the validator's report. A hand-written PASS table is not this report.");
  lines.push("");
  lines.push("| row | result | numbers |");
  lines.push("| --- | --- | --- |");
  for (const r of json.rows) {
    const flag = [r.heuristic ? "heuristic" : "", r.partial ? "partial" : ""].filter(Boolean).join(", ");
    const nums = compact(r.numbers);
    const extra = flag ? ` _(${flag})_` : "";
    lines.push(`| ${r.id} | ${r.result} | ${nums}${extra} |`);
  }
  lines.push("");
  lines.push("## Detail");
  lines.push("");
  for (const r of json.rows) {
    lines.push(`### ${r.id} — ${r.result}`);
    lines.push("");
    lines.push(r.detail);
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(r.numbers, null, 2));
    lines.push("```");
    lines.push("");
  }
  if (json.perf) {
    lines.push("## Perf");
    lines.push("");
    lines.push("Additive `perf` object for tools/reportview. Schema `playcheck-perf/1`. Existing row fields are unchanged.");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(json.perf, null, 2));
    lines.push("```");
    lines.push("");
  }
  if (json.notes?.length) {
    lines.push("## Notes");
    lines.push("");
    for (const n of json.notes) lines.push(`- ${n}`);
    lines.push("");
  }
  if (json.waypoints?.length) {
    lines.push("## Waypoints");
    lines.push("");
    for (const w of json.waypoints) {
      lines.push(`- ${w.kind} ${w.subArea || w.passage || w.id} target ${w.x}, ${w.z} arrived ${w.arrivedX}, ${w.arrivedZ}`);
    }
    lines.push("");
  }
  lines.push("## Stills");
  lines.push("");
  for (const s of json.stills || []) lines.push(`- \`${s}\``);
  lines.push("");
  return lines.join("\n");
}

function compact(numbers) {
  if (!numbers) return "";
  const parts = [];
  for (const [k, v] of Object.entries(numbers)) {
    if (v && typeof v === "object") continue;
    if (typeof v === "string" && v.length > 80) continue;
    parts.push(`${k}=${v}`);
    if (parts.length >= 6) break;
  }
  return parts.join(", ").replace(/\|/g, "/");
}
