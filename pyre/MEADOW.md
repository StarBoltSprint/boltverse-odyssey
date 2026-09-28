# MEADOW — deux plaques noires

Cuisine seulement. Ne pas lire ça au joueur.
Repo : `StarBoltSprint/boltverse-odyssey`. Le jeu qui tourne est `src/game/pyre-stage.tsx`, fonction `Meadow`.

Leçons froides (Pack — ne pas effacer ce fichier) : [`biome/docs/COLD_START-meadow-jobs.md`](../biome/docs/COLD_START-meadow-jobs.md). Échelle des découpes : loi [`biome/docs/56-cutout-native-scale.md`](../biome/docs/56-cutout-native-scale.md) (`scale > 1` = liche).

L'herbe et le ciel ne sont plus la même image. Chacun a sa plaque. On ne ré-encode pas. Un nouvel mp4 noir écrase les pixels. Le noir est fait à l'affichage : on ne dessine pas l'autre moitié.

## Plaque herbe

Huit vidéos d'origine, `decor/meadow-h/h0.mp4` … `h7.mp4`. Une tous les 45°.

On envoie le fichier tel quel au GPU. Pas de zoom vertical. Le haut de l'image (au-dessus de 0,534) est jeté. C'est le noir. L'herbe en dessous est la vidéo.

Le doigt choisit les deux plaques les plus proches et les fond. En même temps, l'herbe glisse. Plus on est près des pattes, plus elle glisse. À l'horizon, elle ne bouge presque pas. C'est ça qui fait la rotation. Le fondu seul ne faisait que changer de vidéo.

Le glissement reste dans l'image. On ne montre jamais le bord, donc pas de bande floue. Au repos, une seule plaque, nette. Les autres lecteurs sont en pause.

Vitesse de cette plaque : `GRASS_RATE = 1`. Elle ne suit pas le ciel.

## Plaque ciel

Pas un second lecteur. Sur ce téléphone, un deuxième `h0` mis en pause avant d'avoir joué ne décode rien : l'écran reste noir, et la plaque d'herbe de face reste coincée avec lui.

On attend la première image de `h0` (celui qui joue déjà pour l'herbe), on la copie une fois, et on ne la reprend plus. L'herbe continue à sa vitesse. Le ciel ne suit pas.

On ne dessine que le haut, au-dessus de 0,534. Le bas est jeté. C'est l'autre noir.

Le soleil fait le tour avec le même doigt que l'herbe, mais ce n'est pas la vidéo qui défile. Tant que le pixel est dans la photo, c'est la photo, nette. Dès qu'il en sort, on ne coupe pas avec un autre bleu : ça fait une ligne verticale. On continue avec la couleur du bord de la photo, lissée de haut en bas pour qu'il n'y ait pas de traits. Le fondu fait 18 % de l'écran, du côté vide seulement.

```
raw = sx - (sunU - 0.49)
inside = le pixel est encore dans la photo
photo = la vidéo
fill = la couleur du bord, lissée de haut en bas
couleur = mix(fill, photo, inside)
```

`SKY_FOV = 43°`. Le soleil traverse l'écran, puis il reste dehors presque tout le tour. Il ne revient pas de l'autre côté au bout de 45°. Un seul soleil, celui de `h0`.

Vitesse du ciel : 0. On ne change que `SKY_FOV` si le soleil doit traverser plus vite ou plus lentement. On ne touche pas à `GRASS_RATE` pour ça.

## Les deux ensemble

Le ciel est dessiné en premier. L'herbe par-dessus, en transparence là où elle est jetée. Même ligne d'horizon, 0,534. Pas de bande entre les deux.

Bolt est une troisième plaque, le cycle grove, par-dessus. Il ne fait pas partie de l'herbe ni du ciel.

## Ne pas

- Glisser l'herbe jusqu'au bord de la vidéo. Le bord s'étire et fait la bande floue. Le glissement actuel reste à l'intérieur.
- Étirer une colonne du ciel pour boucher le trou. Le ciel devient plat et coupé.
- Recadrer ou zoomer une plaque pour cacher un bord. On perd la vidéo.
- Ré-encoder l'herbe ou le ciel sur un mp4 noir. Le noir se fait en ne dessinant pas.
- Prendre le ciel dans un second lecteur de `h0` qui ne joue pas. L'écran devient noir. On copie la première image du lecteur qui joue déjà.
- Mettre un soleil dans chacune des huit plaques. Le soleil revient trop tôt.
