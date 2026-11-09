// Scripted before/after for the foot-contact brick.
//   node engine/webgpu/candidates/foot-lock/measure.mjs
// Writes proof/metrics.json and proof/poses-locked.json (12 fps, for the raster).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { makeFootContact, scriptInput, SCRIPT_SECONDS } from "../../engine/footcontact.js";
import { MEADOW_FEET, CANYON_FEET } from "./biomes.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const contactsDoc = JSON.parse(fs.readFileSync(path.join(here, "contacts.json"), "utf8"));
const contacts = contactsDoc.framesContacts;
const DT = 1 / 60;
const POSE_DT = 1 / 12;

function lookAt(e, c, up) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
  const f = norm(sub(c, e)), s = norm(cross(f, up)), u = cross(s, f);
  return [s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0, -dot(s, e), -dot(u, e), dot(f, e), 1];
}
function persp(fovy, asp, n, f) {
  const t = 1 / Math.tan(fovy / 2);
  return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, f / (n - f), -1, 0, 0, n * f / (n - f), 0];
}
function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function ndcOf(vp, p) {
  const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
  const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
  const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  return [x / w, y / w];
}

function stats(arr) {
  if (!arr.length) return { n: 0, mean: null, max: null };
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return { n: arr.length, mean, max: Math.max(...arr) };
}
const cm = m => (m == null ? null : m * 100);
const round = (v, n = 3) => (v == null || Number.isNaN(v) ? null : +v.toFixed(n));

function run(label, biome, { dump = false } = {}) {
  const fc = makeFootContact({ ...biome, contacts, idleFrame: biome.lock ? contactsDoc.idleFrame : 0 });
  const s = fc.create({ v: biome.speed, phase: 0 });
  const buckets = {};
  const torso = [];
  const shift = [];
  const scales = [];
  const screenX = [];
  const idleDy = [];
  const idleLift = [];
  const idlePaws = [];
  let lockWMin = 1;
  let reach = 0;
  let phaseAt1 = null;
  let movedStraight = 0, phaseStraight = 0;
  const poses = [];
  let acc = 0;
  const aspect = 720 / 1280;
  const proj = persp(62 * Math.PI / 180, aspect, 0.05, 200);
  for (let i = 0, t = 0; t < SCRIPT_SECONDS - 1e-9; i++, t += DT) {
    const input = scriptInput(t);
    const beforePhase = s.phase;
    const beforeDist = s.dist;
    fc.step(s, DT, input);
    const pose = fc.pose(s);
    if (t + DT >= 1 && phaseAt1 == null) phaseAt1 = s.phase;
    if (input.seg === "straight") {
      movedStraight += s.dist - beforeDist;
      let dp = s.phase - beforePhase;
      if (dp < 0) dp += 1;
      phaseStraight += dp;
    }
    let seg = input.seg;
    if (seg === "release") seg = pose.v > 0 ? "brake" : (pose.idle ? "idle" : "settle");
    const bag = buckets[seg] || (buckets[seg] = { slide: [], mesh: [] });
    for (const sl of pose.slides) if (sl.slideM != null) bag.slide.push(sl.slideM);
    for (const m of pose.mesh) if (m.slideM != null) bag.mesh.push(m.slideM);
    torso.push(pose.torsoH);
    shift.push(pose.torsoShift);
    scales.push(pose.scale);
    const vp = mul(proj, lookAt(pose.eye, pose.target, [0, 1, 0]));
    const ndc = ndcOf(vp, [s.x, 0.7, s.z]);
    screenX.push(0.5 + ndc[0] * 0.5);
    if (pose.lockWMin < lockWMin) lockWMin = pose.lockWMin;
    for (const p of pose.paws) reach = Math.max(reach, Math.hypot(p.x - s.x, p.z - s.z));
    if (seg === "idle") {
      if (pose.flatDy != null) idleDy.push(pose.flatDy);
      if (pose.lift != null) idleLift.push(pose.lift);
      idlePaws.push(pose.paws.length);
    }
    acc += DT;
    if (dump && acc + 1e-9 >= POSE_DT) {
      acc = 0;
      poses.push({
        t: +t.toFixed(4),
        seg,
        frame: pose.frame,
        blend: pose.blend,
        pos: Array.from(pose.pos),
        eye: pose.eye,
        target: pose.target,
      });
    }
  }
  const torsoS = stats(torso);
  const out = {
    label,
    biome: biome.id,
    lock: !!biome.lock,
    fog: fc.cfg.fog,
    strideM: round(fc.cfg.strideM, 4),
    phaseAfter1s: round(phaseAt1, 4),
    phasePerMetreStraight: round(phaseStraight / movedStraight, 4),
    expectedPhasePerMetre: round(1 / fc.cfg.strideM, 4),
    screenX: round(stats(screenX).mean, 4),
    screenXStd: round(stats(screenX).mean == null ? null : Math.sqrt(screenX.reduce((a, x) => a + (x - stats(screenX).mean) ** 2, 0) / screenX.length), 5),
    scaleMean: round(stats(scales).mean, 4),
    torsoHcm: { mean: round(cm(torsoS.mean), 3), std: round(cm(Math.sqrt(torso.reduce((a, x) => a + (x - torsoS.mean) ** 2, 0) / torso.length)), 4), maxShift: round(cm(stats(shift).max), 4) },
    segments: {},
    lockWMin: round(lockWMin, 4),
    maxSoleReachM: round(reach, 3),
    idle: {
      frames: idlePaws.length,
      pawsMean: round(idlePaws.length ? idlePaws.reduce((a, b) => a + b, 0) / idlePaws.length : null, 3),
      soleDyCm: round(cm(stats(idleDy).mean), 3),
      soleDyMaxCm: round(cm(stats(idleDy).max), 3),
      soleLiftCm: round(cm(stats(idleLift).mean), 3),
    },
  };
  // screenX std was computed with a second stats() call that reallocates mean. Recompute cleanly.
  const sxMean = screenX.reduce((a, b) => a + b, 0) / screenX.length;
  out.screenX = round(sxMean, 4);
  out.screenXStd = round(Math.sqrt(screenX.reduce((a, x) => a + (x - sxMean) ** 2, 0) / screenX.length), 5);
  for (const seg of ["straight", "turnL", "turnR", "brake", "settle", "idle"]) {
    const bag = buckets[seg] || { slide: [], mesh: [] };
    const sl = stats(bag.slide), ms = stats(bag.mesh);
    out.segments[seg] = {
      stanceSamples: sl.n,
      slideCmPerFrame: round(cm(sl.mean), 3),
      slideMaxCm: round(cm(sl.max), 3),
      meshCmPerFrame: round(cm(ms.mean), 3),
      meshMaxCm: round(cm(ms.max), 3),
    };
  }
  return { out, poses, uvs: fc.uvs, indices: fc.indices, nu: fc.cfg.nu, nv: fc.cfg.nv };
}

const before = run("before", { ...MEADOW_FEET, lock: false, idleFrame: 0 });
const after = run("after", { ...MEADOW_FEET, lock: true }, { dump: true });
const canyon = run("canyon-after", { ...CANYON_FEET, lock: true });

const liveLiftCm = 0.045 * MEADOW_FEET.cardH * 100;
const report = {
  dt: DT,
  seconds: SCRIPT_SECONDS,
  note: "Slide is the world-space XZ travel of a sole that was already in stance on the previous frame, in cm per 1/60 s frame. The mesh row is the same measure on the drawn sole texel (barycentric sample of the card). Idle flatness is |y| of the soles on the ground line, and the gap between them, after the stop has settled. torsoH is the undisplaced chest band, not a scale.",
  liveUpperUvLiftCm: round(liveLiftCm, 3),
  candidateUpperUvLiftCm: 0,
  paintedCardScale: 1,
  before: before.out,
  after: after.out,
  canyonAfter: canyon.out,
};

const proof = path.join(here, "proof");
fs.mkdirSync(proof, { recursive: true });
fs.writeFileSync(path.join(proof, "metrics.json"), JSON.stringify(report, null, 2) + "\n");
fs.writeFileSync(path.join(proof, "poses-locked.json"), JSON.stringify({
  nu: after.nu, nv: after.nv,
  uvs: Array.from(after.uvs),
  indices: Array.from(after.indices),
  frames: after.poses,
}) + "\n");

function line(name, row) {
  const s = row.segments;
  const fmt = v => (v == null ? "  - " : v.toFixed(2).padStart(6));
  console.log(
    `${name.padEnd(14)} stride ${row.strideM} m  ` +
    `straight ${fmt(s.straight.slideCmPerFrame)}  turnL ${fmt(s.turnL.slideCmPerFrame)}  ` +
    `turnR ${fmt(s.turnR.slideCmPerFrame)}  brake ${fmt(s.brake.slideCmPerFrame)}  ` +
    `idleDy ${fmt(row.idle.soleDyCm)}  idleLift ${fmt(row.idle.soleLiftCm)}  ` +
    `torsoStd ${fmt(row.torsoHcm.std)}  shift ${fmt(row.torsoHcm.maxShift)}  ` +
    `screenX ${row.screenX}  phase/m ${row.phasePerMetreStraight} (expect ${row.expectedPhasePerMetre})`
  );
  console.log(
    `${"".padEnd(14)} mesh     ` +
    `straight ${fmt(s.straight.meshCmPerFrame)}  turnL ${fmt(s.turnL.meshCmPerFrame)}  ` +
    `turnR ${fmt(s.turnR.meshCmPerFrame)}  brake ${fmt(s.brake.meshCmPerFrame)}  ` +
    `n ${s.straight.stanceSamples}/${s.turnL.stanceSamples}/${s.turnR.stanceSamples}/${s.brake.stanceSamples}  idlePaws ${row.idle.pawsMean}`
  );
}
line("before", before.out);
line("after", after.out);
line("canyon", canyon.out);
console.log("poses", after.poses.length, "uv lift live", liveLiftCm.toFixed(2), "cm candidate 0");

const b = before.out, a = after.out;
const worse = [];
for (const seg of ["straight", "turnL", "turnR", "brake"]) {
  const bs = b.segments[seg].slideCmPerFrame, as = a.segments[seg].slideCmPerFrame;
  if (!(as < bs * 0.25)) worse.push(`${seg} slide ${as} vs ${bs}`);
  const bm = b.segments[seg].meshCmPerFrame, am = a.segments[seg].meshCmPerFrame;
  if (am != null && bm != null && !(am < bm * 0.25)) worse.push(`${seg} mesh ${am} vs ${bm}`);
}
if (!(a.torsoHcm.std <= b.torsoHcm.std + 1e-4)) worse.push("torso std grew");
if (a.torsoHcm.maxShift > 0.05) worse.push("torso moved " + a.torsoHcm.maxShift);
if (a.scaleMean !== 1) worse.push("scale");
if (a.fog !== 0 || b.fog !== 0) worse.push("fog");
if (!(a.idle.soleLiftCm < (b.idle.soleLiftCm ?? 1) || a.idle.soleLiftCm === 0)) worse.push("idle lift");
if (a.idle.soleDyCm == null || a.idle.soleDyCm > 0.05) worse.push("idle dy " + a.idle.soleDyCm);
if (Math.abs(a.phasePerMetreStraight - a.expectedPhasePerMetre) > 1e-3) worse.push("phase clock");
if (Math.abs(a.screenX - 0.5) > 0.02) worse.push("screen " + a.screenX);
if (a.lockWMin != null && a.lockWMin < 0.999) worse.push("sole triangle not fully locked " + a.lockWMin);
if (worse.length) {
  console.error("FAIL", worse.join("; "));
  process.exit(1);
}
console.log("PASS");
