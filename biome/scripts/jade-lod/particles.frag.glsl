// Law 53. Imagine cutout on the point. Not a colored disc.
// Missing sheet: discard. Do not ship a procedural blob.
// 0 mote moss-dust, 1 paw ember, 2 burst spark-dust. Premultiplied add.

precision mediump float;

varying float vKind;
varying float vAlpha;

uniform sampler2D uMote;
uniform sampler2D uPaw;
uniform sampler2D uBurst;
uniform float uHasMote;
uniform float uHasPaw;
uniform float uHasBurst;

void main() {
  if (vAlpha <= 0.0) discard;
  vec4 tex;
  if (vKind < 0.5) {
    if (uHasMote < 0.5) discard;
    tex = texture2D(uMote, gl_PointCoord);
  } else if (vKind < 1.5) {
    if (uHasPaw < 0.5) discard;
    tex = texture2D(uPaw, gl_PointCoord);
  } else {
    if (uHasBurst < 0.5) discard;
    tex = texture2D(uBurst, gl_PointCoord);
  }
  if (tex.a < 0.02) discard;
  float a = tex.a * vAlpha;
  gl_FragColor = vec4(tex.rgb * a, a);
}
