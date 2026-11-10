// Negative and positive fixtures for the house texel rule. The floor is 2048.
import assert from 'node:assert/strict';
import {
  MIN_PX_PER_M, STRETCH_P99_MAX, pngHeader, gateBiome, gateSlot, triangleStretch, stretchP99,
} from './texel-gate.mjs';

const PAGE = `
const aniso = Math.min(8, 8);
dev.createSampler({ mipmapFilter: 'linear', maxAnisotropy: aniso });
const levels = 1; mipLevelCount = levels;
`;

function filesOf(spec) {
  const files = {};
  for (const [name, wh] of spec) files[name] = pngHeader(wh[0], wh[1]);
  return files;
}

function row(config, files, extra = {}) {
  const result = gateBiome(config, files, { pageSource: PAGE, ...extra });
  return result;
}

let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };

if (MIN_PX_PER_M !== 2048) bad('floor moved ' + MIN_PX_PER_M);

{
  const files = filesOf([['ground.png', [1024, 1024]]]);
  const result = row({
    materials: [{ id: 'ground', surfaceClass: 'ground', tileMetres: 3, files: [{ file: 'ground.png' }] }],
  }, files);
  const ground = result.rows[0];
  if (result.ok || ground.pass) bad('1024 px at 3 m passed');
  if (Math.round(ground.pxPerM) !== 341) bad('3 m px/m ' + ground.pxPerM);
  if (!ground.reasons.some((r) => r.includes('341') && r.includes('2048'))) bad('3 m reason ' + ground.reasons.join(';'));
}

{
  const files = filesOf([['ground.png', [1024, 1024]]]);
  const result = row({
    materials: [{ id: 'ground', surfaceClass: 'ground', tileMetres: 1, files: [{ file: 'ground.png' }] }],
  }, files);
  const ground = result.rows[0];
  if (ground.pass) bad('1024 px at 1 m passed');
  if (Math.round(ground.pxPerM) !== 1024) bad('1 m px/m ' + ground.pxPerM);
  if (!ground.reasons.some((r) => r.includes('under 2048'))) bad('1 m reason ' + ground.reasons.join(';'));
}

{
  const files = filesOf([
    ['a.png', [1024, 1024]],
    ['b.png', [1024, 1024]],
    ['c.png', [1024, 1024]],
  ]);
  const result = row({
    materials: [{
      id: 'crystal',
      surfaceClass: 'prop',
      tileMetres: 0.5,
      files: [{ file: 'a.png' }],
    }],
  }, files, { stretchById: new Map([['crystal', 1]]) });
  if (!result.ok || !result.rows[0].pass) bad('1024 px at 0.5 m should pass: ' + result.message);
  if (Math.round(result.rows[0].pxPerM) !== 2048) bad('0.5 m px/m ' + result.rows[0].pxPerM);
}

{
  const files = filesOf([['only.png', [2048, 2048]]]);
  const result = row({
    materials: [{ id: 'ground', surfaceClass: 'ground', tileMetres: 0.5, files: [{ file: 'only.png' }] }],
  }, files, { stretchById: new Map([['ground', 1]]) });
  if (result.rows[0].pass) bad('single-variant ground passed');
  if (!result.rows[0].reasons.some((r) => r.includes('variants 1'))) bad('variant reason ' + result.rows[0].reasons.join(';'));
}

{
  const files = filesOf([['big.png', [1024, 1024]]]);
  const result = row({
    materials: [{
      id: 'wall',
      surfaceClass: 'wall',
      tileMetres: 0.5,
      files: [
        { file: 'big.png', native: [512, 512] },
        { file: 'big.png', native: [512, 512] },
        { file: 'big.png', native: [512, 512] },
      ],
    }],
  }, files);
  if (result.rows[0].pass) bad('upscale passed');
  if (!result.rows[0].reasons.some((r) => r.includes('upscaled'))) bad('upscale reason ' + result.rows[0].reasons.join(';'));
}

{
  const files = filesOf([
    ['a.png', [2048, 2048]],
    ['b.png', [2048, 2048]],
    ['c.png', [2048, 2048]],
  ]);
  const result = row({
    materials: [{
      id: 'ground',
      surfaceClass: 'ground',
      tileMetres: 0.5,
      files: [{ file: 'a.png' }, { file: 'b.png' }, { file: 'c.png' }],
    }],
  }, files, { stretchById: new Map([['ground', 2]]) });
  if (result.rows[0].pass) bad('stretched UV passed');
  if (!result.rows[0].reasons.some((r) => r.includes('stretch'))) bad('stretch reason ' + result.rows[0].reasons.join(';'));
  if (!(2 > STRETCH_P99_MAX)) bad('stretch limit');
}

{
  const p0 = [0, 0, 0], p1 = [1, 0, 0], p2 = [0, 0, 1];
  const even = triangleStretch(p0, p1, p2, [0, 0], [1, 0], [0, 1], 1024, 1024);
  const stretched = triangleStretch(p0, p1, p2, [0, 0], [1, 0], [0, 0.2], 1024, 1024);
  if (!(even < 1.05)) bad('even triangle ' + even);
  if (!(stretched > STRETCH_P99_MAX)) bad('stretched triangle ' + stretched);
  const p99 = stretchP99([
    { stretch: even, area: 1 },
    { stretch: stretched, area: 100 },
  ]);
  if (p99 !== stretched) bad('p99 ' + p99);
}

{
  const files = filesOf([
    ['a.png', [1024, 1024]],
    ['b.png', [1024, 1024]],
    ['c.png', [1024, 1024]],
  ]);
  const result = row({
    minPxPerM: 512,
    materials: [{
      id: 'ground',
      surfaceClass: 'ground',
      tileMetres: 0.5,
      files: [{ file: 'a.png' }, { file: 'b.png' }, { file: 'c.png' }],
    }],
  }, files, { stretchById: new Map([['ground', 1]]) });
  if (result.ok) bad('lowered floor was accepted');
  if (!result.message.includes('cannot be lowered')) bad('override message ' + result.message);
  if (result.rows.length !== 0) bad('override still scored slots');
}

{
  const files = filesOf([
    ['a.png', [1024, 1024]],
    ['b.png', [1024, 1024]],
    ['c.png', [1024, 1024]],
  ]);
  const result = row({
    materials: [{
      id: 'ground',
      surfaceClass: 'ground',
      tileMetres: 0.5,
      files: [{ file: 'a.png' }, { file: 'b.png' }, { file: 'c.png' }],
    }],
  }, files, { stretchById: new Map([['ground', 1.2]]) });
  if (!result.ok) bad('positive ground failed: ' + result.message);
}

{
  const slot = gateSlot(
    { id: 'ground', surfaceClass: 'ground', tileMetres: 3, file: 'ground.png' },
    { 'ground.png': pngHeader(1024, 1024) },
    { minPxPerM: MIN_PX_PER_M, sampler: { ok: true }, stretchP99: 1 },
  );
  if (slot.variants !== 1) bad('legacy file was not one variant');
  if (slot.pass) bad('legacy 3 m file passed');
}

if (fail) {
  console.error('FAIL texel gate fixtures ' + fail);
  process.exit(1);
}
console.log('PASS texel gate fixtures');
assert.equal(fail, 0);
