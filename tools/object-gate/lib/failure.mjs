// Shared failure record for every object-gate row and every fixPlan item.
// Additive on the existing row: id, check, detail, and hints stay.
// Face ids and world positions are copied from measurement files already on disk.
// They are never invented. suggested_fix is empty only when status is not FAIL.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Same table the fix loop switches on. hooks/imagine-to-3d.mjs re-exports it. */
export const FIX_ACTIONS = [
  { re: /^native Imagine px\/m/, action: "plate-sections", auto: true, what: "split the surface into sections; one crop-sourced full-res Imagine edit per section (no tiling, no upscale)" },
  { re: /^visible px\/m/, action: "plate-sections", auto: true, what: "cut the surface into more sections so each native 1024x1024 Imagine plate covers at most ~6.6 m (phone sharpness from 8 m); one shared plate set per type is fine" },
  { re: /^repetition \(visible\): identical/, action: "spread-plates", auto: true, what: "section LUT / more pool layers / flips so the same plate pixels never appear within 30 m" },
  { re: /^repetition \(visible\): neighbours/, action: "spread-plates", auto: true, what: "neighbouring copies (< 7 m) get different plate windows or a mirrored set, or move apart" },
  { re: /^repetition \(UV\)/, action: "unique-plates", auto: true, what: "UV each section 0..1 once; no plate repeats on a surface" },
  { re: /^repetition \(capture/, action: "unique-plates", auto: true, what: "remove visible tiling; second Imagine variant + low-frequency mask if needed" },
  { re: /^UV stretch/, action: "reunwrap", auto: true, what: "surface-aware UV, equal metres per texel on both axes" },
  { re: /^plates not downscaled/, action: "restore-native", auto: true, what: "copy the Imagine output byte-for-byte (package.py already does), no resize" },
  { re: /^texture filtering/, action: "texture-params", auto: true, what: "mipmaps + LinearMipmapLinear + anisotropy = renderer max" },
  { re: /^texture roles/, action: "declare-roles", auto: true, what: "write every texture's role in the object spec" },
  { re: /^approach morph/, action: "single-silhouette-lod", auto: true, what: "LOD1 = decimated LOD0 with the same cuts (or no swap); crossfade" },
  { re: /^shadow world-fixed/, action: "static-shadow", auto: true, what: "static world-fixed shadow map over all casters" },
  { re: /^shadow colour/, action: "shadow-tint", auto: true, what: "neutral dark shadow multiply, fix the lookup" },
  { re: /^shadow cast/, action: "cast-shadow", auto: true, what: "castShadow on every LOD, ground receives" },
  { re: /^grounding/, action: "sink", auto: true, what: "sink below the lowest footprint corner + base fill + drift" },
  { re: /^mesh sealed/, action: "heal-manifold", auto: true, what: "weld, drop coincident faces, cap loops" },
  { re: /^painted duplicate/, action: "inpaint-basalt", auto: false, what: "inpaint painted feature with neighbouring basalt" },
  { re: /^facade relief/, action: "add-relief", auto: true, what: "model relief from the key crop (fins/ledges/bays or strata)" },
  { re: /^proportions/, action: "rescale", auto: true, what: "scale the solid to the spec ratios in Blender" },
  { re: /^effects/, action: "imagine-fx-texture", auto: true, what: "sample the effect colour/alpha from an Imagine plate" },
  { re: /^facade crisp/, action: "quantise-planes", auto: true, what: "quantise the depth relief into a few flat planes and crisp right-angle steps" },
  // key-compare rows (2026-10-10) -> imagine-to-3d fixloop.py classes kc-shape / kc-colour / kc-detail (never an Imagine generation)
  { re: /^key-compare .*: iou/, action: "kc-shape", auto: true, what: "shape-seed search + silhouette warp toward the key mask of the element (fixloop.py keyloop)" },
  { re: /^key-compare .*: (deLit|deShadow)/, action: "kc-colour", auto: true, what: "grade-match the element toward the key, lit and shadow separately (render-measured Lab offset on the Imagine plates)" },
  { re: /^key-compare .*: structure/, action: "kc-detail", auto: true, what: "plate re-pick from the closest key-style plates, relief strength and detail-layer sweep (fixloop.py keyloop)" },
  { re: /^key-compare .*: present/, action: "build-element", auto: false, what: "the key element is missing in game: build / mount it (Imagine requests need approval)" },
  { re: /^key-compare run/, action: "fix-runtime", auto: true, what: "key-compare crashed: fix the spec or the staging URL" },
  { re: /^key checklist: every item/, action: "verify-captures", auto: false, what: "Grok vision / owner reviews the capture sheet next to the key crop and records pass/fail per item" },
  { re: /^key checklist written|^key crop present/, action: "write-checklist", auto: false, what: "write the per-object checklist from the key crop" },
];

function oneSentence(s) {
  const t = String(s).replace(/\s+/g, " ").trim();
  if (!t) return "";
  const cut = t.search(/[.!?](\s|$)/);
  const out = cut === -1 ? t : t.slice(0, cut + 1);
  return out.length > 320 ? out.slice(0, 317).trimEnd() + "." : out;
}

/** One short sentence. Empty string only when status is not FAIL. */
export function suggestedFix(row) {
  if (!row || row.status !== "FAIL") return "";
  const text = String(row.check || "");
  const hit = FIX_ACTIONS.find((f) => f.re.test(text));
  if (hit && hit.what) return oneSentence(hit.what);
  const hint = (row.hints || []).map((h) => String(h).trim()).find(Boolean);
  if (hint) return oneSentence(hint);
  if (/shader/.test(text)) return "Fix the shader compile error and re-run the gate before any version bump.";
  if (/^console/.test(text)) return "Fix the first console or page error and re-run the gate.";
  if (/live preview untouched/.test(text)) return "Gate a staging copy and swap the live preview only after PASS.";
  return "Fix this failing check and re-run the gate.";
}

function vec3(v) {
  if (!Array.isArray(v) || v.length !== 3) return null;
  if (!v.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  return [v[0], v[1], v[2]];
}

function faceId(f) {
  if (typeof f === "string" && f) return f;
  if (!f || typeof f !== "object") return null;
  if (typeof f.id === "string" && f.id) return f.id;
  if (typeof f.faceId === "string" && f.faceId) return f.faceId;
  if (typeof f.face === "string" && f.face) return f.face;
  return null;
}

function faceWorld(f) {
  if (!f || typeof f !== "object") return null;
  return vec3(f.world) || vec3(f.world_position) || vec3(f.worldPosition) || vec3(f.position) || vec3(f.center);
}

function failingFlag(f) {
  if (!f || typeof f !== "object") return false;
  if (f.fail === true || f.failing === true || f.nonManifold === true || f.open === true) return true;
  return f.kind === "open" || f.kind === "nonManifold" || f.kind === "degenerate";
}

/** String ids, or objects flagged as failing. Unflagged faces in a mixed list are skipped. */
function takeFaces(list, assumeFailing) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const f of list) {
    const id = faceId(f);
    if (!id) continue;
    if (!assumeFailing && !failingFlag(f)) continue;
    out.push({ id, pos: faceWorld(f) });
  }
  return out;
}

function pullGeometry(geo) {
  const list = Array.isArray(geo) ? geo : geo ? [geo] : [];
  const ids = [];
  let position = null;
  for (const g of list) {
    if (!g || typeof g !== "object") continue;
    const chunks = [
      ...takeFaces(g.failing_face_ids, true),
      ...takeFaces(g.failingFaces, true),
      ...takeFaces(g.openFaces, true),
      ...takeFaces(g.nonManifoldFaces, true),
      ...takeFaces(g.faces, false),
    ];
    for (const c of chunks) {
      if (!ids.includes(c.id)) ids.push(c.id);
      if (!position && c.pos) position = c.pos;
    }
    if (!position) position = vec3(g.world_position) || vec3(g.worldPosition) || vec3(g.center);
  }
  return { faces: ids, position };
}

function kindOf(row) {
  const id = row.id || "";
  const text = String(row.check || "");
  if (id.startsWith("geometry.") || /^mesh sealed|^facade relief|^proportions/.test(text)) return "geometry";
  if (id === "grounding" || /^grounding/.test(text)) return "grounding";
  if (id === "morph" || /^approach morph/.test(text)) return "morph";
  return "other";
}

function readJson(dir, name) {
  if (!dir) return null;
  const p = join(dir, name);
  try {
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function namedBox(boxes, detail) {
  if (!Array.isArray(boxes)) return null;
  const text = String(detail || "");
  const named = boxes.filter((b) => b && typeof b.id === "string" && b.id && text.includes(b.id));
  const pick = named[0] || (boxes.length === 1 ? boxes[0] : null);
  if (!pick) return null;
  return vec3(pick.center) || vec3(pick.position) || vec3(pick.world_position) || vec3(pick.worldPosition);
}

function storedPoint(rows) {
  if (!Array.isArray(rows)) return null;
  for (const g of rows) {
    if (!g || typeof g !== "object") continue;
    const p = vec3(g.world_position) || vec3(g.worldPosition) || vec3(g.position) || vec3(g.center);
    if (p) return p;
  }
  return null;
}

/**
 * Faces and a world position already stored next to the object.
 * geometry.json faces, boxes.json centers, morph.json / grounding.json 3-vectors.
 * A missing file or a missing field stays empty / null.
 */
export function evidenceFromDir(dir, row) {
  const kind = kindOf(row);
  const detail = `${row.detail || ""} ${row.check || ""}`;
  let faces = [];
  let position = null;
  if (kind === "geometry") {
    const pulled = pullGeometry(readJson(dir, "geometry.json"));
    faces = pulled.faces;
    position = pulled.position;
  }
  if (!position && (kind === "geometry" || kind === "grounding" || kind === "morph")) {
    position = namedBox(readJson(dir, "boxes.json"), detail);
  }
  if (!position && kind === "grounding") position = storedPoint(readJson(dir, "grounding.json"));
  if (!position && kind === "morph") position = storedPoint(readJson(dir, "morph.json"));
  return { faces, position };
}

/**
 * Stamp the five shared fields. `evidence` (from evidenceFromDir) wins for a FAIL.
 * PASS / INFO / WARN: failing_face_ids [], world_position null, suggested_fix "".
 */
export function applyFailureFields(row, evidence = null) {
  const status = row.status || "INFO";
  const fail = status === "FAIL";
  let faces = [];
  let position = null;
  if (fail) {
    if (evidence && Array.isArray(evidence.faces)) faces = evidence.faces.map(String);
    else if (Array.isArray(row.failing_face_ids)) faces = row.failing_face_ids.map(String);
    if (evidence && Object.prototype.hasOwnProperty.call(evidence, "position")) position = vec3(evidence.position);
    else position = vec3(row.world_position);
  }
  const suggested = fail
    ? (typeof row.suggested_fix === "string" && row.suggested_fix.trim() ? oneSentence(row.suggested_fix) : suggestedFix({ ...row, status: "FAIL" }))
    : "";
  return {
    ...row,
    check: row.check,
    status,
    failing_face_ids: faces,
    world_position: position,
    suggested_fix: suggested,
  };
}

/** Legacy row (no new fields) → shared record. `dir` reads geometry.json / boxes.json / morph.json when present. */
export function adaptLegacyRow(row, dir = null) {
  const stamped = applyFailureFields({ ...row, failing_face_ids: undefined, world_position: undefined, suggested_fix: undefined });
  if (!dir || stamped.status !== "FAIL") return stamped;
  return applyFailureFields(stamped, evidenceFromDir(dir, stamped));
}

/** Re-stamp every row of one object from the measurement files in `dir`. */
export function annotateObjectRows(rows, dir) {
  return (rows || []).map((row) => {
    const base = applyFailureFields(row);
    if (base.status !== "FAIL" || !dir) return base;
    return applyFailureFields(base, evidenceFromDir(dir, base));
  });
}
