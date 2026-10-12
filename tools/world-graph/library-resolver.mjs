/**
 * Node resolver for zone assets stored as { "library": "<id>" }.
 * Reads biome/library/<id>/manifest.json. The zone loader stays browser-safe
 * and only calls this when a caller passes it as opts.resolveLibrary.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function nodeLibraryResolver(repoRoot) {
  const root = join(repoRoot, "biome", "library");
  return function resolveLibrary(id) {
    if (!id || typeof id !== "string") return null;
    const manifestPath = join(root, id, "manifest.json");
    if (!existsSync(manifestPath)) return null;
    const data = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (data.schema !== "library-object/1" || data.id !== id) {
      throw new Error("library manifest refused: " + id);
    }
    if (typeof data.asset !== "string" || !data.asset) throw new Error(id + " has no asset path");
    return data.asset;
  };
}
