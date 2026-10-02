#!/usr/bin/env node
// Headless frames from the unlit viewer. Python frames stay if Chrome fails.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, "out", "frames-web");
const yaws = [0, 45, 90, 135, 180, 225, 270, 315];
const chromeBin = process.env.CHROME || "/usr/local/bin/google-chrome";

const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".obj": "text/plain",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root) || !existsSync(file)) {
    res.writeHead(404);
    res.end("missing");
    return;
  }
  const body = await readFile(file);
  res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
  res.end(body);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

const chrome = spawn(chromeBin, [
  "--headless=new",
  "--disable-gpu",
  "--use-gl=angle",
  "--use-angle=swiftshader",
  "--enable-webgl",
  "--hide-scrollbars",
  "--no-first-run",
  "--remote-debugging-port=0",
  "--user-data-dir=/tmp/mesh3d-chrome",
  "about:blank",
], { stdio: ["ignore", "pipe", "pipe"] });

let wsUrl = "";
const log = [];
chrome.stderr.on("data", (buf) => {
  const text = buf.toString();
  log.push(text);
  const match = text.match(/DevTools listening on (ws:\/\/\S+)/);
  if (match) wsUrl = match[1];
});
const started = Date.now();
while (!wsUrl && Date.now() - started < 15000) {
  await new Promise((r) => setTimeout(r, 100));
}
if (!wsUrl) {
  chrome.kill();
  server.close();
  console.error("FAIL chrome", log.join("").slice(-500));
  process.exit(1);
}

const browserWs = wsUrl;
const browser = new WebSocket(browserWs);
await new Promise((resolve, reject) => {
  browser.addEventListener("open", resolve);
  browser.addEventListener("error", reject);
});

let id = 0;
const pending = new Map();
browser.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
function send(method, params = {}, sessionId) {
  const msgId = ++id;
  const payload = { id: msgId, method, params };
  if (sessionId) payload.sessionId = sessionId;
  browser.send(JSON.stringify(payload));
  return new Promise((resolve) => pending.set(msgId, resolve));
}

const { result: target } = await send("Target.createTarget", { url: "about:blank" });
const { result: attached } = await send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
const session = attached.sessionId;
await send("Page.enable", {}, session);
await send("Runtime.enable", {}, session);
await send("Emulation.setDeviceMetricsOverride", {
  width: 720,
  height: 1600,
  deviceScaleFactor: 1,
  mobile: true,
}, session);

const page = `http://127.0.0.1:${port}/viewer/index.html?still=1&yaw=0&bury=1`;
await send("Page.navigate", { url: page }, session);
const readyAt = Date.now();
let ready = false;
while (Date.now() - readyAt < 30000) {
  const ev = await send("Runtime.evaluate", {
    expression: "window.__SHOT_READY === true",
    returnByValue: true,
  }, session);
  if (ev.result?.result?.value === true) {
    ready = true;
    break;
  }
  await new Promise((r) => setTimeout(r, 200));
}
if (!ready) {
  const err = await send("Runtime.evaluate", {
    expression: "location.href + ' | ' + (document.body && document.body.innerText)",
    returnByValue: true,
  }, session);
  console.error("FAIL viewer not ready", JSON.stringify(err.result?.result || err));
  chrome.kill();
  server.close();
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
for (const yaw of yaws) {
  const ev = await send("Runtime.evaluate", {
    expression: `window.renderYaw(${yaw})`,
    returnByValue: true,
    awaitPromise: true,
  }, session);
  const data = ev.result?.result?.value || "";
  if (!data.startsWith("data:image/png")) {
    console.error("FAIL shot", yaw, JSON.stringify(ev.result || ev).slice(0, 400));
    chrome.kill();
    server.close();
    process.exit(1);
  }
  const buf = Buffer.from(data.slice(data.indexOf(",") + 1), "base64");
  const file = path.join(outDir, `yaw-${String(yaw).padStart(3, "0")}.png`);
  await writeFile(file, buf);
  console.log("shot", file, buf.length);
}

chrome.kill();
server.close();
console.log("PASS mesh3d shots", outDir);
