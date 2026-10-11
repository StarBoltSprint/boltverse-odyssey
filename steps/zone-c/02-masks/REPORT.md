# Zone C — masks

SAM 2.1 Hiera small (Apache-2.0). Hand-checked on `masks-overlay.jpg`. Largest component only.

| Mask | What it is | Note |
|---|---|---|
| causeway | stone ribbon | central slabs, not the full lip |
| arch-left | left ring | the hole stays open; some cliff above the ring is included |
| arch-right | right ring | |
| cliff-left | left fall and its cliff | |
| falls-center | main fall and the cliff beside it | water and rock still share this mask |
| cliff-right | right spire | shaft only, point prompt |
| foliage-left / foliage-right | foreground plants | instance sources, not one solid |
| planet | planet disk | rings and the moon are outside the mask |

These masks name the solids. They are not a mesh, and they have not passed `object-gate`.

```bash
python3 tools/terrain-from-key/sam_masks.py --image key-zc1.jpg --out steps/zone-c/02-masks
```
