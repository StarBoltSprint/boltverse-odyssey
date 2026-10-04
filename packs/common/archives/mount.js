/**
 * One archives module for every zone. The zone passes a manifest URL.
 * Progress is local. remote stays empty until a later shared layer.
 */

import { buildCatalogue } from "./catalogue.js";
import { validateManifest } from "./manifest.js";
import { mountPresent } from "./present.js";
import { nearestUnfound } from "./pickup.js";
import { createSave } from "./save.js";
import { mountWorld } from "./world.js";

function noop() {
  return {
    draws: 0,
    draw() {},
    mag() { return 0; },
    sense() { return null; },
    tick() {},
    blocksPlay() { return false; },
    pawCorner() { return { x: 0, y: 0, w: 0, h: 0 }; },
    info() { return { found: 0, total: 0, draws: 0, colliders: [] }; },
    api: null,
  };
}

export async function mountArchives(gl, env) {
  let manifest;
  try {
    const res = await fetch(env.absUrl(env.manifestUrl));
    if (!res.ok) return noop();
    manifest = await res.json();
  } catch (e) {
    console.warn("archives", e);
    return noop();
  }
  const check = validateManifest(manifest);
  if (!check.ok) {
    console.warn("archives manifest", check.errors.join("; "));
    return noop();
  }
  const save = createSave(globalThis.localStorage);
  const progress = save.load();
  const found = new Set();
  const prefix = manifest.zoneId + "/";
  const keys = Object.keys(progress.found || {});
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].startsWith(prefix)) found.add(keys[i].slice(prefix.length));
  }
  let world;
  try {
    world = await mountWorld(gl, env, manifest);
  } catch (e) {
    console.warn("archives world", e);
    world = { draws: 0, draw() {}, mag() { return 0; }, setFound() {}, info() { return { draws: 0, colliders: [] }; }, colliders: [] };
  }
  world.setFound(found);
  const present = mountPresent(document, {
    absUrl: env.absUrl,
    ui: manifest.ui,
    cardMs: manifest.cardMs || 2500,
    onArchives() { openArchives(); },
  });

  function countText() {
    return found.size + " of " + manifest.shards.length;
  }
  present.setCount(countText());

  function take(shard) {
    const rec = save.mark(manifest.zoneId, shard.id);
    found.add(shard.id);
    world.setFound(found);
    present.setCount(countText());
    present.showCard(shard, manifest.cardMs || 2500);
    return rec.added;
  }

  function sense(x, z) {
    const hit = nearestUnfound(manifest.shards, x, z, manifest.pickupRadiusM || 2.25, found);
    if (!hit) return null;
    take(hit);
    return hit.id;
  }

  function openArchives() {
    present.openArchives(buildCatalogue(manifest, save.load()));
  }

  const api = {
    foundIds() { return [...found]; },
    collect(id) {
      const shard = manifest.shards.find((s) => s.id === id);
      if (!shard) return false;
      return take(shard);
    },
    openArchives,
    openMenu() { present.openMenu(); },
    close() { present.closeMenu(); present.closeArchives(); },
    showCard(id) {
      const shard = manifest.shards.find((s) => s.id === id);
      if (shard) present.showCard(shard, manifest.cardMs || 2500);
    },
    info() { return layer.info(); },
    blocksPlay() { return present.blocksPlay(); },
    pawCorner(vw, vh) { return present.pawCorner(vw, vh); },
  };

  const layer = {
    get draws() { return world.draws; },
    draw(vp, eye) { world.draw(vp, eye); },
    mag(eye, focal, vp) { return world.mag(eye, focal, vp); },
    sense,
    tick(dt) { present.tick(dt, present.blocksPlay()); },
    blocksPlay() { return present.blocksPlay(); },
    pawCorner(vw, vh) { return present.pawCorner(vw, vh); },
    info() {
      const w = world.info();
      return {
        ...w,
        found: found.size,
        total: manifest.shards.length,
        zoneId: manifest.zoneId,
        colliders: [],
      };
    },
    api,
  };
  return layer;
}
