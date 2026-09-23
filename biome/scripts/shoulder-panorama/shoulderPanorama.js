/**
 * Law 42 — shoulder panorama for whatever biome is already cooked.
 * Copy the numbers and the two GLSL strings. Do not recook Bolt or the road.
 * Do not add a fog veil. Do not stitch the wings offline. Do not run law 41 yaw
 * in the same frame (uYaw stays 0, uLook stays 0).
 */
export const SHOULDER_PANORAMA = {
  lookDenom: 0.42,
  lookEaseIn: 14,
  lookEaseBack: 10,
  lookEaseBoarded: 9,
  holdMs: 150,
  holdPx: 32,
  goDebounceMs: 90,
  openStart: 0.10,
  openEnd: 0.48,
  seamSky: 0.20,
  seamFloor: 0.48,
  coverStart: 0.012,
  coverEnd: 0.10,
  inwardLeft: 0.78,
  inwardRight: 0.22,
  horizonY: 0.58,
  boardX: 1,
  boardTweenMs: 380,
  exitTweenMs: 360,
  onEase: 5,
  flowPerSec: 0.72,
  ride: {
    alongDenom: 0.50,
    perspPow: 1.35,
    halfWNear: 0.016,
    halfWFar: 0.17,
    roadYHorizon: 0.54,
    roadYNear: 0.045,
    roadXScale: 0.36,
    roadXMin: 0.30,
    roadXMax: 0.70,
  },
};

/** Fragment mix. Paste inside `if (abs(uGlance) > 0.001)`. */
export const SEAM_FS = `
float mag = abs(uGlance);
float open = smoothstep(0.10, 0.48, mag);
float shift = uGlance * open;
float ruvx = screen.x + shift;
float sy = clamp(screen.y, 0.001, 0.999);
float floorK = 1.0 - smoothstep(0.38, 0.66, sy);
float seam = mix(0.20, 0.48, floorK);
float cover = smoothstep(0.012, 0.10, abs(shift));
float wSideL = ruvx < 0.0 ? 1.0 : (1.0 - smoothstep(0.0, seam, ruvx)) * cover;
float wSideR = ruvx > 1.0 ? 1.0 : smoothstep(1.0 - seam, 1.0, ruvx) * cover;
vec2 ruv = vec2(clamp(ruvx, 0.001, 0.999), sy);
vec3 rc = mix(texture2D(uRoad, ruv).rgb, texture2D(uRoadB, ruv).rgb, uMix);
float intoL = clamp(max(ruvx, 0.0) / max(seam, 0.001), 0.0, 1.0);
float sideLU = mix(ruvx + 1.0, 0.78, intoL);
float intoR = clamp(max(1.0 - ruvx, 0.0) / max(seam, 0.001), 0.0, 1.0);
float sideRU = mix(ruvx - 1.0, 0.22, intoR);
sideLU = clamp(sideLU, 0.001, 0.999);
sideRU = clamp(sideRU, 0.001, 0.999);
vec3 lc = texture2D(uSideL, vec2(sideLU, sy)).rgb;
vec3 qc = texture2D(uSideR, vec2(sideRU, sy)).rgb;
lc = ridePath(vec2(sideLU, sy), uOnL, uFlowL, lc);
qc = ridePath(vec2(sideRU, sy), uOnR, uFlowR, qc);
road = mix(rc, lc, clamp(wSideL, 0.0, 1.0));
road = mix(road, qc, clamp(wSideR, 0.0, 1.0));
`;

/** One ribbon on the wing. Scrolls only while hot > 0. */
export const RIDE_PATH_FS = `
vec3 ridePath(vec2 suv, float hot, float flow, vec3 vista) {
  float along = clamp((0.58 - suv.y) / 0.50, 0.0, 1.0);
  float persp = pow(max(along, 0.001), 1.35);
  float halfW = mix(0.016, 0.17, persp);
  float d = abs(suv.x - 0.5);
  float onLane = 1.0 - smoothstep(halfW * 0.82, halfW * 1.18, d);
  float span = smoothstep(0.03, 0.2, along);
  float roadY = mix(0.54, 0.045, persp);
  float roadX = clamp(0.5 + (suv.x - 0.5) * 0.36, 0.30, 0.70);
  vec3 plate = mix(texture2D(uRoad, vec2(roadX, roadY)).rgb, texture2D(uRoadB, vec2(roadX, roadY)).rgb, uMix);
  float tick = 1.0 - smoothstep(0.0, 0.18, abs(fract(persp * 5.0 - flow * 5.0) - 0.72));
  plate += vec3(0.72, 0.48, 0.85) * tick * hot;
  float core = 1.0 - smoothstep(0.0, halfW * 0.42, d);
  vec3 hinted = vista + vec3(0.75, 0.42, 0.68) * core * span * 0.22;
  vec3 riding = mix(vista, plate, onLane * span);
  return mix(hinted, riding, clamp(hot, 0.0, 1.0));
}
`;

/**
 * Wing prompt. Fill biomeLine with one sentence of THIS plate
 * (the light words already locked, not a new palette).
 * side: "left" puts the road off the right edge, and the reverse.
 */
export function wingPrompt(side, biomeLine) {
  const roadOff = side === "left" ? "right" : "left";
  return [
    "Continue this exact frame.",
    "Same camera height, same horizon line, same exposure, same colors.",
    `The road is now off the ${roadOff} edge of the frame.`,
    `Fill the frame with the world beside the road: ${biomeLine}`,
    "No extra lanes. No text. No mirror of the road.",
    "The world rushes toward the camera the way the road plate does.",
  ].join(" ");
}
