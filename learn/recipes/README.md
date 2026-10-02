# Imagine recipes

A recipe is a cook that already passed its QC rows. The next biome copies that file instead of starting from a blank prompt.

Copy [`_template.md`](_template.md) to `learn/recipes/<kind>-<slug>.md` only after the rows pass. Then add one line to [`INDEX.md`](INDEX.md).

Kinds: `sky`, `ground tile`, `rock`, `hull/ship`, `cutout`.

Record the exact prompt that was sent, the CLI call (`generate` or `edit`, and which image was `image` versus `image_urls`), the measured pixel size, how many tries it took, the QC rows with their numbers, the take and commit, and the gotchas.

Do not invent a prompt. [`biome/docs/60-imagine-relief-panorama-method.md`](../../biome/docs/60-imagine-relief-panorama-method.md) states that the plate-0 prompt string was not stored. A missing prompt stays blank. It is not filled from memory.

Do not put API keys, tokens, or a player's private style prompt in a recipe. `{PAINT}` is the only style slot.

This directory starts with the template and the index. No filled recipe is checked in, because no stored cook in this repo has both an exact prompt and a pasted QC report that this kit can copy without guessing.
