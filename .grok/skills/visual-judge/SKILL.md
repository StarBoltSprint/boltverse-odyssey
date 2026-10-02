---
name: visual-judge
description: Gate a candidate still against 1-3 references and the owner taste log before the owner reviews it. Use before showing a new still, hull, ship, rock, or biome plate.
---

# Visual judge

A gate before owner review. Not a replacement for it. A judge score never overrides a hard law.

## Biome kit

The still was cooked from a kit preamble (`python3 tools/kits/kit.py show --id <kit-id>`). Palette hexes in the kit are prompt guidance. The judge does not score a still against a hex.

## Before the still

Read [`learn/taste.md`](../../../learn/taste.md). The Golden rule is the first section. The Style rules bind the cook. Do not round a shape so a numeric check will pass.

## Gate

```bash
python3 tools/judge/judge.py --candidate <still> --ref <ref> [--ref <ref>] [--ref <ref>] --dry-run --prompt-json <prompt.json>
python3 tools/judge/judge.py --candidate <still> --ref <ref>
```

1 to 3 references. The prompt includes the Golden rule and the taste log. Pass (exit 0) only when the reply is valid, `score` ≥ 7 (`--threshold` to change it), `keep` is true, and `matches_refs` is true. A bad reply exits 1.

Canonical references are [`tools/judge/references.json`](../../../tools/judge/references.json). Registration is [`tools/judge/references/README.md`](../../../tools/judge/references/README.md). The registry starts empty.

Offline check: `python3 tools/judge/selftest.py`.

## After the owner reacts

Append one row to [`learn/taste.md`](../../../learn/taste.md): date, the thing judged, verdict KEEP/FAIL/LOVE, the owner's words, the design lesson. Append only. Do not rewrite an old row. If the reaction changes a style rule, add a sentence under Style rules and keep the old row.
