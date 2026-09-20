const {
  resamplePath,
  ribbonPoint,
  assertTable,
} = require('./curvatureSample');

// Hand-drawn-ish Crystal Highway: long straight, then a hook.
const path = {
  kind: 'catmull',
  alpha: 0.5,
  points: [
    [0.5, 0.92],
    [0.5, 0.78],
    [0.5, 0.62],
    [0.51, 0.5],
    [0.58, 0.4],
    [0.72, 0.34],
    [0.84, 0.28],
    [0.9, 0.18],
  ],
};

const opts = {
  samplesPerSpan: 20,
  thetaMaxDeg: 8,
  ellMax: 0.05,
  nShip: 48,
  nMin: 16,
  width: 0.06,
  windows: [
    { s: 0.12, side: 'L' },
    { s: 0.72, side: 'R' },
  ],
};

const table = resamplePath(path, opts);
const issues = assertTable(table, opts);

console.log('fine samples :', table.fineCount);
console.log('kept samples :', table.keepCount);
console.log('path length  :', table.length.toFixed(4), 'UV');
console.log('kappa max    :', Math.max(...table.kappa).toFixed(2));
console.log('kappa mean   :', (table.kappa.reduce((a, b) => a + b, 0) / table.kappa.length).toFixed(2));
console.log('asserts      :', issues.length ? issues.join('; ') : 'ok');
console.log('');
console.log('s      u      v      kappa    |T turn|');
for (let i = 0; i < table.points.length; i++) {
  const [u, v] = table.points[i];
  let turn = 0;
  if (i > 0) {
    const a = table.normals[i - 1];
    const b = table.normals[i];
    turn = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1])));
  }
  console.log(
    table.s[i].toFixed(3),
    u.toFixed(3),
    v.toFixed(3),
    table.kappa[i].toFixed(2).padStart(6),
    ((turn * 180) / Math.PI).toFixed(1).padStart(6)
  );
}

const foot = ribbonPoint(table, 0.72, 1);
const center = ribbonPoint(table, 0.72, 0);
console.log('\nlane R at s=0.72', foot.map((x) => x.toFixed(3)).join(', '));
console.log('center  at s=0.72', center.map((x) => x.toFixed(3)).join(', '));
