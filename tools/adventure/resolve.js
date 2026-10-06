/**
 * Map a beat's segment id onto a library row the corridor can place.
 * Unknown ids and missing rows walk to a ready stand-in. This file does not draw.
 */

function readyRows(library) {
  return (library.segments || []).filter((row) => row && row.status === "ready");
}

function nearestReady(id, library) {
  const ready = readyRows(library);
  const needle = String(id || "").toLowerCase();
  let best = null;
  let bestScore = 0;
  for (let i = 0; i < ready.length; i++) {
    const row = ready[i];
    if (row.id === "corridor-run") best = best || row;
    const keys = (row.match || []).concat(String(row.id).split("-"));
    let score = 0;
    for (let k = 0; k < keys.length; k++) {
      const word = String(keys[k]).toLowerCase();
      if (word.length > 2 && needle.includes(word)) score += word.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  return best || ready[0] || null;
}

export function resolveSegment(id, library) {
  const rows = library && library.segments;
  const byId = new Map();
  if (Array.isArray(rows)) {
    for (let i = 0; i < rows.length; i++) byId.set(rows[i].id, rows[i]);
  }
  const seen = new Set();
  let cur = id;
  let hops = 0;
  while (cur && hops < 8 && !seen.has(cur)) {
    seen.add(cur);
    const row = byId.get(cur);
    if (!row) {
      const stand = nearestReady(id, library);
      return { requested: id, segment: stand, via: "unknown" };
    }
    if (row.status === "ready") {
      return { requested: id, segment: row, via: hops === 0 ? "ready" : "fallback" };
    }
    cur = row.fallback;
    hops += 1;
  }
  return { requested: id, segment: nearestReady(id, library), via: "fallback" };
}
