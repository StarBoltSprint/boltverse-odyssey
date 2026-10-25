import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { cardToPlan } from "./playmap.js";
import { validateCard } from "./validate.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const catalog = read("./shard-types.json");
const library = read("./library.json");
const seeds = read("./seeds/star-map-signals.json");
const origin = { x0: 0.725, pathZ: 2.175, maxLengthM: 79.75 };

test("star map seeds are valid adventure/1 cards that map onto the corridor", () => {
  assert.equal(seeds.schema, "adventure-seeds/1");
  assert.ok(seeds.cards.length >= 10);
  const ids = new Set();
  for (const card of seeds.cards) {
    const check = validateCard(card, catalog);
    assert.equal(check.ok, true, card.seed + ": " + check.errors.join("; "));
    assert.equal(card.drawsPixels, false);
    assert.equal(card.beats[0].id, "star-map");
    assert.ok(!ids.has(card.seed), "dup seed " + card.seed);
    ids.add(card.seed);
    assert.ok(cardToPlan(card, origin, catalog, library));
  }
});
