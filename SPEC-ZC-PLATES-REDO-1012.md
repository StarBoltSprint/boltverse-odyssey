# Zone C plates redo: #6 and #8 only (`zc/04-plates`, 12 Oct, SmiR GO 06:38)

Zone C "Cascade Verdance". Redo **only** plates #6 and #8. The other 9 plates are validated by SmiR (see `steps/zone-c/04-plates/VALIDATED.md`) — **do not overwrite them**.

kit-gate: python3 steps/zone-c/04-plates/check-plates.py
<!-- kit-gate-outdir: steps/zone-c/04-plates -->

## Read first
GROK.md, docs/METHOD.md, learn/failures.md, `/workspace/x-live/chrome-game-home/.grok/bundled/skills/imagine/SKILL.md` (use `/bundled:imagine`), SPEC-ZC-PLATES-1012.md (original brief), `steps/zone-c/04-plates/REPORT.md`, `steps/zone-c/04-plates/VALIDATED.md`.

## Inputs (FIXED)
- Key: `steps/zone-c/04-plates/key-zc1.jpg` (or `/workspace/zc-bible-1011/key-zc1.jpg`)
- Existing crops in `steps/zone-c/04-plates/crops/` (reuse; re-crop only if needed for a tighter stone-band / right-wall cut)
- Validated reference: `plate-07-wall-left.jpg` (face-on left wall — style/structure for #8)
- Do **not** touch: plates 05, 07, 09, 10, 11, 12, 13, 14, 15

## Redo #6 — `plate-06-arch-right-inner.jpg`
**Problem:** previous outputs showed a view *through* the right arch ring, not an unfolded flat inner surface.

**Fix approach:**
1. With PIL, crop a tight band of the **right arch's carved stone + moss** from the key (the stone thickness / soffit material only — not the full opening, not the canyon beyond). Save as e.g. `crops/crop-arch-right-band.jpg`.
2. `image_edit` that crop. Prompt for a **flat, straight-on orthographic texture strip** of that same carved stone and moss, as if the inside surface were **unrolled flat**.
3. Hard rejects: no ring, no opening, no through-hole, no canyon/background landscape, no horizon, no sky. Fill the frame with stone+moss texture only.
4. Max **2** Imagine tries. Keep the better one as `plate-06-arch-right-inner.jpg`.

## Redo #8 — `plate-08-wall-right.jpg`
**Problem:** previous outputs kept cliff depth / perspective instead of face-on flat strata.

**Fix approach:**
1. Use `plate-07-wall-left.jpg` (validated) as style/structure reference **plus** a crop of the right wall from the key (`crops/crop-wall-right.jpg` or a tighter re-crop).
2. `image_edit`: same strata as the key's right wall, seen **perfectly face-on**, flat, fill frame. No depth, no recession, no sky, no canyon floor.
3. If the tool allows multi-reference or a second pass: also try **mirroring #7** + colour-matched right-wall crop as a fallback candidate; keep the better of flat-edit vs mirror+recolour.
4. Max **2** Imagine tries for the main edit path (mirror fallback may use 1 extra if needed; do not exceed 3 total Imagine calls for #8). Keep the better one as `plate-08-wall-right.jpg`.

## After replacements
1. Rebuild `sheet-plates.jpg` in **code** (PIL): key on top, 11 labelled thumbnails #5–#15 (same layout as before). Never generate the sheet with Imagine.
2. Refresh `SHA256SUMS` for the 11 plates + sheet + key copy.
3. Update `REPORT.md` (add a "Redo 06:38" section: calls used, which approach won for #6 and #8) and `numbers.json` (`imagine_calls` = previous 13 + new calls).
4. Run kit-gate: `python3 steps/zone-c/04-plates/check-plates.py` must PASS.

## Deliver
- Replaced #6 and #8 only; 9 validated files untouched
- Updated sheet, sums, REPORT, numbers
- Local commits on `zc/04-plates` only
- **Do NOT** push, merge, reset --hard, or feed plates into any 3D / solids / terrain step
- Do NOT touch other worktrees

Max effort: redo #6+#8 + sheet + gate. Stop when gate PASSes.
