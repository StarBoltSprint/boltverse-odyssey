import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createSave } from "../../packs/common/archives/save.js";
import { XAI_SHIP_SEED, XAI_URL, clipChain, nextSeed } from "./lib.js";
import { offlineCard } from "./offline.js";
import { cardToPlan } from "./playmap.js";
import { extractJson, repairCard } from "./repair.js";
import { buildMessages } from "./grok.js";
import { generateAdventure } from "./generate.js";
import { resolveSegment } from "./resolve.js";
import { requestUniqueTouch } from "./unique.js";
import { validateCard } from "./validate.js";

const catalog = JSON.parse(readFileSync(new URL("./shard-types.json", import.meta.url), "utf8"));
const library = JSON.parse(readFileSync(new URL("./library.json", import.meta.url), "utf8"));
const schema = JSON.parse(readFileSync(new URL("./adventure.schema.json", import.meta.url), "utf8"));
const origin = { x0: 0.725, pathZ: 2.175, maxLengthM: 79.75 };

test("the schema required keys are on an offline card", () => {
  const card = offlineCard(24, catalog);
  for (const key of schema.required) assert.ok(Object.prototype.hasOwnProperty.call(card, key), key);
  const check = validateCard(card, catalog);
  assert.equal(check.ok, true, check.errors.join("; "));
  assert.equal(card.drawsPixels, false);
  assert.equal(card.source, "offline");
});

test("the same seed writes the same card", () => {
  const a = offlineCard(68, catalog);
  const b = offlineCard(68, catalog);
  assert.deepEqual(a, b);
  assert.notDeepEqual(offlineCard(68, catalog).title + offlineCard(68, catalog).shard.type, offlineCard(69, catalog).title + offlineCard(69, catalog).shard.type);
});

test("shard types are the lore list and only Howling Eclipse is playable now", () => {
  const playable = catalog.types.filter((t) => t.playableNow).map((t) => t.type);
  assert.deepEqual(playable, ["howling-eclipse"]);
  assert.ok(catalog.types.some((t) => t.type === "ember-mesa" && t.playableNow === false));
  assert.ok(catalog.types.some((t) => t.type === "luminous-circuit"));
  assert.ok(catalog.types.some((t) => t.type === "crystal-nebula-plains"));
  const card = offlineCard(351, catalog);
  const row = catalog.types.find((t) => t.type === card.shard.type);
  assert.equal(card.shard.name, row.name);
  assert.equal(card.shard.playableNow, row.playableNow);
});

test("a card maps onto the corridor pool", () => {
  const card = offlineCard(24, catalog);
  const plan = cardToPlan(card, origin, catalog, library);
  assert.ok(plan.lengthM <= 79.75);
  assert.ok(plan.lengthM >= 36);
  for (const id of plan.objects) assert.ok(["stone", "boulder", "arch", "gate", "wreck"].includes(id));
  assert.ok(plan.objects.includes("stone"));
  assert.ok(plan.objects.includes("gate"));
  assert.equal(plan.shards.length, card.run.echoShards.count);
  assert.ok(plan.gate.x > origin.x0 + 10);
  assert.ok(plan.gate.x < origin.x0 + plan.lengthM + 0.01);
  assert.equal(plan.manifest.schema, "echo-shards/1");
  assert.equal(plan.boss.objective, "reach-gate");
  assert.ok(plan.beats.every((b) => b.segment));
});

test("the lost xAI ship falls back onto the wreck", () => {
  const card = offlineCard(XAI_SHIP_SEED, catalog);
  assert.equal(card.title, "The Lost xAI Ship");
  assert.equal(card.run.goalSegment, "derelict-ship");
  assert.equal(validateCard(card, catalog).ok, true);
  const plan = cardToPlan(card, origin, catalog, library);
  assert.equal(plan.goal.segment, "wreck-hangar");
  assert.equal(plan.goal.via, "fallback");
  assert.equal(plan.goal.kind, "wreck");
  assert.ok(plan.objects.includes("wreck"));
  assert.equal(plan.objects.includes("gate"), false);
  assert.equal(plan.echoRequired, false);
  const depart = plan.beats.find((b) => b.requested === "citadel-exit");
  assert.equal(depart.segment, "corridor-run");
  const touch = requestUniqueTouch(card);
  assert.equal(touch.imagineCalls, 0);
  assert.equal(touch.slots[0].status, "stub");
});

test("an unknown segment falls back to a ready row", () => {
  const known = resolveSegment("derelict-ship", library);
  assert.equal(known.segment.id, "wreck-hangar");
  const unknown = resolveSegment("plasma-bridge", library);
  assert.equal(unknown.via, "unknown");
  assert.equal(unknown.segment.status, "ready");
  const ready = library.segments.filter((row) => row.status === "ready").map((row) => row.id);
  assert.deepEqual(ready, ["corridor-run", "boulder-field", "roman-arch", "eclipse-gate", "wreck-hangar"]);
  assert.ok(library.segments.some((row) => row.id === "citadel-exit" && row.status === "missing"));
  assert.ok(library.segments.some((row) => row.id === "enemy-set" && row.status === "missing"));
  assert.equal(library.segments.find((row) => row.id === "zone-b-handoff").status, "stub");
});

test("the Grok prompt treats the skeleton as a hint and shows the ship", () => {
  const card = offlineCard(XAI_SHIP_SEED, catalog);
  const messages = buildMessages(catalog, library, card);
  const system = messages[0].content;
  assert.equal(system.includes("not required"), true);
  assert.equal(system.includes("The Lost xAI Ship"), true);
  assert.equal(system.includes("derelict-ship"), true);
  assert.equal(system.includes("You invent the story"), true);
});

test("invalid model text falls back to the offline card", async () => {
  let called = 0;
  const card = await generateAdventure({
    seed: 24,
    key: "player-key",
    types: catalog,
    fetchImpl(url) {
      called += 1;
      assert.equal(url, XAI_URL);
      assert.equal(url.includes("api.x.ai"), true);
      return Promise.resolve({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "not json at all" } }] }),
      });
    },
  });
  assert.equal(called, 1);
  assert.equal(card.source, "fallback");
  const offline = offlineCard(24, catalog);
  offline.source = "fallback";
  assert.deepEqual(card, offline);
  assert.equal(validateCard(card, catalog).ok, true);
});

test("a partial card keeps a valid title and repairs the rest", () => {
  const parsed = {
    title: "Signal from the Gate",
    shard: { type: "not-a-realm" },
    beats: [{ kind: "sprint", objects: ["laser", "stone"], lengthM: 50 }],
  };
  const card = repairCard(parsed, 24, catalog);
  assert.equal(card.source, "grok");
  assert.equal(card.title, "Signal from the Gate");
  assert.notEqual(card.shard.type, "not-a-realm");
  assert.ok(card.run.objects.includes("stone"));
  assert.equal(card.run.objects.includes("laser"), false);
  assert.equal(validateCard(card, catalog).ok, true);
});

test("a thrown request falls back and the host stays api.x.ai", async () => {
  const card = await generateAdventure({
    seed: 12,
    key: "player-key",
    types: catalog,
    fetchImpl(url) {
      assert.equal(url, "https://api.x.ai/v1/chat/completions");
      throw new Error("down");
    },
  });
  assert.equal(card.source, "fallback");
  assert.equal(extractJson("```json\n{\"a\":1}\n```").a, 1);
});

test("the next hook is a short handoff and the chain stays capped", async () => {
  const card = offlineCard(XAI_SHIP_SEED, catalog);
  assert.equal(card.next_hook.seed, nextSeed(XAI_SHIP_SEED));
  assert.notEqual(card.next_hook.seed, card.seed);
  assert.equal(card.next_hook.context, card.title);
  assert.ok(card.next_hook.teaser.length > 3);
  assert.equal(card.question, "What does a lost hull, marked xAI, still ask about the universe?");
  assert.equal(card.truth.kind, "truth-orb");
  assert.equal(card.truth.insight, "The Star Core reveals: Understanding the universe is not a destination. It is an endless becoming.");
  assert.equal(card.next_hook.question, "If understanding is an endless becoming, what does the next signal ask?");
  const messages = buildMessages(catalog, library, card, "");
  assert.equal(messages[0].content.includes("true nature of the universe"), true);
  assert.equal(messages[0].content.includes("Ancient Star Core"), true);
  assert.equal(messages[0].content.includes("True Heart Sovereign"), true);
  assert.equal(messages[0].content.includes("Living Codex"), true);
  assert.equal(messages[0].content.includes(card.truth.insight), true);
  const followed = offlineCard(card.next_hook.seed, catalog);
  assert.equal(followed.seed, card.next_hook.seed);
  assert.notEqual(followed.title + followed.run.goalSegment, card.title + card.run.goalSegment);
  const clipped = clipChain("x".repeat(400));
  assert.equal(clipped.length <= 240, true);
  let body = "";
  await generateAdventure({
    seed: 24,
    key: "player-key",
    types: catalog,
    library,
    chain: "The Lost xAI Ship (pass)",
    fetchImpl(url, init) {
      assert.equal(url, XAI_URL);
      body = init.body;
      return Promise.resolve({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "nope" } }] }),
      });
    },
  });
  assert.equal(body.includes("The Lost xAI Ship"), true);
  assert.equal(body.includes("Chain so far"), true);
  const plain = await generateAdventure({
    seed: 40,
    key: "",
    types: catalog,
    library,
    chain: "prior",
  });
  assert.deepEqual(plain, offlineCard(40, catalog));
});

test("the end card offers continue and the citadel", () => {
  const src = readFileSync(new URL("../../packs/corridor-ab/play/adventure-ui.js", import.meta.url), "utf8");
  assert.equal(src.includes("Continuer"), true);
  assert.equal(src.includes("Retour à la Citadelle"), true);
  assert.equal(src.includes("rememberTruth"), true);
});

test("a truth is optional and a pass stores it in the archives", () => {
  const card = offlineCard(68, catalog);
  assert.equal(validateCard(card, catalog).ok, true);
  assert.ok(card.question.length > 8);
  assert.equal(card.truth.insight.startsWith("The Star Core reveals:"), true);
  assert.ok(card.truth.kind === "truth-orb" || card.truth.kind === "echo-shard");
  assert.ok(card.next_hook.question.length > 8);
  const bare = offlineCard(68, catalog);
  delete bare.question;
  delete bare.truth;
  delete bare.next_hook.question;
  assert.equal(validateCard(bare, catalog).ok, true);
  const plan = cardToPlan(offlineCard(XAI_SHIP_SEED, catalog), origin, catalog, library);
  const mem = {};
  const storage = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null; },
    setItem(key, value) { mem[key] = value; },
    removeItem(key) { delete mem[key]; },
  };
  const save = createSave(storage);
  const row = save.rememberTruth(plan.manifest.zoneId, plan.truth.insight, "2026-10-06T00:00:00.000Z");
  assert.equal(row.added, true);
  assert.equal(row.key, "adv-1024/truth");
  assert.equal(save.rememberTruth(plan.manifest.zoneId, plan.truth.insight).added, false);
  assert.equal(save.load().found["adv-1024/truth"].insight, plan.truth.insight);
  assert.equal(save.mark("adv-1024", "echo-1").added, true);
});

test("no key uses the offline path and does not fetch", async () => {
  let called = 0;
  const card = await generateAdventure({
    seed: 12,
    key: "",
    types: catalog,
    fetchImpl() { called += 1; },
  });
  assert.equal(called, 0);
  assert.equal(card.source, "offline");
  assert.equal(card.seed, 12);
});
