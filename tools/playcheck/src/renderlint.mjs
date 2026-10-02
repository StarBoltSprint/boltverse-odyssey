/**
 * Source scan for law 65. Grep-level. No browser, no pixels.
 * playcheck calls lintPlaySource. The CLI below is the same check.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const NEAREST_RE =
  /texParameteri\s*\(\s*[^,]+,\s*(?:[\w.]+\.)?TEXTURE_(?:MIN|MAG)_FILTER\s*,\s*(?:[\w.]+\.)?NEAREST\s*\)/g;
const REBUILD_RE =
  /bufferData\s*\(\s*[^;]{0,180}?new\s+(?:Float32Array|Uint16Array|Uint32Array|Float64Array|Uint8Array)\b/g;
const CAM_RE = /camQuad\s*\(/g;
const ID_BUFFER_RE = /\bidTex\b|\bidFb\b|picking|object-id|objectId/i;
const SOFT_QUAD_RE = /\b(fog|hero|bolt|gallop|idle)\b/i;

export function lintPlaySource(text, filename = "play.js") {
  const src = stripComments(String(text || ""));
  const findings = [
    ...lintNearest(src, filename),
    ...lintRebuild(src, filename),
    ...lintInstanceDraws(src, filename),
    ...lintCamQuad(src, filename),
  ];
  return { ok: findings.length === 0, findings };
}

export function lintPlayFiles(files) {
  const findings = [];
  for (const file of files) {
    findings.push(...lintPlaySource(file.text, file.name).findings);
  }
  return { ok: findings.length === 0, findings, scanned: files.length };
}

function lintNearest(src, filename) {
  const findings = [];
  for (const match of src.matchAll(NEAREST_RE)) {
    const back = src.slice(Math.max(0, match.index - 600), match.index);
    if (ID_BUFFER_RE.test(back)) continue;
    findings.push(
      hit(
        filename,
        src,
        match.index,
        "nearest_world",
        "NEAREST on a world texture. Stills use LINEAR_MIPMAP_LINEAR; video uses LINEAR. An object-ID buffer may stay NEAREST.",
      ),
    );
  }
  return findings;
}

function lintRebuild(src, filename) {
  const findings = [];
  for (const match of src.matchAll(REBUILD_RE)) {
    findings.push(
      hit(
        filename,
        src,
        match.index,
        "buffer_rebuild",
        "bufferData allocates a new typed array. Static geometry uploads once with STATIC_DRAW. The Bolt quad is the per-frame exception, and it must not allocate a new array per batch.",
      ),
    );
  }
  return findings;
}

function lintInstanceDraws(src, filename) {
  const findings = [];
  const lines = src.split("\n");
  let depth = 0;
  const loopAt = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\bfor\s*\(/.test(line)) loopAt.push(depth);
    const inLoop = loopAt.length > 0;
    if (
      inLoop &&
      /\bdraw(?:Arrays|Elements)\s*\(/.test(line) &&
      !/Instanced/.test(line)
    ) {
      findings.push({
        rule: "instance_draws",
        file: filename,
        line: i + 1,
        detail:
          "Per-object draw inside a loop. Repeated assets use drawArraysInstanced or drawElementsInstanced with vertexAttribDivisor.",
      });
    }
    depth += count(line, "{") - count(line, "}");
    while (loopAt.length && depth <= loopAt[loopAt.length - 1]) loopAt.pop();
  }
  return findings;
}

function lintCamQuad(src, filename) {
  const findings = [];
  for (const match of src.matchAll(CAM_RE)) {
    const back = src.slice(Math.max(0, match.index - 500), match.index);
    if (SOFT_QUAD_RE.test(back)) continue;
    findings.push(
      hit(
        filename,
        src,
        match.index,
        "cam_quad",
        "camQuad on a solid world object. Hull mesh plus a view picked from the camera bearing. Walking 360° shows different sides.",
      ),
    );
  }
  return findings;
}

function hit(filename, src, index, rule, detail) {
  return { rule, file: filename, line: lineOf(src, index), detail };
}

function lineOf(src, index) {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src.charCodeAt(i) === 10) line++;
  return line;
}

function count(line, ch) {
  let n = 0;
  for (let i = 0; i < line.length; i++) if (line[i] === ch) n++;
  return n;
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
}

function main(argv) {
  const files = argv.filter((a) => a !== "--");
  if (!files.length) {
    console.error("node tools/playcheck/src/renderlint.mjs <play.js> [more.js]");
    return 2;
  }
  const loaded = files.map((name) => ({ name, text: readFileSync(name, "utf8") }));
  const result = lintPlayFiles(loaded);
  if (result.ok) {
    console.log(`PASS render_source files=${loaded.length}`);
    return 0;
  }
  console.log(`FAIL render_source findings=${result.findings.length}`);
  for (const f of result.findings) console.log(`${f.rule}\t${f.file}:${f.line}\t${f.detail}`);
  return 1;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) process.exit(main(process.argv.slice(2)));
