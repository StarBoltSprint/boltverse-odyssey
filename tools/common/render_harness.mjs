#!/usr/bin/env node
// Headless capture harness. Waits until the loading overlay is gone, then checks the pixels.
// A shot taken while the page still says "Chargement…" must fail the shared capture gate.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import net from "node:net";
import crypto from "node:crypto";

function connectWs(url) {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const sock = net.connect(Number(u.port), u.hostname, () => {
      const key = crypto.randomBytes(16).toString("base64");
      sock.write(
        `GET ${u.pathname}${u.search} HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\n` +
        `Connection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`,
      );
    });
    let buf = Buffer.alloc(0);
    let open = false;
    const queue = [];
    let waiter = null;
    function push(text) {
      if (waiter) { const w = waiter; waiter = null; w(text); }
      else queue.push(text);
    }
    sock.on("error", reject);
    sock.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (!open) {
        const end = buf.indexOf("\r\n\r\n");
        if (end < 0) return;
        const head = buf.slice(0, end).toString();
        if (!head.includes("101")) { reject(new Error(head.slice(0, 200))); sock.destroy(); return; }
        buf = buf.slice(end + 4);
        open = true;
        resolve(api);
      }
      parse();
    });
    function parse() {
      while (buf.length >= 2) {
        const opcode = buf[0] & 0x0f;
        const b1 = buf[1];
        let len = b1 & 0x7f;
        let off = 2;
        if (len === 126) {
          if (buf.length < 4) return;
          len = buf.readUInt16BE(2); off = 4;
        } else if (len === 127) {
          if (buf.length < 10) return;
          len = Number(buf.readBigUInt64BE(2)); off = 10;
        }
        const masked = (b1 & 0x80) !== 0;
        const maskLen = masked ? 4 : 0;
        if (buf.length < off + maskLen + len) return;
        let payload = buf.slice(off + maskLen, off + maskLen + len);
        if (masked) {
          const mask = buf.slice(off, off + 4);
          payload = Buffer.from(payload);
          for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
        }
        buf = buf.slice(off + maskLen + len);
        if (opcode === 1) push(payload.toString("utf8"));
        else if (opcode === 8) sock.end();
        else if (opcode === 9) {
          const pong = Buffer.concat([Buffer.from([0x8a, payload.length]), payload]);
          sock.write(pong);
        }
      }
    }
    function sendText(text) {
      const payload = Buffer.from(text);
      const mask = crypto.randomBytes(4);
      const len = payload.length;
      const head = [Buffer.from([0x81])];
      if (len < 126) head.push(Buffer.from([0x80 | len]));
      else if (len < 65536) {
        const b = Buffer.alloc(3); b[0] = 0x80 | 126; b.writeUInt16BE(len, 1); head.push(b);
      } else {
        const b = Buffer.alloc(9); b[0] = 0x80 | 127; b.writeBigUInt64BE(BigInt(len), 1); head.push(b);
      }
      const masked = Buffer.alloc(len);
      for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i & 3];
      sock.write(Buffer.concat([...head, mask, masked]));
    }
    const api = {
      send: sendText,
      next: () => (queue.length ? Promise.resolve(queue.shift()) : new Promise((r) => { waiter = r; })),
      close: () => sock.end(),
    };
  });
}

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, "fixtures/loading.html");
const CAP = join(HERE, "capture_gate.py");
const OUT = process.argv[2] || join(HERE, "../../steps/foundation-1011");
const CHROME = process.env.CHROME || "/usr/bin/google-chrome";

mkdirSync(OUT, { recursive: true });
const html = readFileSync(FIXTURE);
const server = createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--no-first-run",
  `--remote-debugging-port=0`,
  "--window-size=412,915",
  "--user-data-dir=/tmp/foundation-1011-chrome",
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
while (!wsUrl && Date.now() - started < 15000) await new Promise((r) => setTimeout(r, 50));
if (!wsUrl) {
  chrome.kill();
  server.close();
  console.error("FAIL chrome", log.join("").slice(-400));
  process.exit(1);
}

const browser = await connectWs(wsUrl);
let id = 0;
const pending = new Map();
(async () => {
  for (;;) {
    const text = await browser.next();
    const msg = JSON.parse(text);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
})().catch(() => {});
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
  width: 412, height: 915, deviceScaleFactor: 1, mobile: true,
}, session);
await send("Page.navigate", { url: `http://127.0.0.1:${port}/` }, session);
await new Promise((r) => setTimeout(r, 400));

async function shot(name) {
  const ev = await send("Page.captureScreenshot", {
    format: "png",
    clip: { x: 0, y: 0, width: 412, height: 915, scale: 1 },
    captureBeyondViewport: false,
  }, session);
  const buf = Buffer.from(ev.result.data, "base64");
  const file = join(OUT, name);
  writeFileSync(file, buf);
  return file;
}
function gate(img, dom) {
  const raw = execFileSync("python3", [CAP, JSON.stringify({ img, kind: "frame", dom, strict: false })], { encoding: "utf8" });
  return JSON.parse(raw);
}
async function domText() {
  const ev = await send("Runtime.evaluate", {
    expression: "document.body ? document.body.innerText : ''",
    returnByValue: true,
  }, session);
  return ev.result?.result?.value || "";
}

const beforePath = await shot("loading-before.png");
const beforeDom = await domText();
const before = gate(beforePath, beforeDom);

async function sceneReady() {
  const ev = await send("Runtime.evaluate", {
    expression: `(() => {
      if (window.__sceneReady === false) return false;
      for (const el of document.querySelectorAll('body *')) {
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        let direct = '';
        for (const n of el.childNodes) if (n.nodeType === 3) direct += n.textContent || '';
        if (/chargement/i.test(direct)) return false;
      }
      return true;
    })()`,
    returnByValue: true,
  }, session);
  return ev.result?.result?.value === true;
}
const waitStart = Date.now();
let ready = false;
while (Date.now() - waitStart < 10000) {
  if (await sceneReady()) { ready = true; break; }
  await new Promise((r) => setTimeout(r, 100));
}
const afterPath = await shot("loading-after.png");
const afterDom = await domText();
const after = gate(afterPath, afterDom);

browser.close();
chrome.kill();
server.close();
const report = { ready, before, after, beforeDom, afterDom, beforePath, afterPath };
writeFileSync(join(OUT, "loading-harness.json"), JSON.stringify(report, null, 1));
const ok = before.ok === false && before.loading && after.ok === true && ready;
console.log(JSON.stringify({ ok, before: before.why, after: after.why || "pass", ready }));
process.exit(ok ? 0 : 1);
