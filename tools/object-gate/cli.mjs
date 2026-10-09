#!/usr/bin/env node
// node tools/object-gate/cli.mjs --scene specs/zone-b/scene.yaml [--url http://127.0.0.1:8996/] [--only tower-m2,spire]
//                                [--out dir] [--fast]
// Exit 0 = every object PASS. Exit 1 = at least one FAIL (do not show, do not export). Exit 2 = bad invocation.
import { loadScene, gateScene } from "./gate.mjs";
const a = process.argv.slice(2); const opt = {};
for (let i = 0; i < a.length; i++) { const k = a[i]; if (!k.startsWith("--")) continue; const v = a[i + 1] && !a[i + 1].startsWith("--") ? a[++i] : true; opt[k.slice(2)] = v; }
if (!opt.scene) { console.error("usage: cli.mjs --scene <scene.yaml> [--url U] [--only a,b] [--out DIR] [--fast]"); process.exit(2); }
const scene = loadScene(opt.scene);
const rep = await gateScene(scene, { url: opt.url, out: opt.out, only: opt.only ? String(opt.only).split(",") : null, fast: !!opt.fast });
for (const r of rep.runtime) console.log(`${r.status}\truntime\t${r.check}\t${r.detail}`);
for (const o of rep.objects) for (const r of o.rows) console.log(`${r.status}\t${o.id}\t${r.check}\t${r.detail}`);
console.log(`---\n${rep.verdict}  report ${rep.out}/report.md`);
process.exit(rep.verdict === "PASS" ? 0 : 1);
