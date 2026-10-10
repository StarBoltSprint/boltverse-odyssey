// Decode a phone-bench result link (bench.html#r=...) into JSON or a markdown table.
//   node tools/perf/phone-bench/decode.mjs '<link or payload>' [--md] [--target 22]
// Exit 1 with --target when the averaged "base" row is above the target (ms per frame).
const args = process.argv.slice(2), md = args.includes("--md");
const ti = args.indexOf("--target"), target = ti >= 0 ? +args[ti + 1] : null;
const src = args.find((a, i) => !a.startsWith("--") && (ti < 0 || i !== ti + 1));
if (!src) { console.error("usage: decode.mjs <bench link | payload> [--md] [--target ms]"); process.exit(2); }
export function decode(s) {
  const m = s.match(/#r=([\w-]+)/); const p = (m ? m[1] : s).replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(p + "===".slice((p.length + 3) % 4), "base64").toString("utf8"));
}
const res = decode(src), key = res.v >= 2 ? "ms" : "gpu";
if (res.v >= 4) {   // v4: thermally fair, every row against its own neighbouring base segments
  if (md) {
    console.log(`bench v4 ${res.t} · ${res.info.gpu} · DPR ${res.info.dpr} · ${res.info.css} · cool base ${res.base0} ms\n`);
    console.log("| row | its base | ms | Δ ms | Δ % | norm. | ± |\n|---|---|---|---|---|---|---|");
    for (const r of res.rows) console.log(`| ${r.n} | ${r.b} | ${r.ms} | ${r.d > 0 ? "+" : ""}${r.d} | ${r.p > 0 ? "+" : ""}${r.p} | ${r.norm ?? ""} | ${r.spread} |`);
  } else console.log(JSON.stringify({ ...res, baseMs: res.base0 }, null, 1));
  if (target != null) { const ok = res.base0 <= target; console.error(`base ${res.base0} ms vs target ${target}: ${ok ? "PASS" : "FAIL"}`); process.exit(ok ? 0 : 1); }
  process.exit(0);
}
const mean = (re) => { const a = res.rows.filter((r) => re.test(r.n)); return a.length ? a.reduce((t, r) => t + r[key], 0) / a.length : null; };
const base = mean(/^base/), down = mean(/^DOWN base/);
if (md) {
  console.log(`bench v${res.v} ${res.t} · ${res.info.gpu} · DPR ${res.info.dpr} · ${res.info.css} · metric ${key}\n`);
  console.log("| row | " + key + " | Δ vs base |" + (res.v >= 2 ? " cpu | sync |" : "") + "\n|---|---|---|" + (res.v >= 2 ? "---|---|" : ""));
  for (const r of res.rows) {
    const b = r.n.startsWith("DOWN") ? down : base, d = b ? r[key] - b : 0;
    console.log(`| ${r.n} | ${r[key]} | ${/^(DOWN )?base/.test(r.n) ? "base" : (d > 0 ? "+" : "") + d.toFixed(1) + " (" + Math.round((100 * d) / b) + "%)"} |` + (res.v >= 2 ? ` ${r.cpu} | ${r.sync} |` : ""));
  }
} else console.log(JSON.stringify({ ...res, baseMs: base, downBaseMs: down }, null, 1));
if (target != null) { const ok = base != null && base <= target; console.error(`base ${base?.toFixed(1)} ms vs target ${target}: ${ok ? "PASS" : "FAIL"}`); process.exit(ok ? 0 : 1); }
