# Salle — rotation de caméra autour de l’anneau

Lire ça avant de retoucher le regard dans la salle. Les deux côtés sont de vraies passes de caméra. La gauche a d’abord été un fondu : le portail devenait la porte bronze dans le même cadre, et le joueur ne pouvait pas aller plus loin. On l’a recuite comme la droite.

Bolt n’est pas dans la vidéo de la pièce. On le dessine par-dessus, toujours de dos, toujours au centre, toujours à la même taille.

## Ce que le joueur fait

Un doigt sur le sol, pas sur Bolt.

- Glisser vers la gauche : la pièce tourne vers la porte de gauche (bronze, cadre vert).
- Glisser vers la droite : la pièce tourne vers la porte de droite (fente rouge).
- Relâcher : on accroche au milieu, à gauche, ou à droite. Jamais au mur du fond.
- Revenir : le même geste dans l’autre sens. Pas une quatrième vidéo. On rejoue les images à l’envers.
- Un nouveau glissé coupe le précédent tout de suite. On n’attend pas la fin d’un clip.

Deux doigts, c’est autre chose : Bolt se retourne (face / dos). Voir plus bas. Ne pas mélanger les deux.

## Pourquoi des JPEG, pas un mp4 scrubbé

Sur téléphone, `video.currentTime` ne montre que les images-clés. La pièce saute du portail à la porte. C’est le bug « ça coupe, ça ne tourne pas ».

On extrait 16 JPEG et on affiche celle qui correspond à l’angle. Le doigt pilote l’indice. Pas de `seek`.

```
ffmpeg -y -i cam.mp4 -vf "fps=16/6" -start_number 1 -q:v 3 orbit/right-%02d.jpg
```

Après chaque remplacement, incrémenter `?v=` sur le `src` des images. Sinon le téléphone garde les anciennes.

## Les deux suites qui jouent

| Suite | Fichiers | Sens | Ce qu’on doit voir |
|---|---|---|---|
| Gauche | `master/orbit/left-01.jpg` … `left-16.jpg` | `orbit > 0` | Le portail sort par la **droite**, la porte bronze entre par la **gauche**, et se cale au centre. L’anneau ne bouge pas. Source : `master/cam-left-orbit.mp4`. Cache `loadOrbit("left", 5)`. |
| Droite | `master/orbit/right-01.jpg` … `right-16.jpg` | `orbit < 0` | Le portail sort par la gauche, la porte à fente rouge entre par la droite. L’anneau reste au centre, même taille. Source : `master/cam-right-orbit.mp4`. Cache `loadOrbit("right", 4)`. |

Ne pas servir `master/cam-left.mp4` pour la gauche. C’est l’ancien fondu : le portail reste dans la même arche et devient la porte. Le glissé a l’air bloqué. `cam-left.mp4` reste dans le dossier comme archive, il ne joue plus.

Ne pas charger `left-back`, `right-back`, `cam-left-back`, `cam-right-back`. Ce sont les 90° suivants, vers le mur du fond. Le joueur ne les veut pas. Elles font croire qu’une rotation gauche devient une rotation droite.

## Cuire la vidéo de la pièce (sans Bolt)

Deux images de référence, 9:16, 6 s, 720p.

- Image 0 : la salle de face. Un seul portail turquoise. L’anneau cyan au centre. Pas de chien.
- Image 1 : la même salle, la porte de côté à la place du portail. L’anneau au même endroit, à la même taille. Pas de chien.

Prompt qui marche (droite) :

> Start exactly on the first image. End exactly on the second image. One smooth continuous camera orbit 90 degrees to the right around the cyan ring. The ring never moves, never changes size, stays the pivot. The cyan portal drifts off to the left. The dark door with the vertical red ember slit enters from the right and settles in the center. Constant camera distance, level horizon, no tilt, no zoom, no jump cut, no dissolve, no doubled portal. Empty room. No dog, no wolf, no person.

Prompt qui marche (gauche). Image 0 = la même salle de face que la droite (`orbit/right-01.jpg`, un seul portail). Image 1 = la porte bronze déjà cadrée (`orbit/left-16.jpg` de l’ancienne suite, ou `room-left.jpg` si le cadrage de l’anneau est le même).

> Start exactly on the first image. End exactly on the second image. One smooth continuous camera orbit 90 degrees to the LEFT around the cyan ring. The ring never moves, never changes size, stays the pivot. The cyan portal drifts off to the right edge and leaves the frame. The bronze gothic door enters from the left edge and settles in the center. The side arches of the hall must slide past. Constant camera distance, level horizon, no tilt, no zoom, no jump cut, no dissolve, no doubled portal, no morph of the doorway in place. Empty room. No dog, no wolf, no person.

Contrôle, avant de remplacer les JPEG : extraire une planche (`ffmpeg -vf fps=16/6`). L’anneau reste au centre sur les 16 images. Le portail se décale vers le bord opposé à la porte. La porte entre par l’autre bord. S’il y a deux portails, un saut, un zoom, un chien, ou un fondu dans la même arche : on jette le clip et on recuit. Ne pas « réparer » en sautant les images du milieu. Sans le milieu, le glissé reste bloqué sur le portail puis coupe.

## Angle

```
SIDE = π / 2
gain = SIDE / 0.5
orbitTarget = clamp(drag.orbit + (-dx / width) * gain, -SIDE, SIDE)
```

- `dx > 0` (doigt vers la droite) : l’angle baisse. Suite de droite.
- `dx < 0` (doigt vers la gauche) : l’angle monte. Suite de gauche.
- La moitié de la largeur de l’écran = 90°.
- Au relâchement : `round(orbit / SIDE) * SIDE`, encore clampé à ±SIDE. Trois crans : gauche, milieu, droite.

Le geste compte s’il est horizontal : `|dx| > 12` et `|dx| > |dy| * 1.05`. Un glissé vertical sur Bolt reste une marche dans la salle.

## Quelle image

```
local = min(0.999, abs(orbit) / SIDE)
idx   = floor(local * 16)
```

On prend `seq[idx]` si elle est décodée (`complete` et `naturalWidth > 0`). Sinon la précédente déjà prête. Jamais la suivante : une image du futur fait un saut.

`|orbit| < 0.06` : on n’affiche pas la suite. On reste sur `room-breath.mp4` (le portail, boucle).

Dessin : le shader de porte (`gateProg`), image pleine, pas de masque. Pas le shader qui tourne les UV. Pas un fondu entre deux photos. Le fondu se voit, et l’anneau se dédouble.

## Bolt pendant le regard

Dès que `|orbit| > 0.04` ou que le doigt tourne la pièce :

- pose = `bolt-breath.mp4` (dos), `breathMix = 1`, `yaw = "back"`
- on annule un tour de Bolt en cours
- `lanePos = 0`, `depthTarget = 0`, `roomDepth = 0`

Il reste planté sur l’anneau, de dos, à la taille du souffle. Il ne se retourne pas vers la caméra. Il ne grossit pas. Les pattes ne marchent pas : c’est le souffle, pas le galop.

`TURN_FIT = 1.55` ne s’applique qu’aux vidéos de tour (`bolt-turn*.mp4`). Pas au souffle. Pas à la pièce.

## Tour de Bolt (deux doigts) — ne pas le casser en réglant la caméra

Deux doigts dans la salle : un glissé horizontal (`|dx| > 18`) ou un arc (`|dAng| > 0.38`) lance `beginTurn`.

- Vers la droite : il passe face caméra (`bolt-turn.mp4`), ou revient dos (`bolt-turn-back.mp4`).
- Vers la gauche : `bolt-turn-left.mp4` / `bolt-turn-left-back.mp4`.
- Un geste inverse coupe le tour en cours et part dans l’autre sens. On n’attend pas la fin de la vidéo.
- Pendant un tour, les pattes ont le droit de bouger. C’est ce qui le fait pivoter. Au souffle, non.

Ces vidéos sont fond vert, Bolt seul, first / mid / last : dos, profil, face. On les découpe comme le sprint. On ne les met pas dans la vidéo de la pièce.

## Ce qui n’a pas marché

- Scrub d’un mp4 avec `currentTime`. Sur le téléphone, que des images-clés. La pièce saute.
- Bolt filmé dans la passe de caméra. Il se retourne, grossit, sort du cadre quand il s’assoit.
- Un shader qui fait tourner la photo de la salle. L’anneau quitte le centre. On voit que c’est l’image qui glisse.
- Un fondu du portail vers la porte dans la même arche (`cam-left.mp4`). Ce n’est pas une rotation. Le joueur dit que la gauche est limitée. Recuire `cam-left-orbit.mp4` et bumper `loadOrbit("left", 5)`.
- Enlever le milieu d’un clip raté (double portail) pour « nettoyer ». Le glissé ne montre plus rien, puis coupe.
- Dépasser 90° vers le mur du fond. Une rotation gauche se termine comme une rotation droite.
- Un gain trop fort, qui traverse zéro. Un petit glissé change de côté.
- Bloquer les gestes jusqu’à la fin de la vidéo.
- Laisser le tour face-caméra jouer pendant que la pièce tourne.

## Pour un nouveau Grok

1. Lire ce fichier. Ne pas réinventer un shader d’orbite.
2. Copier `src/pyre-stage.tsx`. Les suites sont `leftSide` et `rightSide`, l’angle est `orbit`, le cran est `SIDE`.
3. Servir `master/orbit/left-01.jpg` … `left-16.jpg` et `right-01.jpg` … `right-16.jpg`.
4. Si une suite coupe au lieu de tourner : recuire la vidéo (deux images, anneau fixe, sans chien), réextraire les 16 JPEG, bumper `?v=`.
5. Ne pas réactiver les packs `*-back`. Le joueur s’arrête à la porte de côté.
6. Bolt reste le souffle de dos tant que la pièce n’est pas au milieu.
