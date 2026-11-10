// One NIGHT rig for the crystal candidate. Every material uses these values.
// They are not fitted per texture. Imagine albedo bytes stay as authored.
// night-light.json is the only copy of the numbers.
import night from '../crystal/night-light.json' with { type: 'json' };

export const NIGHT = night;

export function luma(rgb) {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

// Linear irradiance. ny = 1 is a flat sun-facing surface. ny = 0 is a vertical face.
export function shadeAt(ndl, ny = 0, flatScale = NIGHT.flatScale) {
  const n = Math.min(1, Math.max(0, ndl));
  const up = Math.min(1, Math.max(0, ny));
  const face = 1 + (flatScale - 1) * up * up;
  const rgb = NIGHT.ambient.rgb.map((a, i) => a + NIGHT.moon.rgb[i] * NIGHT.moon.intensity * n * face);
  return { rgb, luma: luma(rgb) };
}

// Luma-preserving colour of a fully lit vertical face. Shared by gem and obsidian paths.
export function nightChroma() {
  const full = shadeAt(1, 0).rgb;
  const L = luma(full) || 1;
  return full.map((v) => v / L);
}

export function nightLightRecord() {
  return {
    name: NIGHT.name,
    biome: NIGHT.biome,
    ambient: { rgb: [...NIGHT.ambient.rgb] },
    moon: {
      rgb: [...NIGHT.moon.rgb],
      intensity: NIGHT.moon.intensity,
      direction: [...NIGHT.moon.direction],
    },
    flatScale: NIGHT.flatScale,
    sky: {
      zenith: [...NIGHT.sky.zenith],
      horizon: [...NIGHT.sky.horizon],
      nebulaViolet: [...NIGHT.sky.nebulaViolet],
      nebulaCyan: [...NIGHT.sky.nebulaCyan],
      star: [...NIGHT.sky.star],
      nebulaScale: NIGHT.sky.nebulaScale,
      starGrid: NIGHT.sky.starGrid,
      nebulaFloor: NIGHT.sky.nebulaFloor,
      nebulaHf: NIGHT.sky.nebulaHf,
      nebulaGain: NIGHT.sky.nebulaGain,
    },
  };
}

function v3(a) {
  return `vec3f(${a[0]}, ${a[1]}, ${a[2]})`;
}

export function nightWgsl() {
  const chr = nightChroma();
  return `
fn nightIrr(n: vec3f) -> vec3f {
  let ndl = clamp(dot(n, sunN()), 0.0, 1.0);
  let up = clamp(n.y, 0.0, 1.0);
  let face = mix(1.0, ${NIGHT.flatScale}, up * up);
  return ${v3(NIGHT.ambient.rgb)} + ${v3(NIGHT.moon.rgb)} * (${NIGHT.moon.intensity} * ndl * face);
}
fn nightChroma() -> vec3f { return ${v3(chr)}; }
fn nightTint(c: vec3f) -> vec3f {
  let t = c * nightChroma();
  let keep = dot(c, vec3f(0.2126, 0.7152, 0.0722));
  let got = max(dot(t, vec3f(0.2126, 0.7152, 0.0722)), 1e-4);
  return t * (keep / got);
}
`;
}
