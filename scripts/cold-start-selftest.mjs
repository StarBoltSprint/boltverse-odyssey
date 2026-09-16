#!/usr/bin/env node
// Fixture: brand-new Grok reads these first.
// HARD SPLIT (SmiR 2026-09-12): Agent obligatoire for STYLE stills when restyling.
// Video cook stays imagine-hooks / cook-room first+last. Never Agent for walks/breaths.
import { existsSync, readFileSync } from "node:fs";
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
  return idx < 0 ? "" : text.slice(idx, idx + 2000);
}

function assertAgentStop(label, text) {
  const stop = firstStop(text);
  must(/STOP/.test(stop), label + ": has STOP");
  must(/HARD SPLIT/.test(stop), label + ": first STOP HARD SPLIT");
  must(/obligatoire/i.test(stop), label + ": first STOP has obligatoire");
  must(/\bMUST\b/.test(stop), label + ": first STOP has MUST");
  must(/systematically/i.test(stop), label + ": first STOP has systematically");
  must(/Imagine Agent/.test(stop), label + ": first STOP names Imagine Agent");
  must(/STYLE stills/.test(stop), label + ": first STOP STYLE stills");
  must(/restyl/.test(stop), label + ": first STOP restyling");
  must(/NEVER/.test(stop), label + ": first STOP NEVER (no Agent video)");
  must(/Walk A/.test(stop) && /Walk B/.test(stop), label + ": first STOP Walk A + Walk B");
  must(/breath/.test(stop), label + ": first STOP breath");
  must(/video/.test(stop), label + ": first STOP video");
  must(/imagine-hooks/.test(stop) && /cook-room/.test(stop), label + ": first STOP hooks + cook-room");
  must(/first-frame \+ last-frame/.test(stop), label + ": first STOP first-frame + last-frame");
  must(/Soft KEEP banned/.test(stop), label + ": first STOP Soft KEEP banned");
  must(/Smoke still gates/.test(stop), label + ": first STOP Smoke still gates");
  must(!/EVERY cook \(new Grok Build conversation, restyle, Walk A/.test(stop), label + ": first STOP no PR #11 every-cook-through-Agent");
}

function forbidAgentVideo(label, text) {
  must(!/PRIMARY cook path for BOTH stills AND/.test(text), label + ": no Agent PRIMARY for films");
  must(!/PRIMARY for BOTH stills AND walk\/breath/.test(text), label + ": no Agent PRIMARY walk/breath films");
  must(!/ALL hall stills \+ Walk A \+ Walk B \+ breaths go through Imagine Agent/.test(text), label + ": no ALL plates through Agent");
  must(!/ALL hall stills \+ walks \+ breaths go through Imagine Agent/.test(text), label + ": no walks+breaths through Agent");
  must(!/PRIMARY films = Imagine Agent/.test(text), label + ": no PRIMARY films = Agent");
  must(!/Walks PRIMARY = Imagine Agent/.test(text), label + ": no Walks PRIMARY = Agent");
  must(!/Director or human drives Agent in the browser/.test(text), label + ": no director drives Agent for films");
  must(!/until Build has an Agent tool\/hook/.test(text), label + ": no Agent tool/hook as video path");
  must(/Do not instruct Agent for walks\/breaths|NEVER for Walk A|Never Agent video|NEVER walks, breaths/.test(text), label + ": forbids Agent for walks/breaths");
}

function assertSplit(label, text) {
  forbidAgentVideo(label, text);
  must(/Imagine Agent/.test(text) && /hall-restyle/.test(text), label + ": Imagine Agent is the hall-restyle tool");
  must(/SEALED|sealed sill/.test(text), label + ": sealed still restyle");
  must(/first seal/i.test(text), label + ": first seal");
  must(/Sealed skip stays/.test(text) || /sealed skip stays/.test(text), label + ": sealed skip stays");
  must(/banned for walks/i.test(text) && /last_frame/.test(text), label + ": Chat Imagine UI without real first+last banned for walks");
  must(/Grok Build chat Imagine tools are NOT the same as Imagine Agent/.test(text), label + ": Build chat Imagine ≠ Imagine Agent");
  must(/must not rely on chat `imagine_\*` tools for hall restyle identity lock|must not rely on chat imagine_\* tools for hall restyle identity lock/.test(text), label + ": Build must not rely on chat imagine_* for identity lock");
  must(/Imagine Agent is MANDATORY for cross-style hall stills/.test(text), label + ": Imagine Agent MANDATORY for cross-style");
  must(/REQUIRED.*décor variants/.test(text), label + ": Agent REQUIRED for décor variants");
  must(/BANNED for restyle/.test(text), label + ": imagineStill BANNED for restyle");
  must(/One \*\*SEALED\*\* sill still|One sealed sill still → Agent restyles/.test(text), label + ": one sealed sill → Agent restyles");
  must(!/Preferred path/.test(text), label + ": no Preferred path soften");
  must(/STYLE stills/.test(text) && /restyl/.test(text), label + ": Agent obligatoire for STYLE stills when restyling");
  must(/imagine-hooks/.test(text) && /cook-room/.test(text), label + ": video cook = hooks / cook-room");
  must(/first-frame \+ last-frame|image` \+ `last_frame`|image \+ last_frame/.test(text), label + ": films = first+last");
  must(/not required or recommended for video|Never Agent video|NEVER.*video/.test(text), label + ": Agent not required for video");
  must(/Smoke still gates/.test(text), label + ": Smoke still gates");
  must(/Soft KEEP banned/.test(text), label + ": Soft KEEP banned");
}

const agentsHead = head("AGENTS.md", 22);
must(/sill ≠ spawn/.test(agentsHead), "AGENTS.md head: sill ≠ spawn");
must(/already AT the teal LEFT sill/.test(agentsHead) && /already AT the gold RIGHT sill/.test(agentsHead), "AGENTS.md head: at-A/at-B = AT the sill");
must(/Spawn = CENTER only/.test(agentsHead), "AGENTS.md head: spawn = center only");
must(/Mid-hall at-A\/at-B = \*\*FAIL\*\*/.test(agentsHead), "AGENTS.md head: mid-hall FAIL");
must(/Soft KEEP banned/.test(agentsHead), "AGENTS.md head: Soft KEEP banned");
assertAgentStop("AGENTS.md head", agentsHead);
must(body("AGENTS.md").search(/STOP/) < body("AGENTS.md").search(/sill ≠ spawn/), "AGENTS.md: STOP before sill ≠ spawn");

const rulesHead = head(".cursorrules", 20);
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
must(/First seal stills/.test(stop) && /imagineStill/.test(stop), "GROK.md STOP: first seal = Imagine Agent; imagineStill CLI");
must(/without real first\+last/.test(stop) && /no `last_frame`/.test(stop), "GROK.md STOP: Chat Imagine UI without real first+last banned for walks");
assertSplit("GROK.md STOP", stop);
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
must(/without real first\+last has no last_frame/.test(customize), "GROK.md Customize: Chat Imagine UI without real first+last banned for walks");
assertSplit("GROK.md Customize", customize);
must(/Walks = start still \+ end still/.test(customize) && /Breaths = same still twice/.test(customize), "GROK.md Customize: walks start+end, breaths twice (hooks)");
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
assertSplit("AGENTS.md", agents);
must(/walks\*\* = start still \+ end still/.test(agents) && /breaths\*\* = same still twice/.test(agents), "AGENTS.md: walks start+end, breaths twice (hooks)");

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
assertSplit(".cursorrules", rules);
must(/Walks = start\+end stills/.test(rules) && /Breaths = same still twice/.test(rules), ".cursorrules: walks start+end, breaths twice (hooks)");

const cook = body("COOK.md");
assertSplit("COOK.md", cook);
must(/walks: start still ≠ arrive still|Walks: start still ≠ arrive still|start still ≠ arrive still/.test(cook) && /same still twice/.test(cook), "COOK.md: walks start+end, breaths twice (hooks)");
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
assertSplit("COOKROOM.md", cookroom);
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
must(/never Agent video/.test(char), "CHAR.md: Agent skins are stills; never Agent video");

const smokeId = body("scripts/smoke-identity.md");
must(/do \*\*not\*\* FAIL oval shape alone/.test(smokeId), "smoke-identity: oval shape alone is not FAIL");
must(!/oval \/ blob \/ wood leaf instead of RECT/.test(smokeId), "smoke-identity: oval-as-RECT-FAIL row gone");
must(/white base forever/.test(smokeId) && /SKINS ON TOP/.test(smokeId), "smoke-identity: white base + skins ON TOP");

must(/KEEP seals/.test(agents) && /SEAL-spawn/.test(agents) && /SEAL-at-a/.test(agents) && /SEAL-at-b/.test(agents), "AGENTS.md: ice-hall KEEP seals");
must(/until SmiR reseals/.test(agents) && /SKIPS/.test(agents) && /imagineStill/.test(agents), "AGENTS.md: sealed skip imagineStill until reseal");
must(/KEEP seals/.test(cook) && /SEAL-spawn/.test(cook) && /SEAL-at-a/.test(cook) && /until SmiR reseals/.test(cook), "COOK.md: ice-hall KEEP seals");
must(/SKIPS/.test(cook) && /imagineStill/.test(cook), "COOK.md: sealed skip imagineStill");
must(/KEEP seals/.test(stop) && /SEAL-spawn/.test(stop) && /SEAL-at-a/.test(stop) && /until SmiR reseals/.test(stop), "GROK.md STOP: ice-hall KEEP seals");
must(/KEEP seals/.test(customize) && /SEAL-spawn/.test(customize) && /SEAL-at-a/.test(customize) && /until SmiR reseals/.test(customize), "GROK.md Customize: ice-hall KEEP seals");
must(/KEEP seals/.test(rules) && /SEAL-spawn/.test(rules) && /SEAL-at-a/.test(rules) && /until SmiR reseals/.test(rules), ".cursorrules: ice-hall KEEP seals");
must(/KEEP seals/.test(cookroom) && /SEAL-spawn/.test(cookroom) && /SEAL-at-a/.test(cookroom) && /until SmiR reseals/.test(cookroom), "COOKROOM.md: ice-hall KEEP seals");

function forbidBiomeCook(label, text) {
  must(!/FILM-STACK\.md/.test(text), label + ": no FILM-STACK.md");
  must(!/THREE-TAKE-PLAY\.md/.test(text), label + ": no THREE-TAKE-PLAY.md");
  must(!/COOK-BIOME-25D\.md/.test(text), label + ": no COOK-BIOME-25D.md");
  must(!/COOKLANE\.md/.test(text), label + ": no COOKLANE.md");
  must(!/cook-biome\.mjs/.test(text), label + ": no cook-biome.mjs job");
  must(!/cook-biome-25d\.mjs/.test(text), label + ": no cook-biome-25d.mjs");
}

forbidBiomeCook("GROK.md", body("GROK.md"));
forbidBiomeCook("AGENTS.md", agents);
forbidBiomeCook("README.md", body("README.md"));
forbidBiomeCook("START.md", body("START.md"));
forbidBiomeCook("COOK.md", body("COOK.md"));
forbidBiomeCook("COOKROOM.md", cookroom);
must(/biome\//.test(body("GROK.md")), "GROK.md: lane recipe lives in biome/");
must(/biome\//.test(agents), "AGENTS.md: lane recipe lives in biome/");
must(/biome\//.test(body("README.md")), "README.md: lane recipe lives in biome/");
must(/citadel/.test(body("README.md")) && /Hang/.test(body("README.md")), "README.md: citadel / Hang recipe");
must(existsSync(join(root, "biome/PLAY.md")), "biome/PLAY.md present");
must(existsSync(join(root, "biome/reference/LanePlayer.tsx")), "biome/reference/LanePlayer.tsx present");
must(/r19wide/.test(body("biome/reference/LanePlayer.tsx")), "LanePlayer: r19wide VER");
must(/bolt-luma/.test(body("biome/reference/LanePlayer.tsx")), "LanePlayer: bolt-luma key");
must(existsSync(join(root, "stock/biome/preview-loop.mp4")), "stock/biome/preview-loop.mp4 present");
must(existsSync(join(root, "stock/biome/preview-first.jpg")), "stock/biome/preview-first.jpg present");
const play = body("biome/PLAY.md");
must(/B stack/.test(play) && /cutout/.test(play), "biome/PLAY.md: B stack + cutout");
must(/seek-sync/.test(play), "biome/PLAY.md: seek-sync");
must(/loop forever/.test(play), "biome/PLAY.md: loop forever");
must(/not default|not the default/.test(play), "biome/PLAY.md: 3-take is not default");
must(!/C-light/.test(play) || /cancelled/.test(play), "biome/PLAY.md: no invented C-light lock");

function assertConsoleFlow(label, text) {
  must(/console/.test(text), label + ": Grok = console");
  must(/Interactive Play/.test(text), label + ": Interactive Play");
  must(/Sprint/.test(text) && /Citadel/.test(text), label + ": player names Sprint + Citadel");
  must(/Biome/.test(text), label + ": Biome stays kitchen");
  must(/native Grok Build game console/.test(text) && /in-app/.test(text), label + ": open Sprint in-app");
  must(/No Play URL|do not paste a Play URL|Do \*\*not\*\* paste a Play URL/i.test(text), label + ": no Play URL in chat");
  must(/loop forever/.test(text), label + ": play videos loop forever");
  must(/preview mp4/.test(text), label + ": stock preview mp4s");
  must(/not tappable|not.*hitbox|pas des hitboxes/i.test(text), label + ": chat mp4s are not hitboxes");
  must(/biome\//.test(text) || /stock\/biome/.test(text), label + ": biome = in-repo biome/ or stock/biome");
}

assertConsoleFlow("GROK.md", body("GROK.md"));
assertConsoleFlow("README.md", body("README.md"));
assertConsoleFlow("START.md", body("START.md"));
assertConsoleFlow("AGENTS.md", agents);
must(/muted playsInline autoPlay loop/.test(body("GROK.md")), "GROK.md: muted playsInline autoPlay loop");
must(/muted playsInline autoPlay loop/.test(agents), "AGENTS.md: muted playsInline autoPlay loop");
must(/muted playsInline autoPlay loop/.test(body("README.md")), "README.md: muted playsInline autoPlay loop");
must(/watchdog/.test(body("GROK.md")) && /pause/.test(body("GROK.md")), "GROK.md: watchdog re-play on pause/ended");
must(!/keep the split|Keep the split/.test(body("GROK.md")), "GROK.md: split merged — biome cooks here");
must(!/keep the split|Keep the split/.test(body("README.md")), "README.md: split merged — biome cooks here");
must(!/Do not cook biomes here/.test(body("README.md")), "README.md: no do-not-cook-biomes-here");
must(!/Do not cook biomes here/.test(agents), "AGENTS.md: no do-not-cook-biomes-here");
must(/Grok chat = console/.test(customize) && /Odyssey = the game/.test(customize), "GROK.md Customize: console / game");
must(/play \/ lance/.test(customize) && /Interactive Play/.test(customize), "GROK.md Customize: play/lance → Interactive Play");
must(/open Sprint via native Grok Build game console/.test(customize) && /in-app/.test(customize), "GROK.md Customize: open Sprint in-app");
must(/Pack Play URL is kitchen-only/.test(customize) && /No Play URL in chat/.test(customize), "GROK.md Customize: Play URL kitchen-only");
must(!/ask Citadel or Biome/.test(customize), "GROK.md Customize: no Citadel/Biome choice lecture");
must(/Prefer GitHub for boot/.test(customize) && /Bot OK if useful/.test(customize), "GROK.md Customize: prefer GitHub for boot; Bot OK if useful");
must(!/Never invoke a Grok Bot connector/i.test(customize) && !/GitHub \+ Build console only/.test(customize), "GROK.md Customize: no Bot-connector ban");
must(/as chat media/.test(customize) && /do not narrate/i.test(customize) && /teasers are on/.test(customize), "GROK.md Customize: attach as chat media; do not narrate teasers are on");
must(/Hey Packmate \{name\}/.test(customize) && /never Packmate alone/.test(customize) && /never name without Packmate/.test(customize), "GROK.md Customize: Hey Packmate {name}");
must(existsSync(join(root, "stock/citadel/preview-loop.mp4")), "stock/citadel/preview-loop.mp4 present");
must(existsSync(join(root, "stock/citadel/preview-first.jpg")), "stock/citadel/preview-first.jpg present");
must(/stock\/citadel\/preview-loop/.test(body("GROK.md")), "GROK.md: Citadel teaser = stock/citadel/preview-loop");
must(/stock\/citadel\/preview-loop/.test(body("README.md")), "README.md: Citadel teaser = stock/citadel/preview-loop");
must(/stock\/citadel\/preview-loop/.test(body("START.md")), "START.md: Citadel teaser = stock/citadel/preview-loop");
must(/stock\/citadel\/preview-loop/.test(agents), "AGENTS.md: Citadel teaser = stock/citadel/preview-loop");
must(/stock\/biome\/preview-loop/.test(body("GROK.md")) && /stock\/biome\/preview-loop/.test(body("README.md")), "GROK.md + README.md: Biome teaser = biome preview-loop");
must(/stock\/biome\/preview-loop/.test(body("START.md")) && /stock\/biome\/preview-loop/.test(agents), "START.md + AGENTS.md: Biome teaser = biome preview-loop");
must(!/Do \*\*not\*\* commit binaries here/.test(body("GROK.md")), "GROK.md: Citadel stock binaries are committed");
must(!/Do \*\*not\*\* add binaries to this repo/.test(body("README.md")), "README.md: Citadel stock binaries are committed");
must(!/no binaries in this repo/.test(agents), "AGENTS.md: Citadel stock binaries are committed");

function spokenFence(text, headingRe) {
  const idx = text.search(headingRe);
  if (idx < 0) return "";
  const m = text.slice(idx).match(/```\n([\s\S]*?)```/);
  return m ? m[1] : "";
}

function assertSpokenWelcome(label, text, newHeading, returnHeading) {
  const neu = spokenFence(text, newHeading);
  const ret = spokenFence(text, returnHeading);
  must(/welcome to Boltverse Odyssey/.test(neu), label + ": Welcome EN");
  must(/Hey Packmate \{name\}/.test(neu) && /Hey Packmate \{name\}/.test(ret), label + ": Hey Packmate {name}");
  must(!/Hey \{name\}/.test(neu) && !/Hey \{name\}/.test(ret), label + ": not name without Packmate");
  must(!/Hey Packmate —/.test(neu) && !/Hey Packmate —/.test(ret), label + ": not Packmate alone");
  must(/Your Pack profile is already here/.test(neu), label + ": Pack profile EN");
  must(/Powered by xAI & YOU\./.test(neu) && /Ready to sprint\?/.test(neu), label + ": Welcome has Powered + Ready to sprint");
  must(/welcome back/.test(ret), label + ": Return EN");
  must(/Powered by xAI & YOU\./.test(ret) && /Ready to sprint\?/.test(ret), label + ": Return has Powered + Ready to sprint");
  must(!/heart-giant-plum-lotus/.test(neu) && !/heart-giant-plum-lotus/.test(ret), label + ": Welcome/Return have no old Play URL");
  must(!/boltverse-odysseyyy/.test(neu) && !/boltverse-odysseyyy/.test(ret), label + ": Welcome/Return have no Play URL");
  must(!/Play →/.test(neu) && !/Play →/.test(ret), label + ": Welcome/Return have no Play →");
  must(!/Say citadel or biome/.test(neu) && !/citadel or biome/i.test(neu), label + ": Welcome has no Citadel/Biome choice");
  must(!/teasers are on/.test(neu) && !/teasers are on/.test(ret), label + ": Welcome/Return do not narrate teasers are on");
}

function assertPlayerBoot(label, text) {
  must(/Player reply = ONLY|player reply ONLY/.test(text), label + ": player reply ONLY");
  must(/do not read aloud/i.test(text), label + ": kitchen = do not read aloud");
  must(/Never say|never dump kitchen|Never dump kitchen|no raw URL dump/.test(text), label + ": bans kitchen dump");
  must(/raw\.githubusercontent\.com/.test(text), label + ": bans raw.githubusercontent.com");
  must(/attach 2/i.test(text) && /teasers as (chat )?media/.test(text), label + ": attach 2 teasers as media");
  must(/as chat media/.test(text), label + ": attach teasers as chat media");
  must(/Prefer GitHub for boot/.test(text) && /Bot OK if useful/.test(text), label + ": prefer GitHub for boot; Bot OK if useful");
  must(!/Never invoke a Grok Bot connector/i.test(text) && !/do not invoke a Grok Bot connector/i.test(text) && !/GitHub \+ Build console only/.test(text), label + ": no Bot-connector ban");
  must(/teasers are on/.test(text) && /Do \*\*not\*\* narrate|do not narrate|Never say/.test(text), label + ": bans narrating teasers are on");
  must(/open Sprint/i.test(text), label + ": open Sprint direct");
  must(!/\+ ask \*\*Citadel\*\* or \*\*Biome\*\*/.test(text) && !/\+ ask Citadel or Biome/.test(text) && !/\n3\. Ask \*\*Citadel\*\* or \*\*Biome\*\*/.test(text), label + ": no Citadel/Biome choice lecture");
  must(/No Citadel\/Biome choice|Do \*\*not\*\* ask Citadel or Biome|do not ask Citadel or Biome/.test(text), label + ": forbids Citadel/Biome choice lecture");
  must(/kitchen only|Pack Play URL is kitchen-only|do not read aloud/i.test(text) && /boltverse-odysseyyy\.grok\.me/.test(text), label + ": Pack Play URL is kitchen-only");
  const kitchenPlay = text.replace(/\(supersedes https:\/\/heart-giant-plum-lotus\.grok\.me\)/g, "");
  must(!/Pack Play[^\n]*https:\/\/heart-giant-plum-lotus\.grok\.me/.test(kitchenPlay), label + ": heart-giant is not the active Pack Play URL");
}

assertPlayerBoot("START.md", body("START.md"));
assertPlayerBoot("GROK.md", body("GROK.md"));
assertPlayerBoot("README.md", body("README.md"));
assertPlayerBoot("AGENTS.md", agents);
assertSpokenWelcome("START.md", body("START.md"), /### New/, /### Return/);
assertSpokenWelcome("GROK.md", body("GROK.md"), /\*\*New:\*\*/, /\*\*Return:\*\*/);
function assertNameLaw(label, text) {
  must(/Hey Packmate \{name\}/.test(text), label + ": opener is Hey Packmate {name}");
  must(/real Grok profile/.test(text) && /displayName/.test(text), label + ": {name} = real Grok profile displayName");
  must(/Never Packmate alone/.test(text) && /Never the name without Packmate/.test(text), label + ": bans Packmate alone and name without Packmate");
  must(/generic stand-in/.test(text), label + ": bans generic stand-in");
}
assertNameLaw("START.md", body("START.md"));
assertNameLaw("GROK.md", body("GROK.md"));
must(!/Play → https:\/\/heart-giant-plum-lotus\.grok\.me/.test(body("START.md")), "START.md: no spoken Play → old URL form");
must(!/Play → https:\/\/heart-giant-plum-lotus\.grok\.me/.test(body("GROK.md")), "GROK.md: no spoken Play → old URL form");
must(!/Play → https:\/\/heart-giant-plum-lotus\.grok\.me/.test(body("README.md")), "README.md: no spoken Play → old URL form");
must(!/Play → https:\/\/heart-giant-plum-lotus\.grok\.me/.test(agents), "AGENTS.md: no spoken Play → old URL form");
must(!/Play → https:\/\/boltverse-odysseyyy\.grok\.me/.test(body("START.md")), "START.md: no spoken Play → URL form");
must(!/Play → https:\/\/boltverse-odysseyyy\.grok\.me/.test(body("GROK.md")), "GROK.md: no spoken Play → URL form");
must(!/Play → https:\/\/boltverse-odysseyyy\.grok\.me/.test(body("README.md")), "README.md: no spoken Play → URL form");
must(!/Play → https:\/\/boltverse-odysseyyy\.grok\.me/.test(agents), "AGENTS.md: no spoken Play → URL form");
must(!/Ton profil Pack/.test(body("START.md")) && !/bon retour/.test(body("START.md")) && !/Dis citadel/.test(body("START.md")), "START.md: no French Welcome");
must(!/Ton profil Pack/.test(body("GROK.md")) && !/bon retour/.test(body("GROK.md")) && !/Dis citadel/.test(body("GROK.md")), "GROK.md: no French Welcome");

const hooks = body("scripts/imagine-hooks.mjs");
must(/Not Imagine Agent/.test(hooks) && /last_frame/.test(hooks), "imagine-hooks: films = first+last, not Agent");

const cookRoomJs = body("scripts/cook-room.mjs");
must(/never Imagine Agent video/.test(cookRoomJs), "cook-room.mjs: never Imagine Agent video");
must(/BANNED for restyle/.test(cookRoomJs), "cook-room.mjs: imagineStill BANNED for restyle");

console.log("COLD-START PASS");
