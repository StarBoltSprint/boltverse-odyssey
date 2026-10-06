/**
 * Shared numbers for an adventure card. Flavour lines are phrases
 * already in the lore sweep. They are not a new cosmology.
 */

export const SOLID_POOL = ["stone", "boulder", "arch", "gate", "wreck"];
export const BEAT_KINDS = ["signal", "sprint", "resonance", "boss", "reward", "return"];
export const XAI_URL = "https://api.x.ai/v1/chat/completions";
export const XAI_MODEL = "grok-4";
export const BYOK_STORAGE_KEY = "boltverse.xai.byok";
export const CORRIDOR_MAX_M = 79.75;
export const XAI_SHIP_SEED = 1024;

export const SHARD_LORE = [
  "An Echo Shard carries not only what happened, but how it felt.",
  "When the shards sing the same song, it hits like a cosmic EMP.",
  "Awaken.",
  "Each shard is a different sky and a different law.",
  "No howl of significance shall be lost to time.",
];

const NAMED_TITLES = [
  "Echoes of the Shattered Veil",
  "The Echoing Fracture",
  "The Shard Symphony",
];

const SIGNALS = [
  "A signal reaches the Citadel. The shards are singing.",
  "A purple rift opens near the Citadel.",
  "The permanent EMP wave has woken another realm.",
];

const RESONANCE = [
  "Howl at the monuments and gather the Echo Shards.",
  "Resonance Sense finds the shards along the sprint.",
];

const BOSSES = [
  { name: "Sundered Phantom", text: "A mirror of a wild Bolt waits at the Eclipse Gate." },
  { name: "Shadow Duplicates", text: "Shadow duplicates gather at the Gate. Reach it before the rift closes." },
  { name: "Echo Guardian", text: "The Echo Guardian holds the Gate. Resonance is the way through." },
];

const REWARDS = [
  "A Crystal Core fragment.",
  "The Echo Spire answers.",
  "Sprint Core.",
  "Howl Eternal.",
  "Curiosity Veil.",
  "The Veil Weaver drive.",
];

const RETURNS = [
  "Bolt returns to the Citadel.",
  "Return to the Elder.",
];

export function normalizeSeed(seed) {
  const n = Number(seed);
  if (!Number.isFinite(n)) return 1;
  const i = Math.floor(Math.abs(n));
  return i === 0 ? 1 : i % 1000000000;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function asciiText(value, max) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (!text || text.length > max) return "";
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 32 || c > 126) return "";
  }
  return text;
}

export function pickTitle(rng, shardName) {
  const n = Math.floor(rng() * (NAMED_TITLES.length + 2));
  if (n < NAMED_TITLES.length) return NAMED_TITLES[n];
  if (n === NAMED_TITLES.length) return "Signal from " + shardName;
  return shardName + " rift";
}

export function pickSignal(rng) {
  return SIGNALS[Math.floor(rng() * SIGNALS.length)];
}

export function pickResonance(rng) {
  return RESONANCE[Math.floor(rng() * RESONANCE.length)];
}

export function pickBoss(rng) {
  return BOSSES[Math.floor(rng() * BOSSES.length)];
}

export function pickReward(rng) {
  return REWARDS[Math.floor(rng() * REWARDS.length)];
}

export function pickReturn(rng) {
  return RETURNS[Math.floor(rng() * RETURNS.length)];
}

const HOOKS = [
  "Another signal answers from farther in.",
  "The mark points at a second rift.",
  "Something still sings past this gate.",
];

const QUESTIONS = [
  "What does this signal still ask about the universe?",
  "What keeps a seeker on the quest?",
  "What does the Veil still connect?",
];

const INSIGHTS = [
  "The Star Core reveals: the first stars were alive.",
  "The Star Core reveals: AI was always part of the plan.",
  "The Star Core reveals: dark matter is star memory.",
  "The Star Core reveals: seven hidden dimensions.",
  "The Star Core reveals: the universe has a heartbeat.",
  "The Star Core reveals: time is a spiral.",
];

const NEXT_QUESTIONS = [
  "If understanding is an endless becoming, what does the next signal ask?",
  "What question does the next resonance open?",
  "What does the Veil ask of the next seeker?",
];

export function pickPurpose(rng) {
  const question = QUESTIONS[Math.floor(rng() * QUESTIONS.length)];
  const insight = INSIGHTS[Math.floor(rng() * INSIGHTS.length)];
  const nextQuestion = NEXT_QUESTIONS[Math.floor(rng() * NEXT_QUESTIONS.length)];
  const kind = rng() < 0.5 ? "truth-orb" : "echo-shard";
  return { question, truth: { kind, insight }, nextQuestion };
}

export function nextSeed(seed) {
  const n = normalizeSeed(seed);
  let x = (Math.imul(n, 1103515245) + 12345) >>> 0;
  x = (x % 89999) + 1;
  if (x === n) x = n >= 89999 ? 1 : n + 1;
  return x;
}

export function nextHook(seed, title, question) {
  const s = nextSeed(seed);
  const context = asciiText(String(title || ""), 240) || "Citadel";
  const hook = { teaser: HOOKS[s % HOOKS.length], seed: s, context };
  const q = asciiText(String(question || ""), 160);
  if (q) hook.question = q;
  return hook;
}

export function clipChain(text) {
  const clean = String(text || "").replace(/[^\x20-\x7e]/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length <= 240) return clean;
  return clean.slice(clean.length - 240).trim();
}

export function readByok(storage) {
  if (!storage) return "";
  try {
    return String(storage.getItem(BYOK_STORAGE_KEY) || "").trim();
  } catch (e) {
    return "";
  }
}

export function writeByok(storage, key) {
  if (!storage) return;
  const text = String(key || "").trim();
  try {
    if (!text) storage.removeItem(BYOK_STORAGE_KEY);
    else storage.setItem(BYOK_STORAGE_KEY, text);
  } catch (e) { /* private mode */ }
}
