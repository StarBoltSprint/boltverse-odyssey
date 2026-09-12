# packs/

Each folder is one citadel disc. The player is https://boltverse-odyssey.grok.me

```
packs/<id>/room.json
packs/<id>/stills/
packs/<id>/films/
```

**Default hung hall on `main` = `packs/frost/` (ice).** Play: https://boltverse-odyssey.grok.me/r/frost

**Stock (golden hall)** is also a Release:

https://github.com/StarBoltSprint/boltverse-odyssey/releases/tag/citadel-stock-v1

Download `citadel-stock-v1.zip`, unzip into `packs/citadel/`, then:

```
python3 scripts/validate-pack.py packs/citadel
```

```
tag citadel-stock-v1   = reference disc
player /               = MUST play THIS disc
cook FAIL              = this same disc
```

Three places, one pack. When the 5 films change, tag `v2` — do not rewrite the zip in silence.

Smoke walks against `packs/citadel/stills/` from the zip. Never against `lock/example-*.jpg`.

Floor 0 = 3 stills + 5 films + empty ENTER. Seven films or a hung Enter = not stock.

The zip is the disc you can carry if the site moves.

Grok cooks new WorldLines **here**, validates, then gives `/r/<id>`.
Do not push a FAIL pack. Do not put mp4s at repo root.

See [PACK.md](../PACK.md) [VALIDATE.md](../VALIDATE.md).
