#!/usr/bin/env node
// Compare one docs/METHOD recipe with one learn/proposals variant.
// Writes the log under learn/recipe-improve. On a strict win, writes a proven patch under learn/proposals.
// Never writes docs/METHOD.
import { resolve } from "node:path";
import { ROOT, compareRecipes, loadInputs, loadProposal, writeComparison } from "./lib.mjs";

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    console.error(`missing value for ${name}`);
    process.exit(2);
  }
  return value;
}

function fail(error) {
  console.error(`FAIL recipe-improve: ${error.message || error}`);
  process.exit(2);
}

const recipe = arg("--recipe");
const inputsPath = arg("--inputs");
const proposalPath = arg("--proposal");
if (!recipe || !inputsPath || !proposalPath) {
  console.error("usage: node tools/recipe-improve/cli.mjs --recipe <id> --inputs <file> --proposal <file> [--id <id>] [--root <repo>] [--learn learn]");
  process.exit(2);
}

const root = resolve(arg("--root", ROOT));
const learnDir = arg("--learn", "learn");
const id = arg("--id", "");

try {
  const inputs = loadInputs(resolve(root, inputsPath), root);
  const proposal = loadProposal(resolve(root, proposalPath), root);
  const result = await compareRecipes({ root, recipe, inputs, proposal });
  const comparisonId = id || `${recipe}--${proposal.id}`;
  const written = writeComparison(root, { id: comparisonId, learnDir, ...result });
  const { scores } = result.comparison;
  const proven = written.provenPath ? " proven=yes" : "";
  console.log(
    `decision=${result.comparison.decision} because=${result.comparison.because} score=${scores.variant.points}/${scores.variant.maxPoints} vs ${scores.current.points}/${scores.current.maxPoints} log=${written.jsonPath}${proven}`,
  );
} catch (error) {
  fail(error);
}
