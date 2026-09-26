// Law 45 flattened chain for one Imagine card. Kitchen. Not a world shader.
// sample → multiply FadeAlpha → discard Cutoff → premultiply.
// Lockstep with fade.ts: ALPHA_TEST 0.45 (mask), ALPHA_SKIP 0.02 (fade).
// Two instances, not one uber translucent shader:
//   Mask (rest): uCutout=1, uFadeAlpha=1, uCutoff=0.45. Clip writes depth. Unlit opaque.
//   Fade (≤8):   uCutout=0, uFadeAlpha=t, uCutoff=0.02. Premultiply. Material depth write stays off.
// Yaw (billboardYaw), meshLod (bandDraw), and the capsule are CPU. Not in this shader.
// Fog, tint, AtlasRect, MistColor, UnlitBoost are law 45 pins. This file is the alpha chain.
// Browser mask path: MeshBasicMaterial + alphaTest. Unreal graphs: M_CardJade / M_PlateGround.
// Front side only. The 70/30 billboard yaw already faces the camera.
// Blend instance: gl.blendFunc(ONE, ONE_MINUS_SRC_ALPHA).
// Expects vUv from the card quad. World pixels stay the Imagine sheet.

precision mediump float;

uniform sampler2D uMap;
uniform float uFadeAlpha;
uniform float uCutoff;
uniform float uCutout;

varying vec2 vUv;

void main() {
  vec4 tex = texture2D(uMap, vUv);
  float a = tex.a * uFadeAlpha;
  if (a < uCutoff) discard;
  if (uCutout > 0.5) {
    gl_FragColor = vec4(tex.rgb, 1.0);
  } else {
    gl_FragColor = vec4(tex.rgb * a, a);
  }
}
