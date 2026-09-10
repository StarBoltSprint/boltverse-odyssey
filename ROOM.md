# Room — ossature (pack u9 + enter)

Film graph. Pas un donjon 3D. Caméra **lock-off**. Rien ne morph : Bolt, salle, portes, sol, lumière.

Cette version est écrite **après** une room qui joue vraiment. Les lois player en bas sont des bugs qu'on a tués — ne pas les réintroduire.

Seuil room→room : [ENTER.md](ENTER.md).

## Poses

`spawn` | `atA` | `atB`

Portes : **A = teal, gauche** · **B = gold, droite**.
Toujours les deux dans le même cadre au spawn.

## Clips

| id | act | loop | durée | first (stillStart) | last (stillEnd) | poseStart → poseEnd |
|---|---|---|---|---|---|---|
| breath-spawn | breath | oui | 6s | spawn | spawn | spawn → spawn |
| breath-A | breath | oui | 10s | atA | atA | atA → atA |
| breath-B | breath | oui | 10s | atB | atB | atB → atB |
| walk-spawn-A | walk | non | 10s | spawn | atA | spawn → atA |
| walk-spawn-B | walk | non | 10s | spawn | atB | spawn → atB |
| walk-A-B | walk | non | 10s | atA | atB | atA → atB |
| walk-B-A | walk | non | 10s | atB | atA | atB → atA |
| enter-hall-a | enter | non | 6s | atA (hall) | teal plein | atA → spawn (room 2) |

Durées = ce hall (Imagine). Breath-A/B sont **10s**, pas 6. La loop n'a pas besoin que ça soit 6.

Walk A↔B optionnel pour un pack minimum. **Ce hall les a.** Si absents : depuis atA, tap B → stay breath-A (pas de trou).

Enter n'existe que si une 2e room est branchée. Sinon atA tap A = **stay**.

## Imagine (cuisson)

- Plaque **720×1280** (9:16) H264, **tous** les clips. Un clip 784×1168 (walk-spawn-A) a dû être croppé — sinon le lock-off casse. Recaler : crop centre 9:16 puis scale 720×1280.
- **Breath** : première frame = dernière frame = le still de la pose. **Loop seamless.** Pieds collés. Hall figé.
- **Walk** : première frame = still départ, dernière frame = still arrivée. Interpole. Un aller. Pas de loop.
- **Enter** : deux plaques. First = atA, last = teal plein **même slot** (chien gauche). Pas Hall′ dans le cook. Voir [ENTER.md](ENTER.md).
- **Stills** : première frame du breath de cette pose. Un grab last-frame peut revenir **vide** — ne pas s'en servir.

## Cycle play

1. Open → **breath-spawn** loop. Rien d'autre à l'écran.
2. Tap A → **walk-spawn-A** → ended → **breath-A** loop à t=0. **Stay.** Pas d'enter.
3. Tap B → **walk-spawn-B** → **breath-B** loop à t=0.
4. De A tap B → **walk-A-B** → **breath-B** (si le clip existe, sinon stay).
5. De B tap A → **walk-B-A** → **breath-A**.
6. Même porte au **spawn** → walk vers cette porte. Jamais enter depuis spawn.
7. Même porte à **atA** (2e tap A) → **enter** si un lien existe, sinon stay.
8. Pendant un walk / enter → **ignorer** les taps.
9. `ended(enter)` → switch room → **breath-spawn** dest + rideau cyan vide 500ms.

Pose avance à la **fin du clip**, jamais au tap.
Breath loop jusqu'au prochain walk. Un lap de breath ne recuit rien.
Never walk→walk. Ended(walk) **toujours** → breath(arrivée).
Premier breath après un walk : start à t=0.

## Join (transitions)

```
stillEnd(from) === stillStart(to)  →  cut (0 ms)
sinon                              →  dissolve ≤ 280 ms
enter → dest spawn                 →  veil 500 ms (cyan vide, pas deux chiens)
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
3. **Play toujours muted.** Unmute avant play() après un load async → le walk freeze à t=0. Si en plus on pose walking=true, plus aucun tap ne passe. Unmute seulement le film déjà visible, sur un vrai pointer.
4. **Ne paint / ne lock walking que si le film joue vraiment.** Play raté → still + taps encore vivants.
5. **Pause l'ancien clip** après le swap. Deux films qui jouent en même temps, le nouveau se coupe.
6. **Pas de chrome.** Pas de bouton Play, pas de Forge, pas de Hang, pas de Keep, pas de canvas, pas d'anneaux de tap. Le lien *est* le hall.
7. **Plaque unique 720x1280.** Crop si besoin. Caméra lockée. Hall / Bolt / portes never morph.
8. **Rideau enter :** hide enter 0ms, veil cyan vide au-dessus, breath dest en-dessous, veil 500ms → 0. Pas de fondu chien-gauche + chien-centre.

## Hard locks

- Même plaque sur tous les clips.
- Bolt, objets, room, portes : never morph.
- Caméra lockée. Seul le chien bouge.
- Breath = pieds collés. Pas un walk-back vers spawn.
- Toujours deux portes, jamais une seule.
- Open = la room.
- Walk ended never auto-enter.
- Enter = deux plaques. First G + last centre dans le même cook = clone.
