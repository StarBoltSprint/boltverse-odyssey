/**
 * Found and unfound rows for any Archives view.
 * A later 3D Citadel hub reads this. It does not need the DOM page.
 * remote on the progress doc is ignored here.
 */

export function buildCatalogue(manifest, progress) {
  const found = (progress && progress.found) || {};
  const silhouette = manifest.ui && manifest.ui.silhouette;
  const shards = (manifest.shards || []).map((s) => {
    const key = manifest.zoneId + "/" + s.id;
    const row = found[key];
    const got = !!row;
    return {
      zoneId: manifest.zoneId,
      shardId: s.id,
      id: s.id,
      title: s.title,
      lore: s.lore,
      showLore: got,
      art: s.image,
      image: got ? s.image : silhouette,
      found: got,
      at: got ? row.at : null,
    };
  });
  return {
    zoneId: manifest.zoneId,
    shards,
    found: shards.filter((s) => s.found).length,
    total: shards.length,
  };
}
