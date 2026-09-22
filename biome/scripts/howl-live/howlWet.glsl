// Howl wet GPU — law 34. Luma key on black KEEP. Plate bounce + road sit.
// Two passes: uGlow=1 ADD (expanded), uGlow=0 premul core.
// KEEP: biome/fx/howl/howl-attack.mp4  (do not shader the rings)

// --- vs ---
attribute vec2 a;
uniform vec2 uA;
uniform vec2 uB;
uniform vec2 uC;
uniform vec2 uD;
uniform vec2 uTrauma;
varying vec2 vUv;
varying vec2 vScreen;
void main() {
  vec2 uv = a * 0.5 + 0.5;
  vec2 mouth = mix(uA, uC, uv.y);
  vec2 rock = mix(uB, uD, uv.y);
  vec2 pos = mix(mouth, rock, uv.x) + uTrauma;
  vUv = uv;
  vScreen = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}

// --- fs ---
precision mediump float;
uniform sampler2D uHowl;
uniform sampler2D uPlate;
uniform float uGain;
uniform float uGlow;
varying vec2 vUv;
varying vec2 vScreen;
void main() {
  vec2 uv = vUv;
  vec4 p0 = texture2D(uHowl, uv);
  vec4 p1 = texture2D(uHowl, clamp(uv + vec2(0.010, 0.0), 0.0, 1.0));
  vec4 p2 = texture2D(uHowl, clamp(uv - vec2(0.010, 0.0), 0.0, 1.0));
  vec4 p3 = texture2D(uHowl, clamp(uv + vec2(0.0, 0.008), 0.0, 1.0));
  vec4 p4 = texture2D(uHowl, clamp(uv - vec2(0.0, 0.008), 0.0, 1.0));
  float glow = uGlow;
  vec3 raw = mix(p0.rgb, (p0.rgb * 0.46 + p1.rgb * 0.16 + p2.rgb * 0.16 + p3.rgb * 0.11 + p4.rgb * 0.11), mix(0.22, 0.72, glow));
  float luma = dot(raw, vec3(0.2126, 0.7152, 0.0722));
  float a = mix(
    smoothstep(0.020, 0.22, luma),
    smoothstep(0.006, 0.26, luma),
    glow
  );
  float edge = 1.0 - a;
  a *= mix(0.74, 0.50, glow);
  vec3 pA = texture2D(uPlate, clamp(vScreen, 0.0, 1.0)).rgb;
  vec3 pB = texture2D(uPlate, clamp(vScreen + vec2(0.016, 0.0), 0.0, 1.0)).rgb;
  vec3 pC = texture2D(uPlate, clamp(vScreen - vec2(0.016, 0.0), 0.0, 1.0)).rgb;
  vec3 plate = (pA + pB + pC) / 3.0;
  float pLuma = max(dot(plate, vec3(0.2126, 0.7152, 0.0722)), 0.06);
  float pG = plate.g - max(plate.r, plate.b);
  float neonM = smoothstep(0.035, 0.14, pG);
  vec3 bounceSrc = mix(plate, vec3(pLuma), neonM);
  vec3 bounce = bounceSrc / pLuma;
  vec3 c = raw;
  c *= mix(vec3(1.0), bounce, mix(0.58, 0.72, glow));
  c = mix(c, bounceSrc, 0.26 * edge * edge);
  vec3 sky = texture2D(uPlate, vec2(0.50, 0.80)).rgb;
  vec3 road = texture2D(uPlate, clamp(vScreen + vec2(0.0, -0.04), 0.0, 1.0)).rgb;
  vec3 wet = texture2D(uPlate, clamp(vScreen + vec2(0.0, -0.09), 0.0, 1.0)).rgb;
  c = mix(c, wet, 0.20 * (1.0 - glow));
  c += sky * 0.05 * a;
  c += road * luma * mix(0.12, 0.46, glow);
  c += wet * 0.16 * glow;
  c *= uGain;
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) * (0.012 + 0.034 * edge) * a;
  float outA = mix(a * 0.88, 0.0, glow);
  float energy = mix(0.78, 0.28, glow);
  gl_FragColor = vec4(c * a * energy, outA);
}

// Live drawHowl (bolt-key-gl.ts):
//   glow pass: dest * 2.18, blendFunc(ONE, ONE), uGlow=1
//   core pass: exact beam, blendFunc(ONE, ONE_MINUS_SRC_ALPHA), uGlow=0
