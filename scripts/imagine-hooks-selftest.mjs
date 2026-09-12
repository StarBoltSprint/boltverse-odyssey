#!/usr/bin/env node
// Fixture: at-sill prompts name no-punch floor placement; spawn/lane stay off that stack.
// at-A prefers lock/example-at-a.jpg (SmiR lock teacher). at-B prefers hung moss PASS.
// copy PLACE+POSE from example; FORCE taille 0.35–0.40; FORCE STANDING; never shrink to 0.18.
// IGNORE tiny ~0.18 crop like bolt-back 0.53. Never send example-at-*-tiny.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  ATA_FORCE_STANDING,
  ATA_FORCE_TAILLE,
  ATA_LOCK_COPY,
  ENLARGE_SILL_COPY,
  HALL_LAW,
  enlargeStillLine,
  sillStillLine,
  stillRefLine,
  stillRefOrder,
  sillTeacherRel,
  spawnStillLine,
  walkClipLine,
} from "./imagine-hooks.mjs";
import {
  DEST_REL,
  DROP_RELS,
  ICE_A_REL,
  ICE_B_REL,
  SEAL_A_REL,
  SEAL_B_REL,
  SEAL_REL,
  installLockAta,
  lockAtaStatus,
  sealAtaStatus,
  sealAtbStatus,
} from "./install-lock-ata.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function must(ok, msg) {
  if (!ok) {
    console.error("FAIL  " + msg);
    process.exit(1);
  }
  console.log("PASS  " + msg);
}

const teacherA = sillTeacherRel(root, "atA");
const teacherB = sillTeacherRel(root, "atB");
const atB = [sillStillLine("B"), stillRefLine("atB", true, teacherB)].join(" ");
const atA = [sillStillLine("A"), stillRefLine("atA", true, teacherA)].join(" ");

for (const [name, p] of [
  ["atB", atB],
  ["atA", atA],
]) {
  must(/STONE FLOOR/.test(p), name + " feet-on-floor");
  must(/punch-sill/.test(p), name + " names punch-sill");
  must(/0\.35–0\.40|0\.35-0\.40/.test(p), name + " sill band 0.35–0.40");
  must(/top < 0\.46/.test(p), name + " crown below mid-frame");
  must(/official SEUIL teacher/.test(p), name + " official SEUIL teacher");
  must(/IGNORE a tiny ~0\.18 crop/.test(p) && /IGNORE bolt-back ~0\.53/.test(p), name + " ignore tiny 0.18 like bolt-back 0.53");
  must(/example-at-\*-tiny/.test(p), name + " never copy archived tinies");
  must(/0\.53 is illegal/.test(p), name + " ignore bolt-back crop");
  must(/NEVER sit/.test(p) && /NEVER 3\/4/.test(p) && /muzzle HIDDEN/.test(p), name + " sit/yaw/face still banned");
  must(/NEVER mid-hall/.test(p) && /NEVER spawn/.test(p) && /NEVER center/.test(p), name + " mid-hall/spawn-cx banned");
  must(/already AT the sill\/threshold/.test(p), name + " already AT the sill/threshold");
  must(/NOT mid-hall/.test(p) && /NOT spawn center/.test(p), name + " NOT mid-hall, NOT spawn center");
  must(/THRESHOLD/.test(p) && /sill lip/.test(p), name + " paws on sill lip");
  must(/Do not leave him at center spawn/.test(p) && /Do not grow him in place/.test(p), name + " edit is a move, not a grow");
}

must(teacherA === "lock/example-at-a.jpg", "atA prefers SmiR lock/example-at-a as side ref");
must(teacherB === "packs/moss/stills/at-b.jpg", "prefer hung moss PASS at-B as side ref");
must(stillRefOrder("atB", true, root).join(",") === "spawn,bolt-back.jpg,packs/moss/stills/at-b.jpg", "atB+spawn edits spawn then moss PASS sill");
must(stillRefOrder("atA", true, root).join(",") === "spawn,bolt-back.jpg,lock/example-at-a.jpg", "atA+spawn edits spawn then lock/example-at-a");
must(stillRefOrder("atB", true).join(",") === "spawn,bolt-back.jpg,lock/example-at-b.jpg", "atB lock fallback is swapped example-at-b");
must(stillRefOrder("atA", true).join(",") === "spawn,bolt-back.jpg,lock/example-at-a.jpg", "atA lock fallback is lock/example-at-a");
must(atA.includes(ATA_LOCK_COPY), "atA prompt: copy PLACE+POSE from example; FORCE taille 0.35–0.40; FORCE STANDING; never shrink to 0.18");
must(atA.includes(ATA_FORCE_TAILLE), "atA FORCE taille 0.35–0.40 never shrink to 0.18");
must(atA.includes(ATA_FORCE_STANDING), "atA FORCE STANDING when using teacher");
must(/never shrink to 0\.18/.test(atA), "atA never shrink to 0.18");
must(/FORCE taille 0\.35–0\.40/.test(atA) && /FORCE STANDING/.test(atA), "atA FORCE taille + standing");
must(/0\.16/.test(atA) && /0\.19/.test(atA), "atA names live ember FAIL bands 0.16/0.19");
must(/ignore example décor/.test(atA) && /hall materials from spawn\/catalog only/.test(atA), "atA cross-style: example pose, spawn décor");
must(/standing BACK toward teal L/.test(atA), "atA names SmiR teacher pose");
must(atB.includes(ATA_FORCE_TAILLE) && atB.includes(ATA_FORCE_STANDING), "atB also FORCE taille + standing");
must(DEST_REL === "lock/example-at-a.jpg", "install dest is lock/example-at-a.jpg");
must(SEAL_REL === "lock/SEAL-at-a.jpg" && SEAL_A_REL === "lock/SEAL-at-a.jpg", "seal dest is lock/SEAL-at-a.jpg");
must(SEAL_B_REL === "lock/SEAL-at-b.jpg", "seal dest is lock/SEAL-at-b.jpg");
must(ICE_A_REL === "hall-stills/seal/at-a-ice.jpg", "ice KEEP drop hall-stills/seal/at-a-ice.jpg");
must(ICE_B_REL === "hall-stills/seal/at-b-ice.jpg", "ice KEEP drop hall-stills/seal/at-b-ice.jpg");
must(DROP_RELS[0] === ICE_A_REL, "first drop slot is ice KEEP at-a");
must(/COOK\/LOCK/.test(lockAtaStatus(root).note), "COOK/LOCK note present");
must(lockAtaStatus(root).hasDrop === true, "owner drop present (ice KEEP or smir-ata-teacher)");
must(sealAtaStatus(root, {}).sealed === existsSync(join(root, SEAL_A_REL)), "SEAL file (not env) gates at-A");
must(sealAtaStatus(root, { SEAL_ATA: "1" }).sealed === true, "SEAL_ATA=1 seals at-A");
must(sealAtbStatus(root, { SEAL_ATB: "1" }).sealed === true, "SEAL_ATB=1 seals at-B");
must(sealAtaStatus(root, { SEAL: "1" }).sealed === true && sealAtbStatus(root, { SEAL: "1" }).sealed === true, "SEAL=1 seals both");
must(sealAtaStatus("/tmp/boltverse-no-seal-ata", {}).sealed === false, "no file + no env → unsealed at-A");
must(sealAtbStatus("/tmp/boltverse-no-seal-atb", {}).sealed === false, "no file + no env → unsealed at-B");
must(/frozen/.test(sealAtaStatus(root, { SEAL_ATA: "1" }).note), "seal note says frozen");
must(/Soft KEEP banned/.test(sealAtaStatus(root, { SEAL_ATA: "1" }).note), "seal note: Soft KEEP banned");
try {
  installLockAta(root, join(root, "lock/example-at-a-tiny.jpg"));
  must(false, "tiny install must refuse");
} catch (err) {
  must(/COOK\/LOCK REFUSED/.test(String(err.message || err)), "install refuses archived tiny");
}
must(!String(stillRefOrder("atA", true, root)).includes("tiny"), "live atA does not send archived tiny");
must(!String(stillRefOrder("atB", true, root)).includes("tiny"), "live atB does not send archived tiny");
must(stillRefOrder("spawn", false).join(",") === "bolt-back.jpg,example-spawn.jpg", "spawn ref order unchanged");
must(stillRefLine("spawn", true) === "", "spawn has no sill ref lecture");

function energyOk(p, name) {
  must(/oval OR RECT|oval or RECT|Oval or RECT/.test(p), name + " oval|RECT energy OK");
  must(/never wood|Never wood|NEVER wood/.test(p), name + " never wood");
  must(/chrome UI/.test(p), name + " never chrome UI");
  must(
    !/Never oval|never oval|not ovals|stay RECT \(never oval\)|do not copy door shape|RECT grammar/.test(p),
    name + " does not ban oval shape",
  );
}

energyOk(HALL_LAW, "HALL_LAW");
energyOk(spawnStillLine(), "spawnStillLine");
energyOk(walkClipLine(), "walkClipLine");
energyOk(atA, "atA");
energyOk(atB, "atB");
must(/Do not FAIL oval shape/.test(atA) && /Do not FAIL oval shape/.test(atB), "sill refs: do not FAIL oval shape");
must(/preferred-ok/.test(HALL_LAW) && /preferred-ok/.test(spawnStillLine()), "oval preferred-ok");

const enlargeA = enlargeStillLine("A");
const enlargeB = enlargeStillLine("B");
must(enlargeA.includes(ENLARGE_SILL_COPY), "enlarge A uses ENLARGE_SILL_COPY");
must(/ENLARGE ONLY/.test(enlargeA) && /ENLARGE ONLY/.test(enlargeB), "enlarge: ENLARGE ONLY");
must(/0\.35–0\.40|0\.35-0\.40/.test(enlargeA), "enlarge A taille 0.35–0.40");
must(/STANDING/.test(enlargeA) && /NEVER sit/.test(enlargeA), "enlarge A FORCE standing");
must(/0\.16/.test(enlargeA) && /0\.19/.test(enlargeA), "enlarge names ember FAIL 0.16/0.19");
must(/same camera|Same camera/.test(enlargeA), "enlarge same camera/hall");
must(!/copy PLACE\+POSE from example/.test(enlargeA), "enlarge does not copy teacher PLACE+POSE");
must(stillRefOrder("atA", true, root, { enlarge: true }).join(",") === "fail,bolt-back.jpg,spawn", "enlarge refs: FAIL jpg first, no teacher");
must(!String(stillRefOrder("atA", true, root, { enlarge: true })).includes("example-at-a"), "enlarge does not send lock teacher");
must(stillRefOrder("atA", true, root).join(",") === "spawn,bolt-back.jpg,lock/example-at-a.jpg", "fresh atA refs unchanged");
energyOk(enlargeA, "enlargeA");
energyOk(enlargeB, "enlargeB");

const dry = spawnSync("node", [join(root, "scripts/cook-room.mjs"), "moss", "--dry-run"], {
  encoding: "utf8",
  env: { ...process.env, SEAL_ATA: "1", SEAL_ATB: "1" },
});
must(dry.status === 0, "cook-room moss --dry-run SEAL_ATA+SEAL_ATB exits 0");
must(/SEALED at-A\/at-B = frozen KEEP/.test(dry.stdout || ""), "dry-run prints sealed at-A/at-B KEEP one-liner");
must(/no imagineStill/.test(dry.stdout || ""), "dry-run sealed skip names no imagineStill");
must(!/^cook stills\/at-a\.jpg/m.test(dry.stdout || ""), "dry-run does not Imagine at-A when sealed or hung PASS");
must(!/^cook stills\/at-b\.jpg/m.test(dry.stdout || ""), "dry-run does not Imagine at-B when sealed or hung PASS");

console.log("IMAGINE-HOOKS PASS");
