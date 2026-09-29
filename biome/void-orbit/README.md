# void-orbit

Free-flight prototype. Bolt, a black void, one warship. Not a lane cook.

Method, including every approach that failed: [../docs/57-void-orbit-ship-relief.md](../docs/57-void-orbit-ship-relief.md).

| path | what |
|---|---|
| `void-biome.ts` | Three.js play file. Camera, flight, shell, collision. |
| `bake-hull-depth.py` | Enclosed silhouette + chamfer thickness → `stills/ship-depth.png`. |
| `stills/ship-flank.jpg` | Skin. Side view, ship frozen, nose to the right. |
| `stills/ship-top.jpg` | Top still. Cooked. Not sampled by the phone shader. |
| `stills/ship-nose.jpg` | Front still. Cooked. Not sampled by the phone shader. |
| `stills/ship-depth.png` | R = thickness, G = enclosed mask. 192×108. |

This folder does not replace `biome/docs/44-imagine-volume-stack.md`.
