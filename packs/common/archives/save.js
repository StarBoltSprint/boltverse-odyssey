/**
 * Per-player archives progress. Local only. No account.
 * remote stays null until a later shared layer fills it.
 * Zones never read or write this shape; the shared module does.
 */

export const PROGRESS_SCHEMA = "archives-progress/1";
export const STORAGE_KEY = "boltverse.archives.v1";

function blank() {
  return {
    schema: PROGRESS_SCHEMA,
    playerId: "local-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
    found: {},
    remote: null,
  };
}

function sane(doc) {
  return !!(doc && doc.schema === PROGRESS_SCHEMA && typeof doc.playerId === "string" && doc.found && typeof doc.found === "object");
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function seedOf(zone, seed) {
  if (Number.isInteger(seed) && seed >= 1) return seed;
  const match = /^adv-(\d+)$/.exec(String(zone || ""));
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

function identity(zone, seed) {
  const n = seedOf(zone, seed);
  const zoneText = String(zone || "");
  if (n != null && zoneText === "adv-" + n) return zoneText;
  if (n != null) return zoneText + "#" + n;
  return zoneText + "#legacy";
}

function earlier(a, b) {
  if (!a) return b || "";
  if (!b) return a;
  return a <= b ? a : b;
}

function kindOf(kind) {
  return kind === "truth-orb" || kind === "echo-shard" ? kind : "";
}

/**
 * Every gathered truth, oldest first.
 * A legacy `<zoneId>/truth` row is read beside `codex`.
 * The same adventure (zone + seed) is one row. A richer row fills the gaps.
 */
export function listTruths(doc) {
  const map = new Map();
  function take(partial) {
    const zone = partial.zone || partial.zoneId || "";
    const insight = cleanText(partial.insight);
    if (!zone || !insight) return;
    const seed = seedOf(zone, partial.seed);
    const id = identity(zone, partial.seed);
    const next = {
      zone,
      seed,
      question: cleanText(partial.question),
      insight,
      kind: kindOf(partial.kind),
      title: cleanText(partial.title),
      at: typeof partial.at === "string" ? partial.at : "",
      key: partial.key || (seed != null ? zone + "/truth/" + seed : zone + "/truth"),
    };
    const prev = map.get(id);
    if (!prev) {
      map.set(id, next);
      return;
    }
    map.set(id, {
      zone: prev.zone || next.zone,
      seed: prev.seed != null ? prev.seed : next.seed,
      question: next.question || prev.question,
      insight: next.insight || prev.insight,
      kind: next.kind || prev.kind,
      title: next.title || prev.title,
      at: earlier(prev.at, next.at),
      key: next.key || prev.key,
    });
  }
  const found = (doc && doc.found) || {};
  const keys = Object.keys(found);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (!key.endsWith("/truth")) continue;
    const row = found[key];
    if (!row || typeof row !== "object") continue;
    take({
      zone: row.zone || row.zoneId || key.slice(0, -"/truth".length),
      seed: row.seed,
      question: row.question,
      insight: row.insight,
      kind: row.kind,
      title: row.title,
      at: row.at,
      key,
    });
  }
  const codex = Array.isArray(doc && doc.codex) ? doc.codex : [];
  for (let i = 0; i < codex.length; i++) {
    const row = codex[i];
    if (!row || typeof row !== "object") continue;
    take(row);
  }
  const rows = [];
  map.forEach((row) => rows.push(row));
  rows.sort((a, b) => {
    const ta = a.at || "9999";
    const tb = b.at || "9999";
    if (ta !== tb) return ta < tb ? -1 : 1;
    return String(a.key).localeCompare(String(b.key));
  });
  return rows.map((row, i) => ({
    question: row.question,
    insight: row.insight,
    kind: row.kind,
    title: row.title,
    seed: row.seed,
    zone: row.zone,
    at: row.at,
    order: i + 1,
    key: row.key,
  }));
}

export function createSave(storage, opts) {
  const onFound = (opts && opts.onFound) || (() => {});
  const mem = {};
  let useMem = false;

  function readRaw() {
    if (useMem || !storage) return Object.prototype.hasOwnProperty.call(mem, STORAGE_KEY) ? mem[STORAGE_KEY] : null;
    try {
      return storage.getItem(STORAGE_KEY);
    } catch (e) {
      useMem = true;
      return Object.prototype.hasOwnProperty.call(mem, STORAGE_KEY) ? mem[STORAGE_KEY] : null;
    }
  }

  function writeRaw(text) {
    mem[STORAGE_KEY] = text;
    if (useMem || !storage) return;
    try {
      storage.setItem(STORAGE_KEY, text);
    } catch (e) {
      useMem = true;
    }
  }

  function load() {
    const raw = readRaw();
    if (!raw) {
      const doc = blank();
      writeRaw(JSON.stringify(doc));
      return doc;
    }
    try {
      const doc = JSON.parse(raw);
      if (!sane(doc)) {
        const next = blank();
        writeRaw(JSON.stringify(next));
        return next;
      }
      if (doc.remote === undefined) doc.remote = null;
      return doc;
    } catch (e) {
      const next = blank();
      writeRaw(JSON.stringify(next));
      return next;
    }
  }

  function write(doc) {
    writeRaw(JSON.stringify(doc));
    return doc;
  }

  function mark(zoneId, shardId, at) {
    const doc = load();
    const key = zoneId + "/" + shardId;
    if (doc.found[key]) return { added: false, doc, key };
    const when = at || new Date().toISOString();
    doc.found[key] = { zoneId, shardId, at: when };
    write(doc);
    onFound({ zoneId, shardId, at: when, key });
    return { added: true, doc, key };
  }

  function rememberTruth(zoneId, insight, at, meta) {
    const text = cleanText(insight);
    if (!zoneId || !text) return { added: false, doc: load(), key: "", order: 0 };
    let when = at;
    let extra = meta || null;
    if (at && typeof at === "object") {
      extra = at;
      when = extra.at;
    }
    extra = extra || {};
    const stamp = typeof when === "string" && when ? when : new Date().toISOString();
    const seed = Number.isInteger(extra.seed) && extra.seed >= 1 ? extra.seed : null;
    const doc = load();
    if (seed != null) {
      if (!Array.isArray(doc.codex)) doc.codex = [];
      const key = zoneId + "/truth/" + seed;
      const dup = doc.codex.find((row) => row && row.zone === zoneId && row.seed === seed);
      if (dup) {
        const listed = listTruths(doc);
        const hit = listed.find((item) => item.zone === zoneId && item.seed === seed);
        return { added: false, doc, key: dup.key || key, order: hit ? hit.order : dup.order || 0 };
      }
      doc.codex.push({
        key,
        zone: zoneId,
        zoneId,
        seed,
        question: cleanText(extra.question),
        insight: text,
        kind: kindOf(extra.kind),
        title: cleanText(extra.title),
        at: stamp,
        order: 0,
      });
      const listed = listTruths(doc);
      for (let i = 0; i < doc.codex.length; i++) {
        const row = doc.codex[i];
        const hit = listed.find((item) => item.zone === row.zone && item.seed === row.seed);
        if (hit) row.order = hit.order;
      }
      write(doc);
      const hit = listed.find((item) => item.zone === zoneId && item.seed === seed);
      return { added: true, doc, key, order: hit ? hit.order : listed.length };
    }
    const key = zoneId + "/truth";
    if (doc.found[key]) {
      const listed = listTruths(doc);
      const hit = listed.find((item) => item.key === key);
      return { added: false, doc, key, order: hit ? hit.order : 0 };
    }
    doc.found[key] = { zoneId, shardId: "truth", at: stamp, insight: text };
    write(doc);
    const listed = listTruths(doc);
    const hit = listed.find((item) => item.key === key);
    return { added: true, doc, key, order: hit ? hit.order : 0 };
  }

  function setRemote(remote) {
    const doc = load();
    doc.remote = remote == null ? null : remote;
    write(doc);
    return doc;
  }

  return { load, mark, rememberTruth, setRemote, key: STORAGE_KEY };
}
