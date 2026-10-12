/**
 * Zone placement of library part collision boxes, plus the approach-run log.
 * Local boxes are scaled, yawed, and translated, then ground-snapped on the anchor.
 * The walk does not draw. A keep-out that stops the body in an opening is an invisible wall.
 * Body band matches the ruin face colliders: radius 0.3 m, top 1.3 m.
 * Camera layers use the near 24 m / mid 64 m split. Past mid is far.
 */

const SCHEMA = "approach-run/1";
const EPS = 0.02;
const BODY_RADIUS = 0.3;
const BODY_TOP = 1.3;
const STEP_M = 0.5;
const NEAR_M = 24;
const MID_M = 64;
const ROLES = new Set(["solid", "hanging", "keepout"]);

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function row(id, result, numbers, detail) {
  return { id, result, numbers, detail, heuristic: false, partial: false };
}

function wrap360(a) {
  let x = a % 360;
  if (x < 0) x += 360;
  return x;
}

function headingOf(dx, dz) {
  return wrap360((Math.atan2(dx, dz) * 180) / Math.PI);
}

export function readPlacement(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (raw.schema === "zone-placement/1" || Array.isArray(raw.parts)) return raw;
  return null;
}

function libraryOf(raw, id) {
  const lib = raw && raw.library;
  if (!lib || typeof lib !== "object") return null;
  if (Array.isArray(lib)) return lib.find((item) => item && item.id === id) || null;
  return lib[id] || null;
}

function parseVec3(value) {
  if (!Array.isArray(value) || value.length < 3) return null;
  const x = finite(value[0]);
  const y = finite(value[1]);
  const z = finite(value[2]);
  if (x == null || y == null || z == null) return null;
  return [x, y, z];
}

function parsePosition(value) {
  if (!Array.isArray(value)) return null;
  if (value.length === 2) {
    const x = finite(value[0]);
    const z = finite(value[1]);
    if (x == null || z == null) return null;
    return { x, y: 0, z };
  }
  const v = parseVec3(value);
  if (!v) return null;
  return { x: v[0], y: v[1], z: v[2] };
}

function parseBox(box) {
  if (!box || typeof box !== "object") return { error: "box is not an object" };
  const min = parseVec3(box.min);
  const max = parseVec3(box.max);
  if (!min || !max) return { error: "box min/max is not a vec3" };
  if (!(min[0] < max[0] && min[1] < max[1] && min[2] < max[2])) return { error: "box min is not below max" };
  const role = String(box.role || "");
  if (!ROLES.has(role)) return { error: `box role ${role || "missing"}` };
  const visual = role === "keepout" ? false : box.visual !== false;
  return {
    box: {
      id: box.id ? String(box.id) : "",
      role,
      visual,
      min,
      max,
    },
  };
}

function transformPoint(local, place, yawRad) {
  const lx = local[0] * place.scale;
  const ly = local[1] * place.scale;
  const lz = local[2] * place.scale;
  const c = Math.cos(yawRad);
  const s = Math.sin(yawRad);
  return [place.x + lx * c + lz * s, place.y + ly, place.z - lx * s + lz * c];
}

function transformBox(box, place, yawRad, yShift) {
  const xs = [box.min[0], box.max[0]];
  const ys = [box.min[1], box.max[1]];
  const zs = [box.min[2], box.max[2]];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const x of xs) {
    for (const y of ys) {
      for (const z of zs) {
        const p = transformPoint([x, y, z], place, yawRad);
        for (let i = 0; i < 3; i++) {
          if (p[i] < min[i]) min[i] = p[i];
          if (p[i] > max[i]) max[i] = p[i];
        }
      }
    }
  }
  min[1] += yShift;
  max[1] += yShift;
  return { id: box.id, role: box.role, visual: box.visual, min, max };
}

function boxesClose(a, b) {
  for (let i = 0; i < 3; i++) {
    if (Math.abs(a.min[i] - b.min[i]) > EPS) return false;
    if (Math.abs(a.max[i] - b.max[i]) > EPS) return false;
  }
  return true;
}

function sameBoxSet(declared, built) {
  if (declared.length !== built.length) return false;
  const used = new Set();
  for (const item of declared) {
    let found = -1;
    for (let i = 0; i < built.length; i++) {
      if (used.has(i)) continue;
      if (boxesClose(item, built[i])) {
        found = i;
        break;
      }
    }
    if (found < 0) return false;
    used.add(found);
  }
  return true;
}

function pathPoints(raw) {
  const src = raw && raw.path && Array.isArray(raw.path.points) ? raw.path.points : [];
  const points = [];
  for (const item of src) {
    const pos = parsePosition(item);
    if (pos) points.push(pos);
  }
  return points;
}

function samplePath(points) {
  const samples = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (!(len > 0)) continue;
    const facing = headingOf(dx, dz);
    for (let d = 0; d <= len + 1e-9; d += STEP_M) {
      const t = Math.min(d, len) / len;
      const x = a.x + dx * t;
      const z = a.z + dz * t;
      const prev = samples[samples.length - 1];
      if (prev && Math.hypot(prev.x - x, prev.z - z) < 1e-6) continue;
      samples.push({ x, z, facing });
      if (d >= len - 1e-9) break;
    }
  }
  return samples;
}

function pointBoxDistance(p, box) {
  const cx = Math.min(Math.max(p[0], box.min[0]), box.max[0]);
  const cy = Math.min(Math.max(p[1], box.min[1]), box.max[1]);
  const cz = Math.min(Math.max(p[2], box.min[2]), box.max[2]);
  return Math.hypot(p[0] - cx, p[1] - cy, p[2] - cz);
}

function aabbOverlap(a, b) {
  return a.min[0] <= b.max[0] && a.max[0] >= b.min[0] && a.min[1] <= b.max[1] && a.max[1] >= b.min[1] && a.min[2] <= b.max[2] && a.max[2] >= b.min[2];
}

function xzDistanceToBox(x, z, box) {
  const dx = x < box.min[0] ? box.min[0] - x : x > box.max[0] ? x - box.max[0] : 0;
  const dz = z < box.min[2] ? box.min[2] - z : z > box.max[2] ? z - box.max[2] : 0;
  return Math.hypot(dx, dz);
}

function corridorGap(points, box) {
  let best = Infinity;
  const samples = samplePath(points);
  const probes = samples.length ? samples : points.map((p) => ({ x: p.x, z: p.z }));
  for (const sample of probes) {
    const gap = xzDistanceToBox(sample.x, sample.z, box);
    if (gap < best) best = gap;
  }
  return best;
}

function layerFor(distance) {
  if (distance < NEAR_M) return "near";
  if (distance < MID_M) return "mid";
  return "far";
}

function placeAll(raw) {
  const flags = [];
  const problems = [];
  const placed = [];
  const groundY = finite(raw && raw.ground_y);
  const ground = groundY == null ? 0 : groundY;
  const parts = Array.isArray(raw && raw.parts) ? raw.parts : null;
  if (!parts || !parts.length) {
    flags.push("bad_collision");
    problems.push("zone placement has no parts");
    return { flags, problems, placed, ground };
  }
  for (const part of parts) {
    const id = part && part.id ? String(part.id) : "";
    if (!id) {
      flags.push("bad_collision");
      problems.push("part is missing an id");
      continue;
    }
    const libId = part.library ? String(part.library) : "";
    const lib = libraryOf(raw, libId);
    if (!lib) {
      flags.push("bad_collision");
      problems.push(`${id} has no library part ${libId || "(missing)"}`);
      continue;
    }
    const place = parsePosition(part.position);
    const scale = finite(part.scale == null ? 1 : part.scale);
    const yawDeg = finite(part.yaw_deg == null ? 0 : part.yaw_deg);
    if (!place || scale == null || !(scale > 0) || yawDeg == null) {
      flags.push("bad_collision");
      problems.push(`${id} placement is not a finite pose`);
      continue;
    }
    const pose = { x: place.x, y: place.y, z: place.z, scale };
    const yawRad = (yawDeg * Math.PI) / 180;
    const authored = [];
    const srcBoxes = Array.isArray(lib.boxes) ? lib.boxes : [];
    if (!srcBoxes.length) {
      flags.push("bad_collision");
      problems.push(`${id} library part has no collision boxes`);
    }
    let boxBad = false;
    for (const src of srcBoxes) {
      const parsed = parseBox(src);
      if (parsed.error) {
        boxBad = true;
        problems.push(`${id} ${parsed.error}`);
      } else {
        authored.push(parsed.box);
      }
    }
    if (boxBad) flags.push("bad_collision");
    const anchor = parseVec3(lib.ground_anchor);
    const solid = authored.some((box) => box.role === "solid");
    const hangingOnly = lib.hanging === true && !solid;
    const snap = part.ground_snap !== false;
    let yShift = 0;
    let anchorY = null;
    if (anchor) {
      anchorY = pose.y + anchor[1] * scale;
      if (snap) {
        yShift = ground - anchorY;
        anchorY = ground;
      }
    }
    const needsAnchor = !hangingOnly && (snap || !!anchor);
    if (needsAnchor && (!anchor || Math.abs(anchorY - ground) > EPS)) {
      flags.push("float");
      problems.push(`${id} ground_anchor miss`);
    }
    const world = authored.map((box) => ({
      partId: id,
      ...transformBox(box, pose, yawRad, yShift),
    }));
    if (Object.prototype.hasOwnProperty.call(part, "world_boxes")) {
      const declared = [];
      const list = Array.isArray(part.world_boxes) ? part.world_boxes : null;
      if (!list) {
        flags.push("bad_collision");
        problems.push(`${id} world_boxes is not a list`);
      } else {
        for (const item of list) {
          const parsed = parseBox({ ...item, role: item.role || "solid" });
          if (parsed.error) {
            flags.push("bad_collision");
            problems.push(`${id} world_boxes ${parsed.error}`);
          } else {
            declared.push(parsed.box);
          }
        }
        if (!sameBoxSet(declared, world)) {
          flags.push("bad_collision");
          problems.push(`${id} world_boxes are not the library boxes after placement`);
        }
      }
    }
    placed.push({
      id,
      hanging: lib.hanging === true,
      anchorY,
      boxes: world,
    });
  }
  return { flags, problems, placed, ground };
}

function clearanceOf(raw, placed, points, ground, flags, problems) {
  const path = raw && raw.path && typeof raw.path === "object" ? raw.path : {};
  const minC = finite(path.min_clearance_m);
  const width = finite(path.width_m);
  const half = width != null && width > 0 ? width / 2 : 0;
  const hangingBoxes = [];
  for (const part of placed) {
    for (const box of part.boxes) {
      if (box.role === "hanging") hangingBoxes.push(box);
    }
    if (part.hanging && !part.boxes.some((box) => box.role === "hanging")) {
      flags.push("clearance_missing");
      problems.push(`${part.id} hanging detail has no clearance box`);
    }
  }
  if (points.length < 2 && hangingBoxes.length) {
    flags.push("clearance_missing");
    problems.push("path has no run under the hanging detail");
  }
  for (const box of hangingBoxes) {
    const gap = corridorGap(points, box);
    if (!(gap <= half + EPS)) continue;
    const overGround = box.min[1] - ground;
    if (minC == null || !Number.isFinite(overGround)) {
      flags.push("clearance_missing");
      problems.push(`${box.partId} hanging clearance is missing`);
      continue;
    }
    if (overGround < minC - EPS) {
      flags.push("clearance_tight");
      problems.push(`${box.partId} clearance ${overGround} m is under ${minC} m`);
    }
  }
}

export function validateApproachRecord(record) {
  const errors = [];
  if (!record || typeof record !== "object") {
    return { ok: false, errors: ["record is not an object"] };
  }
  if (record.schema !== SCHEMA) errors.push("schema");
  if (typeof record.timestamp !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(record.timestamp) || !Number.isFinite(Date.parse(record.timestamp))) {
    errors.push("timestamp");
  }
  if (!Array.isArray(record.position) || record.position.length !== 3 || record.position.some((n) => !Number.isFinite(Number(n)))) {
    errors.push("position");
  }
  if (!Number.isFinite(Number(record.facing))) errors.push("facing");
  if (typeof record.nearestPartId !== "string" || !record.nearestPartId) errors.push("nearestPartId");
  if (!Number.isFinite(Number(record.distance)) || Number(record.distance) < 0) errors.push("distance");
  if (record.collision !== "hit" && record.collision !== "miss") errors.push("collision");
  if (record.cameraLayer !== "near" && record.cameraLayer !== "mid" && record.cameraLayer !== "far") errors.push("cameraLayer");
  if (!Number.isFinite(Number(record.fps)) || Number(record.fps) < 0) errors.push("fps");
  return { ok: errors.length === 0, errors };
}

export function formatApproachLog(records) {
  if (!records.length) return "";
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

export function parseApproachLog(text) {
  const records = [];
  const errors = [];
  const lines = String(text || "").split(/\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      errors.push(`line ${i + 1} is not JSON`);
      continue;
    }
    const check = validateApproachRecord(record);
    if (!check.ok) errors.push(`line ${i + 1} ${check.errors.join(",")}`);
    records.push(record);
  }
  if (!records.length) errors.push("no samples");
  return { ok: errors.length === 0, records, errors };
}

function buildRecords(raw, placed, ground, options) {
  const points = pathPoints(raw);
  const samples = samplePath(points);
  const boxes = placed.flatMap((part) => part.boxes);
  const fpsAt = options.fpsAt || (() => 30);
  const timestampAt = options.timestampAt || ((index) => new Date(Date.UTC(2026, 9, 12, 0, 0, index)).toISOString());
  const records = [];
  let invisibleHits = 0;
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const foot = [sample.x, ground, sample.z];
    let nearest = null;
    let distance = Infinity;
    for (const box of boxes) {
      const gap = pointBoxDistance(foot, box);
      if (gap < distance) {
        distance = gap;
        nearest = box;
      }
    }
    const body = {
      min: [sample.x - BODY_RADIUS, ground, sample.z - BODY_RADIUS],
      max: [sample.x + BODY_RADIUS, ground + BODY_TOP, sample.z + BODY_RADIUS],
    };
    const hits = boxes.filter((box) => aabbOverlap(body, box));
    const invisible = hits.some((box) => !box.visual || box.role === "keepout");
    if (invisible) invisibleHits += 1;
    const fps = Number(fpsAt(i, sample));
    records.push({
      schema: SCHEMA,
      timestamp: timestampAt(i, sample),
      position: [sample.x, ground, sample.z],
      facing: sample.facing,
      nearestPartId: nearest ? nearest.partId : "",
      distance: Number.isFinite(distance) ? distance : -1,
      collision: hits.length ? "hit" : "miss",
      cameraLayer: layerFor(Number.isFinite(distance) ? distance : Infinity),
      fps: Number.isFinite(fps) ? fps : -1,
    });
  }
  return { records, invisibleHits, points };
}

export function evaluatePlacement(raw, options = {}) {
  const built = placeAll(raw || {});
  const flags = built.flags.slice();
  const problems = built.problems.slice();
  const { records, invisibleHits, points } = buildRecords(raw || {}, built.placed, built.ground, options);
  clearanceOf(raw || {}, built.placed, points, built.ground, flags, problems);
  if (invisibleHits > 0) {
    flags.push("invisible_wall");
    problems.push(`invisible wall on ${invisibleHits} samples`);
  }
  const unique = [...new Set(flags)].sort();
  const parsed = parseApproachLog(formatApproachLog(records));
  const logOk = parsed.ok;
  if (!logOk) problems.push(`approach log ${parsed.errors.join("; ")}`);
  const boxes = built.placed.flatMap((part) => part.boxes);
  const badCollision = unique.includes("bad_collision") || unique.includes("invisible_wall");
  const floated = unique.includes("float");
  const clearanceBad = unique.includes("clearance_tight") || unique.includes("clearance_missing");
  const rows = [
    row(
      "part_colliders",
      badCollision ? "FAIL" : "PASS",
      { parts: built.placed.length, boxes: boxes.length, invisibleHits, bad: unique.includes("bad_collision") },
      badCollision
        ? "Library boxes after zone placement do not match the run, or a sample hit a keep-out."
        : "Library local boxes were scaled, yawed, translated, and ground-snapped. No keep-out hit the body.",
    ),
    row(
      "ground_anchor",
      floated ? "FAIL" : "PASS",
      { ground_y: built.ground, floats: built.placed.filter((part) => part.anchorY != null && Math.abs(part.anchorY - built.ground) > EPS).length },
      floated
        ? "A ground anchor is missing or is not on ground_y. The part floats."
        : "Every grounded part anchor sits on ground_y.",
    ),
    row(
      "hanging_clearance",
      clearanceBad ? "FAIL" : "PASS",
      {
        tight: unique.includes("clearance_tight"),
        missing: unique.includes("clearance_missing"),
        min_clearance_m: finite(raw && raw.path && raw.path.min_clearance_m),
      },
      clearanceBad
        ? "Hanging detail over the path is under the required clearance, or the clearance box is missing."
        : "Hanging detail over the path clears the required height.",
    ),
    row(
      "approach_log",
      logOk ? "PASS" : "FAIL",
      { samples: records.length, schema: SCHEMA },
      logOk
        ? "approach.jsonl lines carry timestamp, position, facing, nearest part, distance, hit/miss, camera layer, and fps."
        : "approach.jsonl failed the schema.",
    ),
  ];
  const result = rows.every((item) => item.result === "PASS") ? "PASS" : "FAIL";
  return {
    result,
    flags: unique,
    problems,
    rows,
    records,
    jsonl: formatApproachLog(records),
    boxes,
    ground: built.ground,
  };
}
