import { createRequire } from "node:module";
import { mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { normalizeLayout } from "./layout.mjs";
import { launchPhone, readGlErrors } from "./browser.mjs";
import { startStatic } from "./serve.mjs";
import { runWalk } from "./walk.mjs";
import { openVideo } from "./video.mjs";
import { createJudge } from "./checks.mjs";
import { writeReport } from "./report.mjs";
import { lintPlayFiles } from "./renderlint.mjs";

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");

export async function main(argv) {
  const args = parse(argv);
  if (args.help || !args.url || !args.layout) {
    console.log(`tools/playcheck/run --url <play url or local build> --layout <clearing.json> [--source play.js] [--out dir] [--video|--no-video]

Drives the real play view at 360x800 CSS, DPR 2 (720x1600) and writes report.md, report.json, stills/, and walk.mp4.
Exit 0 only when every row PASSes. A hand-written PASS table is not this report.`);
    return args.help ? 0 : 2;
  }
  const layoutRaw = JSON.parse(readFileSync(args.layout, "utf8"));
  const layout = normalizeLayout(layoutRaw);
  const outDir = path.resolve(args.out || path.join("tools/playcheck/out", stamp()));
  const stillsDir = path.join(outDir, "stills");
  mkdirSync(stillsDir, { recursive: true });

  const target = resolveTarget(args.url);
  let server = null;
  let href = target.href;
  if (target.serve) {
    server = await startStatic(target.root);
    href = server.urlFor(target.pathname);
  }
  href = withDebug(href);

  const launched = await launchPhone();
  let video;
  let videoInfo = null;
  const notes = [];
  try {
    if (args.video) video = await openVideo(launched.page, path.join(outDir, "walk.mp4"));
    console.error(`playcheck ${href}`);
    await launched.page.goto(href, { waitUntil: "domcontentloaded", timeout: 60000 });
    try {
      await launched.page.waitForFunction(() => window.__play && window.__play.ready, null, { timeout: 30000 });
    } catch {
      notes.push("window.__play.ready was not set. Builders must install the debug hook when ?debug=1 is present. Unmeasured rows FAIL.");
    }
    const hooked = await launched.page.evaluate(() => !!(window.__play && window.__play.ready && window.__play.snapshot));
    let shots = [];
    let samples = [];
    if (hooked) {
      const walked = await runWalk({
        page: launched.page,
        layout,
        stillsDir,
        video,
        log: (line) => console.error(line),
      });
      shots = walked.shots;
      samples = walked.samples;
    } else {
      const png = path.join(stillsDir, "00-no-hook.png");
      await launched.page.screenshot({ path: png, type: "png", scale: "device" }).catch(() => {});
      shots.push({ id: "00-no-hook", kind: "spawn", snap: {}, png });
    }
    const glErrors = await readGlErrors(launched.page).catch(() => []);
    if (video) {
      videoInfo = await video.close();
      console.error(`video ${videoInfo.width}x${videoInfo.height} ${videoInfo.seconds}s ${videoInfo.bytes} bytes`);
    }
    const judge = createJudge(layout);
    const stills = [];
    for (const shot of shots) {
      let width = 0;
      let height = 0;
      let rgba = null;
      if (shot.png) {
        try {
          const png = PNG.sync.read(readFileSync(shot.png));
          width = png.width;
          height = png.height;
          rgba = png.data;
          stills.push(path.relative(outDir, shot.png));
        } catch {
          notes.push(`Could not read still ${shot.id}`);
        }
      }
      judge.add({ id: shot.id, kind: shot.kind, width, height, rgba, snap: shot.snap });
    }
    for (const sample of samples) {
      judge.add({ id: sample.id, kind: sample.kind, width: 0, height: 0, rgba: null, snap: sample.snap });
    }
    const sourceLint = collectSource(target, args.sources, shots);
    const judged = judge.finish({
      glErrors,
      consoleErrors: launched.consoleErrors,
      softwareGl: true,
      sourceLint,
    });
    if (shots.some((s) => s.snap && s.snap.harness)) {
      notes.push("This URL is the playcheck fixture harness, not a biome play build. This repo has no clearing play build. The harness paints test patterns so the tool can run here. It is not a style and it does not change a game.");
    }
    notes.push("Heuristic rows: black_regions, tile_repeat, fog_band streak test. Partial rows: stops are every 45° (8 headings) rather than 36 walked headings; ring coverage is sampled every 10° from the centre; backdrop size is reported by the renderer; near_lens uses the renderer's nearest fragment distance. A data-only agreement is not a PASS.");
    if (args.video && !videoInfo) notes.push("Video was requested but not written.");
    const report = writeReport(outDir, {
      url: href,
      layoutPath: path.resolve(args.layout),
      layoutId: layout.id,
      video: videoInfo,
      stills,
      steps: shots.map((s) => ({
        id: s.id,
        kind: s.kind,
        x: s.snap.x,
        z: s.snap.z,
        hdg: s.snap.hdg,
        spd: s.snap.spd,
        mag: s.snap.mag,
        state: s.snap.state,
        blocked: s.snap.blocked,
        pathTrigger: s.snap.pathTrigger,
      })),
      rows: judged.rows,
      perf: judged.perf,
      notes,
      generatedAt: new Date().toISOString(),
    });
    console.log(report.summary.result);
    for (const row of report.rows) console.log(`${row.result}\t${row.id}`);
    console.log(path.join(outDir, "report.md"));
    if (args.video && !videoInfo) return 2;
    return report.summary.result === "PASS" ? 0 : 1;
  } finally {
    await launched.browser.close().catch(() => {});
    if (server) await server.close();
  }
}

function parse(argv) {
  const args = { video: true, url: null, layout: null, out: null, help: false, sources: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") args.url = argv[++i];
    else if (a === "--layout") args.layout = argv[++i];
    else if (a === "--source") args.sources.push(argv[++i]);
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--video") args.video = true;
    else if (a === "--no-video") args.video = false;
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`Unknown argument ${a}`);
  }
  return args;
}

function resolveTarget(input) {
  if (/^https?:\/\//i.test(input)) return { href: input, serve: false };
  const q = input.indexOf("?");
  const filePart = q === -1 ? input : input.slice(0, q);
  const query = q === -1 ? "" : input.slice(q);
  const abs = path.resolve(filePart);
  const st = statSync(abs);
  if (st.isDirectory()) return { serve: true, root: abs, pathname: `/${query ? "index.html" : "index.html"}${query}` };
  return { serve: true, root: path.dirname(abs), pathname: `/${path.basename(abs)}${query}` };
}

function collectSource(target, sources, shots) {
  const harness = shots.some((s) => s.snap && s.snap.harness === true);
  const root = target.root ? target.root.split(path.sep).join("/") : "";
  if (harness || root.endsWith("tools/playcheck/fixture")) {
    return { skipped: "harness", findings: [], scanned: false };
  }
  const paths = [];
  if (sources && sources.length) {
    for (const name of sources) paths.push(path.resolve(name));
  } else if (target.serve && target.root) {
    let names = [];
    try {
      names = readdirSync(target.root);
    } catch {
      names = [];
    }
    for (const name of names) {
      if (name.endsWith(".js")) paths.push(path.join(target.root, name));
    }
  }
  if (!paths.length) {
    return {
      scanned: false,
      findings: [
        {
          file: "",
          line: 0,
          rule: "source_missing",
          detail: "Play source was not scanned. Pass a local build or --source <play.js>. Unmeasured is not a PASS.",
        },
      ],
    };
  }
  const files = [];
  for (const name of paths) {
    try {
      files.push({ name, text: readFileSync(name, "utf8") });
    } catch {
      return {
        scanned: false,
        findings: [{ file: name, line: 0, rule: "source_missing", detail: `Could not read ${name}` }],
      };
    }
  }
  const result = lintPlayFiles(files);
  return { scanned: true, files: files.length, findings: result.findings };
}

function withDebug(href) {
  const u = new URL(href);
  if (!u.searchParams.has("debug")) u.searchParams.set("debug", "1");
  return u.toString();
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
