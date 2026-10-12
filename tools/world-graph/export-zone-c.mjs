/**
 * Export the Zone C causeway into zone.v1.
 * Copies numbers the terrain step already stored. Missing light, sky, and
 * solids stay in todo. Does not invent a colour, a lane count, or a GLB.
 *
 *   node tools/world-graph/export-zone-c.mjs [out.json]
 *   node tools/world-graph/export-zone-c.mjs --solids [out.json]
 *
 * Default writes the causeway record only. --solids appends the five solids
 * and writes steps/zone-c/05-solids/zone-c.zone.json. It does not rewrite the
 * terrain file.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const STEP = new URL("../../steps/zone-c/03-terrain/", import.meta.url);
const solidsArg = process.argv.find((a) => a.startsWith("--solids="));
const solidsMode = process.argv.includes("--solids") || !!solidsArg;
const SOLIDS_STEP = solidsArg
  ? new URL(solidsArg.slice("--solids=".length).endsWith("/") ? solidsArg.slice("--solids=".length) : solidsArg.slice("--solids=".length) + "/", import.meta.url.startsWith("file:") ? new URL("../../", import.meta.url) : undefined)
  : new URL("../../steps/zone-c/05-solids/", import.meta.url);
const args = process.argv.slice(2).filter((a) => a !== "--solids" && !a.startsWith("--solids="));
const OUT = args[0]
  ? args[0]
  : solidsMode
    ? new URL("zone-c.zone.json", SOLIDS_STEP)
    : new URL("zone-c.zone.json", STEP);

function readJson(url) {
  return JSON.parse(readFileSync(url, "utf8"));
}

const height = readJson(new URL("data/height.json", STEP));
const numbers = readJson(new URL("numbers.json", STEP));
const cameraFile = readJson(new URL("../../steps/zone-c/01-camera/camera.json", import.meta.url));
const cam = height.camera;
const pitch = cam.pitch * Math.PI / 180;
const eyeY = cam.eye;
const forward = [0, Math.sin(pitch), -Math.cos(pitch)];
const position = [cam.x, eyeY, cam.z];
const target = [
  position[0] + forward[0],
  position[1] + forward[1],
  position[2] + forward[2],
];

const plateFiles = (numbers.plates && numbers.plates.plates) || ["moss-top-1.jpg", "moss-top-2.jpg", "moss-top-3.jpg", "moss-top-4.jpg"];
const plateSources = plateFiles.map((name) => ({
  file: "steps/zone-c/03-terrain/plates/" + name,
  role: "terrain-plate",
}));
const uvOpen = !(numbers.checks && numbers.checks.uvStretch && numbers.checks.uvStretch.pass);
const todo = [
  "cliffs, arches, gorge rock, foliage, falls and the planet are not in this heightfield",
  "no sun, fog, or halo is stored for Zone C yet",
  "the causeway has no GLB; the mesh is the height grid",
];

const zone = {
  $schema: "schema/zone.v1.schema.json",
  schema: "zone.v1",
  version: "1.0",
  id: "zone-c",
  keyImage: height.keyImage,
  keyCamera: {
    fov: cam.fov,
    position,
    target,
    previewPose: {
      yaw: cam.yaw,
      pitch: cam.pitch,
      eye: cam.eye,
      horizonRow: cameraFile.horizonRow,
    },
  },
  biome: {
    id: "cascade-verdance",
    kit: "biome/kits/cascade-verdance.json",
  },
  lighting: {
    sun: { stored: false },
    fog: { stored: false },
    halo: { stored: false },
  },
  objects: [
    {
      id: "causeway",
      asset: { glb: null, lods: [] },
      sources: [
        { file: height.keyImage, role: "key" },
        ...plateSources,
        { file: "steps/zone-c/03-terrain/data/weight.bin", role: "key-weight" },
        { file: "steps/zone-c/03-terrain/data/tint.bin", role: "key-tint" },
      ],
      cameras: [{ fov: cam.fov, position, target }],
      transform: {
        position: [height.origin[0], 0, height.origin[1]],
        rotationDeg: [0, 0, 0],
        scale: [1, 1, 1],
      },
      fidelity: {
        pathIoU: numbers.checks.pathIoU.value,
        reliefM: numbers.checks.reliefM.value,
        maxSlopeDeg: numbers.checks.corridor.value.maxSlopeDeg,
      },
      wake: { type: "placeholder", enabled: false },
      terrain: {
        height: "steps/zone-c/03-terrain/data/height.bin",
        step: height.step,
        nx: height.nx,
        nz: height.nz,
        hLo: height.hLo,
        hHi: height.hHi,
      },
    },
  ],
  gameplay: {
    avenue: height.avenue,
    spawn: { position, eye: cam.eye },
    path: [[0, 0], [0, -8], [0, -30], [0, -60], [0, -90]],
    lanes: null,
    laneWidth: null,
  },
  qualityGates: {
    maxDrawCalls: 12,
    pathIoU: numbers.checks.pathIoU.value,
    blockingPass: numbers.blockingPass,
    pass: numbers.pass,
    uvStretchOpen: uvOpen,
  },
  todo,
  wakeDefaults: { type: "placeholder", enabled: false },
  runtime: {
    previewRoot: null,
    modules: { main: "tools/terrain-from-key/staging/zone-c/main.mjs" },
    biome: { id: "cascade-verdance", source: "biome/kits/cascade-verdance.json" },
    layout: {
      terrain: "steps/zone-c/03-terrain/data/height.bin",
      origin: height.origin,
      step: height.step,
      nx: height.nx,
      nz: height.nz,
    },
    groundDetail: {
      plates: plateSources.map((s) => s.file),
      weight: "steps/zone-c/03-terrain/data/weight.bin",
      tint: "steps/zone-c/03-terrain/data/tint.bin",
      tile: "steps/zone-c/03-terrain/data/tile.bin",
    },
    pins: {},
  },
};

if (solidsMode) {
  const packPath = new URL("data/solids.json", SOLIDS_STEP);
  if (!existsSync(packPath)) throw new Error("missing solids pack " + packPath.pathname);
  const pack = JSON.parse(readFileSync(packPath, "utf8"));
  const numbersPath = new URL("numbers.json", SOLIDS_STEP);
  const solidNumbers = existsSync(numbersPath) ? JSON.parse(readFileSync(numbersPath, "utf8")) : null;
  for (const o of pack.objects) {
    const bag = o.plated || o.pending || {};
    const plates = Object.keys(bag).map((n) => Number(n)).sort((a, b) => a - b);
    const plateSources = plates.map((n) => {
      const rec = bag[String(n)] || {};
      return { file: rec.file || null, role: rec.bound ? "plate" : "pending-plate", plate: n };
    });
    const geomPath = new URL("object-gate/" + o.name + "/geometry.json", SOLIDS_STEP);
    let welded = null;
    if (existsSync(geomPath)) {
      const rows = JSON.parse(readFileSync(geomPath, "utf8"));
      welded = Array.isArray(rows) ? rows[0] : rows;
    }
    zone.objects.push({
      id: o.name,
      asset: { glb: null, lods: [] },
      sources: [
        { file: pack.key, role: "key-visible" },
        ...plateSources,
      ],
      cameras: [{ fov: cam.fov, position, target }],
      transform: { position: [0, 0, 0], rotationDeg: [0, 0, 0], scale: [1, 1, 1] },
      fidelity: {
        stretchP95: o.stretchP95,
        keyTris: o.keyTris,
        sameHull: o.sameHull,
        pendingPlates: plates,
        openEdges: welded && welded.open != null ? welded.open : o.edges.open,
        nonManifold: welded && welded.nonManifold != null ? welded.nonManifold : o.edges.nonManifold,
        indexNonManifold: o.edges.nonManifold,
      },
      wake: { type: "placeholder", enabled: false },
    });
  }
  zone.qualityGates.pass = !!(solidNumbers && solidNumbers.pass === true);
  zone.qualityGates.solidsPass = zone.qualityGates.pass;
  zone.todo = zone.todo.filter((t) => !/cliffs, arches/.test(t) && !/wait on Imagine plates/.test(t));
  const waiting = zone.objects.some((o) => (o.sources || []).some((s) => s.role === "pending-plate"));
  if (waiting) zone.todo.push("hidden faces of the five solids wait on Imagine plates 5-15");
  zone.runtime.modules.solids = "tools/imagine-to-3d/staging/zone-c-solids/main.mjs";
  const solidsDir = solidsArg
    ? solidsArg.slice("--solids=".length).replace(/^\.\//, "").replace(/\/$/, "")
    : "steps/zone-c/05-solids";
  zone.runtime.layout.solids = solidsDir + "/data/solids.bin";
}

const { validateZone } = await import(new URL("../../runtime/zone-loader.mjs", import.meta.url).href);
validateZone(zone);
const text = JSON.stringify(zone, null, 1) + "\n";
const outPath = typeof OUT === "string" ? OUT : fileURLToPath(OUT);
writeFileSync(outPath, text);
console.log("wrote " + outPath + " objects=" + zone.objects.length);
