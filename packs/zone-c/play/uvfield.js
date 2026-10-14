/**
 * Surface-aware ground UV for the invisible relief. Numbers only, no pixels.
 *
 * Planar top-down UV (x / TILE, z / TILE) stretches each Imagine ground texel by 1 / cos(slope)
 * along the slope (1.19 at 33°, 1.6 on the rim berm). This solves, once at boot, a smooth UV
 * field whose gradient matches the surface metric: each grid edge wants the texture length
 * equal to its 3D length / TILE (the symmetric square root of I + ∇h∇hᵀ). Least squares over
 * the grid (conjugate gradient) spreads the part that a non-developable relief cannot flatten.
 * A few reweight rounds add texels where a cell still stretches, so stretch stays ≤ 1.
 * Texels may compress a little on crests (minification only, never magnification).
 * UV stays a fixed function of world position: tiles stay world-locked.
 */

export function solveSurfaceUv(opts) {
  const { macroAt, reach, n, tile, inside } = opts;
  const rounds = opts.rounds || 3;
  const iters = opts.iters == null ? 260 : opts.iters;
  const N = n + 1;
  const step = (2 * reach) / n;
  const gx = new Float32Array(N * N);
  const gz = new Float32Array(N * N);
  const wNode = new Float32Array(N * N);
  const focus = new Uint8Array(N * N);
  for (let iz = 0; iz < N; iz++) {
    for (let ix = 0; ix < N; ix++) {
      const x = -reach + ix * step;
      const z = -reach + iz * step;
      const e = step * 0.5;
      const k = iz * N + ix;
      const inn = inside(x, z);
      // Outside the mesh nothing is drawn: those nodes only carry a weak planar target.
      gx[k] = inn ? (macroAt(x + e, z) - macroAt(x - e, z)) / (2 * e) : 0;
      gz[k] = inn ? (macroAt(x, z + e) - macroAt(x, z - e)) / (2 * e) : 0;
      wNode[k] = inn ? 1 : 0.04;
      focus[k] = inn && (!opts.focus || opts.focus(x, z)) ? 1 : 0;
    }
  }
  // Edge targets: x-edges (ix → ix+1) and z-edges (iz → iz+1), midpoint metric.
  const ex = { du: new Float32Array(N * N), dv: new Float32Array(N * N), w: new Float32Array(N * N) };
  const ez = { du: new Float32Array(N * N), dv: new Float32Array(N * N), w: new Float32Array(N * N) };
  const boost = new Float32Array(N * N).fill(1);
  const sqrtMetric = (a, b, out) => {
    const g2 = a * a + b * b;
    const c = g2 > 1e-12 ? (Math.sqrt(1 + g2) - 1) / g2 : 0.5;
    out[0] = 1 + c * a * a;
    out[1] = c * a * b;
    out[2] = 1 + c * b * b;
  };
  const m = [0, 0, 0];
  function buildTargets() {
    for (let iz = 0; iz < N; iz++) {
      for (let ix = 0; ix < N; ix++) {
        const k = iz * N + ix;
        if (ix < n) {
          const k2 = k + 1;
          sqrtMetric((gx[k] + gx[k2]) * 0.5, (gz[k] + gz[k2]) * 0.5, m);
          const s = (step / tile) * 0.5 * (boost[k] + boost[k2]);
          ex.du[k] = m[0] * s;
          ex.dv[k] = m[1] * s;
          ex.w[k] = Math.min(wNode[k], wNode[k2]);
        }
        if (iz < n) {
          const k2 = k + N;
          sqrtMetric((gx[k] + gx[k2]) * 0.5, (gz[k] + gz[k2]) * 0.5, m);
          const s = (step / tile) * 0.5 * (boost[k] + boost[k2]);
          ez.du[k] = m[1] * s;
          ez.dv[k] = m[2] * s;
          ez.w[k] = Math.min(wNode[k], wNode[k2]);
        }
      }
    }
  }
  const EPS = 2e-4;
  // A·x for the weighted grid Laplacian + EPS·x (EPS pins the free offset).
  function applyA(xv, out) {
    for (let iz = 0; iz < N; iz++) {
      for (let ix = 0; ix < N; ix++) {
        const k = iz * N + ix;
        let acc = EPS * xv[k];
        if (ix < n) acc += ex.w[k] * (xv[k] - xv[k + 1]);
        if (ix > 0) acc += ex.w[k - 1] * (xv[k] - xv[k - 1]);
        if (iz < n) acc += ez.w[k] * (xv[k] - xv[k + N]);
        if (iz > 0) acc += ez.w[k - N] * (xv[k] - xv[k - N]);
        out[k] = acc;
      }
    }
  }
  function rhs(dE, dZ, prior, out) {
    for (let iz = 0; iz < N; iz++) {
      for (let ix = 0; ix < N; ix++) {
        const k = iz * N + ix;
        let acc = EPS * prior[k];
        if (ix < n) acc -= ex.w[k] * dE[k];
        if (ix > 0) acc += ex.w[k - 1] * dE[k - 1];
        if (iz < n) acc -= ez.w[k] * dZ[k];
        if (iz > 0) acc += ez.w[k - N] * dZ[k - N];
        out[k] = acc;
      }
    }
  }
  const diag = new Float32Array(N * N);
  function buildDiag() {
    for (let iz = 0; iz < N; iz++) {
      for (let ix = 0; ix < N; ix++) {
        const k = iz * N + ix;
        let d = EPS;
        if (ix < n) d += ex.w[k];
        if (ix > 0) d += ex.w[k - 1];
        if (iz < n) d += ez.w[k];
        if (iz > 0) d += ez.w[k - N];
        diag[k] = d;
      }
    }
  }
  const r = new Float64Array(N * N);
  const z = new Float64Array(N * N);
  const p = new Float64Array(N * N);
  const Ap = new Float64Array(N * N);
  const b = new Float64Array(N * N);
  function cg(xv, maxIt) {
    applyA(xv, Ap);
    let rz = 0;
    for (let i = 0; i < xv.length; i++) {
      r[i] = b[i] - Ap[i];
      z[i] = r[i] / diag[i];
      p[i] = z[i];
      rz += r[i] * z[i];
    }
    for (let it = 0; it < maxIt && rz > 1e-14; it++) {
      applyA(p, Ap);
      let pAp = 0;
      for (let i = 0; i < xv.length; i++) pAp += p[i] * Ap[i];
      const alpha = rz / pAp;
      let rz2 = 0;
      for (let i = 0; i < xv.length; i++) {
        xv[i] += alpha * p[i];
        r[i] -= alpha * Ap[i];
        z[i] = r[i] / diag[i];
        rz2 += r[i] * z[i];
      }
      const beta = rz2 / rz;
      rz = rz2;
      for (let i = 0; i < xv.length; i++) p[i] = z[i] + beta * p[i];
    }
  }
  const u = new Float64Array(N * N);
  const v = new Float64Array(N * N);
  const pu = new Float64Array(N * N);
  const pv = new Float64Array(N * N);
  for (let iz = 0; iz < N; iz++) {
    for (let ix = 0; ix < N; ix++) {
      const k = iz * N + ix;
      pu[k] = (-reach + ix * step) / tile;
      pv[k] = (-reach + iz * step) / tile;
      u[k] = pu[k];
      v[k] = pv[k];
    }
  }
  const stretch = new Float32Array(N * N);
  const squash = new Float32Array(N * N);
  function measure() {
    let worst = 0;
    let least = 9;
    for (let iz = 0; iz < N; iz++) {
      for (let ix = 0; ix < N; ix++) {
        const k = iz * N + ix;
        const ka = ix < n ? k : k - 1;
        const kb = iz < n ? k : k - N;
        const dudx = (u[ka + 1] - u[ka]) * tile / step;
        const dvdx = (v[ka + 1] - v[ka]) * tile / step;
        const dudz = (u[kb + N] - u[kb]) * tile / step;
        const dvdz = (v[kb + N] - v[kb]) * tile / step;
        // A = JᵀJ (texture metric), G = I + ggᵀ (surface metric). Stretch = sqrt(λmax(A⁻¹G)).
        const a00 = dudx * dudx + dvdx * dvdx;
        const a01 = dudx * dudz + dvdx * dvdz;
        const a11 = dudz * dudz + dvdz * dvdz;
        const g00 = 1 + gx[k] * gx[k];
        const g01 = gx[k] * gz[k];
        const g11 = 1 + gz[k] * gz[k];
        const detA = Math.max(1e-9, a00 * a11 - a01 * a01);
        const detG = g00 * g11 - g01 * g01;
        const bb = g00 * a11 + g11 * a00 - 2 * g01 * a01;
        const disc = Math.sqrt(Math.max(0, bb * bb - 4 * detA * detG));
        const lmax = (bb + disc) / (2 * detA);
        const lmin = (bb - disc) / (2 * detA);
        stretch[k] = Math.sqrt(Math.max(0, lmax));
        squash[k] = Math.sqrt(Math.max(0, lmin));
        const allIn = wNode[k] >= 1 && wNode[ka] >= 1 && wNode[ka + 1] >= 1 && wNode[kb] >= 1 && wNode[kb + N] >= 1;
        if (allIn && focus[k]) {
          if (stretch[k] > worst) worst = stretch[k];
          if (squash[k] < least) least = squash[k];
        }
      }
    }
    return { worst, least };
  }
  let planarWorst = 0;
  for (let k = 0; k < N * N; k++) {
    if (focus[k]) planarWorst = Math.max(planarWorst, Math.sqrt(1 + gx[k] * gx[k] + gz[k] * gz[k]));
  }
  let stats = null;
  const history = [];
  for (let round = 0; round < rounds; round++) {
    buildTargets();
    buildDiag();
    rhs(ex.du, ez.du, pu, b);
    const it = round === 0 ? iters : (opts.itersRefine || Math.ceil(iters / 3));
    cg(u, it);
    rhs(ex.dv, ez.dv, pv, b);
    cg(v, it);
    stats = measure();
    history.push(stats.worst);
    if (stats.worst <= opts.stretchMax) break;
    // Reweight: cells that still stretch get proportionally more texels next round.
    for (let k = 0; k < N * N; k++) {
      if (focus[k] && stretch[k] > opts.stretchMax * 0.995) boost[k] *= Math.min(1.25, stretch[k] / (opts.stretchMax * 0.995));
    }
    // Spread the boost so it stays smooth (two box passes).
    for (let pass = 0; pass < 2; pass++) {
      const t = Float32Array.from(boost);
      for (let iz = 1; iz < n; iz++) {
        for (let ix = 1; ix < n; ix++) {
          const k = iz * N + ix;
          boost[k] = Math.max(t[k], (t[k] * 4 + t[k - 1] + t[k + 1] + t[k - N] + t[k + N]) / 8);
        }
      }
    }
  }
  return {
    reach, n, step, N,
    u: Float32Array.from(u),
    v: Float32Array.from(v),
    stretch,
    squash,
    worst: stats.worst,
    least: stats.least,
    planarWorst,
    history,
  };
}

function bilerp(arr, f, x, z) {
  const gx = (x + f.reach) / f.step;
  const gz = (z + f.reach) / f.step;
  const ix = Math.max(0, Math.min(f.n - 1, Math.floor(gx)));
  const iz = Math.max(0, Math.min(f.n - 1, Math.floor(gz)));
  const tx = Math.max(0, Math.min(1, gx - ix));
  const tz = Math.max(0, Math.min(1, gz - iz));
  const k = iz * f.N + ix;
  const a = arr[k] * (1 - tx) + arr[k + 1] * tx;
  const c = arr[k + f.N] * (1 - tx) + arr[k + f.N + 1] * tx;
  return a * (1 - tz) + c * tz;
}

/** UV (tile units) at a world point; planar outside the solved grid. */
export function uvOf(f, x, z, tile, out) {
  if (!f || Math.abs(x) > f.reach || Math.abs(z) > f.reach) {
    out[0] = x / tile;
    out[1] = z / tile;
    return out;
  }
  out[0] = bilerp(f.u, f, x, z);
  out[1] = bilerp(f.v, f, x, z);
  return out;
}

/** Residual texel stretch of the solved UV at a world point (1 = true size). */
export function stretchOf(f, x, z) {
  if (!f || Math.abs(x) > f.reach || Math.abs(z) > f.reach) return 1;
  return bilerp(f.stretch, f, x, z);
}
