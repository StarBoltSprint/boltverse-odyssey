/**
 * Two paths, one card. A player key calls api.x.ai. No key uses the seed.
 */

import { clipChain, normalizeSeed } from "./lib.js";
import { offlineCard } from "./offline.js";
import { buildMessages, completeGrok, exampleCard } from "./grok.js";
import { extractJson, repairCard } from "./repair.js";
import { validateCard } from "./validate.js";

async function loadCatalog(types, typesUrl, fetchImpl) {
  if (types && Array.isArray(types.types)) return types;
  const fetchFn = fetchImpl || globalThis.fetch;
  const res = await fetchFn(typesUrl || "/tools/adventure/shard-types.json");
  if (!res.ok) throw new Error("shard catalog");
  return res.json();
}

export async function generateAdventure(opts) {
  const options = opts || {};
  const seed = normalizeSeed(options.seed);
  const catalog = await loadCatalog(options.types, options.typesUrl, options.fetchImpl);
  const library = options.library || null;
  const key = String(options.key || "").trim();
  if (!key) return offlineCard(seed, catalog);
  try {
    const text = await completeGrok({
      key,
      messages: buildMessages(catalog, library, exampleCard(catalog), clipChain(options.chain)),
      fetchImpl: options.fetchImpl || globalThis.fetch,
      signal: options.signal,
    });
    const parsed = extractJson(text);
    if (parsed && parsed.run && parsed.run.echoShards && !Array.isArray(parsed.run.echoShards.positions)) {
      parsed.run.echoShards.positions = [];
    }
    const card = repairCard(parsed, seed, catalog);
    const check = validateCard(card, catalog);
    if (!check.ok) {
      const fallback = offlineCard(seed, catalog);
      fallback.source = "fallback";
      return fallback;
    }
    return card;
  } catch (e) {
    const fallback = offlineCard(seed, catalog);
    fallback.source = "fallback";
    return fallback;
  }
}

export { offlineCard, validateCard };
