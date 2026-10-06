# Take note — corridor nits — 2026-10-06

## Quota and turns

No session ndjson was in this cook, so `tools/quota/quota.py` was not run. No quota figure is invented.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| horizon break, seated rocks, whole monolith | other | 1 | n/a | accepted |

## This step

- Step: break the straight horizon with existing hulls and sky-sampled fog, sink every streamed rock, and keep the 28 m gate whole
- Accepted because (command, row, numbers): walk and sprint `drawCalls=7`, `texMB=184.5`, `activeVideos=4`, `fogOn` 1, `pawY` 0, `eyeY` 3.5. Walk rocks 13, sprint rocks 33, `gateLat` 16. Pass clip 720×1600, 72 frames, 24 fps, 3.0 s, pitch −0.159 → −0.141. `hang_selftest.py` exit 0. Twenty-four node tests pass. `renderlint` PASS.
- Recipe appended (path, or `none`): `learn/recipes/corridor-horizon-seat.md`
- Failure appended (heading in `learn/failures.md`, or `none`): `2026-10-06 — the ground met the sky in a straight line`; `2026-10-06 — a settled rock sat on the plane and the rise showed a gap`; `2026-10-06 — the 28 m gate was cut off, and a far offset left the lens`

## Biggest waste

The first pass clip started 108 m before the gate. The sprint look was only about 55 m, so the gate was not drawn and the clip showed an empty road. That is the gate-offset failure in `learn/failures.md`.

## Reuse next time

- Recipes to copy: `learn/recipes/corridor-horizon-seat.md`, `learn/recipes/corridor-horizon-ground.md`
- Library ids to place (`tools/library`), instead of recooking: zone A boulder and stone hulls, the Eclipse Gate loft, `packs/zone-a/src/sky/sky-0.jpg`
- Failures that would have caught this take earlier: a tall solid inside the forward cone, a rock base under the plane, and a gate screen test at the lens width

## Added this take

- New recipes: `learn/recipes/corridor-horizon-seat.md`
- New failure entries: the three headings above

LOD swaps were requested and then cancelled before any LOD code was added. This step did not change LOD.
