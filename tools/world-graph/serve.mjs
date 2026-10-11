/**
 * Local compare server. /ref serves the live preview. /zone serves the same
 * files, with index.html swapped so main.mjs reads zone-b.zone.json.
 * Neither path writes into the preview directory.
 *
 *   node tools/world-graph/serve.mjs
 * prints PORT <n>
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PREVIEW = "/workspace/zb-preview-1008";
const ROOT = path.resolve(new URL("../..", import.meta.url).pathname);
const FREEZE = `<script>
(function () {
  var F = 100000;
  performance.now = function () { return F; };
  var raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) { return raf(function () { cb(F); }); };
  window.__skyT = 120;
  window.__airT = 10;
})();
</script>`;

function shell(kind) {
  const html0 = fs.readFileSync(path.join(PREVIEW, "index.html"), "utf8");
  const tag = html0.match(/<script type="module" src="\.\/main\.mjs\?v=\d+"><\/script>/);
  if (!tag) throw new Error("preview index.html has no main.mjs module tag");
  let html = html0.replace("<head>", "<head>\n" + FREEZE);
  if (kind === "zone") {
    const pin = tag[0].match(/v=\d+/)[0];
    html = html.replace(tag[0], `<script type="module">
import { bootZone } from "/wg/runtime/zone-loader.mjs";
const zone = await (await fetch("/wg/zone-b.zone.json")).json();
await bootZone(zone, new URL("./main.mjs?${pin}", location.href).href);
</script>`);
  }
  return html;
}

function mime(file) {
  const ext = path.extname(file);
  if (ext === ".mjs" || ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".json") return "application/json";
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".glb") return "model/gltf-binary";
  return "application/octet-stream";
}

/** Map /ref/main.mjs onto preview/main.mjs. A leading dot on the relative part is a 404. */
export function resolveRoute(root, pathname, prefix) {
  const rel = decodeURIComponent(pathname.slice(prefix.length)).replace(/^\/+/, "");
  if (!rel || rel.split("/").includes("..")) return null;
  const file = path.resolve(root, rel);
  if (file !== root && !file.startsWith(root + path.sep)) return null;
  return file;
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://127.0.0.1");
  const sendHtml = (kind) => {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(shell(kind));
  };
  if (u.pathname === "/ref" || u.pathname === "/ref/" || u.pathname === "/ref/index.html") return sendHtml("ref");
  if (u.pathname === "/zone" || u.pathname === "/zone/" || u.pathname === "/zone/index.html") return sendHtml("zone");
  let root = null;
  let prefix = null;
  if (u.pathname.startsWith("/wg/")) { root = ROOT; prefix = "/wg/"; }
  else if (u.pathname.startsWith("/ref/")) { root = PREVIEW; prefix = "/ref/"; }
  else if (u.pathname.startsWith("/zone/")) { root = PREVIEW; prefix = "/zone/"; }
  const file = root ? resolveRoute(root, u.pathname, prefix) : null;
  if (!file) { res.statusCode = 404; res.end("not found"); return; }
  if (file !== root && !file.startsWith(root + path.sep)) { res.statusCode = 403; res.end("forbidden"); return; }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.statusCode = 404; res.end("missing"); return; }
  res.setHeader("content-type", mime(file));
  res.setHeader("cache-control", "no-store");
  fs.createReadStream(file).pipe(res);
});

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  server.listen(0, "127.0.0.1", () => {
    console.log("PORT " + server.address().port);
  });
}
