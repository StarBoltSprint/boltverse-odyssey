# [tool-feedback] sealed and hidden-face rows passed a shredded grey phone

- Tool: tools/object-gate
- Tool version / commit: b8bd87c5 on `zc/05-solids`. Parent 61c032e4. The checks added in b8bd87c5 are `triangle-quality`, `untextured-area`, and `oblique-profile`.
- Take / branch and commit of the game being tested: branch `zc/05-solids`, Zone C solids clean, outdir `steps/zone-c/05-solids-clean/`
- Defect seen on screen: SmiR, solids2 on the phone — shredded triangle soup from noisy depth, textures flying, big untextured grey walls. The gate of that step still passed sealed and hidden-face rows.
- Metric the tool reported vs what was actually measured (both numbers): solids2 object-gate reported open 0 and non-manifold 0 and hidden-face PASS while the phone showed soup and grey. The new untextured row on the clean hull reports arch-left 8 m bad 65.42% (max 0.50%). The new triangle-quality row reports aspect p95 1.414 on that hull and 80.012 on a noisy depth fixture. Grounding still reports PASS for a mesh whose worst float is −0.80 m (arch-left) and −0.69 m (gorge-rock). The spec asked for 0.00 m.
- How to reproduce (the command): `node tools/object-gate/cli.mjs --scene tools/object-gate/specs/zone-c/solids-scene.yaml --out steps/zone-c/05-solids-clean/object-gate` against `http://127.0.0.1:8772/?along=0`. Self-test: `node tools/object-gate/selftest.mjs` (log `steps/zone-c/05-solids-clean/selftest.log`).
- Still / screenshot: `steps/zone-c/05-solids-clean/sheet-phone.jpg` and `steps/zone-c/05-solids-clean/oblique-sheet.jpg`
- Short video: none
- Proposed fix: keep triangle-quality, untextured-area, and oblique-profile blocking. Treat a negative float above a small epsilon as its own FAIL when the bar is 0.00 m, instead of folding it into “not floating”.
- Confirmation: no secrets, API keys, tokens, or private style prompts

Open this file as an issue: https://github.com/StarBoltSprint/boltverse-odyssey/issues/new?template=tool-feedback.yml
