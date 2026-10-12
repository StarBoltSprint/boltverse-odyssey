/**
 * zone.v1 loader. It does not draw. It checks the zone file and answers the
 * three JSON fetches the Zone B preview already makes (biome, layout, ground
 * detail). The existing three.js modules stay the renderer.
 *
 * loadPlayableScene builds the scene from the zone file only: objects,
 * transforms, keyCamera, lighting, and assets. A path string or {glb, lods}
 * stays as stored. { "library": "<id>" } is resolved only when opts.resolveLibrary
 * is passed (the node resolver lives in tools/world-graph/library-resolver.mjs).
 * This file stays free of node: imports so the preview page can import it.
 * An id that is not in zone.objects is refused.
 */

const REQUIRED_ZONE = [
  "schema", "version", "id", "keyImage", "keyCamera", "biome", "lighting",
  "objects", "gameplay", "qualityGates", "todo", "wakeDefaults", "runtime",
];

export function validateZone(zone) {
  if (!zone || typeof zone !== "object") throw new Error("zone is not an object");
  if (zone.schema !== "zone.v1") throw new Error("schema must be zone.v1");
  if (zone.version !== "1.0") throw new Error("version must be 1.0");
  for (const key of REQUIRED_ZONE) {
    if (zone[key] == null) throw new Error("missing " + key);
  }
  if (!Array.isArray(zone.objects)) throw new Error("objects must be an array");
  if (!Array.isArray(zone.todo)) throw new Error("todo must be an array");
  if (zone.wakeDefaults?.type !== "placeholder" || zone.wakeDefaults.enabled !== false) {
    throw new Error("wakeDefaults must be the placeholder");
  }
  for (const o of zone.objects) {
    if (!o || typeof o.id !== "string") throw new Error("object missing id");
    if (!assetOk(o.asset)) throw new Error(o.id + " asset");
    if (!Array.isArray(o.sources) || !Array.isArray(o.cameras)) throw new Error(o.id + " sources");
    const t = o.transform;
    if (!t || !Array.isArray(t.position) || t.position.length !== 3) throw new Error(o.id + " transform");
    if (!("rotationDeg" in t) || t.scale == null) throw new Error(o.id + " rotation/scale");
    if (!o.fidelity || typeof o.fidelity !== "object") throw new Error(o.id + " fidelity");
    if (o.wake?.type !== "placeholder" || o.wake.enabled !== false) throw new Error(o.id + " wake");
  }
  const rt = zone.runtime;
  if (!rt.biome || !rt.layout || !rt.groundDetail) throw new Error("runtime payloads missing");
  return zone;
}

/** Path string, { "library": id } with no glb, or the stored { glb, lods } object. */
function assetOk(asset) {
  if (typeof asset === "string" && asset.length > 0) return true;
  if (!asset || typeof asset !== "object") return false;
  if (typeof asset.library === "string" && asset.library.length > 0 && !("glb" in asset)) return true;
  return "glb" in asset && Array.isArray(asset.lods);
}

function libraryIdOf(asset) {
  if (asset && typeof asset === "object" && typeof asset.library === "string" && asset.library && !("glb" in asset)) return asset.library;
  return null;
}

function resolveZoneObject(obj, opts) {
  const lib = libraryIdOf(obj.asset);
  if (!lib) return { ...obj };
  let asset = obj.asset;
  if (typeof opts.resolveLibrary === "function") {
    const resolved = opts.resolveLibrary(lib);
    if (resolved != null) asset = resolved;
  }
  return { ...obj, library: lib, asset };
}

function rogueIds(zone, opts) {
  const listed = new Set(zone.objects.map((o) => o.id));
  const extras = [].concat(opts.injected || [], opts.extraObjects || [], opts.present || []);
  const rogue = [];
  for (const extra of extras) {
    const id = typeof extra === "string" ? extra : extra && extra.id;
    if (!listed.has(id)) rogue.push(id || "?");
  }
  return [...new Set(rogue)];
}

/**
 * The playable scene. Object ids are zone.objects, in that order.
 * opts.injected / extraObjects / present: ids not in the zone are a FAIL.
 * opts.resolveLibrary(id) → asset path, or null to keep the library ref.
 */
export function loadPlayableScene(zone, opts = {}) {
  validateZone(zone);
  const rogue = rogueIds(zone, opts);
  if (rogue.length) {
    const err = new Error("FAIL refused: scene boot injects objects not listed in the zone JSON: " + rogue.join(", "));
    err.status = "FAIL";
    err.code = "INJECTED_OBJECT";
    throw err;
  }
  const objects = zone.objects.map((o) => resolveZoneObject(o, opts));
  const ids = objects.map((o) => o.id);
  const listed = zone.objects.map((o) => o.id);
  if (ids.length !== listed.length || ids.some((id, i) => id !== listed[i])) {
    const err = new Error("FAIL scene objects do not match zone.objects");
    err.status = "FAIL";
    throw err;
  }
  return {
    schema: zone.schema,
    id: zone.id,
    keyCamera: zone.keyCamera,
    lighting: zone.lighting,
    objects,
  };
}

/** Parsed payloads the live page fetches. Null when this URL is not a zone feed. */
export function feedForUrl(zone, url) {
  const raw = typeof url === "string" ? url : url instanceof URL ? url.href : url && url.url;
  if (!raw) return null;
  const path = String(raw).split("?")[0].split("#")[0];
  const name = path.slice(path.lastIndexOf("/") + 1);
  if (name === "biome.json") return zone.runtime.biome;
  if (name === "layout.json" && path.includes("objects1")) return zone.runtime.layout;
  if (name === "ground-detail.json") return zone.runtime.groundDetail;
  return null;
}

export function materialize(zone) {
  validateZone(zone);
  return {
    biome: zone.runtime.biome,
    layout: zone.runtime.layout,
    groundDetail: zone.runtime.groundDetail,
  };
}

/** Patch window.fetch so the preview reads the zone file. Returns the restore function. */
export function installZoneFeeds(zone) {
  validateZone(zone);
  const orig = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const hit = feedForUrl(zone, input);
    if (hit != null) {
      return Promise.resolve(new Response(JSON.stringify(hit), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    }
    return orig(input, init);
  };
  return () => { window.fetch = orig; };
}

/**
 * Build the scene by handing the zone to the existing preview entry.
 * mainHref must be the preview main.mjs URL (resolved by the page). Importing
 * "./main.mjs" from this file would look next to the loader, not in the preview.
 */
export async function bootZone(zone, mainHref, opts = {}) {
  if (!mainHref) throw new Error("bootZone needs the preview main.mjs URL");
  const scene = loadPlayableScene(zone, opts);
  installZoneFeeds(zone);
  await import(mainHref);
  return scene;
}
