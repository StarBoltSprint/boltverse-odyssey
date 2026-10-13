// Build-ticket rules. Field order is mandatory. Commit stamps reset on a new HEAD.
import { schemaErrors } from "./schema.mjs";

export const FIELD_ORDER = ["plates", "placement", "build", "gates", "play", "shots", "phone", "go"];
export const RESET_FIELDS = ["gates", "play", "shots", "phone"];
export const SHA = /^[0-9a-f]{7,40}$/i;

const STAMPED = ["build", "gates", "play", "shots", "phone"];

export function blankTicket(objectId) {
  const ticket = {
    schema: "ticket.v1",
    plates: "pending",
    placement: "pending",
    build: "pending",
    gates: "pending",
    play: "pending",
    shots: "pending",
    phone: "pending",
    go: "pending",
  };
  if (objectId) ticket.object_id = objectId;
  return ticket;
}

export function shaEqual(a, b) {
  const left = String(a).toLowerCase();
  const right = String(b).toLowerCase();
  if (!SHA.test(left) || !SHA.test(right)) return false;
  return left === right || left.startsWith(right) || right.startsWith(left);
}

function pending(value) {
  return value == null || value === "pending";
}

function placementTouched(value) {
  return ["path", "min_clearances", "ground_m", "colliders", "budget"].some((key) => value[key] !== undefined);
}

function placementComplete(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pathOk = typeof value.path === "string"
    ? value.path.length > 0
    : Array.isArray(value.path) && value.path.length > 0 && value.path.every((item) => typeof item === "string" && item.length > 0);
  const mins = value.min_clearances;
  const minsOk = mins && typeof mins === "object"
    && typeof mins.headroom_m === "number" && mins.headroom_m >= 0
    && typeof mins.width_m === "number" && mins.width_m >= 0;
  const budget = value.budget;
  const budgetOk = budget && typeof budget.lod0_tri_cap === "number" && budget.lod0_tri_cap >= 0
    && typeof budget.texture_mb_share === "number" && budget.texture_mb_share >= 0;
  const collidersOk = Array.isArray(value.colliders) && value.colliders.every((item) => typeof item === "string" && item.length > 0);
  return pathOk && minsOk && value.ground_m === 0 && collidersOk && budgetOk;
}

function goComplete(value) {
  if (!value || typeof value !== "object") return false;
  if (typeof value.text !== "string" || value.text.length === 0) return false;
  if (value.executed_by !== "Director") return false;
  if (typeof value.timestamp !== "string" || Number.isNaN(Date.parse(value.timestamp))) return false;
  return true;
}

export function inspectField(ticket, name) {
  const value = ticket[name];
  if (pending(value)) return { blocking: "pending", label: "pending" };

  if (name === "plates") {
    if (!Array.isArray(value) || value.length === 0) return { blocking: "pending", label: "pending" };
    if (value.some((plate) => !plate || plate.ad_precheck === "FAIL")) return { blocking: "fail", label: "fail" };
    if (value.every((plate) => plate.ad_precheck === "KEEP")) return { blocking: "pass", label: "pass" };
    return { blocking: "pending", label: "pending" };
  }

  if (name === "placement") {
    if (typeof value !== "object" || Array.isArray(value)) return { blocking: "fail", label: "fail" };
    if (value.ground_m !== undefined && value.ground_m !== 0) return { blocking: "fail", label: "fail" };
    if (placementComplete(value)) return { blocking: "pass", label: "pass" };
    if (placementTouched(value)) return { blocking: "fail", label: "fail" };
    return { blocking: "pending", label: "pending" };
  }

  if (name === "build") {
    if (value && SHA.test(value.commit || "")) return { blocking: "pass", label: "pass" };
    if (value && value.commit) return { blocking: "fail", label: "fail" };
    return { blocking: "pending", label: "pending" };
  }

  if (name === "gates") {
    if (value.status === "pass") return { blocking: "pass", label: "pass" };
    if (value.status === "refused") return { blocking: "fail", label: "refused" };
    if (value.status === "fail") return { blocking: "fail", label: "fail" };
    if (value.status === "pending") return { blocking: "pending", label: "pending" };
    return { blocking: "fail", label: "fail" };
  }

  if (name === "play") {
    if (value.status === "pending") return { blocking: "pending", label: "pending" };
    if (value.status === "FAIL") return { blocking: "fail", label: "FAIL" };
    if (value.status === "KEEP" && SHA.test(value.commit || "") && Array.isArray(value.timecodes)) {
      return { blocking: "pass", label: "KEEP" };
    }
    return { blocking: "fail", label: "FAIL" };
  }

  if (name === "shots") {
    if (value.status === "FAIL" || value.ad_verdict === "FAIL") return { blocking: "fail", label: "FAIL" };
    if (value.status === "KEEP" && value.ad_verdict === "KEEP" && SHA.test(value.commit || "")
      && Array.isArray(value.sheet_paths) && value.sheet_paths.length > 0) {
      return { blocking: "pass", label: "KEEP" };
    }
    if (value.status === "pending" || value.ad_verdict === "pending") return { blocking: "pending", label: "pending" };
    return { blocking: "fail", label: "FAIL" };
  }

  if (name === "phone") {
    if (value.status === "pending") return { blocking: "pending", label: "pending" };
    if (value.status === "fail") return { blocking: "fail", label: "fail" };
    if ((value.status === "pass" || value.status === "fps unverified") && SHA.test(value.commit || "")) {
      return { blocking: "pass", label: value.status };
    }
    return { blocking: "fail", label: "fail" };
  }

  if (name === "go") {
    if (goComplete(value)) return { blocking: "pass", label: "pass" };
    return { blocking: "fail", label: "fail" };
  }

  return { blocking: "fail", label: "fail" };
}

export function autoReset(ticket, head) {
  const reset = [];
  if (!head) return reset;
  const build = ticket.build;
  if (!build || typeof build !== "object" || !build.commit || shaEqual(build.commit, head)) return reset;
  for (const name of RESET_FIELDS) {
    if (!pending(ticket[name])) {
      ticket[name] = "pending";
      reset.push(name);
    }
  }
  return reset;
}

function evaluateGates(ticket, head) {
  const gates = ticket.gates;
  const fail = [];
  let refused = false;
  if (head) {
    const shots = ticket.shots;
    const shotsFilled = shots && typeof shots === "object";
    if (ticket.build && ticket.build.commit && !shaEqual(ticket.build.commit, head)) refused = true;
    if (shotsFilled && shots.commit && !shaEqual(shots.commit, head)) refused = true;
    if (gates.commit && !shaEqual(gates.commit, head)) refused = true;
  }
  if (refused) return { refused: true, fail };

  const measured = gates.clearance && gates.clearance.measured;
  const mins = ticket.placement.min_clearances || {};
  if (!measured || typeof measured !== "object") {
    fail.push("clearance: measured missing");
  } else {
    for (const [key, min] of Object.entries(mins)) {
      if (typeof min !== "number") continue;
      if (typeof measured[key] !== "number" || measured[key] < min) {
        fail.push(`clearance: ${key} ${measured[key]} < ${min}`);
      }
    }
    if (measured.ground_m !== 0) fail.push(`clearance: ground_m ${measured.ground_m} !== 0`);
  }
  const cap = ticket.placement.budget.lod0_tri_cap;
  const share = ticket.placement.budget.texture_mb_share;
  const check = gates.budget_check || {};
  if (typeof check.lod0_tris !== "number" || check.lod0_tris > cap) {
    fail.push(`budget: lod0_tris ${check.lod0_tris} > lod0_tri_cap ${cap}`);
  }
  if (typeof check.texture_mb !== "number" || check.texture_mb > share) {
    fail.push(`budget: texture_mb ${check.texture_mb} > texture_mb_share ${share}`);
  }

  const objectGate = gates.object_gate;
  if (objectGate && typeof objectGate === "object") {
    const verdict = String(objectGate.verdict ?? objectGate.status ?? "").toUpperCase();
    if (verdict === "FAIL") fail.push("object_gate: FAIL");
  }
  return { refused: false, fail };
}

function dedupe(reasons) {
  const seen = new Set();
  const out = [];
  for (const reason of reasons) {
    if (seen.has(reason)) continue;
    seen.add(reason);
    out.push(reason);
  }
  return out;
}

export function validateTicket(ticket, { head = null } = {}) {
  const schemaFail = schemaErrors(ticket).map((error) => `schema: ${error}`);
  if (schemaFail.length) {
    return {
      ok: false,
      exit: 1,
      schema: "ticket.v1",
      head,
      fields: {},
      reset: [],
      reasons: schemaFail,
    };
  }

  const reset = autoReset(ticket, head);
  const reasons = [];
  if (reset.length) reasons.push(`reset: ${reset.join(", ")}`);

  const buildCommit = ticket.build && typeof ticket.build === "object" ? ticket.build.commit : null;
  if (head && buildCommit && !shaEqual(buildCommit, head)) {
    reasons.push("stale-commit: build");
    reasons.push("gates: refused");
  }

  const fields = {};
  const blocking = {};
  for (const name of FIELD_ORDER) {
    const info = inspectField(ticket, name);
    fields[name] = info.label;
    blocking[name] = info.blocking;
  }

  let blocker = null;
  for (const name of FIELD_ORDER) {
    if (blocker && blocking[name] !== "pending") {
      reasons.push(`order: ${name} filled while ${blocker.name} is ${blocker.label}`);
    }
    if (!blocker && blocking[name] !== "pass") {
      blocker = { name, label: blocking[name] === "pending" ? "pending" : fields[name] };
    }
  }

  if (head) {
    for (const name of STAMPED) {
      const value = ticket[name];
      if (!value || typeof value !== "object" || !value.commit) continue;
      if (!shaEqual(value.commit, head)) reasons.push(`stale-commit: ${name}`);
    }
  }

  if (ticket.placement && typeof ticket.placement === "object" && !Array.isArray(ticket.placement)
    && ticket.placement.ground_m !== undefined && ticket.placement.ground_m !== 0) {
    reasons.push(`clearance: placement.ground_m ${ticket.placement.ground_m} !== 0`);
    if (ticket.gates && typeof ticket.gates === "object") fields.gates = "fail";
  }

  const priorsPass = ["plates", "placement", "build"].every((name) => blocking[name] === "pass");
  if (ticket.gates && typeof ticket.gates === "object" && priorsPass) {
    const judged = evaluateGates(ticket, head);
    if (judged.refused) {
      fields.gates = "refused";
      reasons.push("gates: refused");
    } else if (judged.fail.length) {
      fields.gates = "fail";
      reasons.push(...judged.fail);
    } else if (ticket.gates.status === "pending") {
      fields.gates = "pending";
    } else if (ticket.gates.status !== "pass") {
      fields.gates = ticket.gates.status === "refused" ? "refused" : "fail";
      reasons.push(`gates: status ${ticket.gates.status}`);
    } else {
      fields.gates = "pass";
    }
  }

  for (const name of FIELD_ORDER) {
    if (name === "gates") continue;
    if (blocking[name] === "fail") reasons.push(`${name}: ${fields[name]}`);
  }

  const unique = dedupe(reasons);
  const ok = unique.length === 0;
  return {
    ok,
    exit: ok ? 0 : 1,
    schema: "ticket.v1",
    head,
    fields,
    reset,
    reasons: unique,
  };
}
