/**
 * Top-down birth plot and a count table for one straight sprint.
 * usage: node plot.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createField, census, slotIds, stepField, SPAWN_M } from "../../play/stream.js";

const here = dirname(fileURLToPath(import.meta.url));
const world = JSON.parse(readFileSync(new URL("../../world.json", import.meta.url), "utf8"));
const layout = JSON.parse(readFileSync(new URL("../../path-layout.json", import.meta.url), "utf8"));
const zone = JSON.parse(readFileSync(new URL("../../" + world.zones[world.start].split("/").pop(), import.meta.url), "utf8"));
const corridor = layout.corridors[0];
const x0 = corridor.waypoints[0][0];
const pathZ = corridor.waypoints[0][1];
const field = createField({ seed: layout.seed || 1, x0, pathZ });
let x = zone.spawn.position[0];
let z = zone.spawn.position[1];
let heading = zone.spawn.heading_deg;
const dt = 1 / 24;
const seconds = 24;
const steps = Math.round(seconds / dt);
const born = [];
const seen = new Set();
const table = [];
let prevIds = new Set();

function kindName(kind) {
  if (kind === 1) return "stone";
  if (kind === 2) return "boulder";
  if (kind === 3) return "arch";
  if (kind === 4) return "gate";
  if (kind === 5) return "wreck";
  return "other";
}

for (let i = 0; i <= steps; i++) {
  const body = { x, z, heading, forward: 1, gallop: true };
  stepField(field, body, i === 0 ? dt : dt);
  const ids = slotIds(field);
  const now = new Set(ids);
  for (let s = 0; s < field.pool.length; s++) {
    const slot = field.pool[s];
    if (!slot.on || prevIds.has(slot.id) || seen.has(slot.id)) continue;
    seen.add(slot.id);
    born.push({
      kind: kindName(slot.kind),
      x: slot.x,
      z: slot.z,
      t: i * dt,
      boltX: x,
      boltZ: z,
    });
  }
  prevIds = now;
  const yaw = heading * Math.PI / 180;
  x += Math.sin(yaw) * field.speed * dt;
  z += Math.cos(yaw) * field.speed * dt;
  if (i % 24 === 0) {
    const counts = census(field).counts;
    table.push({
      t: Math.round(i * dt),
      speed: Math.round(field.speed * 100) / 100,
      charge: Math.round(field.charge * 100) / 100,
      ...counts,
    });
  }
}

const colours = {
  stone: "#8a8175",
  boulder: "#4d463c",
  arch: "#d7a15a",
  gate: "#9aa7b5",
  wreck: "#6e4b8a",
};
let minX = Infinity;
let maxX = -Infinity;
let minZ = Infinity;
let maxZ = -Infinity;
for (let i = 0; i < born.length; i++) {
  const p = born[i];
  if (p.x < minX) minX = p.x;
  if (p.x > maxX) maxX = p.x;
  if (p.z < minZ) minZ = p.z;
  if (p.z > maxZ) maxZ = p.z;
}
const pad = 12;
minX -= pad;
maxX += pad;
minZ -= pad;
maxZ += pad;
const W = 960;
const H = 640;
const sx = (px) => ((px - minX) / (maxX - minX)) * (W - 80) + 48;
const sz = (pz) => H - 36 - ((pz - minZ) / (maxZ - minZ)) * (H - 72);
const dots = born.map((p) => {
  const r = p.kind === "stone" || p.kind === "boulder" ? 2.2 : 6;
  return `<circle cx="${sx(p.x).toFixed(1)}" cy="${sz(p.z).toFixed(1)}" r="${r}" fill="${colours[p.kind]}" opacity="0.9"><title>${p.kind} t=${p.t.toFixed(1)} x=${p.x.toFixed(1)} z=${p.z.toFixed(1)}</title></circle>`;
}).join("\n");
const legend = Object.keys(colours).map((name, i) => {
  const y = 28 + i * 18;
  return `<circle cx="24" cy="${y}" r="5" fill="${colours[name]}"/><text x="36" y="${y + 4}" font-size="13" fill="#222">${name}</text>`;
}).join("\n");
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="100%" height="100%" fill="#f4f1ea"/>
  <text x="48" y="22" font-size="16" fill="#222">Sprint births, top down. x east, z north. Ring ${SPAWN_M} m.</text>
  ${legend}
  <line x1="${sx(zone.spawn.position[0]).toFixed(1)}" y1="${sz(minZ).toFixed(1)}" x2="${sx(zone.spawn.position[0]).toFixed(1)}" y2="${sz(maxZ).toFixed(1)}" stroke="#c8c2b6" stroke-width="1"/>
  ${dots}
</svg>
`;
writeFileSync(resolve(here, "spawn-plot.svg"), svg);

const header = "| t (s) | speed | charge | stone | boulder | arch | gate | wreck |";
const rule = "| --- | --- | --- | --- | --- | --- | --- | --- |";
const lines = table.map((row) => `| ${row.t} | ${row.speed} | ${row.charge} | ${row.stone} | ${row.boulder} | ${row.arch} | ${row.gate} | ${row.wreck} |`);
const laterals = { arch: [], gate: [], wreck: [] };
for (let i = 0; i < born.length; i++) {
  const p = born[i];
  if (!laterals[p.kind]) continue;
  laterals[p.kind].push(p.z - pathZ);
}
function span(list) {
  if (!list.length) return "none";
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < list.length; i++) {
    if (list[i] < lo) lo = list[i];
    if (list[i] > hi) hi = list[i];
  }
  return lo.toFixed(1) + " … " + hi.toFixed(1);
}
const md = [
  "# Wide-spawn counts",
  "",
  "Live copies during a straight 24 s sprint. Births stay at or beyond " + SPAWN_M + " m.",
  "",
  header,
  rule,
  ...lines,
  "",
  "Birth laterals (z − path), metres:",
  "",
  "| type | births | lateral span |",
  "| --- | --- | --- |",
  `| arch | ${laterals.arch.length} | ${span(laterals.arch)} |`,
  `| gate | ${laterals.gate.length} | ${span(laterals.gate)} |`,
  `| wreck | ${laterals.wreck.length} | ${span(laterals.wreck)} |`,
  "",
].join("\n");
writeFileSync(resolve(here, "counts.md"), md);
writeFileSync(resolve(here, "births.json"), JSON.stringify({ born: born.length, table, laterals: {
  arch: laterals.arch.length,
  gate: laterals.gate.length,
  wreck: laterals.wreck.length,
} }, null, 2));
console.log(JSON.stringify({ born: born.length, table }, null, 2));
