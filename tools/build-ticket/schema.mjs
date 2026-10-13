// Subset of JSON Schema draft 2020-12 used by ticket.v1.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SCHEMA_PATH = fileURLToPath(new URL("./schema/ticket.v1.schema.json", import.meta.url));

export function loadSchema() {
  return JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
}

export function schemaErrors(instance, schema = loadSchema()) {
  return check(instance, schema, schema, "$");
}

function deref(ref, root) {
  const match = /^#\/\$defs\/([A-Za-z0-9_-]+)$/.exec(ref);
  if (!match || !root.$defs || !root.$defs[match[1]]) return null;
  return root.$defs[match[1]];
}

function typeOk(value, type) {
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "array") return Array.isArray(value);
  if (type === "string") return typeof value === "string";
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "integer") return typeof value === "number" && Number.isInteger(value);
  if (type === "boolean") return typeof value === "boolean";
  if (type === "null") return value === null;
  return false;
}

function check(value, schema, root, path) {
  if (!schema || typeof schema !== "object") return [`${path} invalid schema`];
  if (schema.$ref) {
    const target = deref(schema.$ref, root);
    if (!target) return [`${path} bad $ref ${schema.$ref}`];
    return check(value, target, root, path);
  }
  if (schema.oneOf) {
    const hits = [];
    const misses = [];
    for (let i = 0; i < schema.oneOf.length; i++) {
      const err = check(value, schema.oneOf[i], root, path);
      if (err.length === 0) hits.push(i);
      else misses.push(`#${i} ${err[0]}`);
    }
    if (hits.length === 1) return [];
    if (hits.length === 0) return [`${path} oneOf 0 matches (${misses.join("; ")})`];
    return [`${path} oneOf ${hits.length} matches`];
  }

  const errors = [];
  if (Object.prototype.hasOwnProperty.call(schema, "const") && value !== schema.const) {
    errors.push(`${path} expected ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path} not in enum`);
  }
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => typeOk(value, type))) {
      errors.push(`${path} type ${JSON.stringify(schema.type)}`);
      return errors;
    }
  }
  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      errors.push(`${path} minLength ${schema.minLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${path} pattern`);
    }
  }
  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      errors.push(`${path} minimum ${schema.minimum}`);
    }
    if (typeof schema.exclusiveMinimum === "number" && value <= schema.exclusiveMinimum) {
      errors.push(`${path} exclusiveMinimum ${schema.exclusiveMinimum}`);
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      errors.push(`${path} maximum ${schema.maximum}`);
    }
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      errors.push(`${path} minItems ${schema.minItems}`);
    }
    if (schema.items) {
      value.forEach((item, index) => {
        errors.push(...check(item, schema.items, root, `${path}[${index}]`));
      });
    }
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const props = schema.properties || {};
    for (const key of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(`${path}.${key} required`);
    }
    for (const key of Object.keys(value)) {
      if (props[key]) {
        errors.push(...check(value[key], props[key], root, `${path}.${key}`));
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}.${key} additional`);
      } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        errors.push(...check(value[key], schema.additionalProperties, root, `${path}.${key}`));
      }
    }
  }
  return errors;
}
