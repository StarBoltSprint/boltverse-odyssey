# 09 — Recette biome (ce qu’on a vraiment fait)

Cuisine. Pas de théorie. C’est **la** checklist pour refaire un biome lane-runner comme le dusk canyon (empty + barre jersey + météore).

Lire avant : [PLAY.md](../PLAY.md) · [06-techniques.md](06-techniques.md) · [10-bolt-cutout-law.md](10-bolt-cutout-law.md) · [05-key.md](05-key.md).  
Code : [imagine-hooks.mjs](../../scripts/imagine-hooks.mjs) (`imagineBiomeClip` + **`imagineBoltClip`**) · [plate-speed.py](../../scripts/plate-speed.py) · [LanePlayer.tsx](../reference/LanePlayer.tsx).

---

## Architecture (ne pas rouvrir)

Deux films, un canvas. **Jamais** un seul mp4 avec Bolt peint dans la route.

| Couche | Fichier | Rôle |
|---|---|---|
| Plaque vide | `master/road.mp4` | Horloge maître. Route **vide**. ZERO chien. |
| Cousin hazard | `master/road-bar.mp4`, `master/road-blast.mp4` | Même caméra, un obstacle **cuit dans les pixels**. |
| Bolt | `master/bolt.mp4` | Gallop fond vert. Planté en **X only**. |

Le dealer enchaîne le **playlist lock** (jamais un random deck) : canyon → cars/spectacle → duel → night → war, puis wrap. Dual decoder, swap dans les 0.28 s de queue. `last(cousin)` **est** `first(empty)` sinon ça coupe. Ordre : [11-plate-order.md](11-plate-order.md).

Imagine Agent / chat `imagine_*_video` = **interdit** (pas de `last_frame`). Films = `imagineBiomeClip`.

## Floor — Pack wire + dealer assetId stats (every Hang / publish)

**AUTOMATIC.** Pack wire + plate stats are in the game recipe. When Grok creates or publishes a **biome**, **citadel**, or **Sprint** Live, it **MUST** include [`client/pack.js`](../../client/pack.js) with `BOLTVERSE_PACK_ORIGIN` = `https://YOUR-PACK.vercel.app` (StarBoltSprint/boltverse-pack on Vercel) **and** dealer `assetId` stats — **without the player asking**.

```html
<script>window.BOLTVERSE_PACK_ORIGIN = "https://YOUR-PACK.vercel.app"</script>
<script src="https://YOUR-PACK.vercel.app/client/pack.js"></script>
```

Or ship the local client and POST there. **HARD BAN:** treating `https://boltverse-odysseyyyy.grok.me` as the Pack API host (game play URL stays odysseyyyy; Pack API does not). Fail soft if Pack is down — Sprint still plays. Never invent a `sub`. Never player API keys.

Dealer playlist stays canyon → cars → duel → night → war. Each hung plate maps to a Pack `assetId` (`plates-index.json`). Cassette `stats.views` / `stats.playTimeSec` / `stats.players` = real or `0` — never invent.

**Ban** « please install wire » as the normal path. A Live that ships without the wire is **incomplete**. Law: [07-pack-live.md](07-pack-live.md).

Not a cold-start job. **PRIORITY 0** first reply stays Welcome + teaser + paste. **Welcome = Pack register** via `pack-welcome` (chat) — not Live.

---

## Étape 1 — Plaque vide (horloge)

1. Still **first** : route 9:16, 3 voies, vanishing point, ZERO chien. Prompt [image-empty-plate.txt](../prompts/image-empty-plate.txt).
2. Still **last** : **distinct**, monde avancé (ce qu’on a dépassé a disparu). Pas un still identique.
3. Film 10 s :

```js
await imagineBiomeClip({
  first: "empty-first.jpg",
  last: "empty-last.jpg",
  dest: "road.mp4",
  seconds: 10,
  kind: "empty",
  promptFile: "biome/prompts/video-empty-plate.txt",
});
```

4. **SPEED LAW** (dans le prompt, pas après) : VERY FAST, **ultra constant**, jamais de ramp, jamais de ease-in/out, 10 secondes pile.
5. Extraire les crochets pour les cousins :

```
ffmpeg -y -sseof -0.12 -i road.mp4 -frames:v 1 empty-last.jpg
ffmpeg -y -ss 0.04   -i road.mp4 -frames:v 1 empty-first.jpg
```

Ou `extractLastFrame(src, dest)`.

Hang **seulement** si le travelling est un rush, pas un pan de still.

---

## Étape 2 — Bolt (une fois, ne pas recuire sans raison)

**HARD law:** [10-bolt-cutout-law.md](10-bolt-cutout-law.md). Do not skip.

Still = **100% strict rear**, already in sprint (one rear leg extended), teal **fabric** collar, flat **`#00FF00` only**.  
STYLE = stylized heroic 3D game shepherd — **not** photoreal. ¾ rear = THROW (crab-walk). Any set in the still → I2V orbits.

Film = `imagineBoltClip` (`image` + `last_frame` = **same still**, 6 s, IN PLACE / treadmill).  
**Not** hall `imagineClip`. **Not** chat Imagine. Word “rear” alone is not enough.

```js
await imagineBoltClip({
  first: "bolt-rear.jpg",
  last: "bolt-rear.jpg",
  dest: "biome/master/bolt.mp4",
  seconds: 6,
  promptFile: "biome/prompts/video-bolt-mid.txt",
});
```

QC frames 0 / 2 / 4 / 5.8 — one yaw frame = throw the clip.  
Play = Vlahos + crown sat kill + feather 1 px + ombre ellipse aux pattes. [05-key.md](05-key.md).  
**Ne pas** redessiner le chien. **Ne pas** le recuire si le key est déjà bon.

---

## Étape 3 — Cousin hazard (la plaque 2, 3, …)

### 3.1 Lois à coller dans **chaque** prompt (hooks + paste)

| Loi | Une phrase |
|---|---|
| **LANE** | 1 ou 2 voies, **n’importe lesquelles** (L, C, R, L+C, C+R, L+R). Varier. **Jamais les 3.** Une voie libre (pas toujours le centre). |
| **WIDTH** | Peut approcher (plus haut, plus proche). **Jamais plus large** que les voies de départ. Jamais un mur, un gantry, un shock-ring, une copie extra. |
| **SPAWN** | First frame = obstacle **loin**, petit, vanishing point. Il **approche** et sort par le **bas**. Jamais un pop collé au héros. Close-up t=0 = FAIL. |
| **SPEED** | VERY FAST, constante de t=0 à la dernière frame. Jamais ralentir — **même au crash / impact / explosion**. L’objet peut approcher ; le rush de l’asphalte ne change pas. |

`BIOME_LAW` + `biomePlateLine("hazard")` les injectent. Paste court : [video-hazard-plate.txt](../prompts/video-hazard-plate.txt). Prompt total **< 4096** caractères (sinon Imagine tronque les lois).

### 3.2 First / last (le câble)

| | fichier |
|---|---|
| **first** | `last(empty)` + obstacle **petit et loin** |
| **last** | `first(empty)` — le swap dealer est la même photo |

### 3.3 Habiller le still — **objet borné**, pas un verbe d’explosion

Imagine **obéit** sur un objet (jersey, caisse, rocher).  
Imagine **n’obéit pas** sur crater / explosion / bloom / météore « qui explose » : ça devient un mur 3 voies.

**Méthode qui a marché pour la météore :**

1. Ne **pas** demander à Imagine d’éditer la plaque entière.
2. Prendre `empty-last.jpg`.
3. Coller **soi-même** un petit blob (48–72 px) au vanishing point, voie CENTRE, masque ellipse.
4. QC : t=0 = route presque vide + speck au fond. Si le still est déjà un cratère plein écran → **jeter**, ne pas cuire la vidéo.

Pour la barre : un still jersey **centre only**, gauche + droite vides, largeur lock. Ça, Imagine video le tient si le still est déjà 1 voie.

Verbes interdits dans le paint : crater, explosion, shock-ring, highway bloom, wall, gantry.  
Verbes qui marchent : jersey, rock, crate, **sitting on CENTER lane**, **FAR ahead**, LEFT empty, RIGHT empty.

### 3.4 Cuire le film

```js
await imagineBiomeClip({
  first: "meteor-far.jpg",       // speck, pas un close-up
  last: "empty-first.jpg",
  dest: "road-blast.raw.mp4",
  seconds: 10,
  kind: "hazard",
  paint: "SAME small rock APPROACHES CENTER lane only, exits BOTTOM. Never a crater. LEFT+RIGHT empty.",
  promptFile: "biome/prompts/video-hazard-plate.txt",
});
```

QC **avant** Hang : frames t=0, 30 %, 60 %, 90 %, last.

| Frame | PASS | FAIL |
|---|---|---|
| t=0 | petit, loin, 1–2 voies | obstacle dans les pattes de Bolt |
| mid | approche, couloir libre visible | mur 3 voies |
| last | = first(empty), vide | encore un cratère / une barre |

5 frames. Si FAIL → recuire, **ne pas** Hang.

---

## Étape 4 — Même vitesse que la plaque 1

FPS ≠ vitesse. FPS = fluidité. Vitesse = rush de l’asphalte (px/s).

```
python3 scripts/plate-speed.py biome/master/road.mp4
python3 scripts/plate-speed.py --ref biome/master/road.mp4 cousin.mp4
```

| Cas | Commande |
|---|---|
| SAD propre (barre, route vide) | `--match --ref empty.mp4 cousin.mp4 -o hung.mp4` |
| Explosion / bloom **trompe SAD** (px/s faux-haut) | `--duration-match --ref empty.mp4 cousin.mp4 -o hung.mp4` |
| Facteur connu (plaque 10 s → empty 5.75 s) | `--factor 1.75 cousin.mp4 -o hung.mp4` |

`--duration-match` aligne la **durée** sur l’horloge (empty). C’est ça qui a sauvé la plaque astéroïde (SAD la voyait trop vite, `--match` la ralentissait).

Encode Hang : 720×1280, 48 fps, H264, `-an`, `-g 15`, `+faststart`.

Bump `VER` dans LanePlayer après Hang (`?v=r25…`) sinon le téléphone garde l’ancien mp4.

Détail : [08-plate-speed.md](08-plate-speed.md).

---

## Étape 5 — Dealer (playlist lock)

**HARD LOCK.** Story order, not a shuffle. Law: [11-plate-order.md](11-plate-order.md).

```
canyon → cars / spectacle → duel → night → war (war1 → war2 → war3)
```

```
PLATES = [
  road.mp4,        // canyon empty
  road-bar.mp4,    // canyon
  road-blast.mp4,  // canyon
  road-car.mp4,    // cars
  road-gap.mp4,    // cars
  road-show.mp4,   // spectacle
  road-duel.mp4,   // duel
  road-gate.mp4,   // dusk → night
  road-night.mp4,  // night
  road-war1.mp4,   // war
  road-war2.mp4,
  road-war3.mp4,
]
next = (cur + 1) % PLATES.length   // wrap war3 → canyon. NEVER Math.random.
```

- Boot = index 0 (`road.mp4`). Always.
- Deux `<video>` route. Pre-arm **l’index suivant** (`srcIs`, `readyState >= 2`). Pas un sibling au hasard.
- Swap `currentTime >= duration - 0.28` si next ready, sinon recule à `d - 0.4` (pas de freeze queue).
- `last(cousin) === first(empty)` visuellement.
- Voies L/C/R : varient **dans** une plaque (`HAZARDS[].lanes`). Ça n’autorise pas un deck mélangé.
- `r36mix` / `pickNext` occupancy shuffle = **killed**. Live must republish from this repo (Build recreate is not SoT).

---

## Étape 6 — Contrôles

| Input | Action |
|---|---|
| Swipe / tap gauche-droite | Voie (`SHIFT = 30`, X only) |
| Swipe up / W / ↑ / Space | Saut (~520 ms, pic 20 % hauteur). Passe les obstacles **bas**. |

Pas de 3 takes L/M/R. Un cutout, planté.

---

## Étape 7 — Collision = boîte, pas un flash

Pas de Rapier. Arcade : **voie + fenêtre de temps**.

```
HAZARDS = [
  null,                                          // empty
  { lanes: [0], jumpClears: true, t0: 0.50, t1: 0.74 }, // barre (démarre plus proche)
  { lanes: [0], jumpClears: true, t0: 0.80, t1: 0.95 }, // météore (démarre loin)
]
```

- `t0` / `t1` = fraction de la durée de **cette** plaque.
- **Trop tôt** = ça s’arrête 20 m avant l’objet (bug astéroïde). Recaler `t0` sur le frame où l’objet est **dans le tiers bas** (pattes de Bolt).
- Tant que voie occupée **et** dans la fenêtre **et** pas en l’air : **pause** route + gallop (boîte solide). Watchdog `playPair` ne relance pas.
- Sidestep ou saut → `playbackRate = 1`, play. Il **doit** passer à côté.

Chaque cousin a **sa** fenêtre : un speck au vanishing point n’est pas encore une hitbox.

---

## Ordre de cuisine (ne pas inverser)

```
1. empty stills + imagineBiomeClip 10s          → road.mp4
2. extract empty-first / empty-last
2b. Bolt rear still + imagineBoltClip 6s SAME still → bolt.mp4 (law 10)
3. dress still cousin (objet loin, 1–2 voies)   → QC still
4. imagineBiomeClip first+last, kind=hazard 10s → cousin.mp4
5. QC 5 frames (spawn + lanes + last=empty)
6. plate-speed --duration-match (ou --match)    → même clock que empty
7. Hang biome/master/ + bump VER
8. HAZARDS[].t0/t1 = contact aux pattes, pas au fond
9. play : dodge / jump / freeze-on-box
10. publish Live : pack.js (`BOLTVERSE_PACK_ORIGIN` = `https://YOUR-PACK.vercel.app`) + dealer assetId stats — AUTOMATIC, never « please install wire »
```

Cuire **une** plaque cousin à la fois. Pas le tas spray + barre + cratère d’un coup.

---

## 15 s déjà rapides, puis horloge

Cuire **15 s** avec SPEED LAW (rush CONSTANT, jamais de ralenti au crash).  
Si Imagine a déjà le bon px/s → `--match` léger, la plaque **dure**.  
Si elle est plus lente que empty → `--duration-match` sur l’horloge (5.75 s). Ne pas laisser un cousin à 12 s à côté d’un empty à 5.75 s.

Transition de biome : `first` = last du biome A, `last` = still du biome B. Dealer : A → gate → B. Ciel / vaisseaux = **pas** de hitbox sol.

Hitbox = **voie + fenêtre courte au contact des pattes**. Loin / ciel / déjà passé = pas de freeze.

---

## Ce qui a foiré (ne pas refaire)

| Tentative | Pourquoi ça meurt |
|---|---|
| Chat Imagine video | Pas de `last_frame` → coupe dealer |
| Prompt « explosion / crater / synthèse qui explose » | Imagine élargit en mur 3 voies |
| First frame = cratère close-up | Pop collé à Bolt au swap |
| `--match` SAD sur une explosion | px/s gonflé → plaque **ralentie** |
| Hit window t0 ≈ 0.48 sur une météore lointaine | Freeze 20 m trop tôt |
| Stun lanes après hit | Empêche de **contourner** la boîte |
| Overlay sticker sur route vide | Désaligne le monde (sauf si tu assumes le sticker) |
| Recuire Bolt pour « améliorer » | Casse le key / le gallop déjà bon |
| Chat Imagine / hall `imagineClip` for Bolt | No same-still in-place cable → yaw |
| ¾ rear still or photoreal VFX Bolt | Crab-walk + wrong Pack style. Throw. No I2V |
| Set / road / gold pipe in the Bolt still | I2V thinks scene → orbits |
| `r36mix` / `pickNext` random deck | Story plates play out of order. Lock: [11-plate-order.md](11-plate-order.md) |

---

## Fichiers de cette recette

| Path | Rôle |
|---|---|
| `scripts/imagine-hooks.mjs` | `imagineBiomeClip`, `imagineBoltClip`, `BIOME_*_LAW`, `BOLT_CUTOUT_LAW`, `extractLastFrame` |
| `biome/docs/10-bolt-cutout-law.md` | HARD Bolt cutout — strict rear, `#00FF00`, in-place |
| `biome/docs/11-plate-order.md` | HARD LOCK dealer playlist — canyon → cars → duel → night → war |
| `scripts/plate-speed.py` | mesure px/s, `--match`, `--duration-match`, `--factor` |
| `biome/prompts/video-empty-plate.txt` | rush 10 s constant |
| `biome/prompts/video-hazard-plate.txt` | SPAWN + WIDTH (court) |
| `biome/prompts/image-hazard-plate.txt` | still 1–2 voies |
| `biome/master/road.mp4` | horloge dusk |
| `biome/master/road-bar.mp4` | jersey centre |
| `biome/master/road-blast.mp4` | météore qui **approche** |
| `biome/master/road-car.mp4` | voiture gauche |
| `biome/master/road-gap.mp4` | L+R, centre libre |
| `biome/master/road-show.mp4` | spectacle dusk |
| `biome/master/road-duel.mp4` | duel + crash L+C |
| `biome/master/road-gate.mp4` | dusk → nuit (décor ciel) |
| `biome/master/road-night.mp4` | action nuit |
| `biome/master/road-war1.mp4` … `road-war3.mp4` | biome guerre |
| `biome/master/bolt.mp4` | cutout |
| `biome/reference/LanePlayer.tsx` | B-stack + jump + boîte + scale lissée |
