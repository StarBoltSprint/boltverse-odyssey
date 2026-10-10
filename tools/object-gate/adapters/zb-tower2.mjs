// Zone B tower2 staging. Same adapter as the live preview, but the gate waits until the
// projected hero has published window.__towerReady. The shared adapter must not wait on
// that flag or every other Zone B scene hangs.
import base from "./zb-preview-1008.mjs";

export default {
  ...base,
  name: "zb-tower2",
  readyExpr: "window.__ready === true && !!window.__renderer && !!window.__zbField && window.__towerReady === true",
  readyTimeoutMs: 300000,
};
