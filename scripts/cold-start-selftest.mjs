#!/usr/bin/env node
// Fixture: brand-new Grok reads these first. Imagine Agent MUST / obligatoire / systematically.
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

function firstStop(text) {
  const idx = text.search(/STOP/);
  return idx < 0 ? "" : text.slice(idx, idx + 500);
}

function assertAgentStop(label, text) {
  const stop = firstStop(text);
  must(/STOP/.test(stop), label + ": has STOP");
  must(/obligatoire/i.test(stop), label + ": first STOP has obligatoire");
  must(/\bMUST\b/.test(stop), label + ": first STOP has MUST");
  must(/systematically/i.test(stop), label + ": first STOP has systematically");
  must(/Imagine Agent/.test(stop), label + ": first STOP names Imagine Agent");
  must(/EVERY cook/.test(stop), label + ": first STOP EVERY cook");
  must(/Walk A/.test(stop) && /Walk B/.test(stop), label + ": first STOP Walk A + Walk B");
  must(/breath/.test(stop), label + ": first STOP breath");
  must(/still/.test(stop), label + ": first STOP still");
  must(/Never Chat Imagine without Agent|Never Chat Imagine/.test(stop), label + ": first STOP never Chat Imagine without Agent");
}

const agentsHead = head("AGENTS.md", 22);
must(/sill ≠ spawn/.test(agentsHead), "AGENTS.md head: sill ≠ spawn");
must(/already AT the teal LEFT sill/.test(agentsHead) && /already AT the gold RIGHT sill/.test(agentsHead), "AGENTS.md head: at-A/at-B = AT the sill");
must(/Spawn = CENTER only/.test(agentsHead), "AGENTS.md head: spawn = center only");
must(/Mid-hall at-A\/at-B = \*\*FAIL\*\*/.test(agentsHead), "AGENTS.md head: mid-hall FAIL");
must(/Soft KEEP banned/.test(agentsHead), "AGENTS.md head: Soft KEEP banned");
assertAgentStop("AGENTS.md head", agentsHead);
must(body("AGENTS.md").search(/STOP/) < body("AGENTS.md").search(/sill ≠ spawn/), "AGENTS.md: STOP before sill ≠ spawn");

const rulesHead = head(".cursorrules", 16);
must(/sill ≠ spawn/.test(rulesHead), ".cursorrules head: sill ≠ spawn");
must(/already AT the teal LEFT sill/.test(rulesHead) && /already AT the gold RIGHT sill/.test(rulesHead), ".cursorrules head: at-A/at-B = AT the sill");
must(/Spawn = CENTER only/.test(rulesHead), ".cursorrules head: spawn = center only");
must(/Mid-hall at-A\/at-B = FAIL/.test(rulesHead), ".cursorrules head: mid-hall FAIL");
must(/Soft KEEP banned/.test(rulesHead), ".cursorrules head: Soft KEEP banned");
assertAgentStop(".cursorrules head", rulesHead);
must(body(".cursorrules").search(/STOP/) < body(".cursorrules").search(/sill ≠ spawn/), ".cursorrules: STOP before sill ≠ spawn");

const grok = body("GROK.md");
const stop = grok.slice(0, grok.indexOf("### Custom instructions"));
must(/sill ≠ spawn/.test(stop), "GROK.md STOP: sill ≠ spawn");
must(/already AT the teal LEFT sill/.test(stop) && /already AT the gold RIGHT sill/.test(stop), "GROK.md STOP: at-A/at-B = AT the sill");
must(/Spawn = CENTER only/.test(stop), "GROK.md STOP: spawn = center only");
must(/Mid-hall at-A\/at-B = \*\*FAIL\*\*/.test(stop), "GROK.md STOP: mid-hall FAIL");
must(/Soft KEEP banned/.test(stop), "GROK.md STOP: Soft KEEP banned");
assertAgentStop("GROK.md STOP", stop);
must(stop.search(/STOP/) < stop.search(/sill ≠ spawn/), "GROK.md: STOP before sill ≠ spawn");
must(/full-white German Shepherd/.test(stop) && /white coat forever/.test(stop), "GROK.md STOP: white coat forever");
must(/never changes to grey/.test(stop) && /silver/.test(stop) && /black/.test(stop), "GROK.md STOP: base never grey/silver/black");
must(/SKINS/.test(stop) && /décor-matching skin ON TOP/.test(stop), "GROK.md STOP: décor-matching skin ON TOP");
must(/ember skin/.test(stop) && /ice skin/.test(stop), "GROK.md STOP: ember skin + ice skin");
must(/Stylish adaptation/.test(stop) && /Not a different dog/.test(stop), "GROK.md STOP: skin is not a different dog");
must(/completely new hall décor OK/.test(stop), "GROK.md STOP: completely new hall décor OK");
must(/Cyan L \+ gold R energy portals may adapt/.test(stop), "GROK.md STOP: portals may adapt");
must(/Doors may adapt/.test(stop), "GROK.md STOP: Doors may adapt");
must(/selected, repositioned, resized to sill/.test(stop) && /nickel plate/.test(stop), "GROK.md STOP: Bolt selected/repositioned/resized to sill");
must(/\.kitchen\/fail/.test(stop), "GROK.md STOP: FAIL save → .kitchen/fail");
must(/enlarge/.test(stop), "GROK.md STOP: enlarge-only sill step");
must(/Imagine Agent/.test(stop) && /hall-restyle/.test(stop), "GROK.md STOP: Imagine Agent is the hall-restyle tool");
must(/SEALED/.test(stop), "GROK.md STOP: SEALED sill restyle");
must(/First seal stills/.test(stop) && /imagineStill/.test(stop), "GROK.md STOP: first seal = cook-room imagineStill");
must(/without Agent/.test(stop) && /no `last_frame`/.test(stop), "GROK.md STOP: Chat Imagine UI without Agent banned for walks");
must(/Grok Build chat Imagine tools are NOT the same as Imagine Agent/.test(stop), "GROK.md STOP: Build chat Imagine ≠ Imagine Agent");
must(/must not rely on chat `imagine_\*` tools for hall restyle identity lock/.test(stop), "GROK.md STOP: Build must not rely on chat imagine_* for identity lock");
must(/Imagine Agent is MANDATORY for cross-style hall stills/.test(stop), "GROK.md STOP: Imagine Agent MANDATORY for cross-style");
must(/REQUIRED.*décor variants/.test(stop), "GROK.md STOP: Agent REQUIRED for décor variants");
must(/BANNED for restyle/.test(stop), "GROK.md STOP: imagineStill BANNED for restyle");
must(/One \*\*SEALED\*\* sill still/.test(stop), "GROK.md STOP: one sealed sill → Agent restyles");
must(!/Preferred path/.test(stop), "GROK.md STOP: no Preferred path soften");
must(/PRIMARY cook path for BOTH stills AND/.test(stop), "GROK.md STOP: Agent PRIMARY for stills AND films");
must(/walks with start\+end stills/.test(stop) && /breaths same still twice/.test(stop), "GROK.md STOP: Agent walks start+end, breaths twice");
must(/secondary \/ CLI/.test(stop) && /not.*human happy path/.test(stop), "GROK.md STOP: cook-room secondary not human happy path");
must(/Smoke still gates/.test(stop), "GROK.md STOP: Smoke still gates");
must(/ALL hall stills \+ Walk A \+ Walk B \+ breaths go through Imagine Agent|ALL hall stills \+ walks \+ breaths go through Imagine Agent/.test(stop), "GROK.md STOP: ALL hall plates through Agent");
must(/exact first frame AND last frame/.test(stop) && /interpolate/.test(stop), "GROK.md STOP: user stills exact first+last then interpolate");
must(/Director or human drives Agent in the browser/.test(stop) && /until Build has an Agent tool\/hook/.test(stop), "GROK.md STOP: director/human drives Agent in browser");
must(/open Imagine Agent with the plate refs/.test(stop), "GROK.md STOP: instruct open Agent with plate refs");
must(/secondary \/ CLI only/.test(stop), "GROK.md STOP: cook-room secondary CLI only");
must(!/same dog pose/.test(stop), "GROK.md STOP: no frozen same-dog-pose restyle");

const customize = grok.slice(grok.indexOf("```\nBoltverse"), grok.indexOf("```\n\n---"));
must(/sill ≠ spawn/.test(customize), "GROK.md Customize: sill ≠ spawn");
must(/already AT the teal LEFT sill/.test(customize) && /already AT the gold RIGHT sill/.test(customize), "GROK.md Customize: at-A/at-B = AT the sill");
must(/Spawn = CENTER only/.test(customize), "GROK.md Customize: spawn = center only");
must(/Mid-hall at-A\/at-B = FAIL/.test(customize), "GROK.md Customize: mid-hall FAIL");
must(/Soft KEEP banned/.test(customize), "GROK.md Customize: Soft KEEP banned");
assertAgentStop("GROK.md Customize", customize);
must(customize.search(/STOP/) < customize.search(/Clone/), "GROK.md Customize: STOP before clone steps");
must(!/oval doors cannot PASS/.test(customize), "GROK.md Customize: oval doors not banned");
must(/Oval\|RECT energy portals OK/.test(customize), "GROK.md Customize: oval|RECT energy OK");
must(/never wood/.test(customize) && /never chrome UI/.test(customize), "GROK.md Customize: never wood / chrome UI");
must(/Sit \/ face \/ 3\/4 cannot PASS/.test(customize), "GROK.md Customize: sit/face/3/4 still banned");
must(/full-white German Shepherd/.test(customize) && /white coat forever/.test(customize), "GROK.md Customize: white coat forever");
must(/SKINS/.test(customize) && /décor-matching skin ON TOP/.test(customize), "GROK.md Customize: décor-matching skin ON TOP");
must(/ember skin/.test(customize) && /ice skin/.test(customize), "GROK.md Customize: ember + ice skins");
must(/completely new hall décor OK/.test(customize), "GROK.md Customize: completely new hall décor OK");
must(/Cyan L \+ gold R energy portals may adapt/.test(customize), "GROK.md Customize: portals may adapt");
must(/Doors may adapt/.test(customize), "GROK.md Customize: Doors may adapt");
must(/Bolt reposition OK/.test(customize), "GROK.md Customize: Bolt reposition OK");
must(/selected, repositioned, resized to sill/.test(customize) && /nickel plate/.test(customize), "GROK.md Customize: Bolt selected/repositioned/resized");
must(/First seal stills/.test(customize) && /cook-room imagineStill/.test(customize), "GROK.md Customize: first seal = cook-room");
must(/without Agent has no last_frame/.test(customize), "GROK.md Customize: Chat Imagine UI without Agent banned for walks");
must(/Grok Build chat Imagine tools are NOT the same as Imagine Agent/.test(customize), "GROK.md Customize: Build chat Imagine ≠ Imagine Agent");
must(/must not rely on chat imagine_\* tools for hall restyle identity lock/.test(customize), "GROK.md Customize: Build must not rely on chat imagine_* for identity lock");
must(/Imagine Agent is MANDATORY for cross-style hall stills/.test(customize), "GROK.md Customize: Imagine Agent MANDATORY for cross-style");
must(/Agent REQUIRED for décor variants/.test(customize), "GROK.md Customize: Agent REQUIRED for décor variants");
must(/BANNED for restyle/.test(customize), "GROK.md Customize: imagineStill BANNED for restyle");
must(/One sealed sill still → Agent restyles/.test(customize), "GROK.md Customize: one sealed sill → Agent restyles");
must(/PRIMARY for BOTH stills AND walk\/breath films/.test(customize), "GROK.md Customize: Agent PRIMARY for stills AND films");
must(/Walks = start still \+ end still/.test(customize) && /Breaths = same still twice/.test(customize), "GROK.md Customize: walks start+end, breaths twice");
must(/secondary \/ CLI/.test(customize) && /not the human happy path/.test(customize), "GROK.md Customize: cook-room secondary");
must(/Smoke still gates/.test(customize), "GROK.md Customize: Smoke still gates");
must(/ALL hall stills \+ Walk A \+ Walk B \+ breaths go through Imagine Agent/.test(customize), "GROK.md Customize: ALL hall plates through Agent");
must(/exact first frame AND last frame/.test(customize) && /interpolate/.test(customize), "GROK.md Customize: user stills exact first+last then interpolate");
must(/Director or human drives Agent in the browser/.test(customize) && /until Build has an Agent tool\/hook/.test(customize), "GROK.md Customize: director/human drives Agent in browser");
must(/open Imagine Agent with the plate refs/.test(customize), "GROK.md Customize: instruct open Agent with plate refs");
must(/secondary \/ CLI only/.test(customize), "GROK.md Customize: cook-room secondary CLI only");
must(/\.kitchen\/fail/.test(customize) || /fail-save/.test(customize), "GROK.md Customize: FAIL → .kitchen/fail");
must(/enlarge/.test(customize), "GROK.md Customize: enlarge-only second step");

const agents = body("AGENTS.md");
must(/Oval\|RECT energy portals OK/.test(agents), "AGENTS.md: oval|RECT energy OK");
must(/Do not FAIL oval shape alone/.test(agents), "AGENTS.md: do not FAIL oval shape alone");
must(!/RECT→oval/.test(agents), "AGENTS.md: RECT→oval ban removed");
must(/\.kitchen\/fail/.test(agents), "AGENTS.md: FAIL save → .kitchen/fail");
must(/enlarge/.test(agents), "AGENTS.md: enlarge-only sill step");
must(/full-white German Shepherd/.test(agents) && /white coat forever/.test(agents), "AGENTS.md: white coat forever");
must(/SKINS/.test(agents) && /décor-matching skin ON TOP/.test(agents), "AGENTS.md: décor-matching skin ON TOP");
must(/completely new hall décor OK/.test(agents), "AGENTS.md: completely new hall décor OK");
must(/Cyan L \+ gold R energy portals may adapt/.test(agents), "AGENTS.md: portals may adapt");
must(/Doors may adapt/.test(agents), "AGENTS.md: Doors may adapt");
must(/Bolt reposition OK/.test(agents), "AGENTS.md: Bolt reposition OK");
must(/selected, repositioned, resized to sill/.test(agents) && /nickel plate/.test(agents), "AGENTS.md: Bolt selected/repositioned/resized");
must(/Imagine Agent/.test(agents) && /hall-restyle/.test(agents), "AGENTS.md: Imagine Agent is the hall-restyle tool");
must(/SEALED/.test(agents), "AGENTS.md: sealed still restyle");
must(/first seal/.test(agents), "AGENTS.md: cook-room imagineStill = first seal");
must(/banned for walks/.test(agents) && /no `last_frame`/.test(agents), "AGENTS.md: Chat Imagine UI without Agent banned for walks");
must(/Grok Build chat Imagine tools are NOT the same as Imagine Agent/.test(agents), "AGENTS.md: Build chat Imagine ≠ Imagine Agent");
must(/must not rely on chat `imagine_\*` tools for hall restyle identity lock/.test(agents), "AGENTS.md: Build must not rely on chat imagine_* for identity lock");
must(/Imagine Agent is MANDATORY for cross-style hall stills/.test(agents), "AGENTS.md: Imagine Agent MANDATORY for cross-style");
must(/REQUIRED.*décor variants/.test(agents), "AGENTS.md: Agent REQUIRED for décor variants");
must(/BANNED for restyle/.test(agents), "AGENTS.md: imagineStill BANNED for restyle");
must(/One \*\*SEALED\*\* sill still/.test(agents), "AGENTS.md: one sealed sill → Agent restyles");
must(!/Preferred path/.test(agents), "AGENTS.md: no Preferred path soften");
must(/PRIMARY cook path for BOTH stills AND/.test(agents), "AGENTS.md: Agent PRIMARY for stills AND films");
must(/walks\*\* = start still \+ end still/.test(agents) && /breaths\*\* = same still twice/.test(agents), "AGENTS.md: Agent walks start+end, breaths twice");
must(/secondary \/ CLI/.test(agents) && /not.*human happy path/.test(agents), "AGENTS.md: cook-room secondary not human happy path");
must(/Smoke still gates/.test(agents), "AGENTS.md: Smoke still gates");
must(/ALL hall stills \+ walks \+ breaths go through Imagine Agent/.test(agents), "AGENTS.md: ALL hall plates through Agent");
must(/exact first frame AND last frame/.test(agents) && /interpolate/.test(agents), "AGENTS.md: user stills exact first+last then interpolate");
must(/Director or human drives Agent in the browser/.test(agents) && /until Build has an Agent tool\/hook/.test(agents), "AGENTS.md: director/human drives Agent in browser");
must(/open Imagine Agent with the plate refs/.test(agents), "AGENTS.md: instruct open Agent with plate refs");
must(/secondary \/ CLI only/.test(agents), "AGENTS.md: cook-room secondary CLI only");

const rules = body(".cursorrules");
must(/oval\|RECT energy rifts/.test(rules), ".cursorrules: oval|RECT energy");
must(/never wood/.test(rules) && /never chrome UI/.test(rules), ".cursorrules: never wood / chrome UI");
must(!/never oval/.test(rules), ".cursorrules: oval ban removed");
must(/\.kitchen\/fail/.test(rules), ".cursorrules: FAIL save → .kitchen/fail");
must(/enlarge/.test(rules), ".cursorrules: enlarge-only sill step");
must(/full-white German Shepherd/.test(rules) && /white coat forever/.test(rules), ".cursorrules: white coat forever");
must(/SKINS/.test(rules) && /décor-matching skin ON TOP/.test(rules), ".cursorrules: décor-matching skin ON TOP");
must(/completely new hall décor OK/.test(rules), ".cursorrules: completely new hall décor OK");
must(/Cyan L \+ gold R energy portals may adapt/.test(rules), ".cursorrules: portals may adapt");
must(/Doors may adapt/.test(rules), ".cursorrules: Doors may adapt");
must(/Bolt reposition OK/.test(rules), ".cursorrules: Bolt reposition OK");
must(/selected, repositioned, resized to sill/.test(rules) && /nickel plate/.test(rules), ".cursorrules: Bolt selected/repositioned/resized");
must(/Imagine Agent/.test(rules), ".cursorrules: Imagine Agent restyles sealed stills");
must(/first seal/.test(rules) && /Sealed skip stays/.test(rules), ".cursorrules: first seal + sealed skip");
must(/banned for walks/i.test(rules), ".cursorrules: Chat Imagine UI without Agent banned for walks");
must(/Grok Build chat Imagine tools are NOT the same as Imagine Agent/.test(rules), ".cursorrules: Build chat Imagine ≠ Imagine Agent");
must(/must not rely on chat imagine_\* tools for hall restyle identity lock/.test(rules), ".cursorrules: Build must not rely on chat imagine_* for identity lock");
must(/Imagine Agent is MANDATORY for cross-style hall stills/.test(rules), ".cursorrules: Imagine Agent MANDATORY for cross-style");
must(/Agent REQUIRED for décor variants/.test(rules), ".cursorrules: Agent REQUIRED for décor variants");
must(/BANNED for restyle/.test(rules), ".cursorrules: imagineStill BANNED for restyle");
must(/One sealed sill still → Agent restyles/.test(rules), ".cursorrules: one sealed sill → Agent restyles");
must(/PRIMARY for BOTH stills AND/.test(rules), ".cursorrules: Agent PRIMARY for stills AND films");
must(/Walks = start\+end stills/.test(rules) && /Breaths = same still twice/.test(rules), ".cursorrules: walks start+end, breaths twice");
must(/secondary \/ CLI/.test(rules) && /not the human happy path/.test(rules), ".cursorrules: cook-room secondary");
must(/Smoke still gates/.test(rules), ".cursorrules: Smoke still gates");
must(/ALL hall stills \+ walks \+ breaths go through Imagine Agent/.test(rules), ".cursorrules: ALL hall plates through Agent");
must(/exact first frame AND last frame/.test(rules) && /interpolate/.test(rules), ".cursorrules: user stills exact first+last then interpolate");
must(/Director or human drives Agent in the browser/.test(rules) && /until Build has an Agent tool\/hook/.test(rules), ".cursorrules: director/human drives Agent in browser");
must(/open Imagine Agent with the plate refs/.test(rules), ".cursorrules: instruct open Agent with plate refs");
must(/secondary \/ CLI only/.test(rules), ".cursorrules: cook-room secondary CLI only");

const cook = body("COOK.md");
must(/Imagine Agent/.test(cook) && /hall-restyle/.test(cook), "COOK.md: Imagine Agent is the hall-restyle tool");
must(/SEALED/.test(cook), "COOK.md: sealed still restyle");
must(/first seal/.test(cook) && /Sealed skip stays/.test(cook), "COOK.md: first seal + sealed skip");
must(/banned for walks/.test(cook) && /no `last_frame`/.test(cook), "COOK.md: Chat Imagine UI without Agent banned for walks");
must(/Grok Build chat Imagine tools are NOT the same as Imagine Agent/.test(cook), "COOK.md: Build chat Imagine ≠ Imagine Agent");
must(/must not rely on chat `imagine_\*` tools for hall restyle identity lock/.test(cook), "COOK.md: Build must not rely on chat imagine_* for identity lock");
must(/Imagine Agent is MANDATORY for cross-style hall stills/.test(cook), "COOK.md: Imagine Agent MANDATORY for cross-style");
must(/REQUIRED.*décor variants/.test(cook), "COOK.md: Agent REQUIRED for décor variants");
must(/BANNED for restyle/.test(cook), "COOK.md: imagineStill BANNED for restyle");
must(/One \*\*SEALED\*\* sill still/.test(cook), "COOK.md: one sealed sill → Agent restyles");
must(!/Preferred path/.test(cook), "COOK.md: no Preferred path soften");
must(/PRIMARY cook path for BOTH stills AND/.test(cook), "COOK.md: Agent PRIMARY for stills AND films");
must(/walks with start\+end stills/.test(cook) && /breaths same still twice/.test(cook), "COOK.md: Agent walks start+end, breaths twice");
must(/secondary \/ CLI/.test(cook) && /not.*human happy path/.test(cook), "COOK.md: cook-room secondary not human happy path");
must(/Smoke still gates/.test(cook), "COOK.md: Smoke still gates");
must(/ALL hall stills \+ walks \+ breaths go through Imagine Agent/.test(cook), "COOK.md: ALL hall plates through Agent");
must(/exact first frame AND last frame/.test(cook) && /interpolate/.test(cook), "COOK.md: user stills exact first+last then interpolate");
must(/Director or human drives Agent in the browser/.test(cook) && /until Build has an Agent tool\/hook/.test(cook), "COOK.md: director/human drives Agent in browser");
must(/open Imagine Agent with the plate refs/.test(cook), "COOK.md: instruct open Agent with plate refs");
must(/secondary \/ CLI only/.test(cook), "COOK.md: cook-room secondary CLI only");
must(/enlarge/.test(cook) && /\.kitchen\/fail/.test(cook), "COOK.md: two-step enlarge + fail-save");
must(/0\.19\+sit\+face/.test(cook) && /0\.16\+sit/.test(cook), "COOK.md: ember FAIL×2 shrink evidence");
must(/full-white German Shepherd/.test(cook) && /white coat forever/.test(cook), "COOK.md: white coat forever");
must(/SKINS/.test(cook) && /décor-matching skin ON TOP/.test(cook), "COOK.md: décor-matching skin ON TOP");
must(/completely new hall décor OK/.test(cook), "COOK.md: completely new hall décor OK");
must(/Cyan L \+ gold R energy portals may adapt/.test(cook), "COOK.md: portals may adapt");
must(/Doors may adapt/.test(cook), "COOK.md: Doors may adapt");
must(/Bolt reposition OK/.test(cook), "COOK.md: Bolt reposition OK");
must(/selected, repositioned, resized to sill/.test(cook) && /nickel plate/.test(cook), "COOK.md: Bolt selected/repositioned/resized");
assertAgentStop("COOK.md", cook);

const cookroom = body("COOKROOM.md");
must(/Imagine Agent/.test(cookroom) && /hall-restyle/.test(cookroom), "COOKROOM.md: Imagine Agent is the hall-restyle tool");
must(/SEALED/.test(cookroom), "COOKROOM.md: sealed still restyle");
must(/First seal/.test(cookroom) && /Sealed skip stays/.test(cookroom), "COOKROOM.md: first seal + sealed skip");
must(/banned for walks/.test(cookroom), "COOKROOM.md: Chat Imagine UI without Agent banned for walks");
must(/Grok Build chat Imagine tools are NOT the same as Imagine Agent/.test(cookroom), "COOKROOM.md: Build chat Imagine ≠ Imagine Agent");
must(/must not rely on chat `imagine_\*` tools for hall restyle identity lock/.test(cookroom), "COOKROOM.md: Build must not rely on chat imagine_* for identity lock");
must(/Imagine Agent is MANDATORY for cross-style hall stills/.test(cookroom), "COOKROOM.md: Imagine Agent MANDATORY for cross-style");
must(/REQUIRED.*décor variants/.test(cookroom), "COOKROOM.md: Agent REQUIRED for décor variants");
must(/BANNED for restyle/.test(cookroom), "COOKROOM.md: imagineStill BANNED for restyle");
must(/One \*\*SEALED\*\* sill still/.test(cookroom), "COOKROOM.md: one sealed sill → Agent restyles");
must(!/Preferred path/.test(cookroom), "COOKROOM.md: no Preferred path soften");
must(/PRIMARY cook path for BOTH stills AND/.test(cookroom), "COOKROOM.md: Agent PRIMARY for stills AND films");
must(/walks with start\+end stills/.test(cookroom) && /breaths same still twice/.test(cookroom), "COOKROOM.md: Agent walks start+end, breaths twice");
must(/secondary \/ CLI/.test(cookroom) && /not the human happy path/.test(cookroom), "COOKROOM.md: cook-room secondary");
must(/Smoke still gates/.test(cookroom), "COOKROOM.md: Smoke still gates");
must(/ALL hall stills \+ walks \+ breaths go through Imagine Agent/.test(cookroom), "COOKROOM.md: ALL hall plates through Agent");
must(/exact first frame AND last frame/.test(cookroom) && /interpolate/.test(cookroom), "COOKROOM.md: user stills exact first+last then interpolate");
must(/Director or human drives Agent in the browser/.test(cookroom) && /until Build has an Agent tool\/hook/.test(cookroom), "COOKROOM.md: director/human drives Agent in browser");
must(/open Imagine Agent with the plate refs/.test(cookroom), "COOKROOM.md: instruct open Agent with plate refs");
must(/secondary \/ CLI only/.test(cookroom), "COOKROOM.md: cook-room secondary CLI only");
must(/completely new hall décor OK/.test(cookroom), "COOKROOM.md: completely new hall décor OK");
must(/white coat forever/.test(cookroom), "COOKROOM.md: white coat forever");
must(/décor-matching skin ON TOP/.test(cookroom), "COOKROOM.md: décor-matching skin ON TOP");
must(/Doors may adapt/.test(cookroom), "COOKROOM.md: Doors may adapt");
must(/Bolt reposition OK/.test(cookroom), "COOKROOM.md: Bolt reposition OK");

const doors = body("DOORS.md");
must(/oval or RECT/.test(doors) && /preferred-ok/.test(doors), "DOORS.md: oval|RECT preferred-ok");
must(/not\*\* oval-vs-RECT|not oval-vs-RECT/.test(doors), "DOORS.md: door_morph is not oval-vs-RECT");
must(/never\*\* open wood|never\*\* chrome UI|never.*open wood/.test(doors), "DOORS.md: never wood");
must(/Doors may adapt/.test(doors), "DOORS.md: Doors may adapt");

const char = body("CHAR.md");
must(/white coat forever/i.test(char), "CHAR.md: white coat forever");
must(/SKINS/.test(char) && /ON TOP/.test(char), "CHAR.md: décor SKINS ON TOP of white base");
must(/ember skin/.test(char) && /ice skin/.test(char), "CHAR.md: ember + ice skins");

const smokeId = body("scripts/smoke-identity.md");
must(/do \*\*not\*\* FAIL oval shape alone/.test(smokeId), "smoke-identity: oval shape alone is not FAIL");
must(!/oval \/ blob \/ wood leaf instead of RECT/.test(smokeId), "smoke-identity: oval-as-RECT-FAIL row gone");
must(/white base forever/.test(smokeId) && /SKINS ON TOP/.test(smokeId), "smoke-identity: white base + skins ON TOP");

must(/KEEP seals/.test(agents) && /SEAL-at-a/.test(agents) && /SEAL-at-b/.test(agents), "AGENTS.md: ice-hall KEEP seals");
must(/until SmiR reseals/.test(agents) && /SKIPS/.test(agents) && /imagineStill/.test(agents), "AGENTS.md: sealed skip imagineStill until reseal");
must(/KEEP seals/.test(cook) && /SEAL-at-a/.test(cook) && /until SmiR reseals/.test(cook), "COOK.md: ice-hall KEEP seals");
must(/SKIPS/.test(cook) && /imagineStill/.test(cook), "COOK.md: sealed skip imagineStill");
must(/KEEP seals/.test(stop) && /SEAL-at-a/.test(stop) && /until SmiR reseals/.test(stop), "GROK.md STOP: ice-hall KEEP seals");
must(/KEEP seals/.test(customize) && /SEAL-at-a/.test(customize) && /until SmiR reseals/.test(customize), "GROK.md Customize: ice-hall KEEP seals");
must(/KEEP seals/.test(rules) && /SEAL-at-a/.test(rules) && /until SmiR reseals/.test(rules), ".cursorrules: ice-hall KEEP seals");
must(/KEEP seals/.test(cookroom) && /SEAL-at-a/.test(cookroom) && /until SmiR reseals/.test(cookroom), "COOKROOM.md: ice-hall KEEP seals");

console.log("COLD-START PASS");
