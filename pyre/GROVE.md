# GROVE — forêt, ce qui marche

Cuisine seulement. Ne pas lire ça au joueur.
Repo : `StarBoltSprint/boltverse-odyssey`. Le jeu qui tourne est `src/game/pyre-stage.tsx` dans l'aperçu. La copie poussée ici est `pyre/src/pyre-stage.tsx`.

## Image de l'arbre

On affiche la vidéo d'origine, `decor/grove-tree-0.mp4`, `grove-tree-1.mp4`, `grove-tree-2.mp4`. Une texture partagée par tous les arbres de la même variante. On l'envoie au GPU à chaque frame, comme Bolt.

Ne plus passer par `grove-turn-*.jpg`. Ces photos ont été redessinées, puis enregistrées en JPEG d'environ 120 Ko. La vidéo fait le même cadre et environ 8000 kb/s. Le JPEG lave les feuilles et lisse l'écorce. Bolt n'a jamais eu ce traitement.

Bolt a l'air plus net quand le tronc remplit l'écran, alors que les fichiers sont du même ordre (environ 780 pixels de large). Bolt est dessiné plus petit que sa vidéo : le téléphone réduit, l'image reste nette. Le tronc est agrandi : 768 pixels étirés sur tout l'écran. Aucun filtre de netteté n'ajoute les rainures qui n'y sont pas.

Pour un tronc net en plein écran, une vidéo plus large, visée vers 1080. La première image, l'image du milieu et la dernière sont le tronc d'origine. Le modèle n'a pas le droit d'en partir. Il redessine les pixels : de loin c'est le même arbre, de tout près une rainure peut bouger. Ce n'est pas un agrandissement parfait. C'est quand même le seul moyen d'avoir de vrais pixels en plus.

## Quatre faces, comme Bolt

Pas encore cuit. C'est la suite, pas un tube.

Bolt a une vidéo par côté. On en joue une, parce qu'il est seul. Dans la forêt on voit un tronc de face et un tronc de côté en même temps. Tous les arbres partagent quatre vidéos. Quatre décodeurs, pas un par arbre. Douze (trois essences fois quatre faces), non.

Chaque face se cuit avec la première image, celle du milieu et la dernière calées sur ce côté du même tronc, en plus grand. Les quatre faces ne mangent pas ce verrou. Elles s'en servent.

Au jeu, la face suit l'endroit où l'on se tient (`atan2` vers l'arbre), pas le yaw de la tête. Un grand seuil avant de changer d'image. Sinon l'arbre tourne sur lui-même dès qu'on bouge un peu.

Ça donne le volume de Bolt : on sent qu'on en fait le tour, parce que la silhouette change. Entre deux faces, la carte est plate. On ne voit pas le bord du bois.

Quatre faces restent la suite, pas le volume fini, pas la v1. Le volume qui passe est la [loi 44](../biome/docs/44-imagine-volume-stack.md).

L'instancié vient après. Un seul passage GPU pour tous les arbres d'une même face. Ça allège. Ça n'ajoute pas un pixel. Le brancher sur la vidéo floue ne se voit pas.

## Volume — pile de cartes (loi 44)

SmiR a dit Go le 2026-09-26. Le texte est [`biome/docs/44-imagine-volume-stack.md`](../biome/docs/44-imagine-volume-stack.md). On ne remplace pas le placement simplex plus bas. On l'étend : capsule jumelle, ombre de contact, bandes près et milieu, billboard mixte. Le simplex place. Imagine dessine.

Deux jobs. Les deux.

1. **Collision.** Une capsule. Tu cognes le tronc. La ligne `(x, z, kind)` pose `(x, z, r, h)`.
2. **Regard.** En tournant ou en marchant, le proche glisse plus vite que le loin, le proche cache le loin, le tronc reste planté. Parallaxe, occlusion, échelle. Pas une carte de profondeur dans la vidéo.

Le fichier Imagine n'a pas d'épaisseur. Des cartes en mètres devant le film sol/ciel. Même `(x, z)`. Le seed garde les couches honnêtes.

Test le plus petit : les films de sol et de ciel déjà là, huit troncs dans la bande près, billboard + ombre + brume, capsules allumées, un tour autour d'un arbre. L'arbre reste planté et la forêt glisse derrière. Sinon ce n'est pas le volume.

## Volume — ce qu'on a jeté

| Essai | Résultat |
|---|---|
| Six JPEG du tour, une par angle | Un autre arbre à chaque pas. Et l'image est morte |
| Couches découpées selon une carte de profondeur | Trou de ciel dans le tronc. L'arbre a l'air de tourner |
| Décalage de quelques pixels selon le relief | Invisible. La photo est déjà pleine de rainures |
| Cylindre d'écorce | Un poteau. Ce n'est pas la forme de la vidéo |
| Bloc épais habillé de la photo | Le tronc est coupé des feuilles |
| Stéréo à l'écran | Les deux yeux voient les mêmes pixels. Sans casque, rien |
| SIFT, ORB, triangulation sur cette vidéo | Entre deux images proches, l'écorce bouge moins que le bruit de compression. À 18°, le même nœud n'est plus là |

SIFT ne sert que de repères sur le bois, fenêtre haute, sans rotation, une seule taille, et seulement là où une rainure casse. ORB confond les rainures. Ni l'un ni l'autre ne donnent un gris par pixel. Et cette vidéo-là n'a pas le décalage qu'il faut pour les lancer.

## Sol

Même idée que la plaine : une image déjà éclairée, posée en grand. Tuile `0.18`. Pas de fondu vers un marron uni.

Après une longue course le sol redevient moche. `worldX` / `worldZ` sont trop grands pour un `mediump`, et `fract` casse la tuile. On replie la position dans une seule tuile avant le shader :

```
u = v * 0.18
wrap = (u - floor(u)) / 0.18
```

Le bruit fractal (4 octaves, persistance 0,42, lacunarité 1,9) teinte. Il ne soulève pas le sol. On ne le remet pas par-dessus la photo.

Une vidéo de sol sous les pattes est pire qu'une photo nette : le décodeur et la compression grossissent les taches.

## Placer

Simplex décide où poser l'herbe et les arbres déjà cuits. Il ne dessine pas le sol, le relief, ni le détail.

- Herbe : case de 1,15 m. Bruit bas = trou. Bruit haut = touffe.
- Arbres : case de 3,3 m. Un bruit large dit le bosquet, un bruit plus fin choisit l'arbre.
- Le chemin reste vide. On ne décide pas une case tant que le chemin n'est pas passé devant.

## Contrôle

- Swipe vers le haut : sprint.
- Doigt tenu, à gauche ou à droite : Bolt suit le doigt.
- La caméra rattrape. Le ciel et le sol tournent avec. Sans ça, on ne peut pas changer de direction en courant.

## Poids, pour pouvoir republier

Le paquet avait dépassé ce que la republication accepte. On a retiré du jeu, et effacé les fichiers, ce qui ne sert plus à la forêt ni aux portes :

- Start : la route, les ailes, les démons, le hurlement, `ground.mp4`.
- La plaine : le Thunderwolf (toutes les vidéos `bolt-thunder*`), les bandes `plain-*`, `citadel-plain.mp4`.

Le menu ouvre les portes ou la forêt. Ne pas remettre ces mp4 dans le paquet publié.

## Ce qu'on n'a pas branché

- Perlin 6 octaves à 0,8. Ça rebouche la photo.
- Un LOD en C++. Le téléphone joue en WebGL1.
- Des rayons de soleil collés sur le ciel. Trop gros, ou invisibles. Annulés.
- La poussière en gros nuages. Le grain fin, instancié, poussé par le vent, n'est pas cuit.
