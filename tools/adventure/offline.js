/**
 * Seeded adventure card. No network. The same seed writes the same object.
 * Positions stay on the corridor. Solids stay in the existing pool.
 */

import {
  CORRIDOR_MAX_M,
  SHARD_LORE,
  SOLID_POOL,
  XAI_SHIP_SEED,
  mulberry32,
  normalizeSeed,
  pickBoss,
  pickResonance,
  pickReturn,
  pickReward,
  pickSignal,
  nextHook,
  pickPurpose,
  pickTitle,
} from "./lib.js";

export function placeShards(seed, count, lengthM) {
  const want = count < 1 ? 1 : count > 7 ? 7 : count;
  const archAt = lengthM * 0.28;
  const wreckAt = lengthM * 0.48;
  const gateAt = Math.max(18, lengthM * 0.9);
  const blocked = [archAt, wreckAt, gateAt];
  const lo = 6;
  const hi = Math.min(lengthM - 8, gateAt - 4.2);
  const slots = [];
  for (let x = lo; x <= hi + 1e-6; x += 0.4) {
    const along = Math.round(x * 10) / 10;
    let clear = true;
    for (let m = 0; m < blocked.length; m++) {
      if (Math.abs(along - blocked[m]) < 3.6) clear = false;
    }
    if (clear && (slots.length === 0 || along !== slots[slots.length - 1])) slots.push(along);
  }
  const chosen = [];
  const step = slots.length / want;
  for (let i = 0; i < want && slots.length; i++) {
    let along = slots[Math.min(slots.length - 1, Math.floor(i * step + step * 0.5))];
    if (chosen.length && along - chosen[chosen.length - 1] < 2.6) {
      const need = chosen[chosen.length - 1] + 2.6;
      let found = null;
      for (let s = 0; s < slots.length; s++) {
        if (slots[s] >= need - 1e-6) {
          found = slots[s];
          break;
        }
      }
      if (found == null) break;
      along = found;
    }
    if (chosen.length && along - chosen[chosen.length - 1] < 2.5) break;
    chosen.push(along);
  }
  const out = [];
  for (let i = 0; i < chosen.length; i++) {
    out.push({
      id: "echo-" + (i + 1),
      along: chosen[i],
      lateral: i % 2 === 0 ? 1.6 : -1.6,
      title: "Echo Shard " + (i + 1),
      lore: SHARD_LORE[(seed + i) % SHARD_LORE.length],
    });
  }
  return out;
}

function densityCurve(rng) {
  let a = 0.4 + rng() * 0.12;
  const curve = [];
  for (let i = 0; i < 4; i++) {
    curve.push(Math.round(Math.min(1, a) * 1000) / 1000);
    a += 0.12 + rng() * 0.08;
  }
  return curve;
}

function objectSet(rng) {
  const want = { stone: true, gate: true };
  if (rng() > 0.2) want.boulder = true;
  if (rng() > 0.15) want.arch = true;
  if (rng() > 0.25) want.wreck = true;
  return SOLID_POOL.filter((id) => want[id]);
}

export function shardRecord(typeRow) {
  return {
    name: typeRow.name,
    type: typeRow.type,
    biomeHint: typeRow.biomeHint,
    paletteHint: typeRow.paletteHint || "",
    playableNow: !!typeRow.playableNow,
    assetNote: typeRow.assetNote,
  };
}

/**
 * @param {number} seed
 * @param {{ types: object[] }} catalog
 */
function cardShell(seed, shard, title, beats, run, boss, reward, back, uniqueTouch, purpose) {
  const card = {
    schema: "adventure/1",
    title,
    seed,
    source: "offline",
    drawsPixels: false,
    shard,
    beats,
    run,
    boss,
    reward,
    return: back,
    uniqueTouch: uniqueTouch || [],
    next_hook: nextHook(seed, title, purpose && purpose.nextQuestion),
  };
  if (purpose && purpose.question) card.question = purpose.question;
  if (purpose && purpose.truth) card.truth = purpose.truth;
  return card;
}

/**
 * Owner sample. Bolt leaves the Citadel and reaches a lost xAI hull.
 * The wreck is the stand-in. Seed 1024 only.
 * @param {{ types: object[] }} catalog
 */
export function xaiShipCard(catalog) {
  const types = catalog && catalog.types;
  if (!Array.isArray(types) || !types.length) throw new Error("shard catalog missing");
  const typeRow = types.find((t) => t.type === "asteroid") || types[0];
  const shard = shardRecord(typeRow);
  const lengthM = 64;
  const positions = placeShards(XAI_SHIP_SEED, 3, lengthM);
  const title = "The Lost xAI Ship";
  const reward = "The Veil Weaver drive.";
  const back = "Bolt returns to the Citadel.";
  return cardShell(
    XAI_SHIP_SEED,
    shard,
    title,
    [
      { id: "depart", segment: "citadel-exit", text: "Bolt leaves the Citadel. A faint xAI mark still answers.", variation: 1 },
      { id: "rise", segment: "liftoff", text: "The path lifts off the sill and into open black.", variation: 2 },
      { id: "rocks", segment: "space-asteroid-field", text: "Stone drifts where the chart promised a field.", variation: 3 },
      { id: "veil", segment: "nebula-run", text: "The veil thins. The hull is ahead.", variation: 4 },
      { id: "ship", segment: "derelict-ship", text: "An old lost ship drifts here, marked xAI.", variation: 5 },
    ],
    {
      lengthM,
      objects: ["stone", "boulder", "wreck"],
      density: [0.42, 0.58, 0.74, 0.9],
      echoShards: { count: positions.length, radiusM: 2.25, required: false, positions },
      objective: "Reach the lost xAI ship.",
      goalSegment: "derelict-ship",
    },
    {
      name: "Lost xAI Ship",
      text: "The hull is silent. Reach it before the rift closes.",
      objective: "reach-segment",
      segment: "derelict-ship",
      timerSec: 72,
    },
    reward,
    back,
    [
      {
        id: "xai-stamp",
        prompt: "Empty derelict hull plate with an xAI mark, no Bolt.",
        status: "stub",
      },
    ],
    {
      question: "What does a lost hull, marked xAI, still ask about the universe?",
      truth: {
        kind: "truth-orb",
        insight: "Understanding the universe is not a destination. It is an endless becoming.",
      },
      nextQuestion: "If understanding is an endless becoming, what does the next signal ask?",
    },
  );
}

export function offlineCard(seed, catalog) {
  const types = catalog && catalog.types;
  if (!Array.isArray(types) || !types.length) throw new Error("shard catalog missing");
  const s = normalizeSeed(seed);
  if (s === XAI_SHIP_SEED) return xaiShipCard(catalog);
  const rng = mulberry32(s);
  const typeRow = types[Math.floor(rng() * types.length)];
  const shard = shardRecord(typeRow);
  const title = pickTitle(rng, shard.name);
  const signal = pickSignal(rng);
  const lengthM = 48 + Math.floor(rng() * 28);
  const objects = objectSet(rng);
  const density = densityCurve(rng);
  const count = 3 + Math.floor(rng() * 5);
  const boss = pickBoss(rng);
  const reward = pickReward(rng);
  const back = pickReturn(rng);
  const resonance = pickResonance(rng);
  const timerSec = 55 + Math.floor(rng() * 31);
  const purpose = pickPurpose(rng);
  const capped = Math.min(CORRIDOR_MAX_M, lengthM);
  const positions = placeShards(s, count, capped);
  const objective = "Collect the Echo Shards, then reach the Eclipse Gate.";
  const journey = shard.playableNow ? "corridor-run" : "shard-surface";
  return cardShell(
    s,
    shard,
    title,
    [
      { id: "signal", segment: "citadel-exit", text: signal, variation: 0 },
      { id: "sprint", segment: journey, text: "Sprint toward " + shard.name + ".", variation: 1 },
      { id: "resonance", segment: "roman-arch", text: resonance, variation: 2 },
      { id: "boss", segment: "eclipse-gate", text: boss.text, variation: 3 },
      { id: "reward", segment: "corridor-run", text: reward, variation: 4 },
      { id: "return", segment: "citadel-exit", text: back, variation: 5 },
    ],
    {
      lengthM: capped,
      objects,
      density,
      echoShards: { count: positions.length, radiusM: 2.25, required: true, positions },
      objective,
      goalSegment: "eclipse-gate",
    },
    {
      name: boss.name,
      text: boss.text,
      objective: "reach-gate",
      timerSec,
    },
    reward,
    back,
    [],
    purpose,
  );
}
