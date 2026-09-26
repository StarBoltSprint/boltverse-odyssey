# GROVE — forêt, techniques en place

Cuisine seulement. Ne pas lire ça au joueur.
Repo : `StarBoltSprint/boltverse-odyssey`. Le jeu qui tourne est `src/game/pyre-stage.tsx` dans l'aperçu. La copie poussée ici est `pyre/src/pyre-stage.tsx`.

## Ce qui est Imagine

Vidéos, pas du dessin. Le téléphone les pose en textures GPU.

| Fichier | Rôle |
|---|---|
| `decor/forest-sky-0..3.mp4` | ciel, quatre faces, comme la plaine |
| `decor/grove-floor.mp4` | sol. Image éclairée, puis image-vers-vidéo. La photo `grove-floor.jpg` reste tant que la vidéo n'est pas décodée |
| `decor/grove-path.mp4` | chemin lumineux, ruban à plat sur le sol |
| `decor/grove-grass.mp4` | touffes vertes, courtes, sans racines marron |
| `decor/grove-tree-0..2.mp4` | trois arbres |
| `decor/grove-moss.mp4` `grove-leaves.mp4` | cartes au sol, croisées pour le volume |
| `decor/grove-rock.jpg` | rocher |
| `decor/grove-spark.png` | une frame pour la poussière |

Bolt reste `bolt-native.mp4` / `bolt-idle`. Pas un nouveau clip.

## Sol, même méthode que la plaine

La lave a l'air mieux parce que l'image est déjà éclairée (sombre / clair) et posée en grand. La forêt fait pareil.

- Tuile `0.18`, la même que `ground.mp4`. Pas de répétition fine.
- Pas de fondu vers un marron uni. La photo reste.
- La vidéo ne fait bouger que la lumière et la brume. Caméra fixe, pour que la tuile ne glisse pas.

Après une longue course le sol redevenait moche. `worldX` / `worldZ` deviennent trop grands pour un `mediump` de téléphone, et `fract` casse la tuile en gros carrés. Avant d'envoyer la position au shader, on la replie dans une seule tuile :

```
u = v * 0.18
wrap = (u - floor(u)) / 0.18
```

L'image ne change pas. Seul le nombre envoyé au GPU reste petit.

## Placer l'herbe et les arbres

Simplex décide. Pas des anneaux autour du chemin.

- Herbe : une case de 1,15 m. Bruit bas = trou. Bruit haut = touffe, parfois une deuxième.
- Arbres : case de 3,3 m. Un bruit large dit le bosquet, un bruit plus fin choisit l'arbre. Échelle selon le bruit.
- Le chemin reste vide : herbe à moins de 2,5 m, arbre à moins de 4,1 m, on ne pose rien.
- On ne décide pas une case tant que le chemin n'est pas passé devant. Sinon un arbre pousse sur le futur sentier.

Le hash ne sert plus qu'au détail (miroir, teinte, variante). Il ne choisit plus l'endroit.

## Volume

- Herbe et arbres : cartes debout, qui font face à la caméra.
- Mousse et feuilles : deux cartes croisées, collées au sol. Une seule carte plate se voit.
- Le sol et le chemin lumineux restent des plaques. Le bruit fractal ne leur donne pas de hauteur. On l'a essayé (4 octaves, persistance 0,42, lacunarité 1,9, un tiers par-dessus la photo). Ça teinte. Ça ne sort pas du sol. Retiré, pour laisser l'image éclairée.

## Contrôle

- Swipe vers le haut : sprint. `plateWish` vient du tirage vertical.
- Doigt tenu, glissé à gauche ou à droite : Bolt suit le doigt (`lanePos`).
- La caméra rattrape. Une part de ce décalage devient un virage (`selfAng`) et un pas de côté. Le ciel et le sol tournent avec. Bolt revient vers le centre dans la nouvelle direction.
- Un swipe surtout horizontal, sans la course, tourne toujours le monde. Ce n'est pas le sprint.

## Ce qu'on n'a pas branché

- Perlin 6 octaves à 0,8. Trop de grain, ça rebouche la photo.
- Le décret nébuleuse (gravité, comètes, graine `BOLT-7749-NEBULA`). Autre jeu. Les chunks devant Bolt et le bruit de placement sont déjà là, plus petits.
- Un LOD en C++. Le téléphone joue en WebGL1. Pas de compute shader.
