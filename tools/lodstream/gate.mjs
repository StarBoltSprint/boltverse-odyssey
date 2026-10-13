// LOD outline, triangle budget, and texture streaming gate.
// Silhouette diff is the XOR of the two hit masks at a switch distance, the outline half of
// tools/object-gate/py/lod_gate.py. The limit here is 0 px (that file allows a small fraction and a 4 px blob).
// Mask size and vfov match tools/object-gate/profiles/_base.yaml morph.maskW/maskH and the game vfov (58).
//
// node tools/lodstream/gate.mjs --manifest <manifest.json> --out <report.json>
import fs from "node:fs";
import path from "node:path";

export const DEFAULTS = {
  id: "default",
  lod0Max: 80000,
  switchesM: [15, 40],
  nativeMinPx: 1024,
  maskW: 540,
  maskH: 960,
  fovDeg: 58,
  views: [0, 90, 180, 270],
};

const LEVELS = [0, 1, 2];

function fail(message) {
  const err = new Error(message);
  err.code = "LODSTREAM";
  throw err;
}

function readJson(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (err) {
    fail(`cannot read ${file}: ${err.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    fail(`bad json ${file}: ${err.message}`);
  }
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function norm(a) {
  const len = Math.hypot(a[0], a[1], a[2]);
  if (len < 1e-12) return [0, 0, 0];
  return [a[0] / len, a[1] / len, a[2] / len];
}

function edge(a, b, c) {
  return (c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0]);
}

/** Triangle count from the index buffer. padTriangles are extra degenerate tris counted in the budget. */
export function triangleCount(mesh) {
  if (!mesh || !Array.isArray(mesh.indices)) fail("mesh indices missing");
  if (mesh.indices.length % 3 !== 0) fail("mesh indices length is not a multiple of 3");
  const pad = mesh.padTriangles ?? 0;
  if (!Number.isInteger(pad) || pad < 0) fail("padTriangles must be an integer >= 0");
  return mesh.indices.length / 3 + pad;
}

function resolveMesh(entry, baseDir) {
  if (entry && entry.positions && entry.indices) return entry;
  if (typeof entry === "string") return readJson(path.resolve(baseDir, entry));
  fail("lod mesh must be a path or a {positions, indices} object");
}

function mergeProfile(over) {
  const profile = { ...DEFAULTS, ...(over || {}) };
  profile.switchesM = (over && over.switchesM) || DEFAULTS.switchesM;
  profile.views = (over && over.views) || DEFAULTS.views;
  if (!Number.isFinite(profile.lod0Max) || profile.lod0Max < 0) fail("profile lod0Max is not a number");
  if (!Array.isArray(profile.switchesM) || profile.switchesM.length < 2) fail("profile switchesM needs 15 m and 40 m");
  if (!Array.isArray(profile.views) || profile.views.length < 1) fail("profile views missing");
  return profile;
}

export function resolveProfile(doc, baseDir) {
  const raw = doc.profile;
  if (raw == null) return mergeProfile(null);
  if (typeof raw === "string") return mergeProfile(readJson(path.resolve(baseDir, raw)));
  if (typeof raw === "object") return mergeProfile(raw);
  fail("profile must be a path or an object");
}

function boundsOf(meshes) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of meshes) {
    for (const p of mesh.positions) {
      if (!p || p.length < 3) fail("mesh position is not xyz");
      for (let k = 0; k < 3; k++) {
        if (p[k] < min[k]) min[k] = p[k];
        if (p[k] > max[k]) max[k] = p[k];
      }
    }
  }
  if (!Number.isFinite(min[0])) fail("mesh has no positions");
  return { min, max, center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2] };
}

function fillTri(mask, width, height, a, b, c) {
  const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  if (maxX < minX || maxY < minY) return;
  const area = edge(a, b, c);
  if (Math.abs(area) < 1e-8) return;
  const positive = area > 0;
  for (let y = minY; y <= maxY; y++) {
    const row = y * width;
    for (let x = minX; x <= maxX; x++) {
      const p = [x + 0.5, y + 0.5];
      const w0 = edge(b, c, p);
      const w1 = edge(c, a, p);
      const w2 = edge(a, b, p);
      const inside = positive ? w0 >= 0 && w1 >= 0 && w2 >= 0 : w0 <= 0 && w1 <= 0 && w2 <= 0;
      if (inside) mask[row + x] = 1;
    }
  }
}

/** Binary hit mask. padTriangles are degenerate and are not drawn. */
export function rasterMask(mesh, eye, target, width, height, fovDeg) {
  const forward = norm(sub(target, eye));
  let right = norm(cross(forward, [0, 1, 0]));
  if (right[0] === 0 && right[1] === 0 && right[2] === 0) right = [1, 0, 0];
  const up = cross(right, forward);
  const focal = (height / 2) / Math.tan((fovDeg * Math.PI) / 360);
  const mask = new Uint8Array(width * height);
  const idx = mesh.indices;
  const pos = mesh.positions;
  const project = (p) => {
    const rel = sub(p, eye);
    const z = dot(rel, forward);
    if (z <= 1e-4) return null;
    return [width / 2 + (focal * dot(rel, right)) / z, height / 2 - (focal * dot(rel, up)) / z];
  };
  for (let t = 0; t < idx.length; t += 3) {
    const a = project(pos[idx[t]]);
    const b = project(pos[idx[t + 1]]);
    const c = project(pos[idx[t + 2]]);
    if (!a || !b || !c) continue;
    fillTri(mask, width, height, a, b, c);
  }
  return mask;
}

export function diffPx(a, b) {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

function hitPx(mask) {
  let n = 0;
  for (let i = 0; i < mask.length; i++) n += mask[i];
  return n;
}

function eyeAt(center, distance, yawDeg) {
  const yaw = (yawDeg * Math.PI) / 180;
  return [center[0] + Math.sin(yaw) * distance, center[1], center[2] + Math.cos(yaw) * distance];
}

function outlineSwitch(finer, coarser, center, distance, profile) {
  const views = [];
  let diff = 0;
  let hits = 0;
  for (const yaw of profile.views) {
    const eye = eyeAt(center, distance, yaw);
    const distanceM = Math.hypot(eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]);
    const near = rasterMask(finer, eye, center, profile.maskW, profile.maskH, profile.fovDeg);
    const far = rasterMask(coarser, eye, center, profile.maskW, profile.maskH, profile.fovDeg);
    const px = diffPx(near, far);
    const hit = hitPx(near);
    diff += px;
    hits += hit;
    views.push({ yaw, distanceM: round6(distanceM), diffPx: px, hitPx: hit });
  }
  return { diffPx: diff, hitPx: hits, views };
}

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

function nativeSize(tex) {
  if (Array.isArray(tex.nativePx) && tex.nativePx.length >= 2) return [tex.nativePx[0], tex.nativePx[1]];
  if (Number.isFinite(tex.nativeW) && Number.isFinite(tex.nativeH)) return [tex.nativeW, tex.nativeH];
  return null;
}

function loadLods(doc, baseDir) {
  if (!Array.isArray(doc.lods)) fail("manifest lods missing");
  const byLevel = new Map();
  for (const entry of doc.lods) {
    const level = entry && entry.level;
    if (!LEVELS.includes(level)) fail(`lod level ${level} is not 0, 1, or 2`);
    if (byLevel.has(level)) fail(`duplicate lod ${level}`);
    byLevel.set(level, resolveMesh(entry.mesh, baseDir));
  }
  return LEVELS.map((level) => ({ level, mesh: byLevel.get(level) || null }));
}

/**
 * Gate one manifest object. baseDir resolves mesh and profile paths.
 * Returns the report. Does not throw for a measured FAIL. Throws for a broken manifest.
 */
export function gateDocument(doc, baseDir = ".") {
  if (!doc || typeof doc !== "object") fail("manifest is not an object");
  const id = String(doc.id || "lod");
  const profile = resolveProfile(doc, baseDir);
  const lods = loadLods(doc, baseDir);
  const rows = [];
  const missing = lods.filter((l) => !l.mesh).map((l) => l.level);
  if (missing.length) {
    rows.push({ name: "lod-set", pass: false, detail: `missing lod ${missing.join(",")}` });
  } else {
    rows.push({ name: "lod-set", pass: true, detail: "lod0 lod1 lod2" });
  }

  const triangles = {};
  const counts = [];
  for (const lod of lods) {
    if (!lod.mesh) {
      triangles[`lod${lod.level}`] = null;
      counts.push(null);
      continue;
    }
    const n = triangleCount(lod.mesh);
    triangles[`lod${lod.level}`] = n;
    counts.push(n);
  }

  const lod0 = counts[0];
  const budgetOk = lod0 != null && lod0 <= profile.lod0Max;
  rows.push({
    name: "lod0-tris",
    pass: budgetOk,
    value: lod0,
    limit: profile.lod0Max,
    detail: `lod0=${lod0} limit=${profile.lod0Max} profile=${profile.id}`,
  });

  let monotone = true;
  const monoBits = [];
  for (let i = 1; i < counts.length; i++) {
    if (counts[i] == null || counts[i - 1] == null) {
      monotone = false;
      monoBits.push(`lod${i} missing`);
      continue;
    }
    if (counts[i] > counts[i - 1]) {
      monotone = false;
      monoBits.push(`lod${i}=${counts[i]} > lod${i - 1}=${counts[i - 1]}`);
    }
  }
  rows.push({
    name: "lod-monotone",
    pass: monotone && missing.length === 0,
    value: counts,
    detail: monoBits.length ? monoBits.join("; ") : `lod0=${counts[0]} lod1=${counts[1]} lod2=${counts[2]}`,
  });

  const outline = [];
  if (missing.length === 0) {
    const box = boundsOf(lods.map((l) => l.mesh));
    const pairs = [
      [0, 1, profile.switchesM[0]],
      [1, 2, profile.switchesM[1]],
    ];
    for (const [a, b, distance] of pairs) {
      const measured = outlineSwitch(lods[a].mesh, lods[b].mesh, box.center, distance, profile);
      const empty = measured.hitPx === 0;
      const ok = measured.diffPx === 0 && !empty;
      const name = `outline-${distance}m`;
      outline.push({
        name,
        pair: `lod${a}-lod${b}`,
        distanceM: distance,
        diffPx: measured.diffPx,
        hitPx: measured.hitPx,
        limit: 0,
        pass: ok,
        views: measured.views,
      });
      const viewText = measured.views.map((v) => `${v.yaw}:${v.diffPx}`).join(",");
      rows.push({
        name,
        pass: ok,
        value: measured.diffPx,
        limit: 0,
        detail: empty
          ? `empty silhouette at ${distance} m`
          : `diffPx=${measured.diffPx} limit=0 distanceM=${distance} pair=lod${a}-lod${b} hitPx=${measured.hitPx} views=${viewText}`,
      });
    }
  } else {
    for (const distance of profile.switchesM.slice(0, 2)) {
      rows.push({ name: `outline-${distance}m`, pass: false, value: null, limit: 0, detail: "lod set incomplete" });
    }
  }

  const texturesIn = Array.isArray(doc.textures) ? doc.textures : [];
  const textures = [];
  const nativeBad = [];
  const mipBad = [];
  if (texturesIn.length === 0) {
    nativeBad.push("no textures");
    mipBad.push("no textures");
  }
  for (const tex of texturesIn) {
    const idTex = tex && tex.id ? String(tex.id) : "texture";
    const size = tex ? nativeSize(tex) : null;
    const source = tex && tex.source != null ? String(tex.source) : "";
    const mipmaps = !!(tex && tex.mipmaps === true);
    const sizeOk = !!size && size[0] >= profile.nativeMinPx && size[1] >= profile.nativeMinPx;
    const sourceOk = source === "imagine";
    if (!sizeOk || !sourceOk) {
      nativeBad.push(
        `${idTex} ${size ? `${size[0]}x${size[1]}` : "size missing"} source=${source || "missing"} min=${profile.nativeMinPx}`,
      );
    }
    if (!mipmaps) mipBad.push(`${idTex} mipmaps=${tex ? tex.mipmaps : "missing"}`);
    textures.push({
      id: idTex,
      nativePx: size,
      mipmaps,
      source: source || null,
      pass: sizeOk && sourceOk && mipmaps,
    });
  }
  rows.push({
    name: "texture-native",
    pass: nativeBad.length === 0,
    detail: nativeBad.length ? nativeBad.join("; ") : textures.map((t) => `${t.id} ${t.nativePx[0]}x${t.nativePx[1]} imagine`).join("; "),
  });
  rows.push({
    name: "texture-mipmaps",
    pass: mipBad.length === 0,
    detail: mipBad.length ? mipBad.join("; ") : textures.map((t) => `${t.id} mipmaps=true`).join("; "),
  });

  const pass = rows.every((row) => row.pass);
  const outlineDiffPx = {};
  for (const item of outline) outlineDiffPx[String(item.distanceM)] = item.diffPx;
  return {
    schema: "lodstream-report/1",
    tool: "lodstream",
    id,
    pass,
    verdict: pass ? "PASS" : "FAIL",
    for: ["playcheck", "library"],
    profile: {
      id: profile.id,
      lod0Max: profile.lod0Max,
      switchesM: profile.switchesM,
      nativeMinPx: profile.nativeMinPx,
      mask: [profile.maskW, profile.maskH],
      fovDeg: profile.fovDeg,
      views: profile.views,
    },
    triangles,
    outline,
    textures,
    rows,
    playcheck: {
      lodTriangles: triangles,
      outlineDiffPx,
      textures: textures.map((t) => ({ id: t.id, nativePx: t.nativePx, mipmaps: t.mipmaps, source: t.source })),
    },
    library: { reportKind: "lodstream", verdict: pass ? "PASS" : "FAIL", id },
  };
}

export function loadManifest(file) {
  return { doc: readJson(file), baseDir: path.dirname(path.resolve(file)) };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--manifest" || arg === "--out") {
      const value = argv[i + 1];
      if (!value) fail(`missing value for ${arg}`);
      out[arg.slice(2)] = value;
      i++;
    } else fail(`unknown argument ${arg}`);
  }
  return out;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help || !args.manifest || !args.out) {
    console.error("usage: node tools/lodstream/gate.mjs --manifest <manifest.json> --out <report.json>");
    return 2;
  }
  const { doc, baseDir } = loadManifest(args.manifest);
  const report = gateDocument(doc, baseDir);
  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  const bits = [`${report.verdict} ${report.id}`];
  for (const item of report.outline) bits.push(`${item.name}=${item.diffPx}px`);
  if (report.triangles.lod0 != null) bits.push(`lod0=${report.triangles.lod0}`);
  console.log(bits.join(" "));
  return report.pass ? 0 : 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (err) {
    console.error(`FAIL ${err.message}`);
    process.exit(2);
  }
}
