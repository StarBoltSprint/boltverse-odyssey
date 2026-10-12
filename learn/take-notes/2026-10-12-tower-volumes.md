# Take note — tower volumes — 2026-10-12

## Quota and turns

`python3 tools/quota/quota.py --log events.jsonl --step tower-volumes-1012` appended: turns 0, tool calls 0, image gens 0, video gens 0, tokens n/a, wall 7749.4 s. The event log does not carry turn or tool records, so those cells are the tool's zeros. Wall time is the log span, not a measured gate.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| Zone B hero facade volumes | hull/ship | one completed gate; mesh cooks before that exceeded two while UV was repaired | see quota row | rejected |

## This step

- Step: tower-volumes-1012
- Accepted because (command, row, numbers): not accepted. Gate exit 1, 5 FAIL. Oblique-profile PASS (bar 0.521 m, blocking ranges 0.60–4.50 m). Relief plane PASS. Morph IoU 0.914, float 0.00 m, UV 1.113, sealed open 0.
- Recipe appended (path, or `none`): `learn/recipes/oblique-profile-metre.md` (the check, not a KEEP mesh)
- Failure appended (heading in `learn/failures.md`, or `none`): 2026-10-12 centimetre AABB relief; 2026-10-12 shadow map vs probe colour; 2026-10-12 crispness 2–8 planes

## Biggest waste

Two full gate launches (~10 and ~12 minutes) died before geometry: a `const` used before initialization, then Playwright `page.evaluate` with two arguments. The third run (816 s) is the only score. Shadow stayed 0 after the caster was already in the shadow pass.

## Reuse next time

- Recipes to copy: `learn/recipes/oblique-profile-metre.md`
- Library ids to place (`tools/library`), instead of recooking: none
- Failures that would have caught this take earlier: the centimetre AABB entry, had it existed before fix4

## Added this take

- New recipes: `learn/recipes/oblique-profile-metre.md`
- New failure entries: three headings dated 2026-10-12 in `learn/failures.md`
