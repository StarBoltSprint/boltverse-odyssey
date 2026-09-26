// Law 53. Disc, discard, premultiplied add.
// 0 mote jade, 1 paw orange, 2 burst cyan. Not chrome. Not the world.

precision mediump float;

varying float vKind;
varying float vAlpha;

void main() {
  if (vAlpha <= 0.0) discard;
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r = dot(q, q);
  if (r > 1.0) discard;
  float a = (1.0 - r) * vAlpha;
  vec3 color = vec3(0.45, 0.85, 0.62);
  if (vKind > 0.5 && vKind < 1.5) color = vec3(0.95, 0.45, 0.12);
  if (vKind >= 1.5) color = vec3(0.35, 0.85, 0.95);
  gl_FragColor = vec4(color * a, a);
}
