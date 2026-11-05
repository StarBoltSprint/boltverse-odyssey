// Numeric gate for the meadow capture route. No browser.
// Proves the mill stays ahead on the way in, and the path never enters the house.
import { makeRiver } from '../../engine/river.js';
import { makeMill } from '../../engine/watermill.js';
import { MEADOW } from '../../engine/biomes/meadow.js';
import { makeMeadowRoute } from '../../engine/bricks/meadow-route.js';
import { makeMeadowCollide } from '../../engine/bricks/collide.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const pathX = (z) => 6 + 9 * Math.sin(z * 0.021) + 4 * Math.sin(z * 0.053 + 1.3);
const terrH0 = (x, z) => {
  const h = 0.75 * Math.sin(x * 0.051 + z * 0.023) + 0.55 * Math.sin(-x * 0.031 + z * 0.067 + 1.7) + 0.22 * Math.sin(x * 0.13 + z * 0.11 + 0.4) + 0.12 * Math.sin(-x * 0.19 + z * 0.23 + 2.1);
  return h * ss(3, 18, Math.hypot(x, z)) - 0.10 * (1 - ss(0.6, 1.6, Math.abs(x - pathX(z)) * 0.93));
};
const RIV = makeRiver(MEADOW.river, terrH0);
const MILL = makeMill({ ...MEADOW.mill, river: RIV, h0: terrH0 });
const HX = MILL.house[0], HZ = MILL.house[1], WX = MILL.wheelXZ[0], WZ = MILL.wheelXZ[1];

const RK = 64, RCELL = 9, ROCKS = new Float32Array(RK * RK * 4);
{ let st = 0x9e3779b9; const rnd = () => { st ^= st << 13; st >>>= 0; st ^= st >>> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; };
  for (let i = 0; i < RK * RK; i++) { const e = rnd() < 0.16, ox = 0.25 + 0.5 * rnd(), oz = 0.25 + 0.5 * rnd(), r = 0.6 + 0.5 * rnd();
    ROCKS.set(e ? [ox, oz, r, 0] : [-1, -1, 0, 0], i * 4); } }
const rockCell = (cx, cz) => (((cz % RK) + RK) % RK) * RK + (((cx % RK) + RK) % RK);
const treeGrid = new Map();
for (const [x, z, r] of MILL.colliders) {
  const k = Math.floor(x / 16) + ',' + Math.floor(z / 16);
  if (!treeGrid.has(k)) treeGrid.set(k, []);
  treeGrid.get(k).push([x, z, r]);
}
const HC = makeMeadowCollide({ ROCKS, rockCell, RCELL, treeGrid, TREE_GRID: 16, boltR: 0.42, rockRadScale: 0.95, maxStep: 0.12, iters: 2 });

const SPEED = 7, DT = 1 / 240, D2R = Math.PI / 180;
const route = makeMeadowRoute({ ford: [-3.6, -40.5], house: MILL.house });
let psi = 0, x = 0, z = 0;
let minHouse = 1e9, minWheel = 1e9, maxW = 0, deep = 0, cone = 0;
let prevPsi = 0, maxStepYaw = 0;
const rows = [];
const fordOk = (px, pz) => Math.hypot(px + 3.6, pz + 40.5) < 6.5 || Math.hypot(px + 40.2, pz + 53.5) < 6.5;
for (let i = 0; i <= 45 / DT; i++) {
  const t = i * DT;
  const w = route.omega(x, z, psi);
  const dM = Math.hypot(x - HX, z - HZ), dW = Math.hypot(x - WX, z - WZ);
  const fx = -Math.sin(psi), fz = -Math.cos(psi);
  const bear = Math.atan2((HX - x) * fz - (HZ - z) * fx, (HX - x) * fx + (HZ - z) * fz) * 180 / Math.PI;
  const info = RIV.info(x, z);
  if (info.d < 1e8 && info.d < info.W - 0.85 && !fordOk(x, z)) deep++;
  if (Math.abs(bear) <= 16 && dM > 14 && dM < 48) cone++;
  minHouse = Math.min(minHouse, dM);
  minWheel = Math.min(minWheel, dW);
  maxW = Math.max(maxW, Math.abs(w));
  maxStepYaw = Math.max(maxStepYaw, Math.abs(ang(psi, prevPsi)));
  prevPsi = psi;
  if (Math.abs(t - Math.round(t)) < DT * 0.6) {
    rows.push({ t: Math.round(t), x: +x.toFixed(1), z: +z.toFixed(1), b: +bear.toFixed(0), dM: +dM.toFixed(1), dW: +dW.toFixed(1), riv: info.d > 80 ? null : +info.d.toFixed(1), ph: route.phase() });
  }
  psi += w * DT;
  x += -Math.sin(psi) * SPEED * DT;
  z += -Math.cos(psi) * SPEED * DT;
  const slid = HC.slide(x, z, psi);
  x = slid.x; z = slid.z;
  const wc = RIV.collide(x, z);
  x = wc[0]; z = wc[1];
}
function ang(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
const coneS = cone * DT;
const deepS = deep * DT;
const maxWdeg = maxW * 180 / Math.PI;
const report = { minHouse: +minHouse.toFixed(2), minWheel: +minWheel.toFixed(2), coneS: +coneS.toFixed(2), deepS: +deepS.toFixed(2), maxWdeg: +maxWdeg.toFixed(1), endPhase: route.phase(), rows };
const fails = [];
if (minHouse < 12) fails.push(`house clearance ${minHouse.toFixed(2)} < 12`);
if (minWheel < 11) fails.push(`wheel clearance ${minWheel.toFixed(2)} < 11`);
if (coneS < 2.4) fails.push(`mill-ahead cone ${coneS.toFixed(2)}s < 2.4`);
if (deepS > 0.35) fails.push(`deep water outside fords ${deepS.toFixed(2)}s`);
if (maxWdeg > 30) fails.push(`yaw rate ${maxWdeg.toFixed(1)} deg/s`);
if (route.phase() !== 'peel') fails.push(`end phase ${route.phase()}`);
console.log(JSON.stringify(report, null, 1));
if (fails.length) {
  console.error('FAIL', fails.join('; '));
  process.exit(1);
}
console.log('PASS meadow-route');
