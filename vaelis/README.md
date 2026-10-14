# Vaelis

Survey cruiser, modeled as a solid lofted hull (not a flat image).

This folder is the app source. It does not replace the rest of boltverse-odyssey.

- `src/ship/geo.ts` — hull stations, loft, wings, nozzles, plumes
- `src/ship/scene.tsx` — WebGL scene, materials, hangar, cutaway, flight camera
- `src/ship/soft.tsx` — same mesh, drawn without WebGL when the GPU cannot start
- `src/ship/flight.ts` — thrust, yaw, pitch
- `src/routes/index.tsx` — page and controls
- `public/textures/hull.jpg` — plating map wrapped on the hull and wings
- `public/ref/` — hangar study, side elevation, camera-drift film

Branch `grok/vaelis-ref` only. Not merged to the default branch.
