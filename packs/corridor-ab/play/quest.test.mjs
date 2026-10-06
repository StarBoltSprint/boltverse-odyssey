import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { XAI_SHIP_SEED } from "../../../tools/adventure/lib.js";
import { offlineCard } from "../../../tools/adventure/offline.js";
import { cardToPlan } from "../../../tools/adventure/playmap.js";
import { GATE_RADIUS_M, chooseQuest, createQuest, noteShard, skipToRun, stepQuest } from "./quest.js";

const catalog = JSON.parse(readFileSync(new URL("../../../tools/adventure/shard-types.json", import.meta.url), "utf8"));
const library = JSON.parse(readFileSync(new URL("../../../tools/adventure/library.json", import.meta.url), "utf8"));
const origin = { x0: 0.725, pathZ: 2.175, maxLengthM: 79.75 };

function started() {
  const plan = cardToPlan(offlineCard(24, catalog), origin, catalog, library);
  const quest = createQuest(plan);
  stepQuest(quest, 3, origin.x0, origin.pathZ);
  assert.equal(quest.phase, "run");
  return quest;
}

test("the intro holds, then the run starts", () => {
  const quest = started();
  assert.equal(quest.holdMove, false);
  assert.equal(quest.overlay, null);
});

test("the gate before the shards is not the reward", () => {
  const quest = started();
  stepQuest(quest, 0.1, quest.plan.goal.x, quest.plan.goal.z);
  assert.equal(quest.phase, "run");
  assert.ok(GATE_RADIUS_M >= 5);
});

test("every shard and the gate before the timer is a pass, then a return", () => {
  const quest = started();
  for (const shard of quest.plan.shards) noteShard(quest, shard);
  stepQuest(quest, 0.1, quest.plan.goal.x, quest.plan.goal.z);
  assert.equal(quest.result, "pass");
  assert.equal(quest.phase, "ending");
  stepQuest(quest, 2.6, quest.plan.goal.x, quest.plan.goal.z);
  assert.equal(quest.phase, "choice");
  chooseQuest(quest, "citadel");
  assert.equal(quest.phase, "return");
  assert.equal(quest.teleport, true);
  assert.equal(quest.overlay.lines[0], quest.plan.returnText);
});

test("a pass shows the truth insight", () => {
  const plan = cardToPlan(offlineCard(XAI_SHIP_SEED, catalog), origin, catalog, library);
  const quest = createQuest(plan);
  skipToRun(quest);
  stepQuest(quest, 0.1, plan.goal.x, plan.goal.z);
  assert.equal(quest.result, "pass");
  assert.equal(quest.overlay.lines.includes(plan.truth.insight), true);
});

test("the timer without the gate closes the rift", () => {
  const quest = started();
  stepQuest(quest, quest.plan.boss.timerSec + 1, origin.x0, origin.pathZ);
  assert.equal(quest.result, "fail");
  assert.equal(quest.phase, "ending");
});
