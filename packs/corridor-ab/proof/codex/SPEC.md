# Step — Living Codex truths

Goal: every adventure Bolt finishes leaves its Star Core truth in the Living Codex, and the player can reread it from the Archives. No new Imagine file. No new mesh. Text and the existing hall only.

## Rails

- Truths are one row per completed adventure. Several adventures in one zone all stay. An older `<zoneId>/truth` row is still read.
- Each row keeps the question, the truth text, the kind, the adventure title, the seed, the zone, the date, and its order.
- The Archives page lists Echo Shards as it does now, and lists the truths in order. Opening one shows the question, the truth, and the adventure. Progress is a count toward the Star Core, and the quest does not end.
- A pass shows a short inscription moment, then Continuer and Retour à la Citadelle.
- Player words for the new screen are French. Card text stays the card’s own words. No biome sheet is shown.
- The screen is DOM over the existing hall. Phone budgets stay. No new draw, no new video, no world card.

## Done when

1. Storage, migration, and order tests pass, and the existing 45 adventure and corridor tests still pass.
2. Seeds 1024, 68, and 351 completed in that order leave three truths that survive a reload.
3. Proof stills show the Codex list, one opened truth, and the inscription moment.
4. Echo Shard rows on the Archives page still list found and unfound shards.
