const { buildModel, despillPixel } = require('./vectorDespill');

const model = buildModel(
  [[0.15, 0.85, 0.2], [0.12, 0.9, 0.18]],           // cyc
  [[0.82, 0.8, 0.78], [0.88, 0.86, 0.84]],          // coat
  [[0.6, 0.26, 0.11], [0.55, 0.22, 0.09]]           // ember plate wrap
);

const clean = [0.85, 0.83, 0.81];
const lime = [0.55, 0.95, 0.4];
const mint = [0.7, 0.85, 0.72];
const almost = [0.2, 0.88, 0.22];

function show(label, rgb, edge) {
  const out = despillPixel(rgb, model, 0.75, edge);
  console.log(
    label.padEnd(14),
    'in', rgb.map((x) => x.toFixed(2)).join(','),
    '→', out.map((x) => x.toFixed(2)).join(','),
    'edge', edge
  );
}

show('clean coat', clean, 0);
show('lime fringe', lime, 1);
show('mint ruff', mint, 0.3);
show('almost cyc', almost, 1);
