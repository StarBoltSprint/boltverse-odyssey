/**
 * Keep the parts of a model card that already fit the schema.
 * Anything else is replaced from the offline card for the same seed.
 */

import { SOLID_POOL, asciiText } from "./lib.js";
import { offlineCard, placeShards, shardRecord } from "./offline.js";
import { validateCard } from "./validate.js";

function lengthOk(n) {
  return typeof n === "number" && n >= 36 && n <= 79.75;
}

function densityOk(list) {
  if (!Array.isArray(list) || list.length < 2 || list.length > 8) return false;
  for (let i = 0; i < list.length; i++) {
    const n = list[i];
    if (typeof n !== "number" || n <= 0 || n > 1) return false;
  }
  return true;
}

function objectsOf(list) {
  if (!Array.isArray(list)) return null;
  const want = new Set();
  for (let i = 0; i < list.length; i++) {
    if (SOLID_POOL.includes(list[i])) want.add(list[i]);
  }
  if (!want.size) return null;
  return SOLID_POOL.filter((id) => want.has(id));
}

export function extractJson(text) {
  const raw = String(text || "");
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch (e) {
    return null;
  }
}

const SEG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function beatsOf(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  const ids = new Set();
  for (let i = 0; i < list.length && out.length < 8; i++) {
    const beat = list[i];
    if (!beat || typeof beat !== "object") continue;
    const segment = typeof beat.segment === "string" && SEG.test(beat.segment) ? beat.segment : "";
    const text = asciiText(beat.text, 240);
    if (!segment || !text) continue;
    let id = typeof beat.id === "string" && SEG.test(beat.id) ? beat.id : segment;
    if (ids.has(id)) id = segment + "-" + (out.length + 1);
    if (ids.has(id) || !SEG.test(id)) continue;
    ids.add(id);
    const row = { id, segment, text };
    if (Number.isInteger(beat.variation) && beat.variation >= 0 && beat.variation <= 999) row.variation = beat.variation;
    out.push(row);
  }
  return out.length ? out : null;
}

function touchOf(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (let i = 0; i < list.length && out.length < 2; i++) {
    const row = list[i];
    if (!row || typeof row !== "object") continue;
    const id = typeof row.id === "string" && SEG.test(row.id) ? row.id : "";
    const prompt = asciiText(row.prompt, 240);
    if (!id || !prompt) continue;
    out.push({ id, prompt, status: "stub" });
  }
  return out;
}

export function repairCard(parsed, seed, catalog) {
  const base = offlineCard(seed, catalog);
  if (!parsed || typeof parsed !== "object") {
    base.source = "fallback";
    return base;
  }
  const card = offlineCard(seed, catalog);
  card.source = "grok";
  const title = asciiText(parsed.title, 80);
  if (title && title.length >= 3) card.title = title;
  if (parsed.shard && typeof parsed.shard === "object" && catalog && Array.isArray(catalog.types)) {
    const row = catalog.types.find((t) => t.type === parsed.shard.type);
    if (row) card.shard = shardRecord(row);
  }
  const beats = beatsOf(parsed.beats);
  if (beats) card.beats = beats;
  const run = parsed.run && typeof parsed.run === "object" ? parsed.run : null;
  const sprint = Array.isArray(parsed.beats) ? parsed.beats.find((b) => b && b.kind === "sprint") : null;
  const lengthFrom = run && lengthOk(run.lengthM) ? run.lengthM : sprint && lengthOk(sprint.lengthM) ? sprint.lengthM : 0;
  if (lengthFrom) card.run.lengthM = Math.round(lengthFrom * 10) / 10;
  const objects = objectsOf(run && run.objects) || objectsOf(sprint && sprint.objects);
  if (objects) card.run.objects = objects;
  if (run && densityOk(run.density)) card.run.density = run.density.slice();
  else if (sprint && densityOk(sprint.density)) card.run.density = sprint.density.slice();
  const objective = asciiText(run && run.objective, 160) || asciiText(sprint && sprint.objective, 160);
  if (objective) card.run.objective = objective;
  const goal = run && typeof run.goalSegment === "string" && SEG.test(run.goalSegment) ? run.goalSegment : "";
  if (goal) card.run.goalSegment = goal;
  const echo = (run && run.echoShards) || (sprint && sprint.echoShards);
  const count = echo && echo.count;
  if (Number.isInteger(count) && count >= 1 && count <= 7) {
    const positions = placeShards(card.seed, count, card.run.lengthM);
    card.run.echoShards = {
      count: positions.length,
      radiusM: 2.25,
      required: !(echo && echo.required === false),
      positions,
    };
  }
  const boss = parsed.boss;
  if (boss && typeof boss === "object") {
    const name = asciiText(boss.name, 80);
    const text = asciiText(boss.text, 240);
    const timer = typeof boss.timerSec === "number" ? boss.timerSec : 0;
    const objectiveKind = boss.objective === "reach-segment" ? "reach-segment" : boss.objective === "reach-gate" ? "reach-gate" : "";
    const segment = typeof boss.segment === "string" && SEG.test(boss.segment) ? boss.segment : "";
    if (name && text && timer >= 20 && timer <= 120 && objectiveKind && (objectiveKind !== "reach-segment" || segment)) {
      card.boss = { name, text, objective: objectiveKind, timerSec: timer };
      if (segment) card.boss.segment = segment;
    }
  }
  const reward = asciiText(parsed.reward, 160);
  if (reward) card.reward = reward;
  const back = asciiText(parsed.return, 160);
  if (back) card.return = back;
  const question = asciiText(parsed.question, 160);
  if (question) card.question = question;
  const truth = parsed.truth;
  if (truth && typeof truth === "object") {
    const insight = asciiText(truth.insight, 220);
    const kind = truth.kind === "echo-shard" || truth.kind === "truth-orb" ? truth.kind : "";
    if (kind && insight) card.truth = { kind, insight };
  }
  const hook = parsed.next_hook;
  if (hook && typeof hook === "object") {
    const teaser = asciiText(hook.teaser, 160);
    const seedOk = Number.isInteger(hook.seed) && hook.seed >= 1;
    const context = typeof hook.context === "string" && (!hook.context || asciiText(hook.context, 240))
      ? hook.context.trim()
      : null;
    if (teaser && seedOk && context != null && context.length <= 240) {
      card.next_hook = { teaser, seed: hook.seed, context };
      const hookQuestion = asciiText(hook.question, 160);
      if (hookQuestion) card.next_hook.question = hookQuestion;
    }
  }
  const touch = touchOf(parsed.uniqueTouch);
  if (touch) card.uniqueTouch = touch;
  if (card.run && card.run.echoShards) {
    const positions = placeShards(card.seed, card.run.echoShards.count, card.run.lengthM);
    card.run.echoShards.positions = positions;
    card.run.echoShards.count = positions.length;
  }
  card.seed = base.seed;
  card.drawsPixels = false;
  card.schema = "adventure/1";
  const check = validateCard(card, catalog);
  if (!check.ok) {
    base.source = "fallback";
    return base;
  }
  return card;
}
