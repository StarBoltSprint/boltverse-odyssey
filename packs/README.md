# packs/

Each folder is one citadel disc. The player is https://boltverse-odyssey.grok.me

```
packs/<id>/room.json
packs/<id>/stills/
packs/<id>/films/
```

**Stock (golden hall)** is not in `main` (too heavy). It is a Release:

https://github.com/StarBoltSprint/boltverse-odyssey/releases/tag/citadel-stock-v1

Download `citadel-stock-v1.zip`, unzip into `packs/citadel/`, then:

```
python3 scripts/validate-pack.py packs/citadel
```

The live player `/` already serves this disc. The zip is the disc you can carry if the site moves.

Grok cooks new WorldLines **here**, validates, then gives `/r/<id>`.
Do not push a FAIL pack. Do not put mp4s at repo root.

See [VALIDATE.md](../VALIDATE.md) [PACK.md](../PACK.md).
