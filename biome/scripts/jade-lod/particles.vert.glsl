// Law 53. One Points draw. CPU wrote the births. This shader moves them.
// p = origin + vel * age + gravity(kind) * age * age
// Dead slots (age outside life) keep their attributes and draw at size 0.

attribute vec3 aOrigin;
attribute vec3 aVel;
attribute float aBirth;
attribute float aLife;
attribute float aSeed;
attribute float aKind;

uniform float uTime;
uniform mat4 uViewProj;
uniform float uSize;

varying float vKind;
varying float vAlpha;

vec3 gravity(float kind) {
  if (kind < 0.5) return vec3(0.0, 0.35, 0.0);
  if (kind < 1.5) return vec3(0.0, -2.4, 0.0);
  return vec3(0.0, 0.8, 0.0);
}

void main() {
  float age = uTime - aBirth;
  vKind = aKind;
  if (age < 0.0 || age > aLife) {
    vAlpha = 0.0;
    gl_PointSize = 0.0;
    gl_Position = vec4(0.0, 0.0, -1.0, 1.0);
    return;
  }
  float u = age / aLife;
  vec3 p = aOrigin + aVel * age + gravity(aKind) * age * age;
  vAlpha = 1.0 - u;
  gl_Position = uViewProj * vec4(p, 1.0);
  gl_PointSize = uSize * vAlpha * (0.85 + 0.3 * fract(aSeed));
}
