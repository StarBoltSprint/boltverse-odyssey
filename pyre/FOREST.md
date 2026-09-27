# Forêt — soleil, lumière, sprint

Cuisine. Ne pas lire ça au joueur.
Repo : `StarBoltSprint/boltverse-odyssey`.
Le jeu qui tourne est `src/game/pyre-stage.tsx`. La copie poussée est `pyre/src/pyre-stage.tsx`.
La forêt d'avant (placement, sol, volume jeté) reste [GROVE.md](GROVE.md). Ici, seulement ce qui a été branché après, et comment.

## 1. Le soleil est dans le ciel, pas à part

Le ciel est quatre vidéos, `forest-sky-0` à `forest-sky-3`. Le disque n'est que sur la face 0, vers le milieu de l'image (texture `u = 0.50`, `v = 0.71` après le flip Y).

`skyLock` est calculé avec **les mêmes** `slice`, `span`, `u0`, `v0`, `v1` que le shader du ciel. Le rayon part de ce point. Si on recalcule le soleil avec un autre vecteur, dès qu'on tourne le rayon quitte le disque et sort du ciel.

Quand la face change, on prolonge la position hors de l'écran. Le soleil n'est plus visible, les rayons continuent d'arriver du côté où il est resté.

L'ancien disque peint dans la vidéo dépasse du nôtre. Dans `SKY_FS`, si la face est 0, une ellipse autour de `(0.50, 0.71)` est remplacée par la couleur du ciel juste à l'extérieur. Sans ça le soleil n'est pas rond.

## 2. Les rayons

Une image Imagine, `decor/grove-sun-0.jpg`. Rayons fins, fond noir, le trou du soleil près du haut (`originV = 0.893`). Pas une vidéo : un décodeur de plus, et la compression grossit les traits.

Dessin **avant** les arbres, mélange additif (`SRC_ALPHA`, `ONE`). Les troncs couvrent les rayons tout seuls. On ne découpe pas le rayon arbre par arbre.

- Le quad fait environ `1.42` de large. La hauteur garde le ratio de la photo. On ne scale pas la texture : on cadre.
- Le haut de la photo (le faux soleil) est coupé (`v` jusqu'à `0.97`).
- `SHAFT_FS` fait un trou rond au centre. Les traits sortent du bord du disque, pas d'un point en dessous.
- Pas de second quad vers le haut. Un soleil haut, ciel clair, ne jette des traits que vers le sol, entre les arbres. Le trait du dessus était une bande, pas le ciel.
- `GLARE_FS` : disque + auréole gaussienne + un peu d'air, `p.x` multiplié par l'aspect. Un passage monde avant les arbres, un passage œil après, seulement quand on regarde le soleil.

Ce qui a échoué, et pourquoi :

| Essai | Résultat |
|---|---|
| Gros traits collés sur le ciel | Moche, annulé |
| Les rayons partent d'un point sous le disque | Ce n'est pas le soleil. Le trou rond règle ça |
| Un soleil calculé à part du panorama | Dès qu'on tourne, les traits quittent le disque |
| Un miroir de rayons vers le haut | Une bande. Un soleil haut n'éclaire pas le ciel au-dessus de lui |
| L'ancien disque de la vidéo laissé en place | Le soleil n'est plus rond |

En réalité les rayons sont parallèles. On les voit en éventail à cause de la perspective, et seulement là où l'air est un peu chargé (brume, poussière), surtout vers le sol. Pas sur les côtés du disque en ciel clair. Le halo, lui, fait tout le tour.

## 3. La même lumière sur tout

Le soleil à l'écran, pas un autre vecteur :

```
uSide = clamp((skyLock.x - 0.5) * 2.6, -1.3, 1.3)
```

Le côté de la carte tourné vers ce `x` s'éclaircit (chaud). L'autre s'assombrit (bleu). Même formule pour le pelage (`BOLT_FS`), les arbres, l'herbe, les rochers, les feuilles, le papillon (`MARK_FS`, `TREE_FS`, `INST_FS`).

Le signe a été inversé une fois : le côté éclairé était à l'ombre. Le côté écran où est le soleil doit être le côté clair.

La luminosité globale suit le regard :

```
sunAmt = 0.58 + 0.55 * nd
nd = clamp(look · SUN * 0.5 + 0.5, 0, 1)
```

Face au soleil, plus clair. Dos au soleil, plus sombre. Les arbres multiplient aussi leur orientation (`sunCard`). Le relief du sol avait déjà le vecteur monde `SUN_X = 0.34`, `SUN_Z = 0.94`.

L'ombre d'un arbre ou d'un rocher est un ruban au sol, pointe en `position - SUN * longueur`. Elle tombe à l'opposé du soleil.

Pas de ruban par brin d'herbe. Chaque brin faisait un upload et un draw. Le téléphone fige. L'herbe à l'ombre d'un tronc est juste plus sombre (`* 0.58`).

La liste des troncs est faite **une fois** par image. On ne relit pas toute la forêt pour chaque touffe. La version qui plafonnait les tests sans compter les arbres loin ne s'arrêtait jamais : elle relisait tout, et le jeu restait collé.

## 4. Le jeu qui fige

Trois causes, trois coupes.

1. Un draw d'ombre par brin. Enlevé.
2. L'ombre d'arbre qui parcourt chaque marque pour chaque touffe. Une liste de troncs, une fois.
3. Samsung. À chaque image on faisait `currentTime = 0.05` sur l'herbe, les arbres, le tronc, la couronne, le chemin. Le seek ne finit pas, la frame d'après le relance, le fil bloque, la dernière image reste. Chaque vidéo de décor est calée **une fois** à `0.08`, puis en pause. `texImage2D` est dans un `try`. `tick` aussi : une frame ratée ne tue pas `requestAnimationFrame`.

## 5. Le sprint de Bolt qui reste collé

`bolt-grove-run.mp4` et `bolt-grove-idle.mp4`. Fond déjà découpé comme les autres cartes.

Ne pas seek la course quand `currentTime` ne bouge plus. Sur ce téléphone le seek **est** le blocage : il reste dans la pose, longtemps, puis il saute.

- `groveSprint` s'allume au-dessus de `0.12`, s'éteint sous `0.03`. On ne change pas de clip à chaque micro-arrêt.
- `playbackRate` fixe : course `2.2`, arrêt `1`. On ne l'écrit pas à chaque frame.
- Tant que la vidéo avance de plus de `0.04` s, on copie l'image dans un canvas (max 420 px, 8 cases). Dès qu'on a 3 cases, on les fait défiler sur une horloge : course 16 images/s, arrêt 8. Le décodeur peut se taire, les pattes bougent.
- Au lâcher, on affiche tout de suite le cache de l'arrêt. Il ne reste pas sur la dernière frame de sprint.

Ce qui a échoué : avancer `currentTime` de `0.08` toutes les `0.2` s. L'image saute, et le navigateur se bloque.

## 6. Ordre

Ciel, sol en relief, rayons et halo, arbres et herbe (ils cachent les rayons), Bolt, éblouissement si on regarde le soleil.

## Fichiers que le code lit et qui ne sont pas encore dans ce dépôt

Ils sont dans l'aperçu (`public/master/`). Trop lourds pour ce push texte. Le code les attend :

| Fichier | Rôle |
|---|---|
| `master/bolt-grove-run.mp4` | Sprint forêt |
| `master/bolt-grove-idle.mp4` | Arrêt, souffle |
| `master/decor/grove-sun-0.jpg` | Rayons |
| `master/decor/grove-land.jpg` | Tuile de sol |
| `master/decor/grove-land-n.jpg` | Normal du sol |
| `master/decor/grove-bole.mp4` | Tronc près |
| `master/decor/grove-crown.mp4` | Feuilles près |
| `master/decor/grove-grass.mp4` | Herbe |
| `master/decor/grove-grass-flat.jpg` | Herbe écrasée |
| `master/decor/grove-fly.mp4` et `grove-fly-0.jpg` … `5` | Papillon, images si le décodeur meurt |
| `master/decor/grove-grok.mp4` | Grok dans la forêt |

Les `grove-turn-*`, `grove-depth-*`, `grove-octa-*`, la grille `master/grid/` ne sont pas la méthode qui tient. [GROVE.md](GROVE.md) dit déjà pourquoi.
