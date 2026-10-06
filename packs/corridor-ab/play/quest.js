/**
 * Adventure clock. Text phases only. The corridor solids stay in stream.js.
 * Reaching the Gate is a radius on the seat the loft already uses.
 */

import { CODEX_INSCRIBED } from "../../common/archives/codex.js";

export const INTRO_MS = 2500;
export const END_MS = 2500;
export const GATE_RADIUS_M = 5;

const OBJECTIVE_FR = {
  "Collect the Echo Shards, then reach the Eclipse Gate.": "Ramasse les Éclats d'écho, puis atteins la Porte de l'Éclipse.",
};

/** Player line. The card keeps ASCII so the schema stays valid. */
export function hudObjective(text) {
  return OBJECTIVE_FR[text] || text;
}

export function createQuest(plan) {
  const objective = hudObjective(plan.objective);
  return {
    plan,
    phase: "intro",
    clock: 0,
    runSec: 0,
    found: new Set(),
    result: "",
    holdMove: true,
    teleport: false,
    overlay: {
      kicker: "Boltverse Odyssey",
      title: plan.title,
      lines: [plan.signal, objective],
    },
    objective,
    notice: "",
    noticeT: 0,
  };
}

export function skipToRun(quest) {
  quest.phase = "run";
  quest.holdMove = false;
  quest.clock = 0;
  quest.overlay = null;
  return quest;
}

export function noteShard(quest, shard) {
  if (!quest || quest.phase !== "run" || quest.found.has(shard.id)) return false;
  quest.found.add(shard.id);
  quest.notice = shard.lore;
  quest.noticeT = 2500;
  return true;
}

function choiceOverlay(quest) {
  const base = quest.result === "fail" ? failOverlay(quest) : passOverlay(quest);
  const teaser = quest.plan.nextHook && quest.plan.nextHook.teaser;
  const lines = (base.lines || []).slice();
  if (teaser) lines.push(teaser);
  return { kicker: base.kicker, title: base.title, lines, choice: true };
}

export function chooseQuest(quest, which) {
  if (!quest || quest.phase !== "choice") return quest;
  if (which === "continue") {
    quest.choice = "continue";
    return quest;
  }
  quest.choice = "citadel";
  quest.phase = "return";
  quest.clock = 0;
  quest.holdMove = true;
  quest.teleport = true;
  quest.overlay = returnOverlay(quest);
  return quest;
}

export function counterText(quest) {
  return quest.found.size + " sur " + quest.plan.shards.length;
}

export function timerText(quest) {
  const left = Math.max(0, quest.plan.boss.timerSec - quest.runSec);
  return Math.ceil(left) + "s";
}

function failOverlay(quest) {
  return {
    kicker: "The rift closes",
    title: quest.plan.boss.name,
    lines: ["The Gate stays shut.", quest.plan.boss.text],
  };
}

function passOverlay(quest) {
  const lines = [quest.plan.reward];
  const insight = quest.plan.truth && quest.plan.truth.insight;
  if (insight) lines.push(insight);
  return {
    kicker: "Reward",
    title: quest.plan.title,
    lines,
  };
}

function codexOverlay(quest) {
  const lines = [];
  if (quest.plan.question) lines.push(quest.plan.question);
  lines.push(quest.plan.truth.insight);
  lines.push(CODEX_INSCRIBED);
  return {
    kicker: "Codex vivant",
    title: quest.plan.title,
    lines,
  };
}

function returnOverlay(quest) {
  return {
    kicker: "Citadelle",
    title: quest.plan.title,
    lines: [quest.plan.returnText],
  };
}

export function stepQuest(quest, dt, x, z) {
  const step = dt > 0 ? dt : 0;
  if (quest.noticeT > 0) {
    quest.noticeT -= step * 1000;
    if (quest.noticeT <= 0) {
      quest.notice = "";
      quest.noticeT = 0;
    }
  }
  if (quest.phase === "intro") {
    quest.clock += step * 1000;
    quest.holdMove = true;
    if (quest.clock >= INTRO_MS) {
      quest.phase = "run";
      quest.clock = 0;
      quest.holdMove = false;
      quest.overlay = null;
    }
    return quest;
  }
  if (quest.phase === "run") {
    quest.runSec += step;
    quest.holdMove = false;
    const goal = quest.plan.goal || quest.plan.gate;
    const atGoal = Math.hypot(goal.x - x, goal.z - z) <= GATE_RADIUS_M;
    const all = quest.plan.echoRequired === false || quest.found.size >= quest.plan.shards.length;
    const late = quest.runSec > quest.plan.boss.timerSec;
    if (late && !(atGoal && all)) {
      quest.result = "fail";
      quest.phase = "ending";
      quest.clock = 0;
      quest.holdMove = true;
      quest.overlay = failOverlay(quest);
    } else if (atGoal && all) {
      quest.result = "pass";
      quest.phase = "ending";
      quest.clock = 0;
      quest.holdMove = true;
      const insight = quest.plan.truth && quest.plan.truth.insight;
      quest.overlay = insight ? codexOverlay(quest) : passOverlay(quest);
    }
    return quest;
  }
  if (quest.phase === "ending") {
    quest.clock += step * 1000;
    quest.holdMove = true;
    if (quest.clock >= END_MS) {
      quest.phase = "choice";
      quest.clock = 0;
      quest.holdMove = true;
      quest.overlay = choiceOverlay(quest);
    }
    return quest;
  }
  if (quest.phase === "choice") {
    quest.holdMove = true;
    return quest;
  }
  if (quest.phase === "return") {
    quest.clock += step * 1000;
    quest.holdMove = true;
    if (quest.clock >= END_MS) {
      quest.phase = "done";
      quest.holdMove = false;
      quest.overlay = null;
    }
    return quest;
  }
  quest.holdMove = false;
  return quest;
}
