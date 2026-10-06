/**
 * Grok path. The key is the player's. It is never written into the repo.
 * The only request host is api.x.ai.
 * The skeleton in the prompt is a hint. The few-shot card is one example.
 */

import { XAI_MODEL, XAI_URL } from "./lib.js";
import { xaiShipCard } from "./offline.js";

export function buildMessages(catalog, library, example, chain) {
  const names = (catalog.types || []).map((t) => t.type + " (" + t.name + ")").join(", ");
  const ids = (library && library.segments ? library.segments : []).map((row) => row.id + " [" + row.status + "]").join(", ");
  const sample = example || null;
  const system = [
    "You invent one Boltverse Odyssey adventure and return it as a single JSON object.",
    "Output JSON only. No markdown.",
    "The story may be any plot inside Boltverse lore. A fixed beat list is not required.",
    "A soft hint, not a rule: signal or rift, a journey, a resonance, a challenge, a reward, a return.",
    "You invent the story. You do not invent images. drawsPixels is false.",
    "Bolt's purpose is xAI's mission: understand the true nature of the universe.",
    "Optional question frames the adventure as one question about the universe.",
    "Optional truth is a Truth Orb or an Echo Shard: kind truth-orb or echo-shard, plus a short insight.",
    "The game saves that insight in the Living Archives. The insight opens next_hook.question. That chain is the Eternal Loop.",
    "The segment catalogue is the Living Codex. Inventing the adventure is the True Heart. Do not add a new system.",
    "beats is a chain of location segments. Each beat has id, segment, text, and optional variation.",
    "segment should be a library id. Unknown ids are legal; the game falls back to a ready stand-in.",
    "Library: " + ids + ".",
    "run.lengthM is metres from 36 to 79.75.",
    "run.objects is a subset of stone, boulder, arch, gate, wreck, in that order.",
    "run.density is 2 to 8 numbers in (0, 1]. run.goalSegment is a library id.",
    "Put run.echoShards.positions as an empty array when you include shards. The game places them.",
    "boss.objective is reach-gate or reach-segment. timerSec is 20 to 120.",
    "uniqueTouch has at most 2 rows, status stub. Do not ask the game to call Imagine.",
    "Optional next_hook: teaser, seed, a short context, and an optional question. One hook launches the next adventure. Do not write a long chronicle.",
    "shard.type must be one of: " + names + ".",
    "Copy that type's name, biomeHint, paletteHint, playableNow, and assetNote unchanged.",
    "ASCII only. Per-run flavour is not a new cosmology.",
    "Shape example, not a plot to copy:",
    sample ? JSON.stringify(sample) : "",
  ].join(" ");
  const user = chain
    ? "Give me the next Boltverse adventure. Chain so far, stay short: " + chain
    : "Give me a Boltverse adventure.";
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function exampleCard(catalog) {
  return xaiShipCard(catalog);
}

export async function completeGrok({ key, messages, fetchImpl, signal }) {
  const url = XAI_URL;
  if (url !== "https://api.x.ai/v1/chat/completions") throw new Error("host");
  const fetchFn = fetchImpl;
  const res = await fetchFn(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + key,
    },
    body: JSON.stringify({
      model: XAI_MODEL,
      temperature: 0.4,
      messages,
    }),
    signal,
  });
  if (!res.ok) throw new Error("grok " + res.status);
  const data = await res.json();
  const text = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : "";
  return String(text || "");
}
