/**
 * Paw menu entry and the text cards for one adventure.
 * The paw, the hall film, and the shard card come from the shared module.
 * This file does not draw a world pixel.
 */

import { buildCatalogue } from "../../common/archives/catalogue.js";
import { nearestUnfound } from "../../common/archives/pickup.js";
import { mountPresent } from "../../common/archives/present.js";
import { createSave, listTruths } from "../../common/archives/save.js";
import { clipChain, nextSeed, readByok, writeByok } from "../../../tools/adventure/lib.js";
import { generateAdventure } from "../../../tools/adventure/generate.js";
import { cardToPlan } from "../../../tools/adventure/playmap.js";
import { requestUniqueTouch } from "../../../tools/adventure/unique.js";
import { bindPlan } from "./stream.js";
import { chooseQuest, counterText, createQuest, noteShard, skipToRun, timerText } from "./quest.js";

const UI = {
  paw: "packs/common/archives/art/paw.png",
  pawGlow: "packs/common/archives/art/paw-glow-alpha.png",
  hall: "packs/common/archives/art/hall.jpg",
  hallVideo: "packs/common/archives/art/hall-loop.mp4",
  plate: "packs/common/archives/art/plate.jpg",
  silhouette: "packs/common/archives/art/silhouette.png",
};

const STYLE = `
#adventure-card, #adventure-line {
  position: fixed; z-index: 5; pointer-events: none;
  color: #f4f1ea; font-family: "Segoe UI", system-ui, sans-serif;
  text-shadow: 0 1px 2px rgba(0,0,0,0.85);
}
#adventure-card { left: 28px; right: 28px; top: 16%; text-align: center; display: none; }
#adventure-card .row { margin-top: 18px; display: flex; gap: 18px; justify-content: center; flex-wrap: wrap; }
#adventure-card button {
  pointer-events: auto; background: transparent; color: inherit; border: 0;
  border-bottom: 1px solid rgba(158,231,255,0.45); font: inherit; font-size: 16px; padding: 8px 2px;
}
#adventure-card .kicker { letter-spacing: 0.16em; font-size: 12px; color: #9ee7ff; margin: 0; }
#adventure-card h1 { font-size: 26px; font-weight: 500; margin: 10px 0; }
#adventure-card p { margin: 8px 0; font-size: 16px; line-height: 1.35; }
#adventure-line { left: 16px; right: 16px; top: 18px; text-align: left; font-size: 14px; line-height: 1.35; display: none; }
#adventure-line .obj { display: block; padding-right: 96px; }
#adventure-line .meta { display: flex; gap: 12px; margin-top: 2px; padding-right: 96px; }
#adventure-line .timer { flex: 0 0 auto; }
`;

export async function loadCatalog(absUrl) {
  const res = await fetch(absUrl("tools/adventure/shard-types.json"));
  if (!res.ok) throw new Error("shard catalog");
  return res.json();
}

export async function loadLibrary(absUrl) {
  const res = await fetch(absUrl("tools/adventure/library.json"));
  if (!res.ok) throw new Error("library");
  return res.json();
}

export function mountAdventureUi(doc, env) {
  if (!doc.getElementById("adventure-style")) {
    const style = doc.createElement("style");
    style.id = "adventure-style";
    style.textContent = STYLE;
    doc.head.appendChild(style);
  }
  const card = doc.createElement("div");
  card.id = "adventure-card";
  const line = doc.createElement("div");
  line.id = "adventure-line";
  const lineObj = doc.createElement("div");
  lineObj.className = "obj";
  const lineMeta = doc.createElement("div");
  lineMeta.className = "meta";
  const lineCount = doc.createElement("span");
  lineCount.className = "count";
  const lineTimer = doc.createElement("span");
  lineTimer.className = "timer";
  lineMeta.append(lineCount, lineTimer);
  line.append(lineObj, lineMeta);
  doc.body.append(card, line);

  const save = createSave(globalThis.localStorage);
  let catalog = env.catalog || null;
  let library = env.library || null;
  let plan = env.plan || null;
  let chainNote = "";
  let paintKey = "";
  let busy = false;
  let quest = env.quest || null;
  let manifest = plan ? plan.manifest : null;

  function paintCard() {
    const overlay = quest && quest.overlay;
    const key = !overlay ? "" : [
      quest.phase,
      overlay.kicker,
      overlay.title,
      (overlay.lines || []).join("\n"),
      overlay.choice ? "choice" : "",
      busy ? "busy" : "",
    ].join("\n");
    if (key === paintKey) return;
    paintKey = key;
    if (!overlay) {
      card.style.display = "none";
      card.replaceChildren();
      return;
    }
    card.style.display = "block";
    card.replaceChildren();
    const kicker = doc.createElement("p");
    kicker.className = "kicker";
    kicker.textContent = overlay.kicker;
    const title = doc.createElement("h1");
    title.textContent = overlay.title;
    card.append(kicker, title);
    const lines = overlay.lines || [];
    for (let i = 0; i < lines.length; i++) {
      const p = doc.createElement("p");
      p.textContent = lines[i];
      card.append(p);
    }
    if (!overlay.choice) return;
    const row = doc.createElement("div");
    row.className = "row";
    const again = doc.createElement("button");
    again.type = "button";
    again.textContent = "Continuer";
    again.disabled = busy;
    again.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onContinue();
    });
    const home = doc.createElement("button");
    home.type = "button";
    home.textContent = "Retour à la Citadelle";
    home.disabled = busy;
    home.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onCitadel();
    });
    row.append(again, home);
    card.append(row);
  }

  function paint() {
    paintCard();
    if (!quest || quest.phase !== "run") {
      line.style.display = "none";
      return;
    }
    line.style.display = "block";
    lineObj.textContent = quest.notice ? quest.objective + "  " + quest.notice : quest.objective;
    lineCount.textContent = "Éclats d'écho " + counterText(quest);
    lineTimer.textContent = timerText(quest);
  }

  function onCitadel() {
    if (!quest || quest.phase !== "choice") return;
    chooseQuest(quest, "citadel");
    paintKey = "";
    paint();
  }

  async function onContinue() {
    if (!quest || quest.phase !== "choice" || busy) return;
    busy = true;
    paintKey = "";
    paint();
    try {
      if (!catalog) catalog = await loadCatalog(env.absUrl);
      if (!library) library = await loadLibrary(env.absUrl);
      const hook = plan && plan.nextHook;
      const seed = hook && hook.seed ? hook.seed : nextSeed(plan ? plan.seed : 1);
      const prior = hook && hook.context ? hook.context : "";
      chainNote = clipChain([prior, chainNote, (plan ? plan.title : "") + " (" + (quest.result || "end") + ")"].filter(Boolean).join(" | "));
      const card = await generateAdventure({
        seed,
        key: readByok(globalThis.localStorage),
        types: catalog,
        library,
        chain: chainNote,
        fetchImpl: globalThis.fetch,
      });
      requestUniqueTouch(card);
      const next = cardToPlan(card, env.origin, catalog, library);
      applyPlan(next, createQuest(next));
    } finally {
      busy = false;
      paintKey = "";
      paint();
    }
  }

  function applyPlan(nextPlan, nextQuest) {
    plan = nextPlan;
    manifest = nextPlan.manifest;
    quest = nextQuest;
    bindPlan(env.field, {
      seed: nextPlan.seed,
      lengthM: nextPlan.lengthM,
      objects: nextPlan.objects,
      density: nextPlan.density,
    });
    if (env.onBegin) env.onBegin(nextPlan);
    paint();
    return quest;
  }

  async function beginNew() {
    if (present) present.closeMenu();
    chainNote = "";
    if (!catalog) catalog = await loadCatalog(env.absUrl);
    if (!library) library = await loadLibrary(env.absUrl);
    const seed = (Date.now() % 90000) + 3;
    const card = await generateAdventure({
      seed,
      key: readByok(globalThis.localStorage),
      types: catalog,
      library,
      fetchImpl: globalThis.fetch,
    });
    requestUniqueTouch(card);
    const next = cardToPlan(card, env.origin, catalog, library);
    const q = createQuest(next);
    applyPlan(next, q);
    return card;
  }

  const present = mountPresent(doc, {
    absUrl: env.absUrl,
    ui: UI,
    cardMs: 2500,
    extraItems: [{ label: "Nouvelle aventure", onPress() { beginNew(); } }],
    onArchives() {
      const progress = save.load();
      const cat = manifest
        ? buildCatalogue(manifest, progress)
        : { found: 0, total: 0, shards: [] };
      cat.codex = listTruths(progress);
      present.openArchives(cat);
    },
    onHold(open) { if (env.onHold) env.onHold(open); },
    mountSettings(menu) {
      const label = doc.createElement("p");
      label.textContent = "xAI key stays on this device.";
      label.style.margin = "8px 12px";
      label.style.textAlign = "center";
      const input = doc.createElement("input");
      input.type = "password";
      input.autocomplete = "off";
      input.spellcheck = false;
      input.setAttribute("aria-label", "xAI key");
      input.placeholder = "xAI key";
      input.value = readByok(globalThis.localStorage);
      input.style.display = "block";
      input.style.width = "calc(100% - 24px)";
      input.style.margin = "0 12px 12px";
      input.style.background = "transparent";
      input.style.color = "inherit";
      input.style.border = "0";
      input.style.borderBottom = "1px solid rgba(158,231,255,0.45)";
      input.style.padding = "8px 0";
      input.style.font = "inherit";
      input.style.textAlign = "center";
      input.addEventListener("pointerdown", (e) => e.stopPropagation());
      input.addEventListener("change", () => writeByok(globalThis.localStorage, input.value.trim()));
      menu.append(label, input);
    },
  });

  function sense(x, z) {
    if (!quest || !manifest || quest.phase !== "run") return null;
    const hit = nearestUnfound(manifest.shards, x, z, manifest.pickupRadiusM || 2.25, quest.found);
    if (!hit) return null;
    if (!noteShard(quest, hit)) return null;
    save.mark(manifest.zoneId, hit.id);
    present.showCard(hit, manifest.cardMs || 2500);
    present.setCount(counterText(quest));
    paint();
    return hit.id;
  }

  function archiveTruth() {
    if (!quest || quest.truthSaved || quest.result !== "pass") return;
    quest.truthSaved = true;
    const truth = plan && plan.truth;
    const insight = truth && truth.insight;
    const zoneId = manifest && manifest.zoneId;
    if (!insight || !zoneId || !plan || !Number.isInteger(plan.seed)) return;
    const rec = save.rememberTruth(zoneId, insight, new Date().toISOString(), {
      question: plan.question || "",
      kind: truth.kind || "",
      title: plan.title || "",
      seed: plan.seed,
    });
    if (!rec.order) return;
    quest.codexOrder = rec.order;
    if (quest.phase === "ending" && quest.overlay && Array.isArray(quest.overlay.lines)) {
      const mark = "Vérité #" + rec.order;
      if (!quest.overlay.lines.includes(mark)) {
        quest.overlay = {
          kicker: quest.overlay.kicker,
          title: quest.overlay.title,
          lines: quest.overlay.lines.concat(mark),
        };
      }
    }
  }

  function tick(dt, blocked) {
    archiveTruth();
    present.tick(dt, blocked);
    paint();
  }

  if (plan) requestUniqueTouch(plan);
  if (quest) paint();

  return {
    present,
    get quest() { return quest; },
    get plan() { return plan; },
    applyPlan,
    beginNew,
    sense,
    tick,
    paint,
    skipToRun() {
      if (quest) skipToRun(quest);
      paint();
    },
    blocksPlay() { return present.blocksPlay(); },
  };
}
