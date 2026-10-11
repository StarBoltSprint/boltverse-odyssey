// Adapter for the Zone C causeway staging page. The page already publishes window.__ogHost.
import { readFileSync, existsSync } from "node:fs";

const REPO = new URL("../../../", import.meta.url);

export default {
  name: "zone-c-terrain",
  defaultUrl: "http://127.0.0.1:8771/",
  liveDir: null,
  captureQuery: {},
  readyExpr: "window.__sceneReady === true && !!window.__ogHost",
  readyTimeoutMs: 60000,
  hud: null,
  fxNames: "^$",

  async setupInPage(page) {
    await page.evaluate(() => {
      if (!window.__ogHost) throw new Error("staging page did not publish __ogHost");
    });
  },

  async selfReport(page) {
    return page.evaluate(() => {
      const t = window.__terrain || {};
      return { causeway: { claimedPxPerM: null, triangles: t.triangles, drawCalls: t.drawCalls } };
    });
  },

  view() {
    return { renderPixelRatio: 1, fovDeg: 51.47, source: "steps/zone-c/01-camera/camera.json fov" };
  },

  sources() {
    const dir = new URL("steps/zone-c/03-terrain/plates/", REPO);
    const out = [];
    for (let i = 1; i <= 4; i++) {
      const file = `moss-top-${i}.jpg`;
      const src = new URL(file, dir);
      if (!existsSync(src)) continue;
      out.push({ file, source: src.pathname, note: "Imagine moss slab, native 1408" });
    }
    return out;
  },
};
