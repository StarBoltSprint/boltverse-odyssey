# vectorDespill

Measured-axis despill for Bolt Lane cutouts. Law: `biome/docs/13c-green-despill.md`.

```js
const { buildModel, despillPixel, despillSample } = require('./vectorDespill');

const model = buildModel(cycSamples, coatSamples, plateSamples);
const rgb = despillPixel([r, g, b], model, 0.75, edge); // edge 0=core, 1=fringe
```

Order: key → despill → premultiply → 1 px coverage blur → grade → contact on ribbon → grain.

Run: `node demo.js`
