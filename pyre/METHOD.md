# Pyre — méthode Bolt (sprint, armure, aura)

Bolt n’est pas un sprite dessiné par-dessus la route. C’est **une seule vidéo** : le chien, l’armure et le feu sont dans les mêmes images, donc le feu suit le galop. On découpe le fond vert, puis on pose le résultat sur la route qui défile.

## Fichiers

| Fichier | Rôle |
|---|---|
| `master/pyre-road.mp4` | La chaussée. Elle joue à 1×, en boucle croisée (deux lecteurs). |
| `master/bolt-fury.mp4` | Le Bolt de référence : berger blanc de dos, armure noire, cape rouge, fond vert. |
| `master/bolt-native.mp4` | **Celui qui est dans le jeu.** Sprint + armure + aura, fond vert, marche sans aura coupée, flaque verte sous les pattes enlevée. |
| `master/bolt-aura.mp4` | Ancienne aura séparée. Ne plus la coller : elle ne suit pas le galop. |
| `master/bolt-aura-run.mp4` | Essai où le feu était déjà dans l’image, mais ce n’est pas le Bolt retenu. |
| `master/bolt-gpu.mp4` | Cycle GPU du dépôt (`lock/bolt-gallop-cycle.mp4`). Pas le Bolt de Pyre. |
| `master/bolt.mp4` | Même cycle GPU. |
| `master/bolt-armor.mp4` | Essai d’armure générée, pas utilisé. |
| `master/bolt-pyre.mp4` | Premier essai armure + cape. |
| `src/pyre-stage.tsx` | Le composite WebGL : route, découpe, taille, vitesse. |

## 1. Générer Bolt en une seule vidéo

Image de départ : une frame de `bolt-fury.mp4` (le chien qu’on veut garder).

Image-to-video, caméra verrouillée dans le dos, fond **vert chroma plat** (`#00FF00`), pas de sol, pas de décor :

- le même chien, la même armure, la même cape
- un galop agressif, grandes foulées
- une aura rouge et noire **collée au corps** à chaque foulée, avec une traînée courte derrière les pattes arrière

Pourquoi le fond vert : si on le génère déjà sur la route, la découpe mange le feu (le feu et la lave sont tous les deux rouges) et laisse un trou dans la chaussée. Deux plaques du même biome, comme demandé : la plaque du chien (fond vert) et la plaque de la route (`pyre-road.mp4`).

## 2. Jouer la route et Bolt séparément

- Route : `playbackRate = 1`, deux vidéos qui se relaient pour que la boucle ne saute pas.
- Bolt : `playbackRate = 4`. On accélère **seulement** sa vidéo. La route reste à 1×.
- Les deux sont dessinées dans un canvas WebGL2. Les éléments `<video>` sont hors écran (`opacity: 0`), `muted`, `playsInline`, `disablePictureInPicture`.

## 3. Découper

`BOLT_FS` dans `src/pyre-stage.tsx` :

```
greenness = vert - max(rouge, bleu)
si greenness > 0.02 → alpha = 0
```

On jette le pixel dès qu’il est vert. On ne le « despille » pas vers le jaune : c’est ça qui laissait une flaque jaune-vert sous les pattes. Le feu rouge/orange a le rouge plus fort que le vert, donc il reste.

Les pattes sont plantées sur la route :

- `PAW_V = 0.93` (les pattes sont à 93 % de la hauteur de la vidéo)
- `PLANT_Y = 0.80` (ligne de contact sur l’écran)
- `BOLT_H = 0.28`
- `BOLT_ASPECT = 784 / 1168`

`y = PLANT_Y - PAW_V * h`, puis le quad est centré sur la voie (`lanePos * SLIDE_AMP`).

## 4. Couper la marche sans aura

Les ~0,95 premières secondes de la génération sont un trot sans feu. On les retire :

```
ffmpeg -ss 0.95 -i bolt-native-brut.mp4 -an -c:v libx264 -pix_fmt yuv420p bolt-native.mp4
```

Le cycle qui boucle commence déjà en sprint, avec l’aura.

## 5. Enlever le vert sous les pattes

Le modèle peint une flaque jaune-vert sur le fond, sous les pattes. Le key la transformait en tache. Avant l’encode, sur chaque frame :

1. En bas de l’image (`y > 80 %`), tout pixel jaune-vert (vert haut, bleu bas, pas le feu rouge) est repeint en vert chroma pour être découpé.
2. Les taches brillantes **sous** les pattes (composantes dont le centre est sous 90 % de la hauteur, plus larges que hautes, ou très petites) sont aussi repeintes en vert.
3. Le feu sur les cuisses et l’armure est au-dessus de cette zone : il reste.

C’est déjà appliqué dans `master/bolt-native.mp4`. Le shader ne fait plus que la découpe.

## Ce qui n’a pas marché

- Une deuxième vidéo d’aura, additionnée par-dessus : elle ne suit pas les foulées, on voit la coupe.
- Une aura en shader autour de la silhouette : ça suit le contour, mais ça a l’air faux et pauvre.
- Coller une armure fixe sur le cycle GPU : l’armure ne gallope pas avec le chien, et ce n’est pas le Bolt voulu.
- Régénérer un autre chien : on perd le Bolt de `bolt-fury.mp4`.
