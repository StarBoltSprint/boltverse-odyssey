// Cheap alpha for one Imagine card. Kitchen. Not a world shader.
// Lockstep with fade.ts: ALPHA_SKIP 0.02, ALPHA_TEST 0.45.
// Idle cutout. Mid-fade premultiplied blend. a < 0.02 discards.
// Resting trees stay on the cutout branch. Fill rate is the cost, not the curve.
// Front side only. The 70/30 billboard yaw already faces the camera.
// The capsule never samples this shader. Hit snaps in lod.ts.
//
// Remix uniforms: uMap, uAlpha (coverage 0..1), uCutout (1 cutout, 0 blend).
// Blend path: gl.blendFunc(ONE, ONE_MINUS_SRC_ALPHA).
// Expects vUv from the card quad. World pixels stay the Imagine sheet.

precision mediump float;

uniform sampler2D uMap;
uniform float uAlpha;
uniform float uCutout;

varying vec2 vUv;

void main() {
  vec4 tex = texture2D(uMap, vUv);
  float a = tex.a * uAlpha;
  if (a < 0.02) discard;
  if (uCutout > 0.5) {
    if (a < 0.45) discard;
    gl_FragColor = vec4(tex.rgb, 1.0);
  } else {
    gl_FragColor = vec4(tex.rgb * a, a);
  }
}
