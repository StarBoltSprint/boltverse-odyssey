/**
 * Shard pickup is a radius test. It does not move Bolt and it does not
 * add a collider. A shard is never an invisible wall.
 */

export function nearestUnfound(shards, x, z, radius, found) {
  const r = Number(radius);
  if (!Array.isArray(shards) || !(r > 0)) return null;
  let best = null;
  let bestD = r;
  for (let i = 0; i < shards.length; i++) {
    const s = shards[i];
    if (!s || found.has(s.id)) continue;
    const d = Math.hypot(s.x - x, s.z - z);
    if (d <= bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}
