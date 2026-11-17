// Blocking no-fog check. A distance mix into the sky or the horizon fails.
// The sky shader's elevation gradient is not a distance mix.

const FOG_RE = [
  /mix\s*\(\s*col\s*,\s*horizon\b/,
  /mix\s*\(\s*col\s*,\s*skyColour\b/,
  /mix\s*\(\s*col\s*,\s*sky\b/,
  /\baerial\b/,
  /hazeAmt|fogDist|u\.fog\b/,
];

export function fogHits(src) {
  const hits = [];
  for (const re of FOG_RE) {
    if (re.test(src)) hits.push(re.source);
  }
  return hits;
}

// smoothstep / mix / scalar of distance on the shaded colour.
// A sky elevation gradient has no dist argument.
const DIST_STEP = /smoothstep\s*\([^)]*\bdist\b/;
const COL_SCALE = /col\s*=\s*col\s*\*|col\s*\*=|mix\s*\(\s*col\s*,/;

export function distColourHits(src) {
  const hits = [];
  if (DIST_STEP.test(src) && COL_SCALE.test(src)) hits.push('smoothstep(dist) scales col');
  if (/mix\s*\(\s*col\s*,\s*horizon\b/.test(src)) hits.push('mix(col, horizon)');
  return hits;
}
