/**
 * The live preview proxy treats a raw `@` in a module path as URL userinfo and
 * fails the TLS handshake (HTTP 525). Scoped packages and Vite's optimized
 * deps both ship those paths (`/node_modules/@scope/…`, `.vite/deps/@pkg.js`).
 *
 * Vite's import analysis must still see the real paths, so this does not
 * rewrite modules in `transform`. It rewrites the JavaScript bytes on the way
 * out, and maps the `@`-free request back to the real file before Vite serves it.
 * `/@id/` and `/@vite/` are left alone — those already load.
 */

export function rewriteClientModuleUrls(code) {
  if (!code.includes("@")) return code;
  let next = code.replaceAll("/node_modules/@", "/nm/");
  next = next.replace(
    /\/node_modules\/\.vite\/deps\/([A-Za-z0-9_@.-]+)(?=["'?)\s])/g,
    (full, name) => {
      if (!name.includes("@")) return full;
      return `/node_modules/.vite/deps/${name.replaceAll("@", "atscope_")}`;
    },
  );
  return next;
}

export function restoreModuleUrl(url) {
  const q = url.indexOf("?");
  const path = q === -1 ? url : url.slice(0, q);
  const query = q === -1 ? "" : url.slice(q);
  let next = path;
  if (next.startsWith("/nm/")) next = `/node_modules/@${next.slice(4)}`;
  next = next.replace(/\/\.vite\/deps\/([^/?]+)/g, (_, name) => {
    return `/.vite/deps/${name.replaceAll("atscope_", "@")}`;
  });
  return next + query;
}

function bufferChunk(chunk, encoding) {
  if (chunk == null) return null;
  if (typeof chunk === "string") return Buffer.from(chunk, typeof encoding === "string" ? encoding : "utf8");
  return Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
}

export function safeModuleUrlsPlugin() {
  return {
    name: "app-builder:safe-module-urls",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && (req.url.startsWith("/nm/") || req.url.includes("/.vite/deps/atscope_"))) {
          req.url = restoreModuleUrl(req.url);
        }

        const chunks = [];
        const origSetHeader = res.setHeader.bind(res);
        const origWrite = res.write.bind(res);
        const origEnd = res.end.bind(res);
        let contentType = String(res.getHeader("content-type") ?? "");

        res.setHeader = (name, value) => {
          if (String(name).toLowerCase() === "content-type") contentType = String(value);
          if (String(name).toLowerCase() === "content-length") return res;
          return origSetHeader(name, value);
        };
        res.write = (chunk, encoding, cb) => {
          const buf = bufferChunk(chunk, encoding);
          if (buf) chunks.push(buf);
          if (typeof encoding === "function") encoding();
          else if (typeof cb === "function") cb();
          return true;
        };
        res.end = (chunk, encoding, cb) => {
          if (typeof chunk === "function") {
            cb = chunk;
            chunk = undefined;
            encoding = undefined;
          } else if (typeof encoding === "function") {
            cb = encoding;
            encoding = undefined;
          }
          const buf = bufferChunk(chunk, encoding);
          if (buf) chunks.push(buf);
          let body = chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0);
          const type = contentType || String(res.getHeader("content-type") ?? "");
          if (/javascript|ecmascript/.test(type) && body.length) {
            const text = body.toString("utf8");
            const rewritten = rewriteClientModuleUrls(text);
            if (rewritten !== text) body = Buffer.from(rewritten);
          }
          try {
            origSetHeader("content-length", body.length);
          } catch {
            /* headers already flushed */
          }
          return origEnd(body, cb);
        };
        // Keep a reference so a later wrapper can still stream if it replaces us.
        void origWrite;
        next();
      });
    },
  };
}
