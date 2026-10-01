import { createRequire } from "node:module";
import { existsSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const GL_HOOK = `(() => {
  const errors = [];
  const names = {
    1280: "INVALID_ENUM",
    1281: "INVALID_VALUE",
    1282: "INVALID_OPERATION",
    1285: "OUT_OF_MEMORY",
    1286: "INVALID_FRAMEBUFFER_OPERATION"
  };
  const ops = ["drawArrays","drawElements","texImage2D","texSubImage2D","texImage3D","texSubImage3D","texStorage2D","texStorage3D","compressedTexImage2D","framebufferTexture2D","compileShader","linkProgram"];
  function wrap(proto) {
    if (!proto || proto.__playcheckWrapped) return;
    proto.__playcheckWrapped = true;
    const origGet = proto.getError;
    if (typeof origGet !== "function") return;
    for (const op of ops) {
      const orig = proto[op];
      if (typeof orig !== "function") continue;
      proto[op] = function(...args) {
        const result = orig.apply(this, args);
        const code = origGet.call(this);
        if (code) {
          errors.push({ op, code, name: names[code] || String(code) });
          this.__playcheckQueue = this.__playcheckQueue || [];
          this.__playcheckQueue.push(code);
        }
        return result;
      };
    }
    proto.getError = function() {
      const q = this.__playcheckQueue;
      if (q && q.length) return q.shift();
      const code = origGet.call(this);
      if (code) errors.push({ op: "getError", code, name: names[code] || String(code) });
      return code;
    };
  }
  if (typeof WebGLRenderingContext !== "undefined") wrap(WebGLRenderingContext.prototype);
  if (typeof WebGL2RenderingContext !== "undefined") wrap(WebGL2RenderingContext.prototype);
  window.__playcheckGlErrors = errors;
})();`;

export function chromePath() {
  const candidates = [
    process.env.PLAYCHECK_CHROME,
    "/opt/google/chrome/chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p)) || null;
}

export async function launchPhone(videoDir) {
  const executablePath = chromePath();
  if (!executablePath) {
    throw new Error("No Chrome or Chromium binary found. Set PLAYCHECK_CHROME.");
  }
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
      "--disable-gpu-sandbox",
      "--hide-scrollbars",
      "--mute-audio",
      "--disable-logging",
      "--log-level=3",
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  });
  const page = await context.newPage();
  await page.addInitScript(GL_HOOK);
  const consoleErrors = [];
  page.on("console", (msg) => {
    const t = msg.type();
    if (t === "error" || t === "warning") {
      const text = msg.text();
      if (/GPU stall due to ReadPixels/i.test(text)) return;
      consoleErrors.push(text);
    }
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err && err.message ? err.message : err)));
  return { browser, context, page, consoleErrors, executablePath, videoDir };
}

export async function readGlErrors(page) {
  return page.evaluate(() => (window.__playcheckGlErrors || []).slice());
}
