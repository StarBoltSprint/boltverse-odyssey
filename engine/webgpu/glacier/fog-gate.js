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
