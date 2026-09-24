# Pyre

Biome sang, route de lave, Bolt en sprint.

Le Bolt joué est `master/bolt-native.mp4` : sprint, armure et aura dans la même vidéo, découpé sur `master/pyre-road.mp4`.

Les ennemis sont `master/foe-fallen.mp4` et `master/foe-brute.mp4`. On tape un ennemi : le hurlement (`master/howl.mp4`) part de Bolt et va vers lui, puis `master/ash-fallen.mp4` ou `master/ash-brute.mp4` le défait. Pas de bouton, pas de recharge.

Le regard gauche / droite est `master/pyre-wing-l.mp4` et `master/pyre-wing-r.mp4`, à la même vitesse que la route.

À 600 pas, le seigneur de la porte (`master/boss.mp4`) demande six hurlements. La route entre dans la citadelle, les portes s'ouvrent, le hall mène à la salle de la star map. Un tap sur l'anneau joue `master/room-holo.mp4` puis ouvre https://boltversee-odyssey-star-map.grok.me. Le menu a aussi **The gates**, qui commence déjà devant les portes.

La méthode pour tout refaire est dans [METHOD.md](METHOD.md).

Le composite est `src/pyre-stage.tsx`.
