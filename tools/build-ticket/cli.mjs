#!/usr/bin/env node
// node tools/build-ticket/cli.mjs validate <ticket.json> [--git-dir <repo>] [--commit <sha>]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { schemaErrors } from "./schema.mjs";
import {
  FIELD_ORDER,
  SHA,
  blankTicket,
  inspectField,
  validateTicket,
} from "./ticket.mjs";

const USAGE = [
  "usage: node tools/build-ticket/cli.mjs validate <ticket.json> [--git-dir <repo>] [--commit <sha>]",
  "       node tools/build-ticket/cli.mjs init <ticket.json> [--object <id>] [--force]",
  "       node tools/build-ticket/cli.mjs set-field <ticket.json> <field> (--json <json> | --file <path>) [--git-dir <repo>] [--commit <sha>]",
].join("\n");

function emit(summary, code) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.exit(code);
}

function die(message) {
  emit({
    ok: false,
    exit: 2,
    schema: "ticket.v1",
    head: null,
    fields: {},
    reset: [],
    reasons: [message],
  }, 2);
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--force") {
      flags.force = true;
      continue;
    }
    if (arg === "--git-dir" || arg === "--commit" || arg === "--object" || arg === "--json" || arg === "--file") {
      const value = argv[i + 1];
      if (value == null || value.startsWith("--")) die(`missing value for ${arg}\n${USAGE}`);
      flags[arg.slice(2)] = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--")) die(`unknown flag ${arg}\n${USAGE}`);
    positional.push(arg);
  }
  return { positional, flags };
}

function findGit(start) {
  let dir = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function resolveHead(flags, ticketFile) {
  if (flags.commit) {
    if (!SHA.test(flags.commit)) die(`commit must be 7 or more hex characters\n${USAGE}`);
    return flags.commit.toLowerCase();
  }
  const fromFlag = flags["git-dir"];
  const dir = fromFlag || findGit(path.dirname(path.resolve(ticketFile)));
  if (!dir) return null;
  if (fromFlag && !existsSync(dir)) die(`git dir not found: ${dir}`);
  const proc = spawnSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" });
  if (proc.status !== 0) {
    const detail = (proc.stderr || proc.stdout || "git rev-parse failed").trim();
    if (fromFlag) die(detail);
    return null;
  }
  return proc.stdout.trim();
}

function readTicket(file) {
  if (!file) die(`missing ticket path\n${USAGE}`);
  if (!existsSync(file)) die(`ticket not found: ${file}`);
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    die(`cannot read ticket: ${error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    die(`ticket is not JSON: ${error.message}`);
  }
}

function writeTicket(file, ticket) {
  writeFileSync(file, `${JSON.stringify(ticket, null, 2)}\n`);
}

function finish(file, ticket, flags) {
  const head = resolveHead(flags, file);
  const summary = validateTicket(ticket, { head });
  summary.ticket = path.resolve(file);
  if (summary.reset.length) {
    writeTicket(file, ticket);
    summary.wrote = true;
  }
  emit(summary, summary.exit);
}

function commandInit(file, flags) {
  if (!file) die(`missing ticket path\n${USAGE}`);
  if (existsSync(file) && !flags.force) {
    emit({
      ok: false,
      exit: 1,
      schema: "ticket.v1",
      ticket: path.resolve(file),
      head: null,
      fields: {},
      reset: [],
      reasons: [`ticket already exists: ${file}`],
    }, 1);
  }
  const ticket = blankTicket(flags.object);
  writeTicket(file, ticket);
  const summary = validateTicket(ticket, { head: null });
  summary.ticket = path.resolve(file);
  summary.wrote = true;
  emit(summary, summary.exit);
}

function commandSetField(file, field, flags) {
  if (!file || !field) die(`missing ticket or field\n${USAGE}`);
  if (!FIELD_ORDER.includes(field)) die(`unknown field ${field}\n${USAGE}`);
  if (flags.json == null && flags.file == null) die(`set-field needs --json or --file\n${USAGE}`);
  let value;
  try {
    const text = flags.file != null ? readFileSync(flags.file, "utf8") : flags.json;
    value = JSON.parse(text);
  } catch (error) {
    die(`field value is not JSON: ${error.message}`);
  }
  const ticket = readTicket(file);
  const index = FIELD_ORDER.indexOf(field);
  for (let i = 0; i < index; i++) {
    const earlier = FIELD_ORDER[i];
    const info = inspectField(ticket, earlier);
    if (info.blocking !== "pass") {
      emit({
        ok: false,
        exit: 1,
        schema: "ticket.v1",
        ticket: path.resolve(file),
        head: null,
        fields: {},
        reset: [],
        reasons: [`order: cannot set ${field} while ${earlier} is ${info.label}`],
      }, 1);
    }
  }
  ticket[field] = value;
  const schemaFail = schemaErrors(ticket).map((error) => `schema: ${error}`);
  if (schemaFail.length) {
    emit({
      ok: false,
      exit: 1,
      schema: "ticket.v1",
      ticket: path.resolve(file),
      head: null,
      fields: {},
      reset: [],
      reasons: schemaFail,
    }, 1);
  }
  writeTicket(file, ticket);
  finish(file, ticket, flags);
}

const { positional, flags } = parseArgs(process.argv.slice(2));
const command = positional[0];
if (!command) die(USAGE);

if (command === "validate") finish(positional[1], readTicket(positional[1]), flags);
else if (command === "init") commandInit(positional[1], flags);
else if (command === "set-field") commandSetField(positional[1], positional[2], flags);
else die(`unknown command ${command}\n${USAGE}`);
