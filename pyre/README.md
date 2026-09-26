# Pyre

Biome sang, route de lave, Bolt en sprint.

Le Bolt joué est `master/bolt-native.mp4` : sprint, armure et aura dans la même vidéo, découpé sur `master/pyre-road.mp4`.

Les ennemis sont `master/foe-fallen.mp4` et `master/foe-brute.mp4`. On tape un ennemi : le hurlement (`master/howl.mp4`) part de Bolt et va vers lui, puis `master/ash-fallen.mp4` ou `master/ash-brute.mp4` le défait. Pas de bouton, pas de recharge.

Le regard gauche / droite est `master/pyre-wing-l.mp4` et `master/pyre-wing-r.mp4`, à la même vitesse que la route.

À 600 pas il n'y a pas de boss. La route entre dans la citadelle (`master/citadel-arrive.mp4`), les portes s'ouvrent, le hall mène à la salle de la star map. Un tap sur l'anneau joue `master/room-holo.mp4` puis ouvre la constellation. Le retour se fait par `https://boltversee-odyssey.grok.me/room`, pas par la page Start.

La méthode pour tout refaire Pyre est dans [METHOD.md](METHOD.md). Cette méthode est la base any-biome : [`biome/docs/COLD_START-biome-method.md`](../biome/docs/COLD_START-biome-method.md). La section A est la route. La section B est la forêt (sol ouvert) : noir, quatre ciels, une tuile, l'horizon, puis le GPU. Les chiffres restent [GROVE.md](GROVE.md) et la loi 43. Pyre reste l'exemple Diablo, pas le seul type de biome.

Le composite est `src/pyre-stage.tsx`.

Le regard dans la salle est [ORBIT.md](ORBIT.md) : un doigt sur le sol, la pièce tourne autour de l’anneau, Bolt reste de dos au centre.
