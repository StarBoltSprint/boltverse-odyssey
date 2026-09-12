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
must(/Imagine Agent/.test(stop) && /hall-restyle/.test(stop), "GROK.md STOP: Imagine Agent is the hall-restyle tool");
must(/SEALED/.test(stop) && /same dog pose/.test(stop) && /same cyan\/gold portals/.test(stop), "GROK.md STOP: sealed still — keep dog + portals");
must(/First seal stills/.test(stop) && /imagineStill/.test(stop), "GROK.md STOP: first seal = cook-room imagineStill");
must(/without Agent/.test(stop) && /no `last_frame`/.test(stop), "GROK.md STOP: Chat Imagine UI without Agent banned for walks");
must(/Grok Build chat Imagine tools are NOT the same as Imagine Agent/.test(stop), "GROK.md STOP: Build chat Imagine ≠ Imagine Agent");
must(/must not rely on chat `imagine_\*` tools for hall restyle identity lock/.test(stop), "GROK.md STOP: Build must not rely on chat imagine_* for identity lock");
must(/Imagine Agent is MANDATORY for cross-style hall stills/.test(stop), "GROK.md STOP: Imagine Agent MANDATORY for cross-style");
must(/REQUIRED.*décor variants/.test(stop), "GROK.md STOP: Agent REQUIRED for décor variants");
must(/BANNED for restyle/.test(stop), "GROK.md STOP: imagineStill BANNED for restyle");
must(/One \*\*SEALED\*\* sill still/.test(stop) && /restyles hall only/.test(stop), "GROK.md STOP: one sealed sill → Agent restyles hall only");
must(!/Preferred path/.test(stop), "GROK.md STOP: no Preferred path soften");
must(/PRIMARY cook path for BOTH stills AND/.test(stop), "GROK.md STOP: Agent PRIMARY for stills AND films");
must(/walks with start\+end stills/.test(stop) && /breaths same still twice/.test(stop), "GROK.md STOP: Agent walks start+end, breaths twice");
must(/secondary \/ CLI/.test(stop) && /not.*human happy path/.test(stop), "GROK.md STOP: cook-room secondary not human happy path");
must(/Smoke still gates/.test(stop), "GROK.md STOP: Smoke still gates");

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
must(/Imagine Agent/.test(customize) && /hall materials only/.test(customize), "GROK.md Customize: Imagine Agent hall-restyle");
must(/First seal stills/.test(customize) && /cook-room imagineStill/.test(customize), "GROK.md Customize: first seal = cook-room");
must(/without Agent has no last_frame/.test(customize), "GROK.md Customize: Chat Imagine UI without Agent banned for walks");
must(/Grok Build chat Imagine tools are NOT the same as Imagine Agent/.test(customize), "GROK.md Customize: Build chat Imagine ≠ Imagine Agent");
must(/must not rely on chat imagine_\* tools for hall restyle identity lock/.test(customize), "GROK.md Customize: Build must not rely on chat imagine_* for identity lock");
must(/Imagine Agent is MANDATORY for cross-style hall stills/.test(customize), "GROK.md Customize: Imagine Agent MANDATORY for cross-style");
must(/Agent REQUIRED for décor variants/.test(customize), "GROK.md Customize: Agent REQUIRED for décor variants");
must(/BANNED for restyle/.test(customize), "GROK.md Customize: imagineStill BANNED for restyle");
must(/One sealed sill still → Agent restyles hall only/.test(customize), "GROK.md Customize: one sealed sill → Agent restyles hall only");
must(/PRIMARY for BOTH stills AND walk\/breath films/.test(customize), "GROK.md Customize: Agent PRIMARY for stills AND films");
must(/Walks = start still \+ end still/.test(customize) && /Breaths = same still twice/.test(customize), "GROK.md Customize: walks start+end, breaths twice");
must(/secondary \/ CLI/.test(customize) && /not the human happy path/.test(customize), "GROK.md Customize: cook-room secondary");
must(/Smoke still gates/.test(customize), "GROK.md Customize: Smoke still gates");

const agents = body("AGENTS.md");
must(/Oval\|RECT energy portals OK/.test(agents), "AGENTS.md: oval|RECT energy OK");
must(/Do not FAIL oval shape alone/.test(agents), "AGENTS.md: do not FAIL oval shape alone");
must(!/RECT→oval/.test(agents), "AGENTS.md: RECT→oval ban removed");
must(/Imagine Agent/.test(agents) && /hall-restyle/.test(agents), "AGENTS.md: Imagine Agent is the hall-restyle tool");
must(/SEALED/.test(agents) && /same dog pose/.test(agents) && /same cyan\/gold portals/.test(agents), "AGENTS.md: sealed still — keep dog + portals");
must(/first seal/.test(agents), "AGENTS.md: cook-room imagineStill = first seal");
must(/banned for walks/.test(agents) && /no `last_frame`/.test(agents), "AGENTS.md: Chat Imagine UI without Agent banned for walks");
must(/Grok Build chat Imagine tools are NOT the same as Imagine Agent/.test(agents), "AGENTS.md: Build chat Imagine ≠ Imagine Agent");
must(/must not rely on chat `imagine_\*` tools for hall restyle identity lock/.test(agents), "AGENTS.md: Build must not rely on chat imagine_* for identity lock");
must(/Imagine Agent is MANDATORY for cross-style hall stills/.test(agents), "AGENTS.md: Imagine Agent MANDATORY for cross-style");
must(/REQUIRED.*décor variants/.test(agents), "AGENTS.md: Agent REQUIRED for décor variants");
must(/BANNED for restyle/.test(agents), "AGENTS.md: imagineStill BANNED for restyle");
must(/One \*\*SEALED\*\* sill still/.test(agents) && /restyles hall only/.test(agents), "AGENTS.md: one sealed sill → Agent restyles hall only");
must(!/Preferred path/.test(agents), "AGENTS.md: no Preferred path soften");
must(/PRIMARY cook path for BOTH stills AND/.test(agents), "AGENTS.md: Agent PRIMARY for stills AND films");
must(/walks\*\* = start still \+ end still/.test(agents) && /breaths\*\* = same still twice/.test(agents), "AGENTS.md: Agent walks start+end, breaths twice");
must(/secondary \/ CLI/.test(agents) && /not.*human happy path/.test(agents), "AGENTS.md: cook-room secondary not human happy path");
must(/Smoke still gates/.test(agents), "AGENTS.md: Smoke still gates");

const rules = body(".cursorrules");
must(/oval\|RECT energy rifts/.test(rules), ".cursorrules: oval|RECT energy");
must(/never wood/.test(rules) && /never chrome UI/.test(rules), ".cursorrules: never wood / chrome UI");
must(!/never oval/.test(rules), ".cursorrules: oval ban removed");
must(/Imagine Agent/.test(rules) && /hall materials only/.test(rules), ".cursorrules: Imagine Agent restyles sealed stills");
must(/first seal/.test(rules) && /Sealed skip stays/.test(rules), ".cursorrules: first seal + sealed skip");
must(/banned for walks/i.test(rules), ".cursorrules: Chat Imagine UI without Agent banned for walks");
must(/Grok Build chat Imagine tools are NOT the same as Imagine Agent/.test(rules), ".cursorrules: Build chat Imagine ≠ Imagine Agent");
must(/must not rely on chat imagine_\* tools for hall restyle identity lock/.test(rules), ".cursorrules: Build must not rely on chat imagine_* for identity lock");
must(/Imagine Agent is MANDATORY for cross-style hall stills/.test(rules), ".cursorrules: Imagine Agent MANDATORY for cross-style");
must(/Agent REQUIRED for décor variants/.test(rules), ".cursorrules: Agent REQUIRED for décor variants");
must(/BANNED for restyle/.test(rules), ".cursorrules: imagineStill BANNED for restyle");
must(/One sealed sill still → Agent restyles hall only/.test(rules), ".cursorrules: one sealed sill → Agent restyles hall only");
must(/PRIMARY for BOTH stills AND/.test(rules), ".cursorrules: Agent PRIMARY for stills AND films");
must(/Walks = start\+end stills/.test(rules) && /Breaths = same still twice/.test(rules), ".cursorrules: walks start+end, breaths twice");
must(/secondary \/ CLI/.test(rules) && /not the human happy path/.test(rules), ".cursorrules: cook-room secondary");
must(/Smoke still gates/.test(rules), ".cursorrules: Smoke still gates");

const cook = body("COOK.md");
must(/Imagine Agent/.test(cook) && /hall-restyle/.test(cook), "COOK.md: Imagine Agent is the hall-restyle tool");
must(/SEALED/.test(cook) && /same dog pose/.test(cook) && /same cyan\/gold portals/.test(cook), "COOK.md: sealed still — keep dog + portals");
must(/first seal/.test(cook) && /Sealed skip stays/.test(cook), "COOK.md: first seal + sealed skip");
must(/banned for walks/.test(cook) && /no `last_frame`/.test(cook), "COOK.md: Chat Imagine UI without Agent banned for walks");
must(/Grok Build chat Imagine tools are NOT the same as Imagine Agent/.test(cook), "COOK.md: Build chat Imagine ≠ Imagine Agent");
must(/must not rely on chat `imagine_\*` tools for hall restyle identity lock/.test(cook), "COOK.md: Build must not rely on chat imagine_* for identity lock");
must(/Imagine Agent is MANDATORY for cross-style hall stills/.test(cook), "COOK.md: Imagine Agent MANDATORY for cross-style");
must(/REQUIRED.*décor variants/.test(cook), "COOK.md: Agent REQUIRED for décor variants");
must(/BANNED for restyle/.test(cook), "COOK.md: imagineStill BANNED for restyle");
must(/One \*\*SEALED\*\* sill still/.test(cook) && /restyles hall only/.test(cook), "COOK.md: one sealed sill → Agent restyles hall only");
must(!/Preferred path/.test(cook), "COOK.md: no Preferred path soften");
must(/PRIMARY cook path for BOTH stills AND/.test(cook), "COOK.md: Agent PRIMARY for stills AND films");
must(/walks with start\+end stills/.test(cook) && /breaths same still twice/.test(cook), "COOK.md: Agent walks start+end, breaths twice");
must(/secondary \/ CLI/.test(cook) && /not.*human happy path/.test(cook), "COOK.md: cook-room secondary not human happy path");
must(/Smoke still gates/.test(cook), "COOK.md: Smoke still gates");

const cookroom = body("COOKROOM.md");
must(/Imagine Agent/.test(cookroom) && /hall-restyle/.test(cookroom), "COOKROOM.md: Imagine Agent is the hall-restyle tool");
must(/SEALED/.test(cookroom) && /same dog pose/.test(cookroom) && /same cyan\/gold portals/.test(cookroom), "COOKROOM.md: sealed still — keep dog + portals");
must(/First seal/.test(cookroom) && /Sealed skip stays/.test(cookroom), "COOKROOM.md: first seal + sealed skip");
must(/banned for walks/.test(cookroom), "COOKROOM.md: Chat Imagine UI without Agent banned for walks");
must(/Grok Build chat Imagine tools are NOT the same as Imagine Agent/.test(cookroom), "COOKROOM.md: Build chat Imagine ≠ Imagine Agent");
must(/must not rely on chat `imagine_\*` tools for hall restyle identity lock/.test(cookroom), "COOKROOM.md: Build must not rely on chat imagine_* for identity lock");
must(/Imagine Agent is MANDATORY for cross-style hall stills/.test(cookroom), "COOKROOM.md: Imagine Agent MANDATORY for cross-style");
must(/REQUIRED.*décor variants/.test(cookroom), "COOKROOM.md: Agent REQUIRED for décor variants");
must(/BANNED for restyle/.test(cookroom), "COOKROOM.md: imagineStill BANNED for restyle");
must(/One \*\*SEALED\*\* sill still/.test(cookroom) && /restyles hall only/.test(cookroom), "COOKROOM.md: one sealed sill → Agent restyles hall only");
must(!/Preferred path/.test(cookroom), "COOKROOM.md: no Preferred path soften");
must(/PRIMARY cook path for BOTH stills AND/.test(cookroom), "COOKROOM.md: Agent PRIMARY for stills AND films");
must(/walks with start\+end stills/.test(cookroom) && /breaths same still twice/.test(cookroom), "COOKROOM.md: Agent walks start+end, breaths twice");
must(/secondary \/ CLI/.test(cookroom) && /not the human happy path/.test(cookroom), "COOKROOM.md: cook-room secondary");
must(/Smoke still gates/.test(cookroom), "COOKROOM.md: Smoke still gates");

const doors = body("DOORS.md");
must(/oval or RECT/.test(doors) && /preferred-ok/.test(doors), "DOORS.md: oval|RECT preferred-ok");
must(/not\*\* oval-vs-RECT|not oval-vs-RECT/.test(doors), "DOORS.md: door_morph is not oval-vs-RECT");
must(/never\*\* open wood|never\*\* chrome UI|never.*open wood/.test(doors), "DOORS.md: never wood");

const smokeId = body("scripts/smoke-identity.md");
must(/do \*\*not\*\* FAIL oval shape alone/.test(smokeId), "smoke-identity: oval shape alone is not FAIL");
must(!/oval \/ blob \/ wood leaf instead of RECT/.test(smokeId), "smoke-identity: oval-as-RECT-FAIL row gone");

console.log("COLD-START PASS");
