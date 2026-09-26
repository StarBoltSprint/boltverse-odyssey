# Pyre — méthode complète

Exemple travaillé (Diablo, lave, citadelle). La peinture est libre. Pour n'importe quel biome, le collage de départ est [`biome/docs/COLD_START-biome-method.md`](../biome/docs/COLD_START-biome-method.md).

La plaine et le Thunderwolf sont les sections 11–13 et [PLATE.md](PLATE.md). Il n'y a pas de `PLAIN.md` ni de `VISTA.md` dans `pyre/` — ces chemins 404. À la racine du dépôt, `PLAIN.md` est l'ancienne grille à neuf cases, `VISTA.md` est une note de ciel plus vieille. Un biome neuf ne commence pas là.

Ce fichier suffit à refaire Pyre. Ne pas réinventer Bolt, l’aura, la jointure des ailes, ni le hurlement : les essais ratés sont listés en bas. Le regard dans la salle est [ORBIT.md](ORBIT.md) — ne pas le réinventer non plus.

Pyre est un endless runner Diablo. Une route de lave défile. Bolt (berger blanc, vu de dos) sprinte dessus. Le joueur glisse pour changer de voie, regarde à gauche et à droite, et tape un ennemi pour le hurler.

Le code qui joue est `src/pyre-stage.tsx` (dans l’app : `src/game/pyre-stage.tsx`, même fichier). Les vidéos sont dans `master/` et, dans l’app, servies depuis `public/master/`.

## Fichiers à garder

| Fichier | Rôle |
|---|---|
| `master/pyre-road.mp4` | La chaussée. Joue à 1×. Deux lecteurs se relaient pour que la boucle ne saute pas. |
| `master/pyre-first.jpg` | Première image de la route. Poster, et source des ailes. |
| `master/pyre-wing-l.mp4` | Continuité à gauche de la route. Même vitesse que la route. |
| `master/pyre-wing-r.mp4` | Continuité à droite. |
| `master/bolt-fury.mp4` | Bolt de référence (celui qu’on garde). Ne pas le remplacer par le cycle GPU. |
| `master/bolt-native.mp4` | **Bolt joué.** Sprint + armure + aura dans la même vidéo, fond vert, marche coupée, flaque verte enlevée. `playbackRate = 4`. |
| `master/foe-fallen.mp4` | Démon à capuche, fond vert, cycle de course. |
| `master/foe-brute.mp4` | Démon-bouc en armure, hache, fond vert. |
| `master/howl.mp4` | Hurlement : colonne de feu rouge et noire, fond vert, base en bas de l’image, pointe en haut. |
| `master/ash-fallen.mp4` | Mort du démon à capuche, fond vert. Le burst utile commence vers 0,9 s. |
| `master/ash-brute.mp4` | Mort du bouc, fond vert. Même timing. |
| `src/pyre-stage.tsx` | Tout le composite : route, ailes, Bolt, ennemis, hurlement. |

Ne pas utiliser dans le jeu : `bolt-aura.mp4`, `bolt-aura-run.mp4`, `bolt-gpu.mp4`, `bolt.mp4`, `bolt-armor.mp4`, `bolt-pyre.mp4`. Ce sont des essais.

## Constantes

```
SLIDE_AMP = 0.36
BOLT_H = 0.28
BOLT_ASPECT = 784 / 1168
PAW_V = 0.93
PLANT_Y = 0.80
BOLT_RATE = 4
HORIZON = 0.545
FOE_ASPECT = 480 / 854
```

Fallen : `h 0.30`, `foot 0.96`, `reach 0.34`, `rate 1.45`, `agility 1.55`.
Brute : `h 0.40`, `foot 0.97`, `reach 0.48`, `rate 1.05`, `agility 0.70`.

Pattes de Bolt : `y = PLANT_Y - PAW_V * h`. Le quad est centré sur `0.5 + lanePos * SLIDE_AMP - viewShift`.

Un ennemi a un `z` de 0 (horizon) à 1 (frappe). Son pied est `HORIZON + (PLANT_Y - HORIZON) * z`. Sa taille grandit avec `z` (il ne tombe pas du ciel, il arrive déjà assez grand). `z` commence à 0 mais le pied est déjà sur la ligne d’horizon de la route (`HORIZON = 0.545`), pas dans le ciel.

## 1. Bolt, une seule vidéo

Image de départ : une frame de `bolt-fury.mp4`.

Image-to-video. Caméra verrouillée dans le dos. Fond **vert chroma plat** `#00FF00`. Pas de sol, pas de décor.

- le même chien, la même armure, la même cape
- un galop agressif, grandes foulées
- une aura rouge et noire **collée au corps** à chaque foulée, traînée courte derrière les pattes arrière

Pourquoi le fond vert : si on génère Bolt déjà sur la route, la découpe mange le feu (le feu et la lave sont rouges tous les deux) et laisse un trou dans la chaussée. Deux plaques : le chien (vert) et la route (`pyre-road.mp4`).

Route à `playbackRate = 1`. Bolt à `playbackRate = 4`. On n’accélère que Bolt.

Découpe (`BOLT_FS`) :

```
greenness = vert - max(rouge, bleu)
si greenness > 0.02 → alpha = 0
```

On jette le pixel dès qu’il est vert. On ne le despille pas vers le jaune (ça laissait une flaque). Le feu a le rouge plus fort que le vert, il reste.

Les ~0,95 premières secondes de la génération sont un trot sans feu. On les coupe :

```
ffmpeg -ss 0.95 -i brut.mp4 -an -c:v libx264 -pix_fmt yuv420p bolt-native.mp4
```

Flaque jaune-vert sous les pattes, avant l’encode, sur chaque frame :

1. En bas (`y > 80 %`), tout pixel jaune-vert (vert haut, bleu bas, pas le feu rouge) est repeint en vert chroma.
2. Les taches brillantes dont le centre est sous 90 % de la hauteur, plus larges que hautes, ou très petites, sont aussi repeintes en vert.
3. Le feu des cuisses et de l’armure est au-dessus : il reste.

C’est déjà dans `bolt-native.mp4`. Le shader ne refait que la découpe.

Les `<video>` sont hors écran (`opacity: 0`), `muted`, `playsInline`, `disablePictureInPicture`.

## 2. Gestes

Décidés au `pointerdown`, pas après un délai.

- Le doigt est sur le quad de Bolt (pad 0.05) : glisser change de voie. `lanePos` suit le doigt. Ça ne regarde pas.
- Le doigt est sur un ennemi, et pas sur Bolt : hurlement vers **cet** ennemi. Pas de glissade.
- Le doigt est ailleurs : regarder. `glance` va de -1 à 1 selon le déplacement horizontal. Bolt ne tourne pas la tête. Seule la caméra bouge.
- Clavier : A / D ou flèches pour la voie. Espace ou Entrée pour démarrer. Pas de touche pour le hurlement.

## 3. Regard gauche / droite

Deux vidéos, `pyre-wing-l.mp4` et `pyre-wing-r.mp4`, générées comme la continuité hors du bord de `pyre-first.jpg` (la route sort du cadre). Elles défilent à la même vitesse que la route : `currentTime` calé sur la route qui est affichée, `playbackRate = 1`. Ne pas les `seek` à chaque frame : ça déchire l’image.

Dans `ROAD_FS` :

```
shift = glance * smoothstep(0.10, 0.48, abs(glance))
ruvx = screen.x + shift
```

La route est échantillonnée à `ruvx`. L’aile gauche est le monde en `ruvx + 1`, l’aile droite en `ruvx - 1`.

Jointure. Ne pas répéter la colonne du bord (`clamp` sur tout le fondu) : ça fait une bande verticale déchirée. Pendant le fondu, on échantillonne l’aile **vers l’intérieur** :

```
intoL = clamp(max(ruvx, 0) / seam, 0, 1)
sideLU = mix(ruvx + 1, 0.70, intoL)
intoR = clamp(max(1 - ruvx, 0) / seam, 0, 1)
sideRU = mix(ruvx - 1, 0.30, intoR)
```

`seam` vaut 0,14 dans le ciel et 0,32 au sol. `cover = smoothstep(0.02, 0.14, abs(shift))` multiplie le poids des ailes : vu de face, la route reste nette, les ailes ne bavent pas.

Dehors de la plaque route (`ruvx < 0` ou `ruvx > 1`), le poids de l’aile est `cover`. À fond de regard, `cover` vaut 1 : on ne mélange plus le pixel du bord de la route.

Bolt et les ennemis sont décalés du même `shift` (`viewShift`). Leur voie de collision ne change pas. Un ennemi qui est sur l’aile a un `worldX` hors de `[0, 1]`. À l’écran il est en `worldX - shift`, donc il passe d’une plaque à l’autre sans saut.

## 4. Ennemis

Image-to-video, fond vert plat, le personnage seul, en train de courir vers la caméra. Pas de décor.

- `foe-fallen.mp4` : démon cornu, capuche noire, haillons rouges.
- `foe-brute.mp4` : bouc noir, armure, hache.

Même découpe que Bolt, un peu plus souple (`greenness > 0.05`).

Spawn : au plus 2 en même temps, pas un nouveau tant qu’un est encore loin (`z < 0.55`), attente 2,6 à 4,1 s. Environ 60 % arrivent d’un flanc (on alterne gauche / droite), le reste sur la route. Ils pop sur la route, à l’horizon, déjà assez grands. Un flanc longe l’épaule (`wide` hors de l’écran) puis coupe vers une voie entre `z = 0.46` et `0.80`. Sur la route, un chasseur suit la voie de Bolt jusqu’à `z = 0.68`, puis il s’engage. À `z >= 0.9`, s’il est sur la voie de Bolt, une blessure. Trois blessures : chute.

## 5. Hurlement

Pas de bouton. Pas de recharge. On tape l’ennemi.

Hit-test au pointerdown sur le quad de l’ennemi (pad 0.07). S’il recouvre Bolt, le geste reste une glissade. S’il y en a plusieurs sous le doigt, on prend le plus proche (`z` le plus grand).

`howl.mp4` est un text-to-video : fond vert plat, pas de chien, une colonne de feu rouge et noire (anneaux, tête de loup dans la flamme). La base de la flamme est **en bas** de l’image, la pointe **en haut**. Prompt qui marche : fond `#00FF00` seul, le blast part du bas et monte tout de suite, pas de texte.

On ne dessine pas ce mp4 comme un rectangle vertical. `beam()` construit un quad tourné de la gueule de Bolt jusqu’à la poitrine de l’ennemi tapé. L’UV V suit ce segment. La pointe avance de 0 à 1 en ~0,2–0,48 s selon la distance. À l’impact le quad disparaît (le hurlement s’arrête) et l’ennemi est retiré.

Largeur du quad : `0.045 + 0.02 * p`. Plus large, le hurlement a l’air d’un pilier vertical qui ne vise personne. Le shader ne prend que le milieu de la texture (`u` de 0,34 à 0,66) pour ne pas écraser les marges vertes dans le rayon.

Plusieurs hurlements peuvent voler en même temps. On ne relance pas la vidéo si elle joue déjà (sinon les rayons déjà en l’air sautent). On la met en pause quand plus aucun rayon ne vole.

## 6. Mort

À l’impact, on joue `ash-fallen.mp4` ou `ash-brute.mp4` à la place de l’ennemi, un peu plus grand, ~1,45 s, `playbackRate = 1.7`, en cherchant `currentTime = 0.9` (avant, ils sont encore debout ; le burst est vers 2–3,5 s). Alpha qui tombe sur les dernières 0,3 s. L’ennemi ne peut plus blesser Bolt.

Génération : image-to-video à partir d’une frame du même ennemi, fond vert conservé. Le prompt doit dire que la forme devient des braises et de la cendre. Les mots « explose », « sang », « violent » font rejeter la vidéo par le filtre. Décrire un sort : anneau rouge, la forme se défait en braises, le fond vert ne change pas.

## 7. Boucle de la route

Deux éléments vidéo sur le même mp4. Quand le lecteur actif arrive à ~0,35 s de la fin, l’autre repart de 0. À la fin, on échange. Les ailes prennent `currentTime` du lecteur affiché, modulo leur durée. Ne pas seek les ailes en boucle.

## Ce qui n’a pas marché

- Aura dans une deuxième vidéo, additionnée : elle ne suit pas le galop, on voit la coupe.
- Aura en shader autour de la silhouette : ça suit le contour, ça a l’air faux.
- Armure fixe collée sur le cycle GPU (`lock/bolt-gallop-cycle.mp4`) : l’armure ne gallope pas, et ce n’est pas ce Bolt.
- Régénérer un autre chien : on perd `bolt-fury.mp4`.
- Fondu des ailes en répétant la colonne du bord, ou un flou sur toute la route : bande déchirée, ou la route de face devient floue. Le `cover` et l’échantillon intérieur règlent ça.
- Seek des ailes à chaque frame : déchirures horizontales.
- Bouton Hurlement, ou hurlement automatique vers le plus proche : le joueur veut taper l’ennemi, et le rayon doit aller vers celui-là.
- Quad de hurlement trop large : le feu reste visuellement vertical. Le garder étroit.
- Mort générée avec un prompt gore : la génération est refusée.

## 8. Citadelle, star map

On reste sur le biome 1. Pas de coupe vers un deuxième biome. Le boss est en pause : on ne le fait pas pop.

À `distance >= PYRE_PACES` (600), `citadelCalled` passe à vrai, les ennemis et les hurlements en vol sont vidés, et `openGates()` joue `citadel-arrive.mp4` depuis le début. Les spawns s'arrêtent déjà 40 pas plus tôt. Ne pas remettre un `kind: 2` ici tant que le joueur ne le redemande pas. Les mp4 `boss.mp4` et `boss-ash.mp4` restent dans `master/`, inutilisés.

`GOD = true` : Bolt ne meurt pas. C'est voulu, pour tester. Ne pas le remettre à false sans qu'on le demande.

```
PYRE_PACES = 600
GOD = true
STAR_MAP = https://boltversee-odyssey-star-map.grok.me
ROOM_VANISH = 0.50
ROOM_STEP = 0.67
```

### Vidéos, dans l'ordre

Chaque clip commence sur la dernière image du clip d'avant. Image-to-video, 9:16, 10 s. On encode ensuite :

```
ffmpeg -i brut.mp4 -vf scale=720:1280 -an -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart
```

| Fichier | Rôle |
|---|---|
| `master/boss.mp4` | Gardé, pas joué. Le boss est en pause. |
| `master/boss-ash.mp4` | Gardé, pas joué. |
| `master/citadel-arrive.mp4` | La route entre dans les portes. Joue une fois à 600 pas. |
| `master/citadel-open.mp4` | Les portes s'ouvrent. Déclenché par un tap. |
| `master/citadel-hall.mp4` | Le hall, jusqu'à la salle. Première image = dernière image de l'ouverture. |
| `master/room-breath.mp4` | La salle, caméra fixe, une seule porte turquoise, anneau au sol. Boucle. |
| `master/room-holo.mp4` | L'hologramme. Première image = une frame de `room-breath`. |
| `master/orbit/left-01.jpg` … `left-16.jpg` | Passe de caméra vers la porte gauche. Source `cam-left-orbit.mp4`. `loadOrbit("left", 5)`. Voir [ORBIT.md](ORBIT.md). |
| `master/orbit/right-01.jpg` … `right-16.jpg` | Passe de caméra vers la porte droite. Source `cam-right-orbit.mp4`. `loadOrbit("right", 4)`. |
| `master/cam-left-orbit.mp4` | Source jouée de la suite gauche. Le portail sort à droite, la porte bronze entre à gauche. |
| `master/cam-left.mp4` | Archive. Ancien fondu sur place. Ne plus l’extraire. |
| `master/cam-right-orbit.mp4` | Source de la suite droite. Pas `cam-right.mp4` (double portail). |
| `master/bolt-breath.mp4` | Bolt de dos, dans la salle, et pendant le regard. |
| `master/bolt-turn.mp4` | Deux doigts, il se tourne face caméra. |

`doorMode` : `ride` (arrivée) → `open` → `hall` → `room` → `map`.

On ne reprend pas `citadel-arrive` s'il est en pause et que `doorsLive` est déjà vrai. Sinon le raccourci du menu se fait réécraser.

### Menu

Deux boutons, sur la couverture et après une chute.

- **Start** appelle `begin()`. La route, depuis zéro.
- **The gates** appelle `openGates(true)`. Phase `citadel`, `distance = 600`, `doorsLive` tout de suite, la vidéo d'arrivée est seekée à `duration - 0.08` puis mise en pause. Le hint « Tap the gates » est là. Ça n'écrit pas le record.

### Contact au sol dans la salle

Un déplacement linéaire en Y fait flotter Bolt dans la porte. Les pattes suivent le plan du marbre. `depth` va de 0 (près) à 1 (la marche, pas l'intérieur de la lumière).

```
nearSpan = PLANT_Y - ROOM_VANISH
farSpan = ROOM_STEP - ROOM_VANISH
persp = 1 + depth * (nearSpan / farSpan - 1)
footY = ROOM_VANISH + nearSpan / persp
scale = (footY - ROOM_VANISH) / nearSpan
h = BOLT_H * scale
y = footY - PAW_V * h
```

`y` est le haut du quad. Les pattes, à `PAW_V` dans la texture, tombent sur `footY`. L'ombre est sur `footY`, pas sous le bas du quad (il y a du transparent sous les pattes). La voie se resserre avec le même `scale`. Hors de la salle, `depth` vaut 0 : on retombe sur `y = PLANT_Y - PAW_V * h`.

`ROOM_STEP = 0.67` est le haut de la marche, mesuré sur la frame de la salle (la porte turquoise finit vers 0.66). Ne pas viser 0.59 : c'est dans la lumière.

### Gestes dans la salle

Décidés au pointerdown.

- Le doigt part sur Bolt : glisser change la voie et `depthTarget`. Lui seul.
- Le doigt part ailleurs : Bolt ne bouge pas, même si le doigt dérive. Au relâchement, si le déplacement est sous 40 px :
  - porte : `nx` 0.34–0.66 et `ny` 0.28–0.58 → `depthTarget = 1`
  - anneau : `nx` 0.16–0.84 et `ny` 0.55–0.92 → `openMap()`
- Ne pas appeler `slideTo` au pointerup si le geste n'était pas sur Bolt. L'ancienne zone de l'anneau s'arrêtait à `ny` 0.70 et ratait les grands cercles du bas.

`depthTarget` est rejoint à 0.42 par seconde. Le galop est à 1.7 tant qu'il marche, 1.15 quand il est arrivé. Ne pas le ramener à un trot : le joueur a déjà dit que c'était trop lent.

### Hologramme

`openMap` joue `room-holo.mp4` une fois, puis `location.replace(STAR_MAP)` à `duration - 0.4`.

La génération qui marche, image-to-video depuis une frame de `room-breath` :

- la salle ne change pas au départ
- un faisceau fin monte de l'anneau
- une sphère armillaire : quelques anneaux d'or et de turquoise, fins, trois petites planètes
- la caméra traverse les anneaux
- on finit sur une étoile blanche et or, couronne de filaments, deux planètes

À ne pas demander : un ballon, une bulle de points, un mesh qui gonfle. C'est ce que le joueur a rejeté. Incrémenter `?v=` sur le `src` après chaque remplacement du mp4, sinon le navigateur garde l'ancien.

## 9. Revenir de la star map dans la salle

Le bouton de la constellation doit ouvrir la salle, pas le menu Start.

`PyreStage` prend `startInRoom`. Vrai : l'état initial est déjà `citadel` / `doorMode = "room"`, donc le HTML servi n'affiche pas la couverture. `enterRoom()` au montage : `room-breath.mp4` en boucle, Bolt à `depth` 0.42 (sur l'anneau), `distance = 600`, hint « Tap the ring ».

Deux entrées, les deux passent `startInRoom` :

- `src/routes/room.tsx` — route `/room`. C'est l'adresse du bouton : `https://boltversee-odyssey.grok.me/room`
- `src/routes/index.tsx` — `validateSearch` lit `?at=room` ou `?at=map`

`backToRoom()` attrape aussi le hash `#room` et un `document.referrer` qui contient `boltversee-odyssey-star-map`. Le referrer ne sert qu'au montage client. L'état initial, lui, ne dépend que de `startInRoom`, pour que le serveur et le navigateur rendent la même page.

En partant vers la constellation, l'URL emporte le retour :

```
const back = new URL(window.location.href);
back.hash = "";
back.search = "";
back.searchParams.set("at", "room");
const dest = new URL(STAR_MAP);
dest.searchParams.set("return", back.toString());
window.location.replace(dest.toString());
```

Le site public est une publication de l'app, pas ce dossier git. Tant que cette version n'est pas publiée, `/room` répond 404 et `?at=room` retombe sur l'ancien menu.

## Ce qui n'a pas marché (citadelle)

- Couper sec vers un deuxième biome à 600 pas. Rester sur Pyre, puis `citadel-arrive.mp4`.
- Faire pop le boss avant que le joueur le redemande. Les mp4 sont là, le spawn ne l'est plus.
- Coller le boss en image, ou avec une flaque rouge, ou le rendre transparent. S'il revient : sa propre vidéo, fond vert, il bouge.
- Ouvrir `boltversee-odyssey.grok.me` tout court depuis la constellation : c'est le menu. Le chemin est `/room`.
- Compter sur `?at=room` seul dans une publication trop vieille : l'ancien bundle ignore le paramètre. Il faut publier le code qui lit `startInRoom`.
- Ralentir Bolt presque à l'arrêt devant la porte. Le caler sur la plaque, pas en dessous.
- Pattes qui montent en ligne droite avec la profondeur. Il flotte dans la porte. Le plan perspective ci-dessus règle ça.
- Tout doigt dans la salle déplace Bolt, et la zone de l'anneau ne couvre que le haut. Le tap n'ouvre presque jamais la star map.
- Hologramme en ballon de constellation. L'armillaire, puis l'étoile.
- Extraire la gauche depuis `cam-left.mp4`. Le portail devient la porte dans la même arche. Le joueur ne va pas plus loin. La passe est `cam-left-orbit.mp4`.
- À l'ouverture des portes, si la vidéo n'est pas prête (`readyState < 2`), retomber sur `paintRoad()`. Le biome d'avant flashe une seconde au milieu de l'ouverture. Tenir la dernière texture de citadelle. Ne jamais peindre la route tant que `phase` est `citadel`.

## 10. Ouverture des portes — pas de flash du biome

`openTheDoors` passe `doorMode` à `"open"` et joue `citadel-open.mp4`.

Sur téléphone, `video.currentTime = 0` alors que la vidéo est déjà à 0 fait un seek. `readyState` tombe sous 2 pendant environ une seconde. L'ancien dessin faisait :

```
si la plaque citadelle n'est pas prête → paintRoad()
```

`paintRoad` est le biome de lave. D'où le flash, puis le retour sur l'ouverture quand la vidéo a une image.

Deux règles :

1. Ne seek `openVid` que si `currentTime > 0.05`. S'il est déjà au début, on joue.
2. Tant que `phaseRef` est `"citadel"`, on dessine `citadelTex` même si la plaque du moment n'est pas prête. C'est la dernière image déjà décodée (les portes fermées, puis l'ouverture). `paintRoad()` ne sert que hors citadelle.

```
} else if (plate && plate.readyState >= 2) {
  dessiner citadelTex
} else if (phase === "citadel") {
  dessiner citadelTex   // on tient
} else if (roadSource) paintRoad()
```

Ne pas « réparer » en mettant une image du biome dans `citadel-open.mp4`. Le clip est propre. Le flash venait du composite.

## 11. La porte du milieu — la plaine, et le Thunderwolf

Dans la salle, face au portail du milieu (`abs(orbit) < 0.22`) et assez près (`roomDepth > 0.68`), un tap sur la porte appelle `leaveThrough()`. Loin, le même tap ne fait qu'avancer (`depthTarget = 1`). Les portes de côté ne sortent pas.

`doorMode` passe à `"out"`. La plaque est `master/citadel-exit.mp4` (`?v=1`), 10 s, 9:16, vide de Bolt.

Comment le clip est fait :

1. Première image : une frame de `room-breath.mp4` (la salle, un seul portail cyan, l'anneau).
2. Dernière image : une still 9:16 générée à part. On est **derrière** la citadelle. Les flèches noires encadrent à gauche et à droite, un filet cyan sort de la porte qu'on vient de quitter. Devant : une plaine immense, pas la route étroite du run. Pierre noire craquelée, rivières de lave, lune rouge, une ligne de flèches à l'horizon. Pas de chien.
3. Reference-to-video, 10 s, 9:16, 720p. La caméra avance dans le portail, traverse la lumière, et finit exactement sur la plaine. Pas de deuxième portail, pas de fondu, pas de Bolt dans la plaque.

On encode `scale=720:1280`, crf 20, faststart, sans audio.

Bolt est composite par-dessus, comme toujours :

- `t < 0.40` : il court vers la porte (`depthTarget = 1`).
- `0.40–0.64` : on ne le dessine pas (`outHide`). Il est dans la lumière.
- `t >= 0.64` : il réapparaît sur la plaine et se transforme.

La transformation est deux clips fond vert `#00FF00`, même armure, même cape, même aura que `bolt-breath.mp4` :

| Fichier | Rôle |
|---|---|
| `master/bolt-thunder-rise.mp4` | Une fois. Il se dresse. Les pattes avant deviennent des bras. |
| `master/bolt-thunder.mp4` | Boucle. Respiration agressive, debout, pattes arrière plantées. |

Image de départ du rise : une frame de `bolt-breath.mp4`. Image d'arrivée : still 2:3, le même chien vu de dos, bipède, massif, bras griffus, pattes en bas du cadre, fond vert plat, pas de sol. Reference-to-video 6 s. Puis image-to-video 6 s sur cette still pour la respiration (poitrine, cape, feu, griffes ; il ne marche pas, il ne se retourne pas).

`THUNDER_FIT = 1.62`. Pattes à `0.97` au lieu de `PAW_V` (il remplit le cadre). `breathMix = 1` pendant qu'il est le Thunderwolf, pour ne pas mélanger le galop à quatre pattes avec le corps debout.

Le menu **The plain** appelle `enterVista()`. `vistaHold = true` : on cale `citadel-exit.mp4` sur sa dernière image et on ne la rejoue pas. On saute le rise (`vistaHold` force `riseDone`). Il est déjà le Thunderwolf, en respiration, `roomDepth = 0.06`. Tant que le seek n'a pas passé 85 % du clip, on n'uploade pas la plaque (sinon la salle flashe). On ne retombe pas sur `room-breath`.

`vistaHold` est remis à false dans `begin`, `openGates`, `enterRoom` et `leaveThrough`.

## 12. Sur la plaine — lune, face caméra, déplacement, zoom

Une fois arrivé (`outArrived` ou `vistaHold`), la plaque n'est plus la dernière image figée de `citadel-exit.mp4`. C'est `master/citadel-plain.mp4`, en boucle.

La lune :

1. Dernière frame de `citadel-exit.mp4` (plaine, lune rouge, flèches, lave). Pas de chien.
2. Image-to-video, 10 s, 9:16, 720p. Caméra **verrouillée**. Pas de travelling, pas de zoom. Pierres, flèches et rivières ne bougent pas. Seule la lune fait un tour complet sur elle-même et revient au même endroit, pour que la boucle se ferme. Un pouls léger de la lave est toléré.
3. Encode `scale=720:1280`, crf 20, faststart, sans audio.

Tant que la sortie n'est pas finie, on joue `citadel-exit`. Après, `plainVid`. `vistaHold` joue la lune tout de suite. Ne pas retomber sur `room-breath`.

### Rotations — il finit face à la caméra

Un swipe horizontal rapide (`elapsed < 380 ms`, `|dx| > 40`, plus horizontal que vertical), **même sur le Thunderwolf**, lance la rotation et annule le déplacement de ce geste. Un glissement lent sur lui le déplace. Avant, seul le sol tournait : `THUNDER_FIT` couvre presque l'écran, donc ça ratait.

Il ne s'arrête plus de profil. Droite ou gauche, il finit **face caméra**, puis il respire. Un nouveau swipe le ramène de dos, dans le sens du swipe.

| Fichier | Rôle |
|---|---|
| `bolt-thunder-to-face-r.mp4` | Une fois. De dos, tourne à droite, finit face caméra. |
| `bolt-thunder-to-face-l.mp4` | Une fois. De dos, tourne à gauche, finit face caméra. |
| `bolt-thunder-face.mp4` | Boucle. Respiration de face, agressive, pieds en bas. |
| `bolt-thunder-to-back-r.mp4` | Une fois. De face, continue à droite, finit de dos. |
| `bolt-thunder-to-back-l.mp4` | Une fois. De face, continue à gauche, finit de dos. |

Still de face : image-to-image depuis une frame de `bolt-thunder.mp4`. Même chien, même armure, même cape, même aura, fond vert `#00FF00`, plein cadre, il regarde la caméra, pattes en bas, pas de sol. Puis reference-to-video 6 s, 2:3 : première image = dos, dernière = face (ou l'inverse pour le retour). La respiration de face est un image-to-video 6 s sur cette still, caméra verrouillée, il ne se retourne pas.

`thunderFace` et `thunderTurnTo` valent `"back"` ou `"face"`. À la fin du clip, la pose devient `bolt-thunder-face.mp4` ou `bolt-thunder.mp4`.

Ne pas rejouer les clips de profil (`bolt-thunder-right.mp4`, `*-idle.mp4`). Le joueur veut finir face caméra, pas de trois-quarts.

### Se déplacer

Sur lui, ou un geste vertical sur le sol :

- doigt vers le haut : `depthTarget` monte (plafond 0.78), il s'éloigne sur la lave. De dos, il joue `bolt-thunder-run.mp4` à `playbackRate = 1.25`.
- doigt vers le bas : il se rapproche. De dos, `bolt-thunder-backstep.mp4`.
- gauche / droite sur lui : `lanePos`, le même `slideTo` que la salle.

Les deux clips sont image-to-video 6 s sur la still de dos, fond vert, caméra verrouillée, il reste centré. Run = sprint bipède. Backstep = il recule. Boucle. On ne les joue que si `thunderFace === "back"`. De face, il glisse en gardant `bolt-thunder-face.mp4`.

Une fois la plaine tenue, le tick ne force plus `roomDepth = 0.06` à chaque frame. On ne le pose là qu'à l'arrivée. Sinon chaque frame le ramène au premier plan.

### Zoom

Deux doigts sur la plaine. Dans `ROAD_VS` :

```
gl_Position = vec4(uFocus + (aPos - uFocus) * uZoom, 0.0, 1.0);
```

`drawBuffer` pose `uZoom` sur le programme courant. Hors `doorMode === "out"`, le zoom vaut 1 : la salle et le run ne zooment pas. Plage 0.62–2.35. La molette fait la même chose. Le pincement annule le drag. `leaveThrough` et `enterVista` remettent le zoom à 1.

On zoome les sommets, pas les UV. La plaque n'a rien hors cadre. Lune et Thunderwolf grossissent ensemble, autour du centre. En dessous de 1, la scène rétrécit.

## Pour un nouveau Grok

1. Lire ce fichier avant de toucher au composite.
2. Copier `src/pyre-stage.tsx` tel quel. Ne pas réécrire les shaders de mémoire.
3. Servir les mp4 de `master/` sous `/master/…`. Le CSS des classes `pyre-*` est `src/pyre.css`.
4. Ne pas changer `BOLT_H`, `PAW_V`, `BOLT_RATE`, `ROOM_STEP` sans une capture du joueur.
5. Un nouvel ennemi = une vidéo fond vert + une entrée dans `FOE_KIND` + un mp4 de mort. Ne pas respawn le boss (`kind` 2) tant qu'on ne le redemande pas.
6. Une nouvelle pièce = dernière image du clip d'avant en première image du suivant. Image-to-video. Pas de coupe.
7. Le retour constellation → salle est `/room` (`src/routes/room.tsx`). Ne pas renvoyer vers la racine.
8. Le regard dans la salle : lire [ORBIT.md](ORBIT.md). JPEG `orbit/left-01..16` (`cam-left-orbit.mp4`, `?v=5`) et `orbit/right-01..16` (`cam-right-orbit.mp4`, `?v=4`). Bolt de dos sur l'anneau. Pas de mur du fond. Pas de shader qui tourne la photo. Pas le fondu `cam-left.mp4`.
9. Compresser avant de committer : `ffmpeg -an -vf scale=480:-2 -c:v libx264 -crf 27 -pix_fmt yuv420p -movflags +faststart`. Rester sous 100 Mo par fichier. Les clips de la citadelle déjà en ligne sont en 720×1280, crf 20.
10. Ouverture des portes : ne pas seek si le clip est déjà à 0, et ne jamais repeindre le biome tant qu'on est en citadelle. Section 10.
11. Porte du milieu : `citadel-exit.mp4` (salle → plaine, Bolt absent de la plaque). Thunderwolf : `bolt-thunder-rise.mp4` une fois, puis `bolt-thunder.mp4` en boucle, fond vert, `THUNDER_FIT = 1.62`. Le bouton **The plain** est `enterVista()` / `vistaHold`. Section 11.
12. Sur la plaine : `citadel-plain.mp4` (caméra fixe, la lune tourne). Swipe rapide = rotation qui finit face caméra (`bolt-thunder-to-face-r/l.mp4`, puis `bolt-thunder-face.mp4`). Swipe encore = retour de dos (`bolt-thunder-to-back-r/l.mp4`). Glisser = courir (`bolt-thunder-run.mp4`), reculer (`bolt-thunder-backstep.mp4`), ou se décaler. Pincement = `uZoom` dans `ROAD_VS`, seulement en `doorMode === "out"`. Section 12. Ne pas remettre les clips de profil.

## 13. Plaque vide — c'est ce qui est joué

Lire [PLATE.md](PLATE.md). La grille filmée des 12 pas n'est plus la plaine une fois la porte passée. `onBlack` remplace la vidéo de biome.

Un seul nombre, `plateOffset`, fait défiler le chemin, les rochers, les flèches et la citadelle. `plateWish` vient du swipe nord/sud. Au relâchement, `plateV` retombe à 0. Ne pas clamper `plateOffset`.

La caméra est un `orbit` libre, gain `(2 * PI) / 0.85`, sans snap. Le sol prend `uYaw = orbit`. Le ciel doit prendre le même angle, sinon seule la lave tourne et la lune reste collée. `spin = ((orbit / PI) % 2 + 2) % 2`, deux quads à `spin - 2` et `spin`. `clear` en noir avant, sinon l'ancienne lune reste.

Le ciel est un mp4 9:16 (`master/decor/sky.mp4`). Ne jamais étirer un 16:9 : la lune devient ovale. Hauteur à l'écran = `screenAspect / videoAspect`.

Le chemin est `decor/path.jpg`, échantillonné dans `PLATE_FS` sous l'horizon (`vUv.y > 0.47` est jeté). Les props sont des découpes vertes (`PROP_FS`, `greenness > 0.14` discard). Pas de flèche si `depth < 1.7` ou `|x| < 1.35`, sinon elle traverse Bolt. La citadelle est calée à l'horizon (`depth` clampé à 6.5).

La course : couper le fichier, ne pas seek. Le clip généré commence à l'arrêt et n'a qu'une keyframe, à 0. Samsung rejoue l'arrêt pendant le seek.

```
ffmpeg -ss 2.25 -to 5.7 -i bolt-thunder-run.mp4 -an -c:v libx264 -crf 18 -pix_fmt yuv420p -g 1 -movflags +faststart
```

Puis `loop = true` et bumper `?v=` sur la balise.
