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

  function setRemote(remote) {
    const doc = load();
    doc.remote = remote == null ? null : remote;
    write(doc);
    return doc;
  }

  return { load, mark, setRemote, key: STORAGE_KEY };
}
