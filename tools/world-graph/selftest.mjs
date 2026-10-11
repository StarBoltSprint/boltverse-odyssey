/**
 * Zone graph selftest. No browser.
 *   node tools/world-graph/selftest.mjs
 */
import { readFileSync, statSync, mkdtempSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateZone, feedForUrl, materialize } from "../../runtime/zone-loader.mjs";
import { resolveRoute } from "./serve.mjs";

const ROOT = new URL("../..", import.meta.url).pathname;
const PREVIEW = "/workspace/zb-preview-1008";
let failed = 0;
function check(name, ok, detail) {
  console.log((ok ? "PASS" : "FAIL") + " " + name + (detail ? " " + detail : ""));
  if (!ok) failed++;
}

const schema = readFileSync(ROOT + "schema/zone.v1.schema.json", "utf8");
check("schema file names zone.v1", schema.includes('"const": "zone.v1"') && schema.includes("zone.v1.schema.json"));

const before = ["index.html", "main.mjs"].map((f) => {
  const s = statSync(PREVIEW + "/" + f);
  return { f, size: s.size, mtimeMs: s.mtimeMs };
});

const out = join(mkdtempSync(join(tmpdir(), "wg-")), "zone.json");
const exp = spawnSync(process.execPath, [ROOT + "tools/world-graph/export-zone-b.mjs", out], { encoding: "utf8" });
check("export exit 0", exp.status === 0, exp.stderr && exp.stderr.slice(0, 200));
const fresh = JSON.parse(readFileSync(out, "utf8"));
const disk = JSON.parse(readFileSync(ROOT + "zone-b.zone.json", "utf8"));
check("fresh export matches zone-b.zone.json", JSON.stringify(fresh) === JSON.stringify(disk));

let threw = false;
try { validateZone({ schema: "nope" }); } catch { threw = true; }
check("validateZone rejects a bad schema", threw);
validateZone(disk);
check("validateZone accepts zone-b", true);

const biome = JSON.parse(readFileSync(PREVIEW + "/biome.json", "utf8"));
const layout = JSON.parse(readFileSync(PREVIEW + "/objects1/layout.json", "utf8"));
const gd = JSON.parse(readFileSync(PREVIEW + "/gdet/ground-detail.json", "utf8"));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
check("runtime biome round-trip", same(disk.runtime.biome, biome));
check("runtime layout round-trip", same(disk.runtime.layout, layout));
check("runtime ground detail round-trip", same(disk.runtime.groundDetail, gd));
check("zone biome is the bible file", same(disk.biome, biome));

const hero = disk.cameras.hero.previewPose;
check("hero xz is the spawn literal", hero.x === -51.115 && hero.z === 9.63 && hero.yaw === 75 && hero.pitch === -1.16 && hero.eye === 3.15);
check("gameplay has no invented lanes", disk.gameplay.lanes == null && disk.gameplay.laneWidth == null);
check("todo is a non-empty string list", Array.isArray(disk.todo) && disk.todo.length > 0 && disk.todo.every((t) => typeof t === "string"));
check("every wake is the placeholder", disk.objects.every((o) => o.wake.type === "placeholder" && o.wake.enabled === false));
check("key image path is set", typeof disk.keyImage === "string" && statSync(disk.keyImage).size > 0);
check("street xz matches avenue2At", Math.abs(disk.cameras.street.previewPose.x - (-7.4485346997279205)) < 1e-9);

const feeds = materialize(disk);
check("feed biome.json", same(feedForUrl(disk, "./biome.json?v=8"), feeds.biome));
check("feed layout.json", same(feedForUrl(disk, "/zone/objects1/layout.json?v=1"), feeds.layout));
check("feed ground-detail", same(feedForUrl(disk, "./gdet/ground-detail.json?g=2"), feeds.groundDetail));
check("feed ignores other urls", feedForUrl(disk, "./assets/sky/sky-equirect.jpg") == null);
check("quality gates are the bible budgets", disk.qualityGates.maxDrawCalls === 12 && disk.qualityGates.maxTrisOnScreen === 150000 && disk.qualityGates.maxLpipsKeyView == null);

const after = ["index.html", "main.mjs"].map((f) => {
  const s = statSync(PREVIEW + "/" + f);
  return { f, size: s.size, mtimeMs: s.mtimeMs };
});
check("live preview mtimes unchanged", JSON.stringify(before) === JSON.stringify(after));
const routed = resolveRoute(PREVIEW, "/ref/main.mjs", "/ref/");
check("compare route serves main.mjs", routed === PREVIEW + "/main.mjs");

if (failed) {
  console.log("FAIL " + failed);
  process.exit(1);
}
console.log("PASS selftest");
writeFileSync(ROOT + "steps/world-graph-1011/selftest-ok", "PASS\n");
