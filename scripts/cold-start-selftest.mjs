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
must(/\.kitchen\/fail/.test(stop), "GROK.md STOP: FAIL save → .kitchen/fail");
must(/enlarge/.test(stop), "GROK.md STOP: enlarge-only sill step");

const customize = grok.slice(grok.indexOf("```\nBoltverse"), grok.indexOf("```\n\n---"));
must(/sill ≠ spawn/.test(customize), "GROK.md Customize: sill ≠ spawn");
must(/already AT the teal LEFT sill/.test(customize) && /already AT the gold RIGHT sill/.test(customize), "GROK.md Customize: at-A/at-B = AT the sill");
must(/Spawn = CENTER only/.test(customize), "GROK.md Customize: spawn = center only");
must(/Mid-hall at-A\/at-B = FAIL/.test(customize), "GROK.md Customize: mid-hall FAIL");
must(/Soft KEEP banned/.test(customize), "GROK.md Customize: Soft KEEP banned");
must(!/oval doors cannot PASS/.test(customize), "GROK.md Customize: oval doors not banned");
must(/Oval\|RECT energy portals OK/.test(customize), "GROK.md Customize: oval|RECT energy OK");
must(/never wood/.test(customize) && /never chrome UI/.test(customize), "GROK.md Customize: never wood / chrome UI");
must(/Sit \/ face \/ 3\/4 cannot PASS/.test(customize), "GROK.md Customize: sit/face/3/4 still banned");
must(/\.kitchen\/fail/.test(customize) || /fail-save/.test(customize), "GROK.md Customize: FAIL → .kitchen/fail");
must(/enlarge/.test(customize), "GROK.md Customize: enlarge-only second step");

const agents = body("AGENTS.md");
must(/Oval\|RECT energy portals OK/.test(agents), "AGENTS.md: oval|RECT energy OK");
must(/Do not FAIL oval shape alone/.test(agents), "AGENTS.md: do not FAIL oval shape alone");
must(!/RECT→oval/.test(agents), "AGENTS.md: RECT→oval ban removed");
must(/\.kitchen\/fail/.test(agents), "AGENTS.md: FAIL save → .kitchen/fail");
must(/enlarge/.test(agents), "AGENTS.md: enlarge-only sill step");

const cook = body("COOK.md");
must(/enlarge/.test(cook) && /\.kitchen\/fail/.test(cook), "COOK.md: two-step enlarge + fail-save");
must(/0\.19\+sit\+face/.test(cook) && /0\.16\+sit/.test(cook), "COOK.md: ember FAIL×2 shrink evidence");

const rules = body(".cursorrules");
must(/oval\|RECT energy rifts/.test(rules), ".cursorrules: oval|RECT energy");
must(/never wood/.test(rules) && /never chrome UI/.test(rules), ".cursorrules: never wood / chrome UI");
must(!/never oval/.test(rules), ".cursorrules: oval ban removed");

const doors = body("DOORS.md");
must(/oval or RECT/.test(doors) && /preferred-ok/.test(doors), "DOORS.md: oval|RECT preferred-ok");
must(/not\*\* oval-vs-RECT|not oval-vs-RECT/.test(doors), "DOORS.md: door_morph is not oval-vs-RECT");
must(/never\*\* open wood|never\*\* chrome UI|never.*open wood/.test(doors), "DOORS.md: never wood");

const smokeId = body("scripts/smoke-identity.md");
must(/do \*\*not\*\* FAIL oval shape alone/.test(smokeId), "smoke-identity: oval shape alone is not FAIL");
must(!/oval \/ blob \/ wood leaf instead of RECT/.test(smokeId), "smoke-identity: oval-as-RECT-FAIL row gone");

console.log("COLD-START PASS");
