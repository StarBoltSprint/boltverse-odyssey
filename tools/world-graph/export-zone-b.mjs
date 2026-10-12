/**
 * Export the current Zone B preview into zone.v1.
 * Reads files. Does not invent a lane count, an Imagine camera, a LOD path,
 * a fidelity threshold, or a halo colour. Gaps go in todo.
 *
 *   node tools/world-graph/export-zone-b.mjs [out.json]
 */
import { readFileSync, existsSync, statSync, writeFileSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";

const PREVIEW = "/workspace/zb-preview-1008";
const BIBLE_WT = "/workspace/grokcli/wt/zoneb-bible-1008/tools/biome/runtime/biome-runtime.js";
const BIBLE_FALLBACK = fileURLToPath(new URL("./fixtures/bible-av2.js", import.meta.url));
// Street xz is parsed from `const av2` in the zoneb-bible runtime. This checkout
// keeps that literal beside the exporter when the worktree path is absent.
const BIBLE_RT = existsSync(BIBLE_WT) ? BIBLE_WT : BIBLE_FALLBACK;
const KEY_IMAGE = "/workspace/zb-bible-1008/key-city3.jpg";
const META_8M = "/workspace/gd/ab-look/a/meta.json";
const OUT = process.argv[2] || new URL("../../zone-b.zone.json", import.meta.url);

const todo = [];
const note = (s) => { if (!todo.includes(s)) todo.push(s); };

function read(path) {
  return readFileSync(path, "utf8");
}
function mustNum(src, re, label) {
  const m = src.match(re);
  if (!m) { note(label + " was not found in source; left null"); return null; }
  const n = Number(m[1]);
  if (!Number.isFinite(n)) { note(label + " did not parse as a number"); return null; }
  return n;
}
function sliceBlock(src, startRe) {
  const m = startRe.exec(src);
  if (!m) return null;
  const from = m.index + m[0].length - 1;
  if (src[from] !== "{") return null;
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(from, i + 1); }
  }
  return null;
}
function jsArray(src, marker) {
  const i = src.indexOf(marker);
  if (i < 0) return null;
  const start = src.indexOf("[", i);
  let depth = 0;
  for (let j = start; j < src.length; j++) {
    const c = src[j];
    if (c === "[") depth++;
    else if (c === "]") { depth--; if (depth === 0) return src.slice(start, j + 1); }
  }
  return null;
}
function wake() {
  return { type: "placeholder", enabled: false };
}
function emptyAsset(glb) {
  return { glb, lods: [] };
}

function avenue2Defaults(bibleSrc, biome) {
  const block = sliceBlock(bibleSrc, /const av2 = \{/);
  if (!block) { note("avenue2 defaults were not found in the bible runtime"); return null; }
  const num = (name) => {
    const m = block.match(new RegExp(name + ":\\s*(-?[0-9.]+)"));
    return m ? Number(m[1]) : null;
  };
  const av2 = {
    headingDeg: num("headingDeg"),
    meanderM: num("meanderM"),
    meanderWavelengthM: num("meanderWavelengthM"),
    plazaX: num("plazaX"),
    plazaZ: num("plazaZ"),
  };
  if (Object.values(av2).some((v) => v == null)) {
    note("an avenue2 default failed to parse; street world xz left unset");
    return null;
  }
  const over = biome?.ground?.relief?.avenue2;
  if (over && typeof over === "object") Object.assign(av2, over);
  return av2;
}

function avenue2At(s, lat, av2) {
  const h = (av2.headingDeg * Math.PI) / 180;
  const f2x = Math.sin(h), f2z = -Math.cos(h);
  const r2x = -f2z, r2z = f2x;
  const TAU = Math.PI * 2;
  const meander = av2.meanderM * Math.sin((s / av2.meanderWavelengthM) * TAU);
  const x = av2.plazaX + f2x * s + r2x * meander;
  const z = av2.plazaZ + f2z * s + r2z * meander;
  return { x: x + r2x * lat, z: z + r2z * lat };
}

async function cameraLook(x, y, z, yawDeg, pitchDeg) {
  if (y == null) return { position: [x, null, z], target: null, forward: null };
  const THREE = await import(pathToFileURL(PREVIEW + "/three.module.js").href);
  const cam = new THREE.PerspectiveCamera();
  cam.rotation.order = "YXZ";
  cam.position.set(x, y, z);
  cam.rotation.set((pitchDeg * Math.PI) / 180, (-yawDeg * Math.PI) / 180, 0);
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
  const target = cam.position.clone().add(dir);
  return {
    position: [x, y, z],
    target: [target.x, target.y, target.z],
    forward: [dir.x, dir.y, dir.z],
  };
}

function glbFor(moduleName) {
  if (!moduleName) return null;
  const rel = `objects1/${moduleName}/${moduleName}.glb`;
  if (!existsSync(PREVIEW + "/" + rel)) {
    note("no GLB file for module " + moduleName);
    return null;
  }
  const extra = [`objects1/${moduleName}/${moduleName}_lod1.glb`, `objects1/${moduleName}/${moduleName}_lod2.glb`];
  for (const p of extra) {
    if (existsSync(PREVIEW + "/" + p)) note("unexpected extra LOD file " + p);
  }
  return rel;
}

function placed(kind, row) {
  const glb = glbFor(row.module);
  return {
    id: row.id,
    kind,
    asset: emptyAsset(glb),
    sources: [],
    cameras: [],
    transform: {
      position: [row.x, null, row.z],
      rotationDeg: { yaw: row.yaw, leanDeg: row.leanDeg, leanAxisDeg: row.leanAxisDeg },
      scale: [row.scale, row.scale, row.scale],
    },
    layout: {
      module: row.module,
      lod: row.lod,
      s: row.s,
      lateral: row.lateral,
      sinkWant: row.sinkWant,
      height: row.height,
    },
    fidelity: {},
    wake: wake(),
  };
}

async function main() {
  const biome = JSON.parse(read(PREVIEW + "/biome.json"));
  const layout = JSON.parse(read(PREVIEW + "/objects1/layout.json"));
  const groundDetail = JSON.parse(read(PREVIEW + "/gdet/ground-detail.json"));
  const objectsSrc = read(PREVIEW + "/objects-t7.mjs");
  const mesaSrc = read(PREVIEW + "/mesas/mesas-v11.mjs");
  const skySrc = read(PREVIEW + "/sky1/sky-t7.mjs");
  const mainSrc = read(PREVIEW + "/main.mjs");
  const indexSrc = read(PREVIEW + "/index.html");
  const bibleSrc = read(BIBLE_RT);
  const manifest = JSON.parse(read(PREVIEW + "/tex-manifest.json"));

  const spawnM = objectsSrc.match(/spawn:\s*\{\s*x:\s*(-?[\d.]+),\s*z:\s*(-?[\d.]+),\s*yaw:\s*(-?[\d.]+),\s*pitch:\s*(-?[\d.]+),\s*eye:\s*(-?[\d.]+)\s*\}/);
  if (!spawnM) note("hero spawn literal was not found in objects-t7.mjs");
  const spawn = spawnM ? {
    x: Number(spawnM[1]), z: Number(spawnM[2]), yaw: Number(spawnM[3]),
    pitch: Number(spawnM[4]), eye: Number(spawnM[5]),
  } : null;

  const sun = {
    azimuthDeg: mustNum(objectsSrc, /const SUN_AZIMUTH = (-?[\d.]+)/, "SUN_AZIMUTH"),
    elevationDeg: mustNum(objectsSrc, /const SUN_ELEVATION = (-?[\d.]+)/, "SUN_ELEVATION"),
    requestedAzimuthDeg: mustNum(objectsSrc, /const SUN_REQUESTED_AZIMUTH = (-?[\d.]+)/, "SUN_REQUESTED_AZIMUTH"),
    color: "#ffb089",
    intensity: 1.35,
    castShadow: false,
    bible: biome.sun,
  };
  if (!/DirectionalLight\(0xffb089,\s*1\.35\)/.test(objectsSrc)) {
    note("DirectionalLight(0xffb089, 1.35) was not found; sun color and intensity left as the last read of objects-t7");
  }
  const shadow = {
    elevationDeg: mustNum(objectsSrc, /const SHADOW_ELEVATION = (-?[\d.]+)/, "SHADOW_ELEVATION"),
    color: "#ffffff",
    intensity: 0,
    mapSize: 2048,
    bias: -0.0002,
    normalBias: 0.08,
  };
  const hemi = { sky: "#c47ad4", ground: "#3a2420", intensity: 0.25 };
  if (!/HemisphereLight\(0xc47ad4,\s*0x3a2420,\s*0\.25\)/.test(objectsSrc)) {
    note("HemisphereLight(0xc47ad4, 0x3a2420, 0.25) was not found");
  }
  const shade = {
    graphite: (objectsSrc.match(/hexToLinear\("(#[0-9a-fA-F]+)"\)/) || [])[1] || null,
    sand: (objectsSrc.match(/uZbSand[\s\S]{0,80}hexToLinear\("(#[0-9a-fA-F]+)"\)/) || [])[1] || null,
    sun: "#ffb089",
  };

  const haloWidth = /18 deg wide quad/.test(skySrc) && /Math\.tan\(9 \* deg\)/.test(skySrc) ? 18 : null;
  if (haloWidth == null) note("halo width was not found as the 18 deg atlas quad in sky-t7.mjs");
  const atlas = (skySrc.match(/sky1\/sky7-atlas\.png/) || [])[0] || null;
  if (!atlas) note("sky atlas path was not found");

  let eyeY = null;
  try {
    const R = await import(pathToFileURL(PREVIEW + "/runtime/biome-runtime-v61.js").href);
    const field = R.createDuneField(biome);
    eyeY = (x, z, eye) => field.surfaceHeight(x, z) + eye;
  } catch (err) {
    note("createDuneField import failed (" + err.message + "); camera y left null");
  }

  const av2 = avenue2Defaults(bibleSrc, biome);
  const heroShot = layout.hero;
  const streetShot = layout.street;
  const heroPose = spawn ? {
    name: "hero",
    x: spawn.x, z: spawn.z, yaw: spawn.yaw, pitch: spawn.pitch, eye: spawn.eye,
    fov: heroShot.fov,
    source: "objects-t7.mjs spawn literal (applied when the URL has no x/z)",
  } : null;
  let streetXz = null;
  if (av2 && streetShot) streetXz = avenue2At(streetShot.standS, streetShot.lateral, av2);
  const streetPose = streetShot && streetXz ? {
    name: "street",
    x: streetXz.x,
    z: streetXz.z,
    yaw: streetShot.heading,
    pitch: -streetShot.pitchDownDeg,
    eye: streetShot.eyeM,
    fov: streetShot.fov,
    source: "layout.street angles; world xz from bible avenue2At(standS, lateral); viewer pitch is -pitchDownDeg",
  } : null;
  if (!streetPose) note("street world pose could not be derived from layout.street and avenue2At");

  let m8 = null;
  if (!existsSync(META_8M)) note("8 m pose file is missing: " + META_8M);
  else {
    const meta = JSON.parse(read(META_8M));
    const pose = meta["avenue-8m"] && meta["avenue-8m"].pose;
    if (!pose) note("avenue-8m pose is missing from " + META_8M);
    else {
      m8 = {
        name: "8m",
        x: pose.x, z: pose.z, yaw: pose.yaw, pitch: pose.pitch,
        eye: null,
        resolvedEye: 3.0,
        eyeSource: "main.mjs default when the URL sets x or z and omits eye",
        fov: heroShot ? heroShot.fov : null,
        frame: { W: meta["avenue-8m"].W, H: meta["avenue-8m"].H },
        source: META_8M + " avenue-8m",
      };
    }
  }

  async function shotCamera(pose) {
    if (!pose) return null;
    const eye = pose.eye != null ? pose.eye : pose.resolvedEye;
    const y = eyeY && eye != null ? eyeY(pose.x, pose.z, eye) : null;
    if (y == null) note(pose.name + " camera y is null");
    const look = await cameraLook(pose.x, y, pose.z, pose.yaw, pose.pitch);
    return {
      name: pose.name,
      fov: pose.fov,
      position: look.position,
      target: look.target,
      forward: look.forward,
      previewPose: pose,
    };
  }

  const cameras = {
    hero: await shotCamera(heroPose),
    street: await shotCamera(streetPose),
    m8: await shotCamera(m8),
  };
  const keyCamera = cameras.hero ? {
    fov: cameras.hero.fov,
    position: cameras.hero.position,
    target: cameras.hero.target,
    previewPose: cameras.hero.previewPose,
  } : { fov: null, position: null, target: null };

  const objects = [];
  for (const row of layout.towers || []) objects.push(placed("tower", row));
  for (const row of layout.skyline || []) objects.push(placed("skyline", row));
  if (layout.spire) {
    const s = layout.spire;
    objects.push({
      id: s.id,
      kind: "spire",
      asset: emptyAsset(glbFor("spire")),
      sources: [],
      cameras: [],
      transform: {
        position: [s.x, s.baseY, s.z],
        rotationDeg: { yaw: s.yaw, leanDeg: s.leanDeg, leanAxisDeg: s.leanAxisDeg },
        scale: [s.scale, s.scale, s.scale],
      },
      layout: { s: s.s, lateral: s.lateral, sinkWant: s.sinkWant, height: s.height, baseY: s.baseY },
      fidelity: {},
      wake: wake(),
    });
  }
  const mesaText = jsArray(mesaSrc, "export const MESA_LAYOUT");
  const avO = mesaSrc.match(/const AV_O = \[([-\d.]+),\s*([-\d.]+)\]/);
  const avF = mesaSrc.match(/AV_F = \[([-\d.]+),\s*([-\d.]+)\]/);
  const avR = mesaSrc.match(/AV_R = \[([-\d.]+),\s*([-\d.]+)\]/);
  if (!mesaText || !avO || !avF || !avR) note("MESA_LAYOUT or the avenue frame was not parsed; mesas omitted");
  else {
    const rows = Function("return (" + mesaText + ")")();
    const O = [Number(avO[1]), Number(avO[2])];
    const F = [Number(avF[1]), Number(avF[2])];
    const Rv = [Number(avR[1]), Number(avR[2])];
    const avXZ = (s, lat) => [O[0] + F[0] * s + Rv[0] * lat, O[1] + F[1] * s + Rv[1] * lat];
    const HERO = avXZ(-52, 0);
    for (const L of rows) {
      const [x, z] = avXZ(L.s, L.lat);
      let yaw = L.yaw ?? 0;
      if (L.face) yaw = (Math.atan2(HERO[0] - x, HERO[1] - z) * 180) / Math.PI;
      const geo = `mesas/strata6/${L.id}-geo.json`;
      objects.push({
        id: "mesa-" + L.id,
        kind: "mesa",
        asset: { glb: null, lods: [], geo: existsSync(PREVIEW + "/" + geo) ? geo : null },
        sources: [],
        cameras: [],
        transform: {
          position: [x, null, z],
          rotationDeg: { yaw },
          scale: [L.mirror ? -1 : 1, 1, 1],
          layoutScale: L.scale,
        },
        layout: { s: L.s, lat: L.lat, face: !!L.face, mirror: !!L.mirror, scale: L.scale },
        fidelity: {},
        wake: wake(),
      });
      if (!existsSync(PREVIEW + "/" + geo)) note("mesa geo missing: " + geo);
    }
    note("mesa asset is a geo json, not a GLB");
    note("mesa and tower baseY are seated at runtime from surfaceHeight; y is null except the spire, which stores baseY");
  }
  (layout.cables || []).forEach((c, i) => {
    const ax = c.a && c.a[0], ay = c.a && c.a[1], az = c.a && c.a[2];
    const bx = c.b && c.b[0], by = c.b && c.b[1], bz = c.b && c.b[2];
    const mid = [ (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2 ];
    objects.push({
      id: "cable-" + (c.from || i) + "-" + (c.to || i),
      kind: "cable",
      asset: emptyAsset(null),
      sources: [],
      cameras: [],
      transform: {
        position: mid,
        rotationDeg: null,
        scale: [1, 1, 1],
        endpoints: { a: c.a, b: c.b },
      },
      layout: { from: c.from, to: c.to },
      fidelity: {},
      wake: wake(),
    });
  });
  note("cables have no GLB; the preview builds them in code from layout endpoints");

  const skylineN = (layout.skyline || []).length;
  if (layout.counts && layout.counts.skyline !== skylineN) {
    note("layout.counts.skyline is " + layout.counts.skyline + " and the skyline array length is " + skylineN);
  }
  note("no separate LOD glb files; LODs are meshes inside the single module glb (layout.lod is the index)");
  note("per-object Imagine source images and the cameras that produced them are not stored; tex-manifest only lists objects1/vision");
  note("no per-object fidelity thresholds are stored");
  note("lane count and lane width are not stored");
  note("a segment recycler is not in the current Zone B preview");
  note("no stored LPIPS or SSIM threshold; qualityGates copy biome.budgets only");
  note("halo is Imagine atlas pixels; no halo colour is stored");
  if (biome.anchor && biome.anchor.sampled) {
    note("biome.anchor.sampled.file is " + JSON.stringify(biome.anchor.sampled.file) + "; the key still on disk used here is " + KEY_IMAGE);
  }
  if (!existsSync(KEY_IMAGE)) note("key image file is missing: " + KEY_IMAGE);

  const vision = (manifest.textures || []).map((t) => ({ file: t.file, source: t.source, note: t.note }));

  const pin = (re) => {
    const m = mainSrc.match(re) || indexSrc.match(re);
    return m ? m[1] : null;
  };

  const zone = {
    $schema: "schema/zone.v1.schema.json",
    schema: "zone.v1",
    version: "1.0",
    id: "zone-b",
    keyImage: existsSync(KEY_IMAGE) ? KEY_IMAGE : null,
    keyCamera,
    cameras,
    biome,
    lighting: {
      sun,
      fog: biome.fog,
      halo: { atlas, widthDeg: haloWidth, pixels: "Imagine atlas; no stored colour" },
      hemi,
      shadow,
      shade,
      probes: [],
    },
    objects,
    gameplay: {
      avenue: layout.avenue,
      hero: heroShot || null,
      street: streetShot || null,
      chase: layout.chase || null,
      spawn: heroPose,
      lanes: null,
      laneWidth: null,
    },
    qualityGates: {
      maxDrawCalls: biome.budgets ? biome.budgets.drawCalls : null,
      maxTrisOnScreen: biome.budgets ? biome.budgets.trisOnScreen : null,
      maxTexMB: biome.budgets ? biome.budgets.texMB : null,
      maxLpipsKeyView: null,
      maxSsimKeyView: null,
    },
    wakeDefaults: wake(),
    sources: { vision },
    runtime: {
      previewRoot: PREVIEW,
      modules: {
        main: "main.mjs",
        biomeRuntime: "runtime/biome-runtime-v61.js",
        objects: "objects-t7.mjs",
        mesas: "mesas/mesas-v11.mjs",
        sky: "sky1/sky-t7.mjs",
      },
      pins: {
        indexMain: pin(/main\.mjs\?v=(\d+)/),
        biomeRuntime: pin(/biome-runtime-v61\.js\?v=(\d+)/),
        objects: pin(/objects-t7\.mjs\?v=(\d+)/),
        sky: pin(/sky-t7\.mjs\?v=(\d+)/),
        mesas: pin(/mesas-v11\.mjs\?v=(\d+)/),
      },
      biome,
      layout,
      groundDetail,
      capture: {
        query: "lockq=1&dyn=0&hud=0&grain=0",
        clock: { performanceNow: 100000, skyT: 120, airT: 10 },
      },
    },
    todo,
  };

  const text = JSON.stringify(zone, null, 1) + "\n";
  writeFileSync(OUT, text);
  console.log("wrote " + OUT + " objects=" + objects.length + " todos=" + todo.length);
}

main().catch((err) => { console.error(err); process.exit(1); });
