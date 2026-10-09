// object-gate init script. Runs in the page BEFORE any game script.
// Tags every decoded image with the URL it came from, so the gate can tell which file a GPU texture is
// (fetch -> arrayBuffer/blob -> new Blob -> createImageBitmap, and <img src>). Read-only: it never changes pixels.
(() => {
  if (window.__ogTags) return;
  const urlOf = new WeakMap();
  window.__ogTags = urlOf;
  window.__ogConsole = [];
  const R = Response.prototype;
  for (const k of ["arrayBuffer", "blob"]) {
    const orig = R[k];
    R[k] = async function () {
      const out = await orig.call(this);
      try { urlOf.set(out, this.url); } catch (e) {}
      return out;
    };
  }
  const OrigBlob = window.Blob;
  class TaggedBlob extends OrigBlob {
    constructor(parts, opts) {
      super(parts, opts);
      try {
        if (parts && parts.length === 1 && parts[0] && typeof parts[0] === "object") {
          const src = parts[0].buffer && !(parts[0] instanceof ArrayBuffer) ? parts[0].buffer : parts[0];
          if (urlOf.has(src)) urlOf.set(this, urlOf.get(src));
          else if (urlOf.has(parts[0])) urlOf.set(this, urlOf.get(parts[0]));
        }
      } catch (e) {}
    }
  }
  window.Blob = TaggedBlob;
  const cib = window.createImageBitmap;
  window.createImageBitmap = async function (src, ...rest) {
    const bmp = await cib.call(this, src, ...rest);
    try {
      let u = urlOf.get(src);
      if (!u && src && src.src) u = src.src;
      if (u) urlOf.set(bmp, u);
      // a crop/resize argument means the GPU copy is not the file: record it
      const o = rest[rest.length - 1];
      if (rest.length >= 4 || (o && typeof o === "object" && (o.resizeWidth || o.resizeHeight))) urlOf.set(bmp, (u || "?") + "#resized");
    } catch (e) {}
    return bmp;
  };
})();
