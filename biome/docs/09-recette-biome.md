# 09 — Recette biome (ce qu’on a vraiment fait)

Cuisine. Pas de théorie. C’est **la** checklist pour refaire un biome lane-runner comme le dusk canyon (empty + barre jersey + météore).

Lire avant : [PLAY.md](../PLAY.md) · [06-techniques.md](06-techniques.md) · [10-bolt-cutout-law.md](10-bolt-cutout-law.md) · [05-key.md](05-key.md) · [12-lane-path-ribbon.md](12-lane-path-ribbon.md) (living-film Lane control — not SprintCore).  
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

Imagine Agent / chat `imagine_*_video` = **interdit** (pas de `last_frame`). Road = `imagineBiomeClip`. Bolt = `imagineBoltClip` (cycle bookends on green). **48fps**. Pipeline: [10-bolt-cutout-law.md](10-bolt-cutout-law.md).

---

## HARD LOCK — Hang ≠ wipe (SmiR 2026-09-18)

When a player asks Grok to add a **NEW biome / sprint run** (« make a new sprint biome » / « add Tide » / any new biome): **HANG it. Never WIPE existing biomes.**

| | Law |
|---|---|
| **Hang** | ADD new plates + dealer / `plates-index` entries **alongside** existing masters. Keep canyon → cars → duel → night → war (or whatever is already hung). |
| **Wipe** | Delete / replace old `public/master` / `biome/master` plates, or replace the whole playlist with **only** the new biome. **FAIL.** Banned forever. |

Tide cook FAIL: Grok deleted canyon / war masters and left only Tide. Do not repeat.

**When they ask for a new biome:**

- ADD `road-<biome>*.mp4` (+ hazards) under `biome/master/` (and `public/master` if that Live copies there). New dest. Do **not** overwrite hung `road.mp4`.
- ADD to `plates-index` / dealer as an **additional** run or selectable biome.
- KEEP existing `road.mp4` / war / night / cars / duel.
- MAY replace only `bolt.mp4` if recooking the Bolt layer from `@ref` [`lock/bolt-back.jpg`](../../lock/bolt-back.jpg). **BAN** copying hung `biome/master/bolt.mp4` / canyon Bolt as identity. Never delete the road library.
- NEVER `rm` the previous stack to “make room”.
- NEVER set the playlist to new-biome-only unless the player **explicitly** asks to replace the default Beat. SmiR must say replace default Beat — otherwise keep the hung order.

Playlist / index law: [11-plate-order.md](11-plate-order.md).

---

## HARD LOCK — make / add a biome (SmiR 2026-09-18)

When a player asks **make a biome** / **add a biome** / cook a new sprint run: décor scrolls (rush); Bolt sprints **IN PLACE** (treadmill). Mid-lane for the gait cook. **48fps** on cooked plates. Style teacher = [`lock/bolt-back.jpg`](../../lock/bolt-back.jpg) **or** [`biome/lock/bolt-back.jpg`](../lock/bolt-back.jpg) (same bytes; `@ref`) — fluffy white GSD rear; **this still IS Bolt**. **PRIORITY 0 TEACHER GATE:** attach / show that exact image in the Build chat first. If teacher not shown → **STOP. No cook. FAIL.** Black void on the teacher = STYLE only; cooks go to flat `#00FF00`. Hang ≠ wipe.

**Do not invert.** Full law: [10-bolt-cutout-law.md](10-bolt-cutout-law.md).

1. Empty plaque still — ZERO dog (`image-empty-plate.txt` + `{PAINT}`). Camera locked (not too far / not too close).
2. Video A empty rush — `imagineBiomeClip` real `image` + distinct `last_frame`. **48fps**. ZERO dog.
3. Video B gait source — SAME décor + Bolt mid-lane IN PLACE, `@ref` `lock/bolt-back.jpg`. **48fps**. Kitchen only — do **not** Hang. Green-only I2V invents walk.
4. Extract one gallop cycle from B (start, 2–3 mids chronological, end ≈ start).
5. Repose cycle onto flat `#00FF00`. Light bake from one A/B road frame OK (light only).
6. `imagineBoltClip` — `first` / `last` = cycle bookends on green. `promptFile` `biome/prompts/video-bolt-mid.txt`. **48fps**. IN PLACE.
7. Chroma key ([05-key.md](05-key.md)) → plant on Video A. Match rates (no skate). L/M/R = code X shift of **one** Bolt layer.

**HARD BAN — chat Imagine alone.** Hooks first+last. Hall `imagineClip` banned here. Baking Bolt into a single final film = FAIL. 3-Bolt multi-lane mask = FAIL. No `XAI_API_KEY` → **REFUSE** / stock — do not fall back to chat I2V.

---

## HARD LOCK — new biome cook (SmiR 2026-09-18 FAIL)

When the player says **make / add a new biome** (any name — Tide, Frost, Ember, invented):

| | Law |
|---|---|
| **Hang only** | ADD the new biome plates + `plates-index` / dealer entries **beside** existing masters. Do **NOT** rebuild canyon→cars→duel→night→war first. Do **NOT** require Beat 3 recook as a gate. |
| **Old Beat** | canyon→war stays as-is (Hang ≠ wipe). Player can play the old Beat **without** recook. |
| **Bolt** | **Always** `@ref` [`lock/bolt-back.jpg`](../../lock/bolt-back.jpg). **BAN** copying hung `biome/master/bolt.mp4` / canyon Bolt as the identity. Light bake from the **new** empty plaque is OK; identity = teacher. |
| **Name + `{PAINT}`** | Allowed / encouraged. Tide is **one** example, not the only biome. Never refuse “I can only do Tide.” |
| **Pipeline** | B→cycle→green→key + hooks first/last still apply. [10-bolt-cutout-law.md](10-bolt-cutout-law.md). |
| **Catalog** | Chat lists **hung** biomes only. A biome in cook is **not** hung until hung. |

---

## HARD LOCK — Chat biome catalog (on ask)

When a player asks Grok (any close alias): **what biomes** / **playable biomes** / **list biomes** / **which runs** / **what can I play**:

1. English Pack voice. Short list of **hung** biomes only (from `plates-index` / biome catalog / `master` files that still exist). **Never invent.**
2. Each line: biome name + optional one-short flavor. No kitchen paths. No GitHub. No API jargon.
3. How to pick: `play Tide` / `play canyon` / `only Tide` — then start that run (or paste the Live + filter dealer to that biome). `only X` = they explicitly asked to replace the default Beat.
4. **On ask only.** Do **not** dump this list on Welcome / cold-start. Plate-deck lists at boot stay banned.
5. Hang grows this catalog. Wipe shrinks it — another reason wipe is FAIL.
6. No chrome biome picker in the Live UI. Chat list + spoken pick is v1.

Hung chapters **now** (do not invent extra names): canyon · cars · duel · night · war. Tide is **not** in this list until it is hung. A biome **in cook** is not hung until hung. Cook any name + `{PAINT}` — catalog still lists hung only. If they pick a name that is not hung: say it is not hung yet. Do not fake the run. Do not wipe the catalog to pretend. Never refuse the cook because the name is new.

---

## Floor — Pack wire + dealer assetId stats (every Hang / publish)

**AUTOMATIC.** Pack wire + plate stats are in the game recipe. When Grok creates or publishes a **biome**, **citadel**, or **Sprint** Live, it **MUST** include [`client/pack.js`](../../client/pack.js) with `BOLTVERSE_PACK_ORIGIN` = `https://boltverse-pack.vercel.app` (TEMPORARY — Lives freeze; not the forever home. Long-term: Pack stays inside the Grok sandbox) **and** dealer `assetId` stats — **without the player asking**.

```html
<script>window.BOLTVERSE_PACK_ORIGIN = "https://boltverse-pack.vercel.app"</script>
<script src="https://boltverse-pack.vercel.app/client/pack.js"></script>
```

Or ship the local client and POST there. **HARD BAN:** treating `https://boltverse-odysseyyyy.grok.me` as the Pack API host (game play URL stays odysseyyyy; Pack API does not). Fail soft if Pack is down — Sprint still plays. Never invent a `sub`. Never player API keys.

Dealer playlist stays canyon → cars → duel → night → war unless SmiR explicitly says replace the default Beat. A new biome **appends** plates + `plates-index` entries — it does **not** replace this list. Each hung plate maps to a Pack `assetId` (`plates-index.json`). Cassette `stats.views` / `stats.playTimeSec` / `stats.players` = real or `0` — never invent.

**Ban** « please install wire » / « install Pack » / « wire profiles » as the normal path. Creating a **naked Live** without Pack = **FAIL** / incomplete recipe. Law: [07-pack-live.md](07-pack-live.md).

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

**HARD law:** [10-bolt-cutout-law.md](10-bolt-cutout-law.md). Do not skip. B→cycle→green→key. **48fps**.

Still (after Video B cycle extract) = **100% strict rear**, already in sprint (one rear leg extended), teal **fabric** collar, flat **`#00FF00` only**.  
STYLE teacher = [`lock/bolt-back.jpg`](../../lock/bolt-back.jpg) **or** [`biome/lock/bolt-back.jpg`](../lock/bolt-back.jpg) (same bytes) — fluffy white GSD rear; **@ref** that still after attaching it in the Build chat (PRIORITY 0 TEACHER GATE). Hung `biome/master/bolt.mp4` is OUTPUT only — never @ref as style teacher. Black void = STYLE only; cook dest stays `#00FF00`. **Not** photoreal. ¾ rear = THROW (crab-walk). Any set in the **green** still → I2V orbits.

Video B (gait source) = SAME décor rush as Video A + Bolt mid-lane IN PLACE. Kitchen — **not** Hung. Green-only I2V invents walk.

Film = `imagineBoltClip` (`first` + `last` = **cycle bookends on green**, 6 s, **48fps**, IN PLACE / treadmill).  
**Not** hall `imagineClip`. **Not** chat Imagine. Word “rear” alone is not enough.

```js
await imagineBoltClip({
  first: "bolt-cycle-start.jpg",
  last: "bolt-cycle-end.jpg",   // ≈ start — in place
  dest: "biome/master/bolt.mp4",
  seconds: 6,
  promptFile: "biome/prompts/video-bolt-mid.txt",
});
```

QC frames 0 / 2 / 4 / 5.8 — one yaw frame = throw the clip.  
Play = Vlahos + crown sat kill + feather 1 px + ombre ellipse aux pattes. [05-key.md](05-key.md). L/M/R = X shift of **one** Bolt layer.  
**Ne pas** redessiner le chien. **Ne pas** le recuire si le key est déjà bon. **Ne pas** cuire Bolt dans un seul film final.

After empty + cutout KEEP: author `path.json` on empty road plate A. Law: [12-lane-path-ribbon.md](12-lane-path-ribbon.md). Without `path.json` = film only. With `path.json` = steerable game. Not SprintCore / Nebula editor.

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
**HARD LOCK — Hang ≠ wipe.** New biome = new `_playlist` / dealer entries **after** this lock (or as a selectable extra run). Keep this order. Do not swap the whole deck to Tide-only.

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

Living-film Lane (ribbon + arc-length): after empty+cutout KEEP, author `path.json` per [12-lane-path-ribbon.md](12-lane-path-ribbon.md). Without the sidecar = pretty film. With it = game. Play state is \((s,\lambda)\), not WASD / yaw.

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
1. empty stills + imagineBiomeClip 10s 48fps    → Video A / road.mp4   (ZERO dog)
2. extract empty-first / empty-last
2b. Video B gait (same décor + Bolt mid-lane IN PLACE, 48fps) — kitchen, not Hung
2c. extract ONE cycle → repose on #00FF00 → imagineBoltClip first+last bookends 48fps → bolt.mp4 (law 10)
3. dress still cousin (objet loin, 1–2 voies)   → QC still
4. imagineBiomeClip first+last, kind=hazard 10s → cousin.mp4
5. QC 5 frames (spawn + lanes + last=empty)
6. plate-speed --duration-match (ou --match)    → même clock que empty
7. Hang biome/master/ + bump VER   ← ADD new files. NEVER rm canyon/war. NEVER overwrite road.mp4 for a new biome.
7b. After empty+cutout KEEP: author path.json (ribbon + arc-length) — [12-lane-path-ribbon.md](12-lane-path-ribbon.md)
8. HAZARDS[].t0/t1 = contact aux pattes, pas au fond
9. play : dodge / jump / freeze-on-box (with path.json = steerable; without = film only)
10. publish Live : pack.js (`BOLTVERSE_PACK_ORIGIN` = `https://boltverse-pack.vercel.app`) + dealer assetId stats — AUTOMATIC, never « please install wire »
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
| Chat Imagine / hall `imagineClip` for Bolt | No first+last in-place cable → yaw / walk. Hooks only. |
| Green-only I2V from one still (skip Video B) | Invents walk. Extract cycle from B, repose on green. |
| Bake Bolt into one final road film | No cutout stack. FAIL. |
| 3-Bolt multi-lane mask | L/M/R = code X shift of **one** Bolt layer. |
| ¾ rear still or photoreal VFX Bolt | Crab-walk + wrong Pack style. Throw. No I2V |
| Set / road / gold pipe in the Bolt still | I2V thinks scene → orbits |
| `r36mix` / `pickNext` random deck | Story plates play out of order. Lock: [11-plate-order.md](11-plate-order.md) |
| Wipe `biome/master` / `public/master` to “make room” for Tide | **Hang ≠ wipe.** Canyon/war gone = FAIL. Tide cook. Banned forever. |
| Rebuild canyon→cars→duel→night→war **first** before a new biome | Hang **only** the new plates. Old Beat stays. No Beat 3 recook gate. |
| Copy hung `biome/master/bolt.mp4` / canyon Bolt as new-biome identity | Always `@ref` `lock/bolt-back.jpg`. Light bake from the **new** empty plaque OK. |
| Refuse invented biome / “I can only do Tide” | Name + `{PAINT}` allowed. Tide is one example. |
| Playlist = new-biome-only | Keep hung order unless SmiR / player **explicitly** says replace the default Beat. |
| Biome catalog on Welcome / invent Tide before Hang | Catalog = **on ask**. Hung chapters only. A biome in cook is not hung until hung. Wipe shrinks the list = FAIL. |

---

## Fichiers de cette recette

| Path | Rôle |
|---|---|
| `scripts/imagine-hooks.mjs` | `imagineBiomeClip`, `imagineBoltClip`, `BIOME_*_LAW`, `BOLT_CUTOUT_LAW`, `extractLastFrame` |
| `biome/docs/10-bolt-cutout-law.md` | HARD Bolt cutout — B→cycle→green→key, 48fps, hooks first+last |
| `biome/docs/11-plate-order.md` | HARD LOCK dealer playlist — canyon → cars → duel → night → war. New biome = new entries. Hang ≠ wipe. |
| `biome/docs/12-lane-path-ribbon.md` | Living-film Lane path — ribbon + arc-length `path.json`. Without = film. With = steerable game. Not SprintCore. |
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
