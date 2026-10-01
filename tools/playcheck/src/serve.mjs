import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp4": "video/mp4",
  ".css": "text/css",
  ".webm": "video/webm",
};

export function startStatic(root) {
  const base = path.resolve(root);
  const server = createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.resolve(base, "." + rel);
    if (!file.startsWith(base)) {
      res.writeHead(403);
      res.end("no");
      return;
    }
    try {
      const st = statSync(file);
      if (st.isDirectory()) {
        res.writeHead(302, { location: url.pathname.replace(/\/?$/, "/") });
        res.end();
        return;
      }
      const body = readFileSync(file);
      res.writeHead(200, {
        "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({
        port,
        urlFor(pathname) {
          return `http://127.0.0.1:${port}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
        },
        close() {
          return new Promise((r) => server.close(() => r()));
        },
      });
    });
  });
}
