# MEADOW — idées, ratés, réussites

Cuisine seulement. Ne pas lire ça au joueur.

`MEADOW.md` est la méthode en cours (huit vidéos, deux plaques, ciel copié). Ce fichier est le chemin. Il n'était pas sur le dépôt. Les autres lois restent `METHOD.md`, `GROVE.md`, `PLATE.md`, `ORBIT.md`, `FOREST.md`.

## Réussites — on garde

- Le noir se fait à l'affichage. On ne dessine pas la moitié qu'on ne veut pas. Ré-encoder l'herbe ou le ciel sur un mp4 noir écrase les pixels. C'est un raté, pas une méthode.
- Empiler des plaques à l'écran ne compresse pas. Chaque plaque reste à la qualité de son fichier. L'herbe n'abîme pas le ciel, le ciel n'abîme pas l'herbe.
- L'herbe et le ciel doivent être deux plaques. Même horizon, `0,534`. Le ciel est dessiné d'abord. L'herbe par-dessus.
- Un seul soleil. Il vient d'une seule photo, la première image de `h0`, copiée une fois depuis le lecteur qui joue déjà. Un second lecteur de `h0` mis en pause avant d'avoir joué ne décode rien : écran noir, et la plaque de face reste coincée avec lui.
- `GRASS_RATE = 1`. Vitesse du ciel = 0. On ne change pas l'un pour régler l'autre. Le soleil se règle avec `SKY_FOV` (43°). Il traverse, puis il reste dehors. Il ne revient pas de l'autre côté au bout de 45°.
- Le fondu du ciel vide fait 18 % de l'écran, du côté vide seulement, avec la couleur du bord lissée de haut en bas. Un autre bleu collé fait une ligne verticale.
- Huit fichiers d'origine, `decor/meadow-h/h0.mp4` … `h7.mp4`, un tous les 45°. On les envoie tels quels au GPU. Pas de zoom vertical. Le haut au-dessus de `0,534` est jeté.
- Le doigt choisit les deux plaques les plus proches et les fond. En même temps l'herbe glisse : beaucoup près des pattes, presque rien à l'horizon. Le glissement reste dans l'image. Le fondu seul ne faisait que changer de vidéo.
- Au repos, une seule plaque, nette. Les autres lecteurs sont en pause.
- L'herbe debout (carte verticale) a du volume. La mousse, les feuilles et le sol à plat n'en ont pas. Bolt est une troisième plaque, le cycle grove, par-dessus. Il ne fait pas partie de l'herbe ni du ciel.
- First, mid, last sur la même pelouse empêche le morph à l'intérieur d'une vidéo de défilement. La caméra ne tourne pas dans cette vidéo. L'herbe avance.
- La vitesse filmée n'est pas constante. Imagine ralentit. On mesure le flux (pixels par seconde) et on corrige le débit. On n'accélère pas à la main un bout puis l'autre.

## Ratés — on ne refait pas

- Vingt-quatre plaques, puis treize, puis un anneau 0° / 15°, pour « couvrir » le tour. L'angle du doigt restait l'angle filmé. Pas de 30°, pas de 40°, pas de 90° libres. Ce n'est pas une voiture.
- Des orbites gauche et droite où le virage est déjà dans la vidéo. Le contrôle est bloqué. Parfois 10 secondes, parfois 2. Coupées sans raison. Le défilement droit n'avait pas la même vitesse ni la même couleur.
- First frame différente d'une plaque à l'autre. Le fondu morph dès la première seconde. Coller la photo de face sur un angle de côté : même raté.
- Fondre le ciel des deux plaques. Deux soleils. Le soleil qui sort à gauche et revient à droite : le tour du ciel est trop court.
- Un second lecteur, ou une plaque ciel qui rejoue toute la vidéo pendant que l'herbe tourne. Le ciel saute quand on inverse le virage.
- Glisser l'herbe jusqu'au bord du fichier. Le bord s'étire. Bandes floues à gauche et à droite.
- Recadrer ou zoomer pour cacher un bord. On perd la vidéo.
- Étirer une colonne du ciel pour boucher le trou. Ciel plat, traits horizontaux.
- Huit vidéos jouées en même temps, chacune dans un sens, pour « faire » le 360. Les tampons ne continuent pas les brins. À gauche l'herbe part d'un côté, à droite de l'autre. Couper le tampon au moment du virage n'a pas suffi.
- Une vidéo 360, ou un panoramique, avec le soleil et l'herbe dans le même fichier. Le sol ne tournait pas, ou tournait image par image. Le ciel, lui, tournait. Ce n'est pas un tour.
- Poser la belle herbe (photo de face, horizon dedans) sur un plan 3D qui tourne. L'horizon peint tourne avec la plaque. Vue de dessus, ou de côté. Écran bleu dès que l'angle n'avait pas de frame.
- Une photo prise du dessus, répétée, caméra qui tourne vraiment. Le tour est vrai. L'herbe est plate. Pas le relief de la vidéo.
- Défilement et rotation dans deux familles de vidéos (orbite arrêtée, orbite qui défile, défilement droit). Au moment du switch, le défilement s'arrête, ou la vitesse change, ou la couleur change. Enchaîner « proprement » n'a pas tenu.
- Faire défiler la photo de face en boucle, en la répétant. Le haut ne continue pas le bas. L'horizon descend dans la pelouse. La boucle se voit.
- Découper chaque brin, chaque zone, chaque rectangle d'une plaque 1080p pour le reposer plus tard. Les rectangles ne sont pas des objets. Les objets reposés au mauvais moment s'étirent. Trop lourd, et la caméra n'était plus celle de la prise.
- Empiler des troncs, des tubes, des faces, pour donner du volume aux arbres. Parfois propre, souvent flou, dédoublé, ou un autre arbre. Un arbre ne tourne pas sur lui-même. Une vidéo, c'est le temps, pas la caméra qui tourne autour.
- Traits de soleil, halos, rayons collés. Moche. Annulés. La lumière réelle n'est pas une vidéo de rayons posée sur le ciel.

## Idées — ce qu'elles valent

- Anneau de plaques tous les 15°, même first, mid, last, même pelouse, ciel indépendant. Testé en 0° et 15°. Le passage peut ne pas morpher si c'est vraiment la même herbe. Ce n'est toujours pas un tour libre. Au-delà, il manque la plaque. Vingt-quatre plaques, c'est lourd, et changer de plaque ne fait pas une rotation si l'écart est grand.
- Huit plaques GPU, herbe qui glisse sous les pattes, ciel copié. C'est `MEADOW.md`. Mieux que le fondu seul. Ça reste un changement de vidéo tous les 45°, rattrapé par le glissement. Pas un 360 fluide.
- Une seule image d'herbe, sans ciel, même taille partout, répétée, glissée vers l'arrière. Pas de morph : ce sont les mêmes pixels. Le ciel et le reste sont d'autres plaques, par-dessus, coupées à l'écran. Ça garde la qualité de chaque fichier. Ça ne garde pas le relief de la pelouse filmée. Le sol a l'air d'un tapis. Propre. Pas la vidéo.
- Reposer l'herbe debout (la même carte verticale) sur ce tapis, près de Bolt, à la même vitesse que le sol. Là, on voit l'herbe. Au fond, on voit le tapis. Si les vitesses diffèrent, les brins flottent.
- Jugement, pas encore fait : à faire si on veut une longue course sans morph et sans soleil qui saute. Pas à faire si on veut partout le relief de la plaque filmée. Les deux ne tiennent pas ensemble.

## Ne pas

- Croire qu'une photo de face, répétée, devient un sol en relief parce qu'elle est nette.
- Tourner la plaque en 3D et, en plus, changer la photo d'angle. L'horizon est tourné deux fois.
- Remettre les orbites filmées pour « aider » le doigt. L'angle est dans la vidéo, le joueur ne le choisit plus.
- Pousser un nouveau mp4 noir pour « séparer » le ciel. Séparer = ne pas dessiner.
