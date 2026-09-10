# Room — ossature (pack u9 + enter)

Film graph. Pas un donjon 3D. Caméra **lock-off**. Rien ne morph : Bolt, salle, portes, sol, lumière.

Cette version est écrite **après** une room qui joue vraiment. Les lois player en bas sont des bugs qu'on a tués — ne pas les réintroduire.

Seuil room→room : [ENTER.md](ENTER.md). Ops (encode, PACK, folders): [HANG.md](HANG.md).

**Ce repo = recette.** `stills/` et `films/` ici sont vides (`.gitkeep`). Les stills / mp4 de *cette* citadelle vivent dans l'app preview, pas sur GitHub. Grok recuit le style du joueur. `lock/` = identité Bolt + cadrage, pas le hang.

## Poses

`spawn` | `atA` | `atB`

Portes : **A = teal, gauche** · **B = gold, droite**.
Toujours les deux dans le même cadre au spawn.

## Clips — the 7 (per room)

Live in `room.clips`. Room 1 → `films/`. Room 2 → `films/a/`.

| id | act | loop | durée | first (stillStart) | last (stillEnd) | poseStart → poseEnd |
|---|---|---|---|---|---|---|
| breath-spawn | breath | oui | 6s | spawn | spawn | spawn → spawn |
| breath-A | breath | oui | 10s | atA | atA | atA → atA |
| breath-B | breath | oui | 10s | atB | atB | atB → atB |
| walk-spawn-A | walk | non | 10s | spawn | atA | spawn → atA |
| walk-spawn-B | walk | non | 10s | spawn | atB | spawn → atB |
| walk-A-B | walk | non | 10s | atA | atB | atA → atB |
| walk-B-A | walk | non | 10s | atB | atA | atB → atA |

Walk A↔B optionnel pour un pack minimum. **Ce hall les a.** Si absents : depuis atA, tap B → stay breath-A (pas de trou).

## Enter — hors des 7

Enter n'est **pas** dans `room.clips`. Il vit dans `ENTER[room][door]`.

| id | act | loop | durée | first | last | poseStart → poseEnd |
|---|---|---|---|---|---|---|
| enter-hall-a | enter | non | 6s | atA (hall) | teal plein, même slot | atA → spawn (room 2) |

N'existe que si une 2e room est branchée. Sinon atA tap A = **stay**.
Preload à part — `Object.values(room.clips)` ne le voit pas.

```
ended(enter):
  roomRef = played.to     // switch FIRST
  poseRef = spawn
  startBreath(spawn)      // pack() lit films/a + stills/a
```

Breath avant le switch = hall spawn sous le rideau. FAIL.

## Encode (tous les mp4)

Pas « H264 » tout court. Flags, sinon autoplay mort / Safari noir.

```
ffmpeg -i in.mp4 -map 0:v:0 \
  -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" \
  -c:v libx264 -pix_fmt yuv420p -an -movflags +faststart out.mp4
```

- Plaque **720×1280** 9:16. Non-9:16 → crop centre puis scale. Un 784×1168 casse le lock-off.
- **`-an`** — zéro audio. Audio = autoplay mort.
- `yuv420p` + `+faststart` — Chrome / Safari.
- Puis bump `PACK` (`?uN`). Sinon le navigateur rejoue l'ancien.

## Imagine (cuisson)

- **Breath in-room** : première = dernière = still de la pose. Loop seamless. Pieds collés. Micro head OK.
- **Breath dest (après enter)** : posé. Si i2v marche → freeze `stills/a/spawn.jpg` (HANG.md). Pas un micro-head qui traverse Hall′.
- **Walk** : first = still départ, last = still arrivée. **Distincts.** Interpole. Un aller. Pas de loop.
- **Enter** : deux plaques. First **et** last distincts. First = atA, last = teal plein **même slot**. Pas `image_to_video` sur un still. Pas Hall′ dans le cook. [ENTER.md](ENTER.md).
- **Stills** : première frame du breath de cette pose. Un grab last-frame peut revenir **vide** — ne pas s'en servir.

## Cycle play

1. Open → **breath-spawn** loop. Rien d'autre à l'écran.
2. Tap A → **walk-spawn-A** → ended → **breath-A** loop à t=0. **Stay.** Pas d'enter.
3. Tap B → **walk-spawn-B** → **breath-B** loop à t=0.
4. De A tap B → **walk-A-B** → **breath-B** (si le clip existe, sinon stay).
5. De B tap A → **walk-B-A** → **breath-A**.
6. Même porte au **spawn** → walk vers cette porte. Jamais enter depuis spawn.
7. Même porte à **atA** (2e tap A) → **enter** si `ENTER[room].A` existe, sinon stay.
8. Pendant un walk / enter → **ignorer** les taps.
9. `ended(enter)` → **switch room first** → **breath-spawn** dest + veil de **cette porte** 500ms.

Pose avance à la **fin du clip**, jamais au tap.
Breath loop jusqu'au prochain walk. Un lap de breath ne recuit rien.
Never walk→walk. Ended(walk) **toujours** → breath(arrivée).
Premier breath après un walk : start à t=0.

## Join (transitions)

```
stillEnd(from) === stillStart(to)  →  cut (0 ms)
sinon                              →  dissolve ≤ 280 ms
enter → dest spawn                 →  veil 500 ms (empty, color = the door)
```

Coutures qui doivent matcher (cut) :

- last(breath-spawn) = first(walk-spawn-A) = first(walk-spawn-B) = still spawn
- last(walk-spawn-A) = first(breath-A) = first(walk-A-B) = still atA
- last(walk-spawn-B) = first(breath-B) = first(walk-B-A) = still atB
- last(walk-A-B) = first(breath-B)
- last(walk-B-A) = first(breath-A)
- first(breath-X) = last(breath-X)  (loop)
- first(enter-hall-a) = still atA  (cut 0ms into enter)

Dissolve ne répare pas un encode. Si ça morph, le clip est FAIL — recuire first/last.
Ne jamais fondu **deux images avec un chien à deux places** (clone moteur).

## Hits

Picture **9:16**, object-fit contain.
Hits sur **l'image**, pas la letterbox.
Gauche ~40% = A (teal). Droite ~40% = B (gold). Centre ~20% = miss.

## Player — bugs tués (ne pas les recuire)

1. **Still toujours dessous.** Jamais d'écran vide. Gap / ended / play raté → le still de la pose. **Sauf enter :** still opacity 0 (sinon still atA + vidéo = deux chiens).
2. **Deux videos (vis / hid).** Les deux **cachés** tant que le premier clip ne joue pas. Une vidéo visible sans frame = plaque noire par-dessus le still.
3. **`muted=true` ET `playsInline=true` avant `play()`.** Unmute avant play() après un load async → le walk freeze à t=0. Si en plus on pose walking=true, plus aucun tap ne passe. Sans `playsInline`, iOS passe fullscreen et tue le hall. Unmute seulement le film déjà visible, sur un vrai pointer.
4. **Ne paint / ne lock walking que si le film joue vraiment.** Play raté → still + taps encore vivants.
5. **Pause l'ancien clip** après le swap. Deux films qui jouent en même temps, le nouveau se coupe.
6. **Pas de chrome.** Pas de bouton Play, pas de Forge, pas de Hang, pas de Keep, pas de canvas, pas d'anneaux de tap. Le lien *est* le hall.
7. **Plaque unique 720x1280.** Encode ci-dessus. Caméra lockée. Hall / Bolt / portes never morph.
8. **Rideau enter :** hide enter 0ms, veil **de cette porte** (teal-empty ou gold-empty) au-dessus, breath dest en-dessous, veil 500ms → 0 (double rAF). Pas de fondu chien-gauche + chien-centre.
9. **PACK.** Après chaque replace mp4/still, bump `?uN`.

## Hard locks

- Même plaque sur tous les clips.
- Bolt, objets, room, portes : never morph.
- Caméra lockée. Seul le chien bouge.
- Breath = pieds collés. Pas un walk-back vers spawn.
- Toujours deux portes, jamais une seule.
- Open = la room.
- Walk ended never auto-enter.
- Enter = deux plaques, **hors des 7**, `ENTER{}`. First G + last centre dans le même cook = clone.
- Ce repo ne contient **pas** les films de *cette* citadelle.
