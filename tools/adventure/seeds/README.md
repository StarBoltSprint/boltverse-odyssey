# Adventure seeds

Data only. No runtime code reads this folder yet.

- `star-map-signals.json` (schema `adventure-seeds/1`): 12 hand-written `adventure/1` cards, seeds 2101-2112. Each opens with beat `star-map` on `citadel-exit`: the Star Map in the Aetherbolt Citadel receives a signal and Grok turns it into a quest. Lines are per-run flavour, not canon (doc 69). Truths reuse the Star Core list in `lib.js`; no decree number is assigned.
- `seeds.test.mjs` (one level up) checks every card with `validateCard` and `cardToPlan`.
- The full lore-mined catalogue (sources, beats, needed assets) is in the PR description and in `/workspace/lore-mining/adventure-catalogue.md` on the box.

A later step may let `generate.js` or the Grok prompt pick a seed card from here. That wiring is not in this change.
