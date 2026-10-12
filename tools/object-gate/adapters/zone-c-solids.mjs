// Adapter for the Zone C solids staging page (port 8772).
import { existsSync } from "node:fs";

const REPO = new URL("../../../", import.meta.url);

export default {
  name: "zone-c-solids",
  defaultUrl: "http://127.0.0.1:8772/?along=0",
  liveDir: null,
  captureQuery: {},
  readyExpr: "window.__sceneReady === true && !!window.__ogHost",
  readyTimeoutMs: 90000,
  hud: null,
  fxNames: "^$",

  async setupInPage(page) {
    await page.evaluate(() => {
      if (!window.__ogHost) throw new Error("staging page did not publish __ogHost");
    });
  },

  async selfReport(page) {
    return page.evaluate(() => {
      const s = window.__solids || {};
      return { solids: { drawCalls: s.drawCalls, objects: s.names || [] } };
    });
  },

  view() {
    return { renderPixelRatio: 1, fovDeg: 51.47, source: "steps/zone-c/01-camera/camera.json fov" };
  },

  sources() {
    const out = [];
    const src = new URL("steps/zone-c/03-terrain/key-zc1.jpg", REPO);
    if (existsSync(src)) out.push({ file: "key-zc1.jpg", source: src.pathname, note: "key-visible faces, native key" });
    const atlas = new URL("steps/zone-c/05-solids/data/plate-atlas.jpg", REPO);
    if (existsSync(atlas)) out.push({ file: "plate-atlas.jpg", source: atlas.pathname, note: "hidden faces, 11 validated plates pasted native" });
    return out;
  },
};
