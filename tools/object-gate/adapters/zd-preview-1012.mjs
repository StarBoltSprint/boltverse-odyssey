// Adapter: Zone D terrace preview (agent box /workspace/zd-preview-1012, served on 127.0.0.1:8971). Checks never change.
import { readFileSync, existsSync } from "node:fs";
const DIR = process.env.OG_ZD_DIR || "/workspace/zd-preview-1012";
export default {
  name: "zd-preview-1012",
  defaultUrl: "http://127.0.0.1:8971/",
  liveDir: DIR,
  captureQuery: { hud: "0" },
  readyExpr: "window.__ready === true && !!window.__renderer",
  readyTimeoutMs: 120000,
  hud: { selector: "#tag" },
  fxNames: "^$^",
  async setupInPage(page) {
    await page.evaluate(async () => {
      const st = window.__st;
      window.__ogHost = {
        THREE: window.__THREE, scene: window.__scene, camera: window.__camera, renderer: window.__renderer, path: window.__path,
        groundHeight: () => 0,
        setPose: ({ x, z, eye = 1.6, look }) => {
          st.x = x; st.z = z; st.y = eye;
          if (look) { const dx = look[0] - x, dz = look[2] - z, dy = look[1] - st.y;
            st.yaw = (Math.atan2(dx, -dz) * 180) / Math.PI; st.pitch = Math.max(-75, Math.min(75, (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI)); }
          return { x: st.x, y: st.y, z: st.z, yaw: st.yaw, pitch: st.pitch };
        },
        freeze: () => {},
      };
    });
  },
  async selfReport() { return {}; },
  view() { return { renderPixelRatio: 1.5, fovDeg: 58, source: "zd preview biome.json" }; },
  sources() { const p = `${DIR}/tex-manifest.json`; return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")).textures : []; },
};
