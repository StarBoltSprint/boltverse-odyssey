/**
 * Terrain feature placement. Noise picks positions only.
 * Heights come from the zone field. No pixels.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hitsPassage, passagesFromRuin } from "./passages.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

export function mix(a, b) {
  let n = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function corridorFrame(headingDeg) {
  const th = (headingDeg * Math.PI) / 180;
  return {
    fx: Math.sin(th),
    fz: Math.cos(th),
    rx: Math.cos(th),
    rz: -Math.sin(th),
  };
}

export function acrossOf(x, z, frame, spawn) {
  return (x - spawn[0]) * frame.rx + (z - spawn[1]) * frame.rz;
}

export function alongOf(x, z, frame, spawn) {
  return (x - spawn[0]) * frame.fx + (z - spawn[1]) * frame.fz;
}

export function footprintOf(spec, scale) {
  if (spec.kind === "cutout") {
    const h = spec.heightM[1] * scale;
    return h * 0.55;
  }
  return 0.5 * Math.hypot(spec.objectSize[0], spec.objectSize[2]) * scale;
}

export function inKeepOut(x, z, numbers, frame, footprint) {
  const spawn = numbers.corridor.spawn;
  const across = Math.abs(acrossOf(x, z, frame, spawn));
  const along = Math.abs(alongOf(x, z, frame, spawn));
  const pad = footprint || 0;
  if (along <= numbers.corridor.lengthM && across < numbers.corridor.halfWidthM + pad) return true;
  if (Math.hypot(x - spawn[0], z - spawn[1]) < numbers.corridor.bubbleM + pad) return true;
  return false;
}

function spanAt(field, x, z, radius) {
  const r = Math.max(0.15, radius);
  let min = Infinity;
  let max = -Infinity;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const h = field.heightAt(x + i * r * 0.55, z + j * r * 0.55);
      if (h < min) min = h;
      if (h > max) max = h;
    }
  }
  return { min, max, span: max - min };
}

function yawFold(a, b) {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  if (d > 90) d = 180 - d;
  return d;
}

function overlaps(instances, spec, x, z, scale) {
  const foot = footprintOf(spec, scale);
  for (let i = 0; i < instances.length; i++) {
    const o = instances[i];
    const d = Math.hypot(o.x - x, o.z - z);
    const need = Math.max(spec.minSeparation, o.minSeparation) * 0.92;
    if (d < need || d < foot + o.footprint + 0.25) return true;
  }
  return false;
}

function cloneClash(instances, name, x, z, yaw, scale, numbers, variant, kind) {
  for (let i = 0; i < instances.length; i++) {
    const o = instances[i];
    if (o.type !== name) continue;
    if (Math.hypot(o.x - x, o.z - z) >= numbers.cloneRadiusM) continue;
    if (kind === "cutout" && o.variant !== variant) continue;
    if (yawFold(o.yaw, yaw) < numbers.cloneYawDeg && Math.abs(o.scale - scale) < numbers.cloneScale) return true;
  }
  return false;
}

function insideZone(field, numbers, x, z) {
  const rho = Math.hypot(x, z);
  if (rho < numbers.rhoMin) return false;
  const R = field.radiusAt(Math.atan2(x, z));
  return rho < numbers.insideFrac * R;
}

function pickSeeds(numbers, field, frame) {
  const reach = field.maxRadius();
  const step = numbers.clusterStepM;
  const n = Math.ceil((reach * 2) / step);
  const seeds = [];
  for (let ix = -n; ix <= n && seeds.length < numbers.clusters; ix++) {
    for (let iz = -n; iz <= n && seeds.length < numbers.clusters; iz++) {
      const jx = (mix(ix + numbers.seed, iz) - 0.5) * 2 * numbers.jitterM;
      const jz = (mix(iz + 17, ix + numbers.seed) - 0.5) * 2 * numbers.jitterM;
      const x = ix * step + jx;
      const z = iz * step + jz;
      if (!insideZone(field, numbers, x, z)) continue;
      if (mix(ix + 11, iz + 19) < numbers.clusterNoiseMin) continue;
      if (inKeepOut(x, z, numbers, frame, 1.2)) continue;
      if (hitsPassage(x, z, 1.2, numbers.passages)) continue;
      let far = true;
      for (let s = 0; s < seeds.length; s++) {
        if (Math.hypot(seeds[s].x - x, seeds[s].z - z) < numbers.clusterSepM) far = false;
      }
      if (!far) continue;
      seeds.push({ x, z });
    }
  }
  return seeds;
}

function sampleXZ(i, salt, seeds, spec, field) {
  if (seeds.length && mix(i, salt) < 0.74 && spec.annulus && spec.annulus[1] > spec.annulus[0]) {
    const s = seeds[Math.floor(mix(i, salt + 3) * seeds.length)];
    const ang = mix(i, salt + 4) * Math.PI * 2;
    const rad = spec.annulus[0] + mix(i, salt + 5) * (spec.annulus[1] - spec.annulus[0]);
    return [s.x + Math.sin(ang) * rad, s.z + Math.cos(ang) * rad];
  }
  const ang = mix(i, salt + 6) * Math.PI * 2;
  const u = Math.sqrt(mix(i, salt + 7));
  const R = field.maxRadius() * 0.78;
  return [Math.sin(ang) * u * R, Math.cos(ang) * u * R];
}

function tryAdd(instances, numbers, field, frame, name, spec, x, z, yaw, scale, variant) {
  if (!insideZone(field, numbers, x, z)) return false;
  const foot = footprintOf(spec, scale);
  if (hitsPassage(x, z, foot, numbers.passages)) return false;
  if (inKeepOut(x, z, numbers, frame, foot)) return false;
  const across = Math.abs(acrossOf(x, z, frame, numbers.corridor.spawn));
  const needAcross = spec.minAcrossM || 0;
  if (across < needAcross) return false;
  if (spec.minMacro != null && field.macroAt(x, z) < spec.minMacro) return false;
  const seat = spanAt(field, x, z, foot);
  if (seat.span > spec.spanMax) return false;
  if (overlaps(instances, spec, x, z, scale)) return false;
  let yFix = yaw;
  for (let k = 0; k < 8; k++) {
    if (!cloneClash(instances, name, x, z, yFix, scale, numbers, variant, spec.kind)) break;
    yFix = (yFix + 47) % 360;
  }
  if (cloneClash(instances, name, x, z, yFix, scale, numbers, variant, spec.kind)) return false;
  const heightM = spec.kind === "cutout"
    ? spec.heightM[0] + mix(Math.round(x * 10), Math.round(z * 10)) * (spec.heightM[1] - spec.heightM[0])
    : spec.objectSize[1];
  instances.push({
    id: name + "-" + instances.length,
    type: name,
    kind: spec.kind,
    variant: variant == null ? 0 : variant,
    x, z,
    yaw: yFix,
    scale,
    footprint: foot,
    minSeparation: spec.minSeparation,
    seatY: seat.min,
    span: seat.span,
    heightM,
    collider: spec.collider !== false && spec.kind === "hull",
  });
  return true;
}

export function placeAll(numbers, field) {
  const frame = corridorFrame(numbers.corridor.headingDeg);
  const seeds = pickSeeds(numbers, field, frame);
  const instances = [];
  const order = ["crest", "boulder", "stone", "pebble"];
  for (let t = 0; t < order.length; t++) {
    const name = order[t];
    const spec = numbers.types[name];
    if (!spec) continue;
    let guard = 0;
    let have = 0;
    while (have < spec.count && guard < 24000) {
      const i = guard++;
      const [x, z] = sampleXZ(i + numbers.seed, 100 + t * 17, seeds, spec, field);
      const scale = spec.scale[0] + mix(i, 80 + t) * (spec.scale[1] - spec.scale[0]);
      let yaw = mix(i, 90 + t) * 360;
      let variant = 0;
      if (spec.kind === "cutout") variant = mix(i, 70 + t) < 0.5 ? 0 : 1;
      if (tryAdd(instances, numbers, field, frame, name, spec, x, z, yaw, scale, variant)) have++;
    }
  }
  return { seeds, instances, frame };
}

export function radiusCv(instances) {
  if (instances.length < 3) return 0;
  let sx = 0;
  let sz = 0;
  for (const o of instances) {
    sx += o.x;
    sz += o.z;
  }
  sx /= instances.length;
  sz /= instances.length;
  const d = instances.map((o) => Math.hypot(o.x - sx, o.z - sz));
  const mean = d.reduce((a, b) => a + b, 0) / d.length;
  if (mean < 1e-6) return 0;
  const v = d.reduce((a, b) => a + (b - mean) ** 2, 0) / d.length;
  return Math.sqrt(v) / mean;
}

export function rowScore(instances, bin) {
  const buckets = new Map();
  for (const o of instances) {
    const k = Math.round(o.x / bin);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(o.z);
  }
  let worst = 0;
  for (const zs of buckets.values()) {
    if (zs.length < 5) continue;
    zs.sort((a, b) => a - b);
    if (zs[zs.length - 1] - zs[0] > 8) worst = Math.max(worst, zs.length);
  }
  return worst;
}

export function countTypes(instances) {
  const n = {};
  for (const o of instances) n[o.type] = (n[o.type] || 0) + 1;
  return n;
}

function fail(msg) {
  console.error("FAIL " + msg);
  process.exitCode = 1;
}

export function checkPlacement(numbers, placed) {
  const errors = [];
  const { seeds, instances } = placed;
  const frame = corridorFrame(numbers.corridor.headingDeg);
  const counts = countTypes(instances);
  for (const [name, spec] of Object.entries(numbers.types)) {
    if ((counts[name] || 0) !== spec.count) {
      errors.push(name + " count " + (counts[name] || 0) + " wanted " + spec.count);
    }
  }
  for (const o of instances) {
    if (inKeepOut(o.x, o.z, numbers, frame, o.footprint * 0.98)) errors.push("keepout " + o.id);
    if (hitsPassage(o.x, o.z, o.footprint, numbers.passages)) errors.push("passage " + o.id);
    if (o.span > numbers.types[o.type].spanMax + 1e-6) errors.push("span " + o.id);
    if (o.scale < numbers.types[o.type].scale[0] - 1e-6 || o.scale > numbers.types[o.type].scale[1] + 1e-6) {
      errors.push("scale " + o.id);
    }
  }
  for (let i = 0; i < instances.length; i++) {
    for (let j = i + 1; j < instances.length; j++) {
      const a = instances[i];
      const b = instances[j];
      if (a.type !== b.type) continue;
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d < numbers.cloneRadiusM && yawFold(a.yaw, b.yaw) < numbers.cloneYawDeg && Math.abs(a.scale - b.scale) < numbers.cloneScale) {
        if (a.kind !== "cutout" || a.variant === b.variant) errors.push("clone " + a.id + " " + b.id);
      }
    }
  }
  const cv = radiusCv(instances);
  if (cv < 0.22) errors.push("ring cv " + cv.toFixed(3));
  const rows = rowScore(instances, 0.8);
  if (rows >= 5) errors.push("row " + rows);
  if (seeds.length < 4) errors.push("seeds " + seeds.length);
  let far = 0;
  for (let i = 0; i < seeds.length; i++) {
    for (let j = i + 1; j < seeds.length; j++) {
      far = Math.max(far, Math.hypot(seeds[i].x - seeds[j].x, seeds[i].z - seeds[j].z));
    }
  }
  if (far < 24) errors.push("seeds clustered " + far.toFixed(1));
  return errors;
}

function manifestFrom(numbers, placed) {
  return {
    schema: "rocks-manifest/1",
    kit: numbers.kit,
    seed: numbers.seed,
    types: numbers.types,
    seeds: placed.seeds,
    instances: placed.instances.map((o) => ({
      id: o.id,
      type: o.type,
      kind: o.kind,
      variant: o.variant,
      x: Math.round(o.x * 1000) / 1000,
      z: Math.round(o.z * 1000) / 1000,
      yaw: Math.round(o.yaw * 10) / 10,
      scale: Math.round(o.scale * 1000) / 1000,
      seatY: Math.round(o.seatY * 1000) / 1000,
      span: Math.round(o.span * 1000) / 1000,
      heightM: Math.round(o.heightM * 1000) / 1000,
      collider: o.collider,
    })),
  };
}

async function loadField(pack) {
  const url = pathToFileURL(resolve(pack, "play/field.js")).href;
  return import(url);
}

async function main() {
  const argv = process.argv.slice(2);
  const self = argv.includes("--selftest");
  const ni = argv.indexOf("--numbers");
  const numbersPath = ni >= 0 ? argv[ni + 1] : resolve(HERE, "numbers/howling-eclipse.json");
  const numbers = JSON.parse(readFileSync(numbersPath, "utf8"));
  const root = resolve(HERE, "../..");
  const field = await loadField(resolve(root, numbers.pack));
  if (self) {
    const placed = placeAll(numbers, field);
    const errors = checkPlacement(numbers, placed);
    const ring = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      ring.push({ x: Math.cos(a) * 20, z: Math.sin(a) * 20, type: "stone" });
    }
    if (radiusCv(ring) > 0.08) fail("ring detector missed a circle");
    const grid = [];
    for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) grid.push({ x: x * 4, z: z * 4, type: "stone" });
    if (rowScore(grid, 0.8) < 5) fail("row detector missed a grid");
    if (errors.length) {
      for (const e of errors) console.error("FAIL " + e);
      process.exit(1);
    }
    const blocked = {
      ...numbers,
      passages: [{ id: "all", pad: 0, corners: [[-1e4, -1e4], [1e4, -1e4], [1e4, 1e4], [-1e4, 1e4]] }],
    };
    const none = placeAll(blocked, field);
    if (none.instances.length !== 0) {
      fail("passage exclusion still placed " + none.instances.length);
      return;
    }
    const counts = countTypes(placed.instances);
    console.log("PASS rocks place " + JSON.stringify(counts) + " seeds " + placed.seeds.length + " cv " + radiusCv(placed.instances).toFixed(3));
    return;
  }
  const manifestPath = resolve(root, numbers.pack, "src/ruins/manifest.json");
  if (existsSync(manifestPath)) {
    numbers.passages = passagesFromRuin(JSON.parse(readFileSync(manifestPath, "utf8")));
  }
  const placed = placeAll(numbers, field);
  const wi = argv.indexOf("--write");
  if (wi >= 0) {
    const out = manifestFrom(numbers, placed);
    writeFileSync(argv[wi + 1], JSON.stringify(out, null, 2) + "\n");
    console.log("wrote " + argv[wi + 1] + " " + out.instances.length);
  } else {
    console.log(JSON.stringify(countTypes(placed.instances)));
  }
}

if (process.argv[1] && process.argv[1].endsWith("place.mjs")) {
  main();
}
