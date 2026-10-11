/**
 * zone.v1 loader. It does not draw. It checks the zone file and answers the
 * three JSON fetches the Zone B preview already makes (biome, layout, ground
 * detail). The existing three.js modules stay the renderer.
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
    if (!o.asset || !("glb" in o.asset) || !Array.isArray(o.asset.lods)) throw new Error(o.id + " asset");
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
export async function bootZone(zone, mainHref) {
  if (!mainHref) throw new Error("bootZone needs the preview main.mjs URL");
  installZoneFeeds(zone);
  await import(mainHref);
}
