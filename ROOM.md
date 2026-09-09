# Room — ossature

Film graph. Pas un donjon 3D. Caméra **lock-off**. Rien ne morph : Bolt, salle, portes, sol, lumière.

## Poses

`spawn` | `atA` | `atB`

Portes : **A = teal, gauche** · **B = gold, droite**.
Toujours les deux dans le même cadre au spawn.

## Clips

| id | act | loop | durée | first (stillStart) | last (stillEnd) | poseStart → poseEnd |
|---|---|---|---|---|---|---|
| breath-spawn | breath | oui | ~6s | spawn | spawn | spawn → spawn |
| breath-A | breath | oui | ~6s | atA | atA | atA → atA |
| breath-B | breath | oui | ~6s | atB | atB | atB → atB |
| walk-spawn-A | walk | non | ~10s | spawn | atA | spawn → atA |
| walk-spawn-B | walk | non | ~10s | spawn | atB | spawn → atB |
| walk-A-B | walk | non | ~8–10s | atA | atB | atA → atB |
| walk-B-A | walk | non | ~8–10s | atB | atA | atB → atA |

Walk A↔B optionnel. Si absent : depuis atA, tap B → stay breath-A (pas de trou).

## Imagine (cuisson)

- **Breath** : première frame = dernière frame = le still de la pose. **Loop seamless.** Pieds collés. Hall figé.
- **Walk** : première frame = still départ, dernière frame = still arrivée. Interpole. Un aller. Pas de loop.

## Cycle play

1. Open → **breath-spawn** loop.
2. Tap A → coupe le breath → **walk-spawn-A** (prefetch breath-A) → ended → **breath-A** loop.
3. Tap B → **walk-spawn-B** → **breath-B** loop.
4. De A tap B → **walk-A-B** → **breath-B** (si le clip existe).
5. De B tap A → **walk-B-A** → **breath-A**.

Pose avance à la **fin du clip**, jamais au tap.
Breath loop jusqu'au prochain walk. Un lap de breath ne recuit rien.
Never walk→walk. Ended(walk) **toujours** → breath(arrivée).
Premier breath après un walk : start à t=0.

## Join (transitions)

```
stillEnd(from) === stillStart(to)  →  cut (0 ms)
sinon                              →  dissolve ≤ 280 ms
```

Coutures qui doivent matcher (cut) :

- last(breath-spawn) = first(walk-spawn-A) = first(walk-spawn-B) = still spawn
- last(walk-spawn-A) = first(breath-A) = first(walk-A-B) = still atA
- last(walk-spawn-B) = first(breath-B) = first(walk-B-A) = still atB
- last(walk-A-B) = first(breath-B)
- last(walk-B-A) = first(breath-A)
- first(breath-X) = last(breath-X)  (loop)

Dissolve ne répare pas un encode. Si ça morph, le clip est FAIL — recuire first/last.

Trou noir interdit : ended / gap → montrer stillEnd tout de suite, préparer le next, cut ou dissolve court. Jamais écran vide.

## Hits

Picture 9:16, object-fit contain.
Gauche ~40% = A (teal). Droite ~40% = B (gold). Centre ~20% = miss.

## Hard locks

- Même plaque sur tous les clips.
- Bolt, objets, room, portes : never morph.
- Caméra lockée. Seul le chien bouge.
- Breath = pieds collés. Pas un walk-back vers spawn.
- Toujours deux portes, jamais une seule.
- Open = la room. Pas de menu, pas de Forge, pas de chrome.
