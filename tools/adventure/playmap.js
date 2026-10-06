/**
 * Card to the corridor run. Segments resolve onto solids that already exist.
 * The manifest is the shared Echo Shard shape. This file does not draw.
 */

import { validateManifest } from "../../packs/common/archives/manifest.js";
import { planMonument } from "../../packs/corridor-ab/play/stream.js";
import { SOLID_POOL } from "./lib.js";
import { placeShards } from "./offline.js";
import { resolveSegment } from "./resolve.js";
import { validateCard } from "./validate.js";

const UI = {
  paw: "packs/common/archives/art/paw.png",
  plate: "packs/common/archives/art/plate.jpg",
  hall: "packs/common/archives/art/hall.jpg",
  silhouette: "packs/common/archives/art/silhouette.png",
};

function seatKind(segment) {
  const objects = segment && segment.objects ? segment.objects : [];
  if (objects.includes("wreck")) return "wreck";
  if (objects.includes("gate")) return "gate";
  if (objects.includes("arch")) return "arch";
  return "";
}

function ordered(list) {
  const want = new Set(list);
  return SOLID_POOL.filter((id) => want.has(id));
}

export function cardToPlan(card, origin, catalog, library) {
  const check = validateCard(card, catalog);
  if (!check.ok) throw new Error(check.errors.join("; "));
  if (!library || !Array.isArray(library.segments)) throw new Error("library");
  const run = card.run;
  const maxL = origin && origin.maxLengthM ? origin.maxLengthM : run.lengthM;
  const lengthM = Math.min(run.lengthM, maxL);
  const x0 = origin.x0;
  const pathZ = origin.pathZ;
  const resolved = [];
  const objectIds = run.objects.slice();
  for (let i = 0; i < card.beats.length; i++) {
    const beat = card.beats[i];
    const hit = resolveSegment(beat.segment, library);
    resolved.push({
      id: beat.id,
      requested: beat.segment,
      segment: hit.segment ? hit.segment.id : "",
      via: hit.via,
      text: beat.text,
      variation: beat.variation || 0,
    });
  }
  const goalHit = resolveSegment(run.goalSegment, library);
  const kind = seatKind(goalHit.segment) || (card.boss && card.boss.objective === "reach-gate" ? "gate" : "");
  const goalKind = kind || "gate";
  if (goalHit.segment && goalHit.segment.objects) {
    for (let i = 0; i < goalHit.segment.objects.length; i++) objectIds.push(goalHit.segment.objects[i]);
  }
  if (goalKind === "gate") objectIds.push("gate");
  if (goalKind === "wreck") objectIds.push("wreck");
  if (goalKind === "arch") objectIds.push("arch");
  const objects = ordered(objectIds);
  const echo = run.echoShards;
  const sourcePositions = echo && Array.isArray(echo.positions) && echo.positions.length
    ? echo.positions
    : placeShards(card.seed, 1, lengthM);
  const shards = sourcePositions.map((p) => ({
    id: p.id,
    title: p.title,
    lore: p.lore,
    image: "packs/common/archives/art/crystal.png",
    x: Math.round((x0 + p.along) * 1000) / 1000,
    z: Math.round((pathZ + p.lateral) * 1000) / 1000,
    yaw: 90,
    along: p.along,
    lateral: p.lateral,
  }));
  const zoneId = "adv-" + card.seed;
  const manifest = {
    schema: "echo-shards/1",
    zoneId,
    pickupRadiusM: echo && echo.radiusM ? echo.radiusM : 2.25,
    cardMs: 2500,
    ui: UI,
    shards,
  };
  const manifestCheck = validateManifest(manifest);
  if (!manifestCheck.ok) throw new Error(manifestCheck.errors.join("; "));
  const seat = planMonument(lengthM, goalKind);
  const goal = {
    kind: goalKind,
    segment: goalHit.segment ? goalHit.segment.id : "",
    via: goalHit.via,
    x: Math.round((x0 + seat.along) * 1000) / 1000,
    z: Math.round((pathZ + seat.lateral) * 1000) / 1000,
  };
  const gateSeat = planMonument(lengthM, "gate");
  return {
    seed: card.seed,
    title: card.title,
    lengthM,
    objects,
    density: run.density.slice(),
    shards: manifest.shards,
    manifest,
    goal,
    gate: {
      x: Math.round((x0 + gateSeat.along) * 1000) / 1000,
      z: Math.round((pathZ + gateSeat.lateral) * 1000) / 1000,
    },
    radiusM: manifest.pickupRadiusM,
    objective: run.objective,
    echoRequired: !!(echo && echo.required !== false && shards.length),
    signal: card.beats[0].text,
    beats: resolved,
    boss: card.boss,
    reward: card.reward,
    returnText: card.return,
    question: card.question || "",
    truth: card.truth || null,
    shardName: card.shard.name,
    playableNow: card.shard.playableNow,
    uniqueTouch: card.uniqueTouch || [],
    nextHook: card.next_hook || null,
  };
}
