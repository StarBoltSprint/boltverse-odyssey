# Moteur maison WebGPU (Boltverse)

## Lancer
```
cd engine/webgpu && python3 -m http.server 8000
```
Ouvrir dans Chrome/Edge (WebGPU) :
- `m448aaa2.html` — prairie AAA (rivière, moulin, arbres, arrêt de Bolt)
- `m445lp.html` — chemin lumineux, montée Paw-to-Galaxy
- `m447g.html` — Bolt, galop des virages (test) ; `m447v.html` — Bolt de référence

## Briques et biomes
Chaque fonctionnalité est une brique dans `engine/` (`makeX(config)`) : `river`, `watermill`, `trees`, `path`, `shadows`, `footprints`, `particles`, `wind`, `atmosphere`, `gi`, `postfx`, `taa`, `ssgi`, plus `engine/bricks/perf-*` (culling, cache d'ombres, réglages qualité, mesure GPU).
Un biome = un fichier de config (`engine/biomes/meadow.js`) qui passe ses réglages à chaque brique. Nouveau biome : copier `meadow.js`, changer les valeurs, importer.

`taa` et `ssgi` sont optionnels et **éteints par défaut** (`on: false`). La prairie live (`m448aaa2`, `meadow.js`) ne les importe pas. Le banc isolé est `m449cand.html` (candidat cristal, quartz F0 0.04, pas de chrome, pas de brouillard). Vérifs : `node --test check/post449/math.test.mjs` et, avec WebGPU, `node check/post449/run.mjs`. Le temps de frame de ce banc n'est pas une mesure téléphone.

Encore codé en dur dans `m448aaa2.js` (à extraire) : rochers + collisions, shaders ciel/sol/herbe/cailloux, constantes de locomotion de Bolt.

## Vérifications
`check/lp445` (structure image par image : sol, arbres, horizon, chemin) et `check/b447` (gel des pattes, taille, inclinaison de Bolt). Scripts Python, prennent une capture vidéo en entrée.

Assets > 5 Mo non inclus : `bolt447_{back,q3l,q3r,prof}_c.png`, `bolt_trot.bin`.
