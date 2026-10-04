import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildCatalogue } from "./catalogue.js";
import { cardBox, cardOpacity, chromeLayout, containBox, fitPixels, overlaps, plateBox, pointInLook } from "./layout.js";
import { validateManifest } from "./manifest.js";
import { nearestUnfound } from "./pickup.js";
import { footY, seatMin, worldHeight } from "./place.js";
import { createSave } from "./save.js";

const zone = JSON.parse(readFileSync(new URL("../../zone-a/src/archives/manifest.json", import.meta.url), "utf8"));

function memStore() {
  const m = new Map();
  return {
    getItem(k) { return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { m.set(k, String(v)); },
  };
}

function throwStore() {
  return {
    getItem() { throw new Error("denied"); },
    setItem() { throw new Error("denied"); },
  };
}

function baseManifest() {
  return {
    schema: "echo-shards/1",
    zoneId: "howling-eclipse",
    pickupRadiusM: 2.25,
    ui: { paw: "a.png", plate: "b.jpg", hall: "c.jpg", silhouette: "d.png" },
    shards: [
      { id: "one", title: "One", lore: "A line.", image: "crystal.png", x: 0, z: 0, yaw: 0 },
      { id: "two", title: "Two", lore: "Another line.", image: "crystal.png", x: 5, z: 0, yaw: 0 },
    ],
  };
}

function distToSeg(px, pz, ax, az, bx, bz) {
  const vx = bx - ax;
  const vz = bz - az;
  const l2 = vx * vx + vz * vz;
  let t = ((px - ax) * vx + (pz - az) * vz) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}

test("validateManifest accepts a small catalogue and rejects bad rows", () => {
  const ok = validateManifest(baseManifest());
  assert.equal(ok.ok, true, ok.errors.join("; "));
  const missing = validateManifest({ schema: "nope" });
  assert.equal(missing.ok, false);
  const dup = baseManifest();
  dup.shards[1].id = "one";
  assert.equal(validateManifest(dup).ok, false);
  const stacked = baseManifest();
  stacked.shards[1].x = 0.2;
  assert.ok(validateManifest(stacked).errors.some((e) => e.startsWith("stacked")));
  const lore = baseManifest();
  lore.shards[0].lore = "x".repeat(221);
  assert.equal(validateManifest(lore).ok, false);
  const ui = baseManifest();
  delete ui.ui.hall;
  assert.equal(validateManifest(ui).ok, false);
  const img = baseManifest();
  img.shards[0].image = "crystal.jpg";
  assert.equal(validateManifest(img).ok, false);
});

test("save and load round-trip on memory, mark once, remote keeps found", () => {
  const store = memStore();
  const seen = [];
  const save = createSave(store, { onFound: (ev) => seen.push(ev.key) });
  const first = save.load();
  assert.equal(first.schema, "archives-progress/1");
  assert.equal(first.remote, null);
  assert.equal(first.playerId.startsWith("local-"), true);
  const a = save.mark("howling-eclipse", "pulse-birth");
  assert.equal(a.added, true);
  const b = save.mark("howling-eclipse", "pulse-birth");
  assert.equal(b.added, false);
  assert.deepEqual(seen, ["howling-eclipse/pulse-birth"]);
  const again = createSave(store);
  const loaded = again.load();
  assert.equal(loaded.playerId, first.playerId);
  assert.equal(loaded.found["howling-eclipse/pulse-birth"].shardId, "pulse-birth");
  const remote = again.setRemote({ shared: true, globalCount: 3, narration: null });
  assert.equal(remote.remote.globalCount, 3);
  assert.equal(remote.found["howling-eclipse/pulse-birth"].zoneId, "howling-eclipse");
  const broken = memStore();
  broken.setItem("boltverse.archives.v1", "{\"schema\":\"other\"}");
  const reset = createSave(broken).load();
  assert.equal(reset.schema, "archives-progress/1");
  assert.deepEqual(reset.found, {});
});

test("storage that throws falls back to memory for the same save", () => {
  const save = createSave(throwStore());
  assert.equal(save.mark("howling-eclipse", "felt-echo").added, true);
  assert.equal(save.mark("howling-eclipse", "felt-echo").added, false);
  const doc = save.setRemote({ shared: false });
  assert.equal(doc.found["howling-eclipse/felt-echo"].shardId, "felt-echo");
  assert.equal(doc.remote.shared, false);
});

test("pickup is radius only and does not move the shard", () => {
  const shards = [
    { id: "one", x: 0, z: 0 },
    { id: "two", x: 10, z: 0 },
  ];
  const found = new Set();
  const hit = nearestUnfound(shards, 1.5, 0, 2.25, found);
  assert.equal(hit.id, "one");
  assert.equal(shards[0].x, 0);
  found.add("one");
  assert.equal(nearestUnfound(shards, 1.5, 0, 2.25, found), null);
  assert.equal(nearestUnfound(shards, 8, 0, 2.25, found).id, "two");
  assert.equal(nearestUnfound(shards, 0, 3, 2.25, new Set()), null);
});

test("catalogue splits found art from unfound silhouettes", () => {
  const manifest = baseManifest();
  manifest.ui.silhouette = "dim.png";
  const progress = {
    found: { "howling-eclipse/one": { zoneId: "howling-eclipse", shardId: "one", at: "t" } },
    remote: { globalCount: 9 },
  };
  const cat = buildCatalogue(manifest, progress);
  assert.equal(cat.found, 1);
  assert.equal(cat.total, 2);
  assert.equal(cat.shards[0].image, "crystal.png");
  assert.equal(cat.shards[0].showLore, true);
  assert.equal(cat.shards[1].image, "dim.png");
  assert.equal(cat.shards[1].showLore, false);
  assert.equal(cat.shards[1].lore, "Another line.");
});

test("paw stays off the stick and inside the reserved corner", () => {
  for (const [vw, vh] of [[360, 800], [720, 1600]]) {
    const layout = chromeLayout(vw, vh, 56, 64);
    assert.equal(overlaps(layout.paw, layout.stick), false);
    assert.equal(overlaps(plateBox(vw, vh), layout.stick), false);
    const card = cardBox(vw, vh);
    assert.equal(overlaps(card, layout.stick), false);
    assert.equal(overlaps(card, layout.reserve), false);
    assert.ok(card.y + card.h < vh * 0.4);
    assert.ok(layout.paw.x >= layout.reserve.x);
    assert.ok(layout.paw.y >= layout.reserve.y);
    assert.ok(layout.paw.x + layout.paw.w <= layout.reserve.x + layout.reserve.w);
    assert.ok(layout.paw.y + layout.paw.h <= layout.reserve.y + layout.reserve.h);
    assert.equal(pointInLook(vw / 2, vh / 2, vw, vh), true);
    assert.equal(pointInLook(layout.stick.x + 10, layout.stick.y + 10, vw, vh), false);
    assert.equal(pointInLook(layout.reserve.x + 4, 8, vw, vh), false);
  }
});

test("fit never enlarges Imagine pixels", () => {
  const hall = fitPixels(1080, 1920, 360, 800, 2);
  assert.equal(hall.mode, "cover");
  assert.ok(Math.abs(hall.scale - 0.833333) < 0.002);
  const tiny = fitPixels(400, 400, 360, 800, 2);
  assert.equal(tiny.mode, "contain");
  assert.equal(tiny.scale, 1);
  assert.equal(tiny.cssW, 200);
  const box = containBox(718, 760, 72, 96, 2);
  assert.ok(box.scale <= 1);
  assert.ok(box.cssW * 2 <= 718 + 0.01);
  assert.ok(box.cssH * 2 <= 760 + 0.01);
});

test("card opacity holds inside 2.5 s", () => {
  assert.equal(cardOpacity(0), 0);
  assert.equal(cardOpacity(100), 0.5);
  assert.equal(cardOpacity(1000), 1);
  assert.ok(Math.abs(cardOpacity(2150) - 0.5) < 1e-9);
  assert.equal(cardOpacity(2500), 0);
  assert.equal(cardOpacity(2600), 0);
});

test("world height never enlarges and the foot meets the ground", () => {
  const hfov = 22.7 * Math.PI / 180;
  const vfov = 2 * Math.atan(Math.tan(hfov / 2) / (720 / 1600));
  const focal = 800 / Math.tan(vfov / 2);
  const tall = worldHeight(760, focal, 2.3, 1.12);
  assert.ok(tall <= 1.12);
  assert.ok(tall <= (0.98 * 2.3 * 760) / focal + 1e-9);
  const short = worldHeight(100, focal, 2.3, 1.12);
  assert.ok(short < 0.2);
  assert.ok(short <= (0.98 * 2.3 * 100) / focal + 1e-9);
  const flat = seatMin(() => 1.5, 0, 0, 0, 1, 0.3);
  assert.equal(flat, 1.5);
  const y = footY(flat, tall * 0.1);
  assert.ok(Math.abs(y + tall * 0.1 - flat) < 1e-9);
  const slope = seatMin((x) => x, 0, 0, 0, 1, 0.4);
  assert.ok(Math.abs(slope - (-0.4)) < 1e-9);
});

test("zone A places six shards on the path and beside the landmarks", () => {
  const check = validateManifest(zone);
  assert.equal(check.ok, true, check.errors.join("; "));
  assert.equal(zone.shards.length, 6);
  const ids = zone.shards.map((s) => s.id);
  assert.equal(new Set(ids).size, 6);
  for (const s of zone.shards) {
    assert.ok(s.lore.length > 8);
    assert.equal(s.image.endsWith(".png"), true);
    assert.equal(Object.hasOwn(s, "collider"), false);
  }
  for (let i = 0; i < zone.shards.length; i++) {
    for (let j = i + 1; j < zone.shards.length; j++) {
      const a = zone.shards[i];
      const b = zone.shards[j];
      assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 4);
    }
  }
  const by = Object.fromEntries(zone.shards.map((s) => [s.id, s]));
  const gateD = Math.hypot(by["gate-memory"].x - 18.451, by["gate-memory"].z - 25.657);
  assert.ok(gateD > 10.53);
  assert.ok(gateD > 11 && gateD < 20);
  const archD = Math.hypot(by["arch-whisper"].x - (-5), by["arch-whisper"].z - 39);
  assert.ok(archD > 3.8);
  assert.ok(archD > 4.2 && archD < 10);
  const apron = Math.hypot(by["hangar-echo"].x - (-18.528), by["hangar-echo"].z - 15.507);
  assert.ok(apron < 0.02);
  const wreckD = Math.hypot(by["hangar-echo"].x - (-24), by["hangar-echo"].z - 14);
  assert.ok(wreckD > 4 && wreckD < 12);
  const nearPath = zone.shards.filter((s) => distToSeg(s.x, s.z, -6, -14, 18.451, 25.657) <= 2.25);
  assert.ok(nearPath.length >= 3);
  const src = readFileSync(new URL("./world.js", import.meta.url), "utf8");
  assert.equal(src.includes("colliders.push"), false);
  assert.ok(src.includes("colliders: []"));
  assert.equal(src.includes("NEAREST"), false);
});
