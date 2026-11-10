// Blocking texel gate. MIN_PX_PER_M is not a biome setting.
import fs from 'fs';

export const MIN_PX_PER_M = 2048;
export const MAX_STRETCH = 1.3;

export function jpegSize(file) {
  const b = fs.readFileSync(file);
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    }
    const len = b.readUInt16BE(i + 2);
    i += 2 + len;
  }
  throw new Error('jpeg size ' + file);
}

// metres is how much world one texture repeat covers in the shader.
// A 1024 image authored for 0.5 m is 2048 px/m and stretch 1 when the repeat is 0.5 m.
// A 1024 image repeated over 1 m is 1024 px/m and stretch 2, and must fail.
export function texelRow({ name, width, height, metres, variants, minVariants }) {
  const pxPerM = Math.min(width, height) / metres;
  const authoredMetres = Math.min(width, height) / MIN_PX_PER_M;
  const stretch = metres / authoredMetres;
  const fails = [];
  if (!(pxPerM + 1e-6 >= MIN_PX_PER_M)) fails.push('px/m ' + pxPerM.toFixed(1));
  if (!(stretch <= MAX_STRETCH)) fails.push('stretch ' + stretch.toFixed(3));
  if (variants < minVariants) fails.push('variants ' + variants + ' < ' + minVariants);
  return {
    name,
    nativeW: width,
    nativeH: height,
    metres,
    pxPerM: +pxPerM.toFixed(1),
    stretch: +stretch.toFixed(3),
    variants,
    minVariants,
    fails,
    pass: fails.length === 0,
  };
}
