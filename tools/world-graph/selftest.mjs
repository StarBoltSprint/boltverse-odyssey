/**
 * Zone graph selftest. No browser.
 *   node tools/world-graph/selftest.mjs
 */
import { readFileSync, statSync, mkdtempSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateZone, feedForUrl, materialize, loadPlayableScene, bootZone } from "../../runtime/zone-loader.mjs";
import { nodeLibraryResolver } from "./library-resolver.mjs";
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
check("export exit 0", exp.status === 0, exp.status === 0 ? "" : (exp.stderr || exp.stdout || "").slice(0, 240));
const disk = JSON.parse(readFileSync(ROOT + "zone-b.zone.json", "utf8"));
if (exp.status === 0) {
  const fresh = JSON.parse(readFileSync(out, "utf8"));
  check("fresh export matches zone-b.zone.json", JSON.stringify(fresh) === JSON.stringify(disk));
} else {
  check("fresh export matches zone-b.zone.json", false, "export did not write " + out);
}

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

const playedB = loadPlayableScene(disk);
check("zone-b scene ids match the zone file", JSON.stringify(playedB.objects.map((o) => o.id)) === JSON.stringify(disk.objects.map((o) => o.id)));
check("zone-b keyCamera and lighting come from the zone", playedB.keyCamera === disk.keyCamera && playedB.lighting === disk.lighting);

const miniPath = ROOT + "tools/world-graph/fixtures/mini-zone.v1.json";
const miniBytes = statSync(miniPath).size;
const mini = JSON.parse(readFileSync(miniPath, "utf8"));
check("mini fixture is zone.v1 and under 200 KB", mini.schema === "zone.v1" && miniBytes <= 200 * 1024, miniBytes + " bytes");
const played = loadPlayableScene(mini);
check("mini objects match zone.objects ids", JSON.stringify(played.objects.map((o) => o.id)) === JSON.stringify(mini.objects.map((o) => o.id)));
check("mini keyCamera and lighting come from the zone", played.keyCamera.fov === 50 && played.lighting.sun.intensity === 1);
check("path-string asset stays a path", played.objects.find((o) => o.id === "marker").asset === "assets/marker.glb");
check("glb asset stays the stored object", played.objects.find((o) => o.id === "rock-a").asset.glb === "assets/rock-a.glb");
const unresolved = played.objects.find((o) => o.id === "lib-solid");
check("library ref kept when no resolver is passed", unresolved.library === "fixture-solid" && unresolved.asset.library === "fixture-solid");
const resolved = loadPlayableScene(mini, { resolveLibrary: nodeLibraryResolver(ROOT) });
const lib = resolved.objects.find((o) => o.id === "lib-solid");
const manifest = JSON.parse(readFileSync(ROOT + "biome/library/fixture-solid/manifest.json", "utf8"));
check("library ref resolves to the manifest asset path", lib.library === "fixture-solid" && lib.asset === manifest.asset);
check("listed present ids are accepted", loadPlayableScene(mini, { present: mini.objects.map((o) => o.id) }).objects.length === mini.objects.length);

let injected = false;
try { loadPlayableScene(mini, { injected: [{ id: "hardcoded-extra" }] }); }
catch (e) { injected = e.status === "FAIL" && /not listed in the zone JSON/.test(e.message) && /hardcoded-extra/.test(e.message); }
check("injected object outside the zone JSON is refused", injected);

let bootRefused = false;
try { await bootZone(mini, "file:///tmp/zone-loader-should-not-import.mjs", { injected: [{ id: "hardcoded-extra" }] }); }
catch (e) { bootRefused = e.status === "FAIL" && /not listed/.test(e.message); }
check("bootZone refuses an injected object before import", bootRefused);

let missingCam = false;
try { const z = structuredClone(mini); delete z.keyCamera; validateZone(z); }
catch (e) { missingCam = /keyCamera/.test(e.message); }
check("missing keyCamera fails validation", missingCam);

let missingSchema = false;
try { const z = structuredClone(mini); delete z.schema; validateZone(z); }
catch (e) { missingSchema = /schema/.test(e.message); }
check("missing schema fails validation", missingSchema);

if (failed) {
  console.log("FAIL " + failed);
  process.exit(1);
}
console.log("PASS selftest");
writeFileSync(ROOT + "steps/world-graph-1011/selftest-ok", "PASS\n");
