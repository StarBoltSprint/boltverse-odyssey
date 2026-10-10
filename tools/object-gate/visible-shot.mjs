#!/usr/bin/env node
// Render-based visible px/m of ANY screenshot (A/B sheets, other tools' poses). Same estimator as the gate row
// texel.visible-px-per-m (lib/analyze.py visible_px).
//   node visible-shot.mjs --img shot.png --dist 8 --fov 58 [--height 1200] [--pr 1] [--mask m.png] [--rect x0,y0,x1,y1] [--type rock]
// --height = screenshot height in px (default: image height); --pr = page render pixel ratio inside the shot (default 1).
// The shot can only prove px/m up to its own screen px/m S = height*pr / (2 dist tan(fov/2)). If S is under the
// target, the result says so and gives the fov to shoot with (optical zoom at the same distance).
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProfile, screenPxPerM } from "./gate.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const A = {}; for (let i = 2; i < process.argv.length; i += 2) A[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
if (!A.img || !A.dist || !A.fov) { console.error("usage: --img shot.png --dist 8 --fov 58 [--height H] [--pr 1] [--mask m.png] [--rect x0,y0,x1,y1] [--type rock] [--game-pr 1.5 --game-fov 58]"); process.exit(2); }
const py = (op, a) => JSON.parse(execFileSync("python3", [join(HERE, "lib/analyze.py"), op, JSON.stringify(a)], { encoding: "utf8" }));
const t = loadProfile(A.type || "rock").texel;
const H = +(A.height || py("size", { img: A.img }).h) * +(A.pr || 1), d = +A.dist, fov = +A.fov;
const S = H / (2 * d * Math.tan((fov * Math.PI) / 360));
const need = screenPxPerM(t, { renderPixelRatio: +(A["game-pr"] || 1.5), fovDeg: +(A["game-fov"] || 58) }, Math.max(d, t.minViewM));
const r = py("visible_px", { img: A.img, mask: A.mask, rect: A.rect && A.rect.split(",").map(Number), screenPxPerM: S });
const fovFor = (2 * Math.atan(H / (2 * d * (t.renderHeadroom ?? 2) * need)) * 180) / Math.PI;
const out = { ...r, needPxPerM: +need.toFixed(1), distM: d, shotFovDeg: fov,
  pass: !!r.ok && r.visiblePxPerM >= need ? true : r.ok && r.capped && S < need ? null : false,   // null = inconclusive: sharp up to the shot's own limit
  note: S < need * 1.2 ? `this shot shows only ${S.toFixed(1)} screen px/m, too few to prove ${need.toFixed(1)}: shoot the same pose with fov ${fovFor.toFixed(1)} deg (optical zoom, same distance)` : undefined };
console.log(JSON.stringify(out, null, 1));
process.exit(out.pass ? 0 : out.pass === null ? 3 : 1);
