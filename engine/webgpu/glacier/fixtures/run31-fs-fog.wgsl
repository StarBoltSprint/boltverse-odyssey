// Run 31 world-fragment tail. The no-fog gate must FAIL this text.
// Walls, arches, falls, and distant rock fade in by noise.
if ((m > 0.5 && m < 2.5) || (m > 5.5 && m < 7.5)) {
  let cover = smoothstep(460.0, 160.0, dist);
  let n = fract(sin(dot(v.p.xy, vec2f(12.9898, 78.233))) * 43758.5453);
  if (cover < n) { discard; }
}
let aerial = smoothstep(280.0, 6200.0, dist);
let horizon = skyColour(normalize(v.w - u.cam.xyz));
col = mix(col, horizon, aerial * 0.62);
if (m > 6.5 && m < 7.5) {
  let rim = pow(1.0 - ndv, 1.6) * smoothstep(0.0, 0.35, ndl);
  let head = max(col.r, max(col.g, col.b));
  col = col + vec3f(0.9, 0.36, 0.22) * rim * clamp(1.15 - head, 0.0, 1.0) * (1.0 - aerial * 0.25);
}
