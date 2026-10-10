// imagine-to-3d grade step 2: run the runtime's OWN grading functions (extracted verbatim from the runtime module) offline.
// node grade.mjs [runtimeModule.mjs]   (cwd = work dir with raw*.rgba; default module = Zone B objects-stage.mjs)
import fs from "fs";
const src = fs.readFileSync(process.argv[2] || "/workspace/zb-preview-1008/objects-stage.mjs", "utf8");
const grab = (name) => { const i = src.indexOf("function " + name + "("); let d = 0, j = src.indexOf("{", i);
  for (let k = j; k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}") { d--; if (!d) return src.slice(i, k + 1); } } };
const code = ["sectionGraphiteStats", "medianChannel", "sectionMacro", "gradeSection", "suppressBroadBright"].map(grab).join("\n");
const F = new Function(code + "\nreturn {sectionGraphiteStats, medianChannel, sectionMacro, gradeSection, suppressBroadBright};")();
const S = 1024, n = fs.readdirSync(".").filter((f) => /^raw\d+\.rgba$/.test(f)).length;
const cells = []; for (let i = 0; i < n; i++) cells.push(new Uint8ClampedArray(fs.readFileSync(`raw${String(i).padStart(2, "0")}.rgba`)));
cells.forEach((d) => F.suppressBroadBright(d, S));
const stats = cells.map(F.sectionGraphiteStats);
const target = { mean: F.medianChannel(stats, "mean"), std: F.medianChannel(stats, "std") };
cells.forEach((d, i) => { F.gradeSection(d, stats[i], target, F.sectionMacro(i)); fs.writeFileSync(`g${String(i).padStart(2, "0")}.rgba`, d); });
fs.writeFileSync("tone.json", JSON.stringify(target));
console.log(n, JSON.stringify(target));
