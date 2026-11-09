// Analytic height. Placement only. The same coefficients feed the shader.
// Slope is a property of the waves, measured by maxSlope, not painted.

export function makeHeight(spec) {
  const K = spec.K;
  const terms = spec.terms;
  return function height(x, z) {
    let h = 0;
    for (let i = 0; i < terms.length; i++) {
      const w = terms[i];
      const ax = Math.sin(x * K * w.fx + w.px);
      const az = w.z === 'cos' ? Math.cos(z * K * w.fz + w.pz) : Math.sin(z * K * w.fz + w.pz);
      h += w.a * ax * az;
    }
    return h;
  };
}

export function heightWgsl(spec, fnName = 'reachH') {
  const lines = termsWgsl(spec);
  return `fn ${fnName}(x: f32, z: f32) -> f32 {\n  let K = ${spec.K};\n  var h = 0.0;\n${lines}  return h;\n}\n`;
}

function termsWgsl(spec) {
  let s = '';
  for (const w of spec.terms) {
    const az = w.z === 'cos' ? `cos(z * K * ${w.fz} + ${w.pz})` : `sin(z * K * ${w.fz} + ${w.pz})`;
    s += `  h += ${w.a} * sin(x * K * ${w.fx} + ${w.px}) * ${az};\n`;
  }
  return s;
}

export function maxSlope(heightOf, x0, x1, z0, z1, step) {
  let m = 0;
  const e = step;
  for (let x = x0; x <= x1; x += step) {
    for (let z = z0; z <= z1; z += step) {
      const dx = (heightOf(x + e, z) - heightOf(x - e, z)) / (2 * e);
      const dz = (heightOf(x, z + e) - heightOf(x, z - e)) / (2 * e);
      const g = Math.hypot(dx, dz);
      if (g > m) m = g;
    }
  }
  return m;
}
