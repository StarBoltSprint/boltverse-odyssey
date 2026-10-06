/**
 * Player words for the Living Codex. French, like the adventure choices.
 * The insight and the question stay the card's own words.
 */

export const CODEX_INSCRIBED = "Le Codex vivant inscrit cette vérité.";
export const CODEX_FAR = "Le Cœur Stellaire reste loin. Comprendre l'univers n'a pas de fin.";

export function codexCountLine(n) {
  const count = n > 0 ? Math.floor(n) : 0;
  if (count === 0) return "Aucune vérité réunie";
  if (count === 1) return "1 vérité réunie";
  return count + " vérités réunies";
}

export function kindLabel(kind) {
  if (kind === "truth-orb") return "Orbe de vérité";
  if (kind === "echo-shard") return "Éclat d'écho";
  return "";
}
