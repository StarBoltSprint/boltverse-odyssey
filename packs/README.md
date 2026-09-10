# packs/

Each folder is one citadel disc. The player is https://boltverse-odyssey.grok.me

```
packs/<id>/room.json
packs/<id>/stills/
packs/<id>/films/
```

`citadel` (golden hall) is hung on the player itself until this folder is filled.
Grok cooks new WorldLines **here**, runs `node scripts/validate-pack.mjs packs/<id>`, then gives `/r/<id>`.
Do not push a FAIL pack. Do not put mp4s at repo root.

See [VALIDATE.md](../VALIDATE.md).
