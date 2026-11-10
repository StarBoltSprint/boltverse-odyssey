// Column-major 4x4, matching follow-cam.js.

export function invertMat4(m) {
  const a = Array.from({ length: 4 }, (_, r) => {
    const row = [0, 0, 0, 0, 0, 0, 0, 0];
    for (let c = 0; c < 4; c++) row[c] = m[c * 4 + r];
    row[4 + r] = 1;
    return row;
  });
  for (let i = 0; i < 4; i++) {
    let p = i;
    for (let r = i + 1; r < 4; r++) if (Math.abs(a[r][i]) > Math.abs(a[p][i])) p = r;
    if (Math.abs(a[p][i]) < 1e-12) throw new Error('singular view');
    const tmp = a[i];
    a[i] = a[p];
    a[p] = tmp;
    const d = a[i][i];
    for (let c = i; c < 8; c++) a[i][c] /= d;
    for (let r = 0; r < 4; r++) {
      if (r === i) continue;
      const f = a[r][i];
      for (let c = i; c < 8; c++) a[r][c] -= f * a[i][c];
    }
  }
  const o = new Array(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) o[c * 4 + r] = a[r][4 + c];
  return o;
}
