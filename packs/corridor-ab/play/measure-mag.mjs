/**
 * Corridor magnification sweep. Placement only.
 * The still eye is the cleared chase (snap), the same pose a walk or sprint shot holds.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { chasePitch, chaseRight, forwardOf, pitchForTall, CHASE_EYE, GATE_TOP } from "./look.js";
import {
  FOCAL,
  MAG_LIMIT,
  MESH,
  VFOV,
  artFloor,
  boltMag,
  boomOf,
  clearEye,
  groundMag,
  restEye,
  rockDist,
  rockMag,
  rockShell,
  rockShells,
  ruinFaceDist,
  ruinShownMag,
} from "./mag.js";
import { createField, horizonSeats, settleField, rockBottom } from "./stream.js";

const HFOV = 22.7 * Math.PI / 180;
const layout = JSON.parse(readFileSync(new URL("../path-layout.json", import.meta.url), "utf8"));
const corridor = layout.corridors[0];
const x0 = corridor.waypoints[0][0];
const pathZ = corridor.waypoints[0][1];
const lengthM = corridor.length_m;

function sphereHits(eye, fwd, right, up, center, radius) {
  const dx = center[0] - eye[0];
  const dy = center[1] - eye[1];
  const dz = center[2] - eye[2];
  const ahead = dx * fwd[0] + dy * fwd[1] + dz * fwd[2];
  const dist = Math.hypot(dx, dy, dz) || 1e-4;
  if (ahead < -radius) return false;
  const side = Math.abs(dx * right[0] + dy * right[1] + dz * right[2]);
  const vert = Math.abs(dx * up[0] + dy * up[1] + dz * up[2]);
  const pad = Math.asin(Math.min(1, radius / Math.max(dist, 1e-3)));
  if (Math.atan2(side, Math.max(0.05, ahead)) - pad > HFOV * 0.5) return false;
  if (Math.atan2(vert, Math.max(0.05, ahead)) - pad > VFOV * 0.5) return false;
  return true;
}

function basis(heading, pitch) {
  const f = forwardOf(heading);
  const r = chaseRight(heading);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return {
    fwd: [f[0] * cp, sp, f[2] * cp],
    right: r,
    up: [-sp * f[0], cp, -sp * f[2]],
  };
}

function pitchAt(field, eye, heading) {
  let p = chasePitch();
  if (field.gate && field.gate.emerge > 0.4) {
    const f = forwardOf(heading);
    const r = chaseRight(heading);
    const dx = field.gate.x - eye[0];
    const dz = field.gate.z - eye[2];
    const ahead = dx * f[0] + dz * f[2];
    const side = dx * r[0] + dz * r[2];
    if (ahead > 12 && Math.abs(Math.atan2(side, ahead)) < HFOV * 0.5) {
      p = pitchForTall(p, GATE_TOP, Math.hypot(ahead, side), VFOV);
    }
  }
  return p;
}

export function sweepPose(pace, x, heading) {
  const field = createField({ seed: layout.seed || 1, x0, pathZ });
  settleField(field, { x, z: pathZ, heading, forward: 1, gallop: pace === "sprint" }, pace);
  const rigid = restEye(heading, x, pathZ);
  const eye = clearEye(rigid, x, pathZ, rockShells(field.pool), field);
  const pitch = pitchAt(field, eye, heading);
  const view = basis(heading, pitch);
  const hits = [];
  hits.push({ id: "ground", mag: groundMag(eye[1], pitch), dist: eye[1], visible: true });
  hits.push({ id: "bolt", mag: boltMag(boomOf(eye, x, pathZ)), dist: boomOf(eye, x, pathZ), visible: true });

  for (const slot of field.pool) {
    if (!slot.on || slot.kind > 2 || slot.emerge < 0.02) continue;
    const rock = rockShell(slot);
    const mesh = MESH[slot.kind === 2 ? "boulder" : "stone"];
    const meshH = mesh.maxY - mesh.minY;
    const draw = rock.worldH / meshH;
    const rad = Math.hypot(mesh.hx, mesh.hz) * draw;
    const visible = sphereHits(eye, view.fwd, view.right, view.up, [rock.x, rock.y, rock.z], rad);
    const dist = rockDist(eye, rock);
    hits.push({ id: rock.id, mag: rockMag(eye, rock), dist, visible });
  }
  const skyline = horizonSeats(field, x);
  for (let i = 0; i < skyline.length; i++) {
    const seat = skyline[i];
    const type = seat.kind === 2 ? "boulder" : "stone";
    const mesh = MESH[type];
    const meshH = mesh.maxY - mesh.minY;
    const draw = seat.height / meshH;
    const rad = Math.max(mesh.hx, mesh.hz) * draw;
    const y = rockBottom(1) - mesh.minY * draw + meshH * 0.5 * draw;
    const rock = { x: seat.x, y, z: seat.z, rad, worldH: seat.height, srcH: mesh.srcH };
    const visible = sphereHits(eye, view.fwd, view.right, view.up, [seat.x, y, seat.z], Math.hypot(mesh.hx, mesh.hz) * draw);
    if (!visible) continue;
    hits.push({
      id: "horizon-" + type + ":" + i,
      mag: rockMag(eye, rock),
      dist: rockDist(eye, rock),
      visible: true,
    });
  }
  for (const kind of ["arch", "gate", "wreck"]) {
    const slot = field[kind];
    if (!slot || !(slot.emerge > 0.02)) continue;
    const face = ruinFaceDist(kind, eye, slot);
    const center = [slot.x, 4, slot.z];
    const seen = sphereHits(eye, view.fwd, view.right, view.up, center, 12) || face.dist < 8;
    hits.push({
      id: kind,
      mag: ruinShownMag(kind, face.dist),
      dist: face.dist,
      visible: !!seen,
      inside: !!face.inside,
      art: artFloor(kind),
    });
  }
  let worst = null;
  let worstVis = null;
  for (const h of hits) {
    if (!Number.isFinite(h.mag)) continue;
    if (!worst || h.mag > worst.mag) worst = h;
    if (h.visible && (!worstVis || h.mag > worstVis.mag)) worstVis = h;
  }
  return { pace, x, heading, pitch, eye, boom: boomOf(eye, x, pathZ), worst, worstVis, hits };
}

export function headingTable(stepM) {
  const headings = [];
  for (let h = 0; h < 360; h += 10) headings.push(h);
  for (const extra of [82, 127, 165]) if (!headings.includes(extra)) headings.push(extra);
  headings.sort((a, b) => a - b);
  const stations = [];
  const step = stepM || 4;
  for (let along = 6; along <= lengthM - 4; along += step) stations.push(x0 + along);
  const rows = [];
  for (const pace of ["walk", "sprint"]) {
    for (const x of stations) {
      for (const heading of headings) {
        const row = sweepPose(pace, x, heading);
        if (row.worstVis && row.worstVis.mag > MAG_LIMIT) {
          rows.push({
            pace,
            x: Math.round(x * 10) / 10,
            heading,
            id: row.worstVis.id,
            mag: Math.round(row.worstVis.mag * 1000) / 1000,
            dist: Math.round(row.worstVis.dist * 1000) / 1000,
            pitch: Math.round(row.pitch * 1000) / 1000,
            art: row.worstVis.art || 0,
            inside: !!row.worstVis.inside,
          });
        }
      }
    }
  }
  rows.sort((a, b) => b.mag - a.mag);
  return {
    focal: FOCAL,
    vfovDeg: VFOV * 180 / Math.PI,
    groundAtRest: groundMag(CHASE_EYE, chasePitch()),
    bolt: boltMag(boomOf(restEye(90, 0, 0), 0, 0)),
    rows,
  };
}

function summarise(table) {
  const byId = new Map();
  for (const row of table.rows) {
    const key = row.pace + "|" + row.id.split(":")[0];
    const prev = byId.get(key);
    if (!prev || row.mag > prev.mag) byId.set(key, row);
  }
  return {
    focal: Math.round(table.focal * 10) / 10,
    vfovDeg: Math.round(table.vfovDeg * 100) / 100,
    groundAtRest: Math.round(table.groundAtRest * 1000) / 1000,
    bolt: Math.round(table.bolt * 1000) / 1000,
    over: table.rows.length,
    worstBySurface: [...byId.values()],
    top: table.rows.slice(0, 12),
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  console.log(JSON.stringify(summarise(headingTable(4)), null, 2));
}
