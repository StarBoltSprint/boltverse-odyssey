/**
 * Echo shard manifest. A zone adds shards by writing one of these.
 * Schema echo-shards/1. The shared module refuses to place an invalid file.
 */

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isNum(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function bad(errors, msg) {
  errors.push(msg);
}

export function validateManifest(doc) {
  const errors = [];
  if (!doc || typeof doc !== "object") {
    return { ok: false, errors: ["manifest is not an object"] };
  }
  if (doc.schema !== "echo-shards/1") bad(errors, "schema must be echo-shards/1");
  if (typeof doc.zoneId !== "string" || !ID.test(doc.zoneId)) bad(errors, "zoneId");
  if (doc.pickupRadiusM != null && !(isNum(doc.pickupRadiusM) && doc.pickupRadiusM > 0.4 && doc.pickupRadiusM <= 4)) {
    bad(errors, "pickupRadiusM");
  }
  if (doc.cardMs != null && !(isNum(doc.cardMs) && doc.cardMs >= 2000 && doc.cardMs <= 3000)) {
    bad(errors, "cardMs");
  }
  if (doc.heightCapM != null && !(isNum(doc.heightCapM) && doc.heightCapM > 0.2 && doc.heightCapM <= 2.5)) {
    bad(errors, "heightCapM");
  }
  if (doc.approachM != null && !(isNum(doc.approachM) && doc.approachM > 0.5 && doc.approachM <= 8)) {
    bad(errors, "approachM");
  }
  if (doc.buryFrac != null && !(isNum(doc.buryFrac) && doc.buryFrac >= 0 && doc.buryFrac <= 0.45)) {
    bad(errors, "buryFrac");
  }
  const ui = doc.ui;
  if (!ui || typeof ui !== "object") bad(errors, "ui");
  else {
    for (const key of ["paw", "plate", "hall", "silhouette"]) {
      if (typeof ui[key] !== "string" || !ui[key]) bad(errors, "ui." + key);
    }
  }
  if (!Array.isArray(doc.shards) || doc.shards.length < 1) bad(errors, "shards");
  else {
    const seen = new Set();
    for (let i = 0; i < doc.shards.length; i++) {
      const s = doc.shards[i];
      const at = "shards[" + i + "]";
      if (!s || typeof s !== "object") {
        bad(errors, at);
        continue;
      }
      if (typeof s.id !== "string" || !ID.test(s.id)) bad(errors, at + ".id");
      else if (seen.has(s.id)) bad(errors, "duplicate " + s.id);
      else seen.add(s.id);
      if (typeof s.title !== "string" || s.title.length < 1 || s.title.length > 80) bad(errors, at + ".title");
      if (typeof s.lore !== "string" || s.lore.length < 1 || s.lore.length > 220) bad(errors, at + ".lore");
      else if ([...s.lore].some((ch) => {
        const c = ch.codePointAt(0);
        return c < 32 || c > 126;
      })) bad(errors, at + ".lore charset");
      if (typeof s.image !== "string" || !s.image.endsWith(".png")) bad(errors, at + ".image");
      if (!isNum(s.x) || !isNum(s.z)) bad(errors, at + ".position");
      if (s.yaw != null && !isNum(s.yaw)) bad(errors, at + ".yaw");
    }
    const list = doc.shards;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (!a || !b || !isNum(a.x) || !isNum(b.x)) continue;
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        if (d < 0.5) bad(errors, "stacked " + a.id + " " + b.id);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
