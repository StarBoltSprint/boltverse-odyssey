# Biome factory

Shared house modules for an isolated WebGPU candidate. A biome passes a light record in the `night-light.json` shape, a world-anchored procedural sky, and the rendered colour gate. The factory does not release and it does not write KEEP.

```bash
node engine/webgpu/biome-factory/make.mjs --biome glacier
node engine/webgpu/glacier/test-cpu.mjs
node engine/webgpu/glacier/test-holes.mjs
node engine/webgpu/glacier/test-colour.mjs
node engine/webgpu/glacier/test-sky.mjs
node engine/webgpu/glacier/test-defects.mjs <frame.jpg>
node engine/webgpu/glacier/capture.mjs
```

`make.mjs` exits 2 while the verdict is HOLD. Exit 1 is a hard failure. CIE76 stays 10 and includes lightness. The sky limit stays 0.015. Pure black stays 0.0003. The grid peak stays 1.8. A negative control must fail each of those. The phone budget stays 200k triangles and 12 draws.

The glacier page does not paint unless the URL carries `candidate=glacier-abyss-dawn`. It is not wired into a live route.
