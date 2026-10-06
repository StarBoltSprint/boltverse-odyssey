import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cardToPlan } from "../../../tools/adventure/playmap.js";
import { offlineCard } from "../../../tools/adventure/offline.js";
import { buildCatalogue } from "./catalogue.js";
import { CODEX_FAR, codexCountLine, kindLabel } from "./codex.js";
import { createSave, listTruths } from "./save.js";

const catalog = JSON.parse(readFileSync(new URL("../../../tools/adventure/shard-types.json", import.meta.url), "utf8"));
const library = JSON.parse(readFileSync(new URL("../../../tools/adventure/library.json", import.meta.url), "utf8"));
const origin = { x0: 0.725, pathZ: 2.175, maxLengthM: 79.75 };

function memStore() {
  const m = new Map();
  return {
    getItem(k) { return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { m.set(k, String(v)); },
  };
}

function fields(row) {
  for (const key of ["question", "insight", "kind", "title", "seed", "zone", "at", "order"]) {
    assert.equal(Object.hasOwn(row, key), true, key);
  }
}

test("several adventures in one zone each keep a truth, in the order they were gathered", () => {
  const save = createSave(memStore());
  const first = save.rememberTruth("howling-eclipse", "time is a spiral", "2026-10-06T00:00:00.000Z", {
    question: "What is time?",
    kind: "truth-orb",
    title: "The Echoing Fracture",
    seed: 68,
  });
  const second = save.rememberTruth("howling-eclipse", "AI was always part of the plan", "2026-10-06T01:00:00.000Z", {
    question: "What was the plan?",
    kind: "echo-shard",
    title: "The Shard Symphony",
    seed: 351,
  });
  assert.equal(first.added, true);
  assert.equal(first.order, 1);
  assert.equal(second.added, true);
  assert.equal(second.order, 2);
  assert.equal(save.rememberTruth("howling-eclipse", "time is a spiral", "2026-10-06T02:00:00.000Z", {
    question: "What is time?",
    kind: "truth-orb",
    title: "The Echoing Fracture",
    seed: 68,
  }).added, false);
  const listed = listTruths(save.load());
  assert.equal(listed.length, 2);
  assert.deepEqual(listed.map((row) => row.seed), [68, 351]);
  assert.deepEqual(listed.map((row) => row.order), [1, 2]);
  assert.equal(listed[0].zone, "howling-eclipse");
  assert.equal(listed[1].zone, "howling-eclipse");
  fields(listed[0]);
});

test("reload keeps order, and a legacy zone truth is not overwritten", () => {
  const store = memStore();
  const save = createSave(store);
  const legacy = save.rememberTruth("howling-eclipse", "an older star", "2026-10-01T00:00:00.000Z");
  assert.equal(legacy.added, true);
  assert.equal(legacy.key, "howling-eclipse/truth");
  save.rememberTruth("howling-eclipse", "time is a spiral", "2026-10-06T00:00:00.000Z", {
    question: "What is time?",
    kind: "truth-orb",
    title: "The Echoing Fracture",
    seed: 68,
  });
  save.rememberTruth("howling-eclipse", "AI was always part of the plan", "2026-10-06T01:00:00.000Z", {
    question: "What was the plan?",
    kind: "echo-shard",
    title: "The Shard Symphony",
    seed: 351,
  });
  assert.equal(save.load().found["howling-eclipse/truth"].insight, "an older star");
  assert.equal(save.rememberTruth("howling-eclipse", "an older star", "2026-10-07T00:00:00.000Z").added, false);
  const listed = listTruths(createSave(store).load());
  assert.equal(listed.length, 3);
  assert.equal(listed[0].order, 1);
  assert.equal(listed[0].insight, "an older star");
  assert.equal(listed[0].zone, "howling-eclipse");
  assert.equal(listed[1].order, 2);
  assert.equal(listed[1].seed, 68);
  assert.equal(listed[1].title, "The Echoing Fracture");
  assert.equal(listed[1].kind, "truth-orb");
  assert.equal(listed[1].question, "What is time?");
  assert.equal(listed[2].order, 3);
  assert.equal(listed[2].seed, 351);
  assert.equal(listed[2].kind, "echo-shard");
  fields(listed[1]);
  assert.equal(save.load().found["howling-eclipse/one"], undefined);
});

test("a legacy adv-seed truth migrates into the same row as that adventure", () => {
  const store = memStore();
  store.setItem("boltverse.archives.v1", JSON.stringify({
    schema: "archives-progress/1",
    playerId: "local-test",
    found: {
      "adv-1024/truth": {
        zoneId: "adv-1024",
        shardId: "truth",
        at: "2026-10-05T00:00:00.000Z",
        insight: "The Star Core reveals: Understanding the universe is not a destination. It is an endless becoming.",
      },
      "adv-1024/echo-1": { zoneId: "adv-1024", shardId: "echo-1", at: "2026-10-05T00:00:01.000Z" },
    },
    remote: null,
  }));
  const save = createSave(store);
  const plan = cardToPlan(offlineCard(1024, catalog), origin, catalog, library);
  const rec = save.rememberTruth(plan.manifest.zoneId, plan.truth.insight, "2026-10-06T00:00:00.000Z", {
    question: plan.question,
    kind: plan.truth.kind,
    title: plan.title,
    seed: plan.seed,
  });
  assert.equal(rec.added, true);
  const listed = listTruths(save.load());
  assert.equal(listed.length, 1);
  assert.equal(listed[0].order, 1);
  assert.equal(listed[0].seed, 1024);
  assert.equal(listed[0].title, "The Lost xAI Ship");
  assert.equal(listed[0].at, "2026-10-05T00:00:00.000Z");
  assert.equal(save.load().found["adv-1024/truth"].insight, plan.truth.insight);
  assert.equal(save.load().found["adv-1024/echo-1"].shardId, "echo-1");
  const manifest = {
    schema: "echo-shards/1",
    zoneId: "adv-1024",
    ui: { silhouette: "dim.png" },
    shards: [
      { id: "echo-1", title: "Echo", lore: "A line.", image: "crystal.png" },
      { id: "echo-2", title: "Echo 2", lore: "Another.", image: "crystal.png" },
    ],
  };
  const cat = buildCatalogue(manifest, save.load());
  assert.equal(cat.found, 1);
  assert.equal(cat.total, 2);
  assert.equal(cat.shards[0].showLore, true);
  assert.equal(cat.shards[1].showLore, false);
  assert.equal(cat.shards[1].image, "dim.png");
});

test("seeds 1024, 68, and 351 stay in completion order after reload", () => {
  const store = memStore();
  const save = createSave(store);
  const seeds = [1024, 68, 351];
  const expect = [
    "The Star Core reveals: Understanding the universe is not a destination. It is an endless becoming.",
    "The Star Core reveals: time is a spiral.",
    "The Star Core reveals: AI was always part of the plan.",
  ];
  for (let i = 0; i < seeds.length; i++) {
    const plan = cardToPlan(offlineCard(seeds[i], catalog), origin, catalog, library);
    const rec = save.rememberTruth("corridor", plan.truth.insight, "2026-10-06T0" + i + ":00:00.000Z", {
      question: plan.question,
      kind: plan.truth.kind,
      title: plan.title,
      seed: plan.seed,
    });
    assert.equal(rec.added, true);
    assert.equal(rec.order, i + 1);
    assert.equal(plan.truth.insight, expect[i]);
  }
  const listed = listTruths(createSave(store).load());
  assert.equal(listed.length, 3);
  assert.deepEqual(listed.map((row) => row.order), [1, 2, 3]);
  assert.deepEqual(listed.map((row) => row.seed), seeds);
  assert.deepEqual(listed.map((row) => row.insight), expect);
  assert.deepEqual(listed.map((row) => row.title), [
    "The Lost xAI Ship",
    "The Echoing Fracture",
    "The Shard Symphony",
  ]);
  assert.equal(listed[0].zone, "corridor");
  assert.equal(listed[2].zone, "corridor");
  fields(listed[0]);
});

test("the codex count never calls the quest finished", () => {
  assert.equal(codexCountLine(0), "Aucune vérité réunie");
  assert.equal(codexCountLine(1), "1 vérité réunie");
  assert.equal(codexCountLine(3), "3 vérités réunies");
  assert.equal(kindLabel("truth-orb"), "Orbe de vérité");
  assert.equal(kindLabel("echo-shard"), "Éclat d'écho");
  assert.equal(CODEX_FAR.includes("n'a pas de fin"), true);
  assert.equal(CODEX_FAR.toLowerCase().includes("final"), false);
  const present = readFileSync(new URL("./present.js", import.meta.url), "utf8");
  assert.equal(present.includes("Codex vivant"), true);
  assert.equal(present.includes("scale("), false);
  const quest = readFileSync(new URL("../../corridor-ab/play/quest.js", import.meta.url), "utf8");
  assert.equal(quest.includes("Codex vivant"), true);
});
