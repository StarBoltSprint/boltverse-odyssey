#!/usr/bin/env node
// Fixture: brand-new Grok reads these first. sill ≠ spawn must be instant.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function must(ok, msg) {
  if (!ok) {
    console.error("FAIL  " + msg);
    process.exit(1);
  }
  console.log("PASS  " + msg);
}

function head(rel, n) {
  return readFileSync(join(root, rel), "utf8").split("\n").slice(0, n).join("\n");
}

function body(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const agentsHead = head("AGENTS.md", 16);
must(/sill ≠ spawn/.test(agentsHead), "AGENTS.md head: sill ≠ spawn");
must(/already AT the teal LEFT sill/.test(agentsHead) && /already AT the gold RIGHT sill/.test(agentsHead), "AGENTS.md head: at-A/at-B = AT the sill");
must(/Spawn = CENTER only/.test(agentsHead), "AGENTS.md head: spawn = center only");
must(/Mid-hall at-A\/at-B = \*\*FAIL\*\*/.test(agentsHead), "AGENTS.md head: mid-hall FAIL");
must(/Soft KEEP banned/.test(agentsHead), "AGENTS.md head: Soft KEEP banned");

const rulesHead = head(".cursorrules", 12);
must(/sill ≠ spawn/.test(rulesHead), ".cursorrules head: sill ≠ spawn");
must(/already AT the teal LEFT sill/.test(rulesHead) && /already AT the gold RIGHT sill/.test(rulesHead), ".cursorrules head: at-A/at-B = AT the sill");
must(/Spawn = CENTER only/.test(rulesHead), ".cursorrules head: spawn = center only");
must(/Mid-hall at-A\/at-B = FAIL/.test(rulesHead), ".cursorrules head: mid-hall FAIL");
must(/Soft KEEP banned/.test(rulesHead), ".cursorrules head: Soft KEEP banned");

const grok = body("GROK.md");
const stop = grok.slice(0, grok.indexOf("### Custom instructions"));
must(/sill ≠ spawn/.test(stop), "GROK.md STOP: sill ≠ spawn");
must(/already AT the teal LEFT sill/.test(stop) && /already AT the gold RIGHT sill/.test(stop), "GROK.md STOP: at-A/at-B = AT the sill");
must(/Spawn = CENTER only/.test(stop), "GROK.md STOP: spawn = center only");
must(/Mid-hall at-A\/at-B = \*\*FAIL\*\*/.test(stop), "GROK.md STOP: mid-hall FAIL");
must(/Soft KEEP banned/.test(stop), "GROK.md STOP: Soft KEEP banned");

const customize = grok.slice(grok.indexOf("```\nBoltverse"), grok.indexOf("```\n\n---"));
must(/sill ≠ spawn/.test(customize), "GROK.md Customize: sill ≠ spawn");
must(/already AT the teal LEFT sill/.test(customize) && /already AT the gold RIGHT sill/.test(customize), "GROK.md Customize: at-A/at-B = AT the sill");
must(/Spawn = CENTER only/.test(customize), "GROK.md Customize: spawn = center only");
must(/Mid-hall at-A\/at-B = FAIL/.test(customize), "GROK.md Customize: mid-hall FAIL");
must(/Soft KEEP banned/.test(customize), "GROK.md Customize: Soft KEEP banned");

console.log("COLD-START PASS");
