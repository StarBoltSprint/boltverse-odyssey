/**
 * Headless ruin walk (zone A step 4, owner request 2026-10-04: arch and hangar walkable).
 * Gallops Bolt straight through the gate opening (one side to the other), then into the wreck
 * hangar, turns round and runs back out. Asserts no invisible wall and no camera jump.
 * Routes come from the ruin manifest's measured parts, so a re-cooked gate needs no edit here.
 * Skips when no Chrome binary is present.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromePath, launchPhone } from "./browser.mjs";
import { startStatic } from "./serve.mjs";
import { archPlan, drive, hangarPlan, judge, rockDiscs, ruinRoutes } from "./ruinwalk.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const RUINS = path.join(ROOT, "packs/zone-a/src/ruins/manifest.json");
const ROCKS = path.join(ROOT, "packs/zone-a/src/rocks/manifest.json");

// Eye moves per 1/30 s frame. A snap or jump is a metre-class step; a rigid chase at gallop
// with the boom easing in is about 0.3 m. Jerk (second difference) catches a kink in the path.
const MAX_STEP_M = 0.45;
const MAX_JERK_M = 0.35;

const skip = chromePath() ? false : "no Chrome or Chromium binary";

test("ruin walk: through the arch and into the hangar, no wall, no camera jump", { skip, timeout: 900000 }, async () => {
  const manifest = JSON.parse(readFileSync(RUINS, "utf8"));
  const rocks = JSON.parse(readFileSync(ROCKS, "utf8"));
  const routes = ruinRoutes(manifest, rockDiscs(rocks));
  assert.ok(routes.arch, "gate has a measured opening (openingBoxM)");
  assert.ok(routes.hangar, "wreck has a measured hangar");
  const server = await startStatic(ROOT);
  const { browser, page, consoleErrors } = await launchPhone();
  try {
    await page.goto(server.urlFor("/packs/zone-a/play/index.html?debug=1"));
    await page.waitForFunction(
      () => window.__play && window.__play.ready && window.__play.ruinInfo && window.__play.ruinInfo().count === 2,
      null,
      { timeout: 300000 },
    );

    // Arch: enter in front, leave behind, at full gallop, without a single blocked tick.
    const a = await drive(page, archPlan(routes.arch));
    const aj = judge(a.rec);
    const aLast = a.rec[a.rec.length - 1];
    assert.equal(aj.blocked, 0, `arch run blocked ${aj.blocked} ticks`);
    assert.ok(aLast.lz < routes.arch.exitLocalZ, `arch exit: local z ${aLast.lz.toFixed(2)} not past ${routes.arch.exitLocalZ}`);
    assert.ok(a.rec.some((r) => r.covered), "Bolt never passed under the arch");
    const latDev = Math.max(...a.rec.map((r) => Math.abs(r.lx - routes.arch.lx)));
    assert.ok(latDev < 0.1, `arch run pushed sideways ${latDev.toFixed(3)} m`);
    assert.ok(aj.maxStep <= MAX_STEP_M, `arch camera step ${aj.maxStep.toFixed(3)} m`);
    assert.ok(aj.maxJerk <= MAX_JERK_M, `arch camera jerk ${aj.maxJerk.toFixed(3)} m`);
    assert.ok(aj.minEyeClear >= 0.3, `arch eye ${aj.minEyeClear.toFixed(3)} m from stone`);

    // Hangar: gallop in through the port opening, turn round inside, run back out.
    const h = await drive(page, hangarPlan(routes.hangar));
    const hj = judge(h.rec);
    const ins = h.rec.filter((r) => r.phase === "in");
    const depth = routes.hangar.portZ - Math.min(...ins.map((r) => r.lz));
    assert.ok(depth >= 1.5, `hangar depth reached ${depth.toFixed(2)} m`);
    assert.ok(h.rec.some((r) => r.covered), "Bolt never got under the hangar deck");
    // The only wall Bolt may meet is the bay's far side, after running the whole bay depth.
    const firstBlocked = h.rec.find((r) => r.blocked);
    if (firstBlocked) {
      const at = routes.hangar.portZ - firstBlocked.lz;
      assert.ok(at >= depth - 0.05 && at >= 2.5, `blocked ${at.toFixed(2)} m inside, before the far wall`);
    }
    const hLast = h.rec[h.rec.length - 1];
    assert.ok(hLast.lz > routes.hangar.portZ + 2, `back out: local z ${hLast.lz.toFixed(2)}`);
    assert.ok(hj.maxStep <= MAX_STEP_M, `hangar camera step ${hj.maxStep.toFixed(3)} m`);
    assert.ok(hj.maxJerk <= MAX_JERK_M, `hangar camera jerk ${hj.maxJerk.toFixed(3)} m`);
    assert.ok(hj.minEyeClear >= 0.1, `hangar eye ${hj.minEyeClear.toFixed(3)} m from hull`);
    assert.ok(hj.maxFeetStep <= 0.2, `feet step ${hj.maxFeetStep.toFixed(3)} m`);
    assert.deepEqual(consoleErrors.filter((e) => !/GPU stall|ReadPixels/i.test(e)), []);
    console.log(JSON.stringify({ arch: aj, hangar: { ...hj, depth } }));
  } finally {
    await browser.close();
    await server.close();
  }
});
