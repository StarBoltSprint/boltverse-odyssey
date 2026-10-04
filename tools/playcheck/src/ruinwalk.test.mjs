/**
 * Headless ruin walk (zone A step 4, owner decision 2026-10-04: no invisible walls; collisions
 * follow the real geometry; walk through the arch; enter the hangar).
 *
 * Proves, on the live play page:
 *  - arch: Bolt gallops through the gate opening at full speed, not slowed, not pushed, not blocked;
 *  - hangar: Bolt gallops into the wreck's bay, under the deck, turns round and runs back out;
 *  - walls: head-on runs into each pier and the closed hull stop AT the drawn face, never inside it;
 *  - slides: a shallow run into a face slides along it without stalling;
 *  - sweeps: lines across and around both ruins; every collider contact has a drawn face within
 *    the body radius + 0.2 m (ground truth read straight from the .ruin meshes, not collide.js),
 *    and lines that pass just clear of the bounds have no contact at all;
 *  - camera: per-frame eye displacement has no pop, no shake (acceleration reversal), and the
 *    near plane never opens a face.
 * Routes and checks come from the ruin manifest's measured parts, so a re-cooked gate needs no edit.
 * Skips when no Chrome binary is present. RUINWALK_OUT=<file> writes the numbers as JSON.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromePath, launchPhone } from "./browser.mjs";
import { startStatic } from "./serve.mjs";
import {
  archPlan, buildTruth, drive, hangarPlan, judge, rockDiscs, ruinProbes, ruinRoutes, runPlan, truthCheck,
} from "./ruinwalk.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const RUINS = path.join(ROOT, "packs/zone-a/src/ruins/manifest.json");
const ROCKS = path.join(ROOT, "packs/zone-a/src/rocks/manifest.json");

const NEAR = 0.35; // camera near plane (play.js)
// Eye moves per 1/30 s frame. A pop is metre-class; a gallop chase with the boom easing is ~0.3 m.
const MAX_STEP_RUN = 0.35;
const MAX_STEP_TURN = 0.5; // turning on the spot swings a 5 m boom round Bolt at 150 deg/s
const MAX_JERK_STEADY = 0.15;
const MAX_JERK_TURN = 0.35;

const skip = chromePath() ? false : "no Chrome or Chromium binary";

test("ruin walk: arch, hangar, walls, slides, sweeps; no invisible wall, no camera jump", { skip, timeout: 900000 }, async (t) => {
  const manifest = JSON.parse(readFileSync(RUINS, "utf8"));
  const rocks = JSON.parse(readFileSync(ROCKS, "utf8"));
  const r = manifest.collider.bodyRadiusM;
  const discs = rockDiscs(rocks);
  const routes = ruinRoutes(manifest, discs);
  const probes = ruinProbes(manifest, discs, { sweepStepM: 0.5, hullStepM: 3, bayStepM: 1 });
  assert.ok(routes.arch, "gate has a measured opening (openingBoxM)");
  assert.equal(routes.arches.length, manifest.objects.filter((o) => o.frame !== "ship").length, "every gate-frame ruin has an opening route");
  assert.ok(routes.hangar, "wreck has a measured hangar");
  const server = await startStatic(ROOT);
  const { browser, page, consoleErrors } = await launchPhone();
  const out = { bodyRadiusM: r };
  try {
    await page.goto(server.urlFor("/packs/zone-a/play/index.html?debug=1"));
    await page.waitForFunction(
      (n) => window.__play && window.__play.ready && window.__play.ruinInfo && window.__play.ruinInfo() && window.__play.ruinInfo().count === n,
      manifest.objects.length,
      { timeout: 300000 },
    );
    const truth = await buildTruth(page, manifest, (p) => readFileSync(path.join(ROOT, p)));
    // any: a drawn face anywhere from the ground to Bolt's height; core: the middle of the body band.
    const topt = { radius: r, tol: 0.2, anyLo: 0.05, anyHi: 2.15, coreLo: 0.4, coreHi: 1.2 };
    out.truthSamples = truth.count;

    out.arches = {};
    for (const route of routes.arches) {
      await t.test(`arch ${route.id}: full gallop through the opening`, async () => {
        const a = await drive(page, archPlan(route));
        const j = judge(a.rec);
        const tc = truthCheck(a.rec, truth, topt);
        const last = a.rec[a.rec.length - 1];
        const top = Math.max(...a.rec.map((q) => q.spd));
        const at = a.rec.findIndex((q) => q.spd >= top * 0.98);
        const slowest = Math.min(...a.rec.slice(at).map((q) => q.spd));
        const latDev = Math.max(...a.rec.map((q) => Math.abs(q.lx - route.lx)));
        out.arches[route.id] = { ...j, ...tc, topSpeed: top, slowestAfterTop: slowest, latDev, lx: route.lx, mags: a.mags };
        assert.equal(j.blocked, 0, `${route.id} run blocked ${j.blocked} ticks`);
        assert.ok(last.lz < route.exitLocalZ, `arch exit: local z ${last.lz.toFixed(2)} not past ${route.exitLocalZ}`);
        assert.ok(a.rec.some((q) => q.covered), `Bolt never passed under ${route.id}`);
        assert.ok(slowest >= top * 0.98, `slowed under the arch: ${slowest.toFixed(2)} of ${top.toFixed(2)} m/s`);
        assert.ok(latDev < 0.05, `arch run pushed sideways ${latDev.toFixed(3)} m`);
        assert.equal(tc.invisible, 0, `invisible contact in the arch ${JSON.stringify(tc.firstInvisible)}`);
        assert.ok(j.maxStep <= MAX_STEP_RUN, `arch camera step ${j.maxStep.toFixed(3)} m`);
        assert.ok(j.maxJerkSteady <= MAX_JERK_STEADY, `arch camera jerk ${j.maxJerkSteady.toFixed(3)} m`);
        assert.equal(j.shake, 0, `${route.id} camera shake ${j.shake} (zero shake, owner rule)`);
        assert.ok(j.minNear >= NEAR, `arch near plane opens a face (${j.minNear})`);
      });
    }

    await t.test("hangar: in under the deck, turn round, back out", async () => {
      const h = await drive(page, hangarPlan(routes.hangar));
      const j = judge(h.rec);
      const tc = truthCheck(h.rec, truth, topt);
      const ins = h.rec.filter((q) => q.phase === "in");
      const depth = routes.hangar.portZ - Math.min(...ins.map((q) => q.lz));
      const runs = judge(h.rec.filter((q) => q.phase !== "turn"));
      out.hangar = { ...j, ...tc, depth, runShake: runs.shake, runMaxJerkSteady: runs.maxJerkSteady, mags: h.mags };
      assert.ok(depth >= 1.5, `hangar depth reached ${depth.toFixed(2)} m`);
      assert.ok(h.rec.some((q) => q.covered), "Bolt never got under the hangar deck");
      // The only wall Bolt may meet on the way in is the bay's far side, after the whole bay depth.
      const firstBlocked = h.rec.find((q) => q.blocked);
      if (firstBlocked) {
        const at = routes.hangar.portZ - firstBlocked.lz;
        assert.ok(at >= depth - 0.2 && at >= 2.5, `blocked ${at.toFixed(2)} m inside, before the far wall`);
      }
      const hLast = h.rec[h.rec.length - 1];
      assert.ok(hLast.lz > routes.hangar.portZ + 2, `back out: local z ${hLast.lz.toFixed(2)}`);
      assert.equal(tc.invisible, 0, `invisible contact in the hangar ${JSON.stringify(tc.firstInvisible)}`);
      assert.ok(tc.minFace >= r - 0.1, `body inside the hull: ${tc.minFace.toFixed(3)} m`);
      assert.ok(j.maxStep <= MAX_STEP_TURN, `hangar camera step ${j.maxStep.toFixed(3)} m`);
      assert.ok(j.maxJerk <= MAX_JERK_TURN, `hangar camera jerk ${j.maxJerk.toFixed(3)} m`);
      assert.equal(runs.shake, 0, "hangar camera shake on the straight runs");
      assert.ok(runs.maxJerkSteady <= MAX_JERK_STEADY, `hangar run jerk ${runs.maxJerkSteady.toFixed(3)} m`);
      assert.equal(j.shake, 0, `hangar camera shake ${j.shake} (zero shake, owner rule)`);
      assert.ok(j.minNear >= NEAR, `hangar near plane opens the hull (${j.minNear.toFixed(3)} m)`);
      assert.ok(j.maxFeetStep <= 0.2, `feet step ${j.maxFeetStep.toFixed(3)} m`);
    });

    await t.test("walls: piers and closed hull stop Bolt at the drawn face", async () => {
      out.walls = {};
      for (const w of probes.walls) {
        const res = await drive(page, runPlan(w, undefined, { probeEvery: 1 }));
        const j = judge(res.rec);
        const tc = truthCheck(res.rec, truth, topt);
        const last = res.rec[res.rec.length - 1];
        const stopGap = truth.nearest(last.x, last.z, topt.anyLo, topt.anyHi, 3) - r;
        out.walls[w.phase] = { ...j, ...tc, stopGap, travel: last.travel, length: w.lengthM };
        assert.ok(j.blocked > 0 && last.travel < w.lengthM - 1, `${w.phase}: Bolt went through (travel ${last.travel.toFixed(2)} m)`);
        assert.ok(stopGap <= 0.2, `${w.phase}: stopped ${stopGap.toFixed(3)} m before the face (invisible wall)`);
        assert.ok(tc.minFace >= r - 0.1, `${w.phase}: body inside the face (${tc.minFace.toFixed(3)} m)`);
        assert.equal(tc.invisible, 0, `${w.phase}: invisible contact`);
        assert.ok(j.maxStep <= MAX_STEP_RUN, `${w.phase}: camera step ${j.maxStep.toFixed(3)} m`);
        assert.equal(j.shake, 0, `${w.phase}: camera shake`);
      }
    });

    await t.test("slides: a shallow run slides along the face", async () => {
      out.slides = {};
      for (const w of probes.slides) {
        const res = await drive(page, runPlan(w, undefined, { probeEvery: 1 }));
        const j = judge(res.rec);
        const tc = truthCheck(res.rec, truth, topt);
        const top = Math.max(...res.rec.map((q) => q.spd));
        // Progress along the face while touching it, against the tangential share of the gallop.
        let along = 0;
        let n = 0;
        for (let i = 1; i < res.rec.length; i++) {
          if (!res.rec[i].contact) continue;
          const d = (res.rec[i].lx - res.rec[i - 1].lx) * w.face.along;
          along += d;
          n++;
        }
        const slideSpeed = n ? along / (n * (1 / 30)) : 0;
        const tangential = top * Math.cos((30 * Math.PI) / 180);
        out.slides[w.phase] = { ...j, ...tc, contactFrames: n, slideSpeed, tangential };
        assert.ok(n >= 5, `${w.phase}: never touched the face (${n} frames)`);
        assert.equal(j.blocked, 0, `${w.phase}: stalled ${j.blocked} ticks`);
        assert.ok(slideSpeed >= tangential * 0.6, `${w.phase}: slide ${slideSpeed.toFixed(2)} m/s of ${tangential.toFixed(2)}`);
        assert.ok(tc.minFace >= r - 0.1, `${w.phase}: body inside the face (${tc.minFace.toFixed(3)} m)`);
        assert.equal(tc.invisible, 0, `${w.phase}: invisible contact`);
        assert.ok(j.maxJerkSteady <= MAX_JERK_STEADY, `${w.phase}: camera jerk ${j.maxJerkSteady.toFixed(3)} m`);
        assert.equal(j.shake, 0, `${w.phase}: camera shake`);
      }
    });

    await t.test("sweeps: every contact sits on a drawn face; near-misses touch nothing", async () => {
      let invisible = 0;
      let minFace = Infinity;
      let runs = 0;
      const free = [];
      for (const w of probes.sweeps) {
        const res = await drive(page, runPlan(w, undefined, { light: true, untilStill: 6 }));
        const tc = truthCheck(res.rec, truth, topt);
        const j = judge(res.rec);
        runs++;
        invisible += tc.invisible;
        minFace = Math.min(minFace, tc.minFace);
        assert.equal(tc.invisible, 0, `${w.phase}: invisible contact ${JSON.stringify(tc.firstInvisible)}`);
        assert.ok(tc.minFace >= r - 0.1, `${w.phase}: body inside a face (${tc.minFace.toFixed(3)} m)`);
        assert.equal(j.shake, 0, `${w.phase}: camera shake ${j.shake} (zero shake, owner rule)`);
        if (w.expectFree) {
          free.push({ phase: w.phase, contact: j.contact });
          assert.equal(j.contact, 0, `${w.phase}: touched a collider ${r + 0.2} m off the bounds`);
        }
      }
      out.sweeps = { runs, invisible, minFace, free };
    });

    assert.deepEqual(consoleErrors.filter((e) => !/GPU stall|ReadPixels/i.test(e)), []);
    console.log(JSON.stringify({
      arches: Object.fromEntries(Object.entries(out.arches).map(([k, a]) => [k, { maxStep: a.maxStep, maxJerk: a.maxJerk, shake: a.shake, minNear: a.minNear, topSpeed: a.topSpeed }])),
      hangar: out.hangar && { depth: out.hangar.depth, maxStep: out.hangar.maxStep, maxJerk: out.hangar.maxJerk, shake: out.hangar.shake, minNear: out.hangar.minNear, maxBoltMag: out.hangar.maxBoltMag },
      sweeps: out.sweeps,
    }));
  } finally {
    if (process.env.RUINWALK_OUT) writeFileSync(process.env.RUINWALK_OUT, JSON.stringify(out, null, 1));
    await browser.close();
    await server.close();
  }
});
