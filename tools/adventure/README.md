# Adventure contract

Schema `adventure/1`. The card is what the game reads. It does not decree the plot. [`biome/docs/69-adventure-generator.md`](../../biome/docs/69-adventure-generator.md).

```bash
node --test tools/adventure/adventure.test.mjs
```

`generate.js` is the entry. No key means `offline.js`. A key means one POST to `https://api.x.ai/v1/chat/completions`, then `validate.js` and `repair.js`. The key is an argument. This folder does not store one.

`library.json` is the Codex: the shared segment catalogue. Recorded truths stay in the Living Archives save, one row per adventure, and the Archives page lists them. An older `<zoneId>/truth` row is still read. `resolve.js` walks a missing id to a ready stand-in. `unique.js` records a unique-touch ask and does not call Imagine. Seed 1024 is the lost xAI ship. `playmap.js` maps a valid card onto the corridor stream and an Echo Shard manifest. `drawsPixels` stays false. Optional `question` frames the run. Optional `truth` is a Star Core revelation. The pass writes it into that save, and it opens `next_hook.question`. The offline insights are the short canon list in `lib.js`.
