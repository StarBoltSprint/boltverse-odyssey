// Adapter: Zone B preview (agent workspace /workspace/zb-preview-1008, served on 127.0.0.1:8996).
// An adapter only tells the gate how to reach the THREE scene of one game page. The checks never change.
import { readFileSync, existsSync } from "node:fs";

const PREVIEW_DIR = process.env.OG_ZB_DIR || "/workspace/zb-preview-1008";

export default {
  name: "zb-preview-1008",
  defaultUrl: "http://127.0.0.1:8996/",
  // live tree (read-only for every job: stage edits in a copy, swap after PASS)
  liveDir: PREVIEW_DIR,
  // capture pages: no HUD, fixed quality, eye 1.6 m (phone held by a standing player)
  captureQuery: { hud: "0", lockq: "1", eye: "1.6", grain: "0" },
  readyExpr: "window.__ready === true && !!window.__renderer && !!window.__zbField",
  readyTimeoutMs: 300000,
  hud: { selector: "#tag" },
  // Fx (particles, sand veils, sky sprites) are hidden for object captures and shown for the effects check.
  fxNames: "^(air-|sky1-sprites)",

  /** Runs in the page. Publishes window.__ogHost. */
  async setupInPage(page) {
    await page.evaluate(async () => {
      const THREE = await import(new URL("./three.module.js", location.href).href);
      const r = window.__renderer;
      let best = null;
      const orig = r.render;
      r.render = function (s, c) {
        if (s && s.isScene && c && c.isPerspectiveCamera) {
          let n = 0; s.traverse(() => n++);
          if (!best || n > best.n) best = { s, c, n };
        }
        return orig.apply(this, arguments);
      };
      for (let i = 0; i < 3; i++) await new Promise((res) => requestAnimationFrame(() => res()));
      r.render = orig; // WebGLRenderer.render is an instance property: restore, never delete
      if (!best) throw new Error("no perspective scene render seen");
      // avenue axis of the key view (same numbers as preview-gate.mjs mesa avenue row) + hero spawn
      const AV_O = [0.287, 1.349], AV_F = [0.97933, -0.20233];
      const path = [[-51.115, 9.63]];
      for (let s = -150; s <= 520; s += 10) path.push([AV_O[0] + AV_F[0] * s, AV_O[1] + AV_F[1] * s]);
      const st = window.__st, field = window.__zbField;
      window.__ogHost = {
        THREE, scene: best.s, camera: best.c, renderer: r, path,
        groundHeight: (x, z) => field.surfaceHeight(x, z),
        setPose: ({ x, z, eye = 1.6, look }) => {
          st.x = x; st.z = z; st.y = field.surfaceHeight(x, z) + eye;
          if (look) {
            const dx = look[0] - x, dz = look[2] - z, dy = look[1] - st.y;
            st.yaw = (Math.atan2(dx, -dz) * 180) / Math.PI;
            st.pitch = Math.max(-75, Math.min(75, (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI));
          }
          return { x: st.x, y: st.y, z: st.z, yaw: st.yaw, pitch: st.pitch };
        },
        freeze: () => { window.__skyT = 120; window.__airT = 3.0; },
      };
    });
  },

  /** What the scene says about itself (cross-checked against the measurement, never trusted). */
  async selfReport(page) {
    return page.evaluate(() => {
      const g = window.__objectsGate || {};
      const out = {};
      for (const [k, v] of Object.entries(g.texel || {})) out[k] = { claimedPxPerM: v.pxPerM, detailPxPerM: v.detailPxPerM };
      if (g.texQc) out._texQc = g.texQc;
      return out;
    });
  },

  /** The game's own render pixel ratio and base vertical fov (texel policy "visible"). Read from the live biome.json
   *  the way main.mjs does: pr = min(devicePixelRatio, camera.pixelRatioCap); fov = camera.fovBase ?? 58. Read-only. */
  view() {
    let cam = {};
    try { cam = JSON.parse(readFileSync(`${PREVIEW_DIR}/biome.json`, "utf8")).camera || {}; } catch {}
    return { renderPixelRatio: cam.pixelRatioCap ?? 1, fovDeg: cam.fovBase ?? 58, source: "game: biome.json camera.pixelRatioCap, main.mjs fovBase ?? 58" };
  },

  /** Texture originals: served file -> Imagine source (tex-manifest.json written by the texture passes). */
  sources() {
    const p = `${PREVIEW_DIR}/tex-manifest.json`;
    if (!existsSync(p)) return [];
    return JSON.parse(readFileSync(p, "utf8")).textures.map((t) => ({ file: t.file, source: t.source, nativeW: t.nativeW, nativeH: t.nativeH, note: t.note }));
  },
};
