/**
 * Checks an adventure card against adventure/1.
 * Shard types must be in the lore catalog. Text stays ASCII.
 */

import { CORRIDOR_MAX_M, SOLID_POOL, asciiText } from "./lib.js";

function isNum(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function bad(errors, msg) {
  errors.push(msg);
}

export function validateCard(card, catalog) {
  const errors = [];
  const types = catalog && catalog.types;
  if (!card || typeof card !== "object") return { ok: false, errors: ["card"] };
  if (card.schema !== "adventure/1") bad(errors, "schema");
  if (!asciiText(card.title, 80) || card.title.trim().length < 3) bad(errors, "title");
  if (!Number.isInteger(card.seed) || card.seed < 1) bad(errors, "seed");
  if (card.source !== "offline" && card.source !== "grok" && card.source !== "fallback") bad(errors, "source");
  if (card.drawsPixels !== false) bad(errors, "drawsPixels");
  const known = new Map();
  if (!Array.isArray(types)) bad(errors, "catalog");
  else for (let i = 0; i < types.length; i++) known.set(types[i].type, types[i]);
  const shard = card.shard;
  if (!shard || typeof shard !== "object") bad(errors, "shard");
  else {
    const row = known.get(shard.type);
    if (!row) bad(errors, "shard.type");
    else if (shard.name !== row.name) bad(errors, "shard.name");
    if (typeof shard.playableNow !== "boolean") bad(errors, "shard.playableNow");
    else if (row && shard.playableNow !== !!row.playableNow) bad(errors, "shard.playableNow");
    if (!asciiText(shard.biomeHint, 120) && shard.biomeHint !== "") bad(errors, "shard.biomeHint");
    if (typeof shard.paletteHint !== "string" || shard.paletteHint.length > 80) bad(errors, "shard.paletteHint");
    if (!asciiText(shard.assetNote, 240)) bad(errors, "shard.assetNote");
  }
  const segId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!Array.isArray(card.beats) || card.beats.length < 1 || card.beats.length > 8) bad(errors, "beats");
  else {
    const ids = new Set();
    for (let i = 0; i < card.beats.length; i++) {
      const beat = card.beats[i];
      const at = "beat[" + i + "]";
      if (!beat || typeof beat !== "object") {
        bad(errors, at);
        continue;
      }
      if (typeof beat.id !== "string" || !segId.test(beat.id) || ids.has(beat.id)) bad(errors, at + ".id");
      else ids.add(beat.id);
      if (typeof beat.segment !== "string" || !segId.test(beat.segment)) bad(errors, at + ".segment");
      if (!asciiText(beat.text, 240)) bad(errors, at + ".text");
      if (beat.variation != null && (!Number.isInteger(beat.variation) || beat.variation < 0 || beat.variation > 999)) {
        bad(errors, at + ".variation");
      }
    }
  }
  const run = card.run;
  if (!run || typeof run !== "object") bad(errors, "run");
  else {
    if (!isNum(run.lengthM) || run.lengthM < 36 || run.lengthM > CORRIDOR_MAX_M) bad(errors, "lengthM");
    if (!Array.isArray(run.objects) || !run.objects.length) bad(errors, "objects");
    else {
      const seen = new Set();
      for (let i = 0; i < run.objects.length; i++) {
        const id = run.objects[i];
        if (!SOLID_POOL.includes(id) || seen.has(id)) bad(errors, "objects." + id);
        seen.add(id);
      }
      for (let i = 1; i < run.objects.length; i++) {
        if (SOLID_POOL.indexOf(run.objects[i]) < SOLID_POOL.indexOf(run.objects[i - 1])) bad(errors, "objects.order");
      }
    }
    if (!Array.isArray(run.density) || run.density.length < 2 || run.density.length > 8) bad(errors, "density");
    else {
      for (let i = 0; i < run.density.length; i++) {
        const d = run.density[i];
        if (!isNum(d) || d <= 0 || d > 1) bad(errors, "density." + i);
      }
    }
    if (!asciiText(run.objective, 160)) bad(errors, "objective");
    if (typeof run.goalSegment !== "string" || !segId.test(run.goalSegment)) bad(errors, "goalSegment");
    const echo = run.echoShards;
    if (echo != null) {
      if (!Number.isInteger(echo.count) || echo.count < 1 || echo.count > 7) bad(errors, "echo.count");
      if (!isNum(echo.radiusM) || echo.radiusM < 1.5 || echo.radiusM > 3) bad(errors, "echo.radius");
      if (typeof echo.required !== "boolean") bad(errors, "echo.required");
      if (!Array.isArray(echo.positions) || echo.positions.length !== echo.count) bad(errors, "echo.positions");
      else if (run.lengthM) checkPositions(errors, echo.positions, run.lengthM);
    }
  }
  const boss = card.boss;
  if (!boss || typeof boss !== "object") bad(errors, "boss");
  else {
    if (!asciiText(boss.name, 80)) bad(errors, "boss.name");
    if (!asciiText(boss.text, 240)) bad(errors, "boss.text");
    if (boss.objective !== "reach-gate" && boss.objective !== "reach-segment") bad(errors, "boss.objective");
    if (boss.objective === "reach-segment" && (typeof boss.segment !== "string" || !segId.test(boss.segment))) {
      bad(errors, "boss.segment");
    }
    if (!isNum(boss.timerSec) || boss.timerSec < 20 || boss.timerSec > 120) bad(errors, "boss.timer");
  }
  const hook = card.next_hook;
  if (hook != null) {
    if (!hook || typeof hook !== "object") bad(errors, "next_hook");
    else {
      if (!asciiText(hook.teaser, 160)) bad(errors, "next_hook.teaser");
      if (!Number.isInteger(hook.seed) || hook.seed < 1) bad(errors, "next_hook.seed");
      if (typeof hook.context !== "string" || hook.context.length > 240) bad(errors, "next_hook.context");
      else if (hook.context && !asciiText(hook.context, 240)) bad(errors, "next_hook.context");
      if (hook.question != null && !asciiText(hook.question, 160)) bad(errors, "next_hook.question");
    }
  }
  if (card.question != null && !asciiText(card.question, 160)) bad(errors, "question");
  const truth = card.truth;
  if (truth != null) {
    if (typeof truth !== "object") bad(errors, "truth");
    else {
      if (truth.kind !== "truth-orb" && truth.kind !== "echo-shard") bad(errors, "truth.kind");
      if (!asciiText(truth.insight, 220)) bad(errors, "truth.insight");
    }
  }
  if (card.uniqueTouch != null) {
    if (!Array.isArray(card.uniqueTouch) || card.uniqueTouch.length > 2) bad(errors, "uniqueTouch");
    else {
      for (let i = 0; i < card.uniqueTouch.length; i++) {
        const row = card.uniqueTouch[i];
        const at = "touch[" + i + "]";
        if (!row || typeof row.id !== "string" || !segId.test(row.id)) bad(errors, at + ".id");
        if (!row || !asciiText(row.prompt, 240)) bad(errors, at + ".prompt");
        if (!row || row.status !== "stub") bad(errors, at + ".status");
      }
    }
  }
  if (!asciiText(card.reward, 160)) bad(errors, "reward");
  if (!asciiText(card.return, 160)) bad(errors, "return");
  return { ok: errors.length === 0, errors };
}

function checkPositions(errors, positions, lengthM) {
  const monuments = [lengthM * 0.28, lengthM * 0.48, Math.max(18, lengthM * 0.9)];
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    const at = "echo[" + i + "]";
    if (!p || typeof p !== "object") {
      bad(errors, at);
      continue;
    }
    if (typeof p.id !== "string" || !/^echo-[1-7]$/.test(p.id)) bad(errors, at + ".id");
    if (!isNum(p.along) || p.along < 4 || p.along > lengthM - 6) bad(errors, at + ".along");
    if (!isNum(p.lateral) || Math.abs(p.lateral) < 1.2 || Math.abs(p.lateral) > 4.5) bad(errors, at + ".lateral");
    if (!asciiText(p.title, 80)) bad(errors, at + ".title");
    if (!asciiText(p.lore, 220)) bad(errors, at + ".lore");
    if (isNum(p.along)) {
      for (let m = 0; m < monuments.length; m++) {
        if (Math.abs(p.along - monuments[m]) < 3.5) bad(errors, at + ".monument");
      }
    }
    for (let j = 0; j < i; j++) {
      if (positions[j] && isNum(positions[j].along) && Math.abs(positions[j].along - p.along) < 2.5) {
        bad(errors, "echo.stacked");
      }
    }
  }
}
