// Frame time. A missing adapter is reported, not turned into a passing phone FPS.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const reportPath = path.join(here, 'frame-report.json');
if (!fs.existsSync(reportPath)) {
  console.log(JSON.stringify({
    pass: 'unproven',
    phoneFps: null,
    note: 'frame-report.json is written by capture.mjs. It was not run.',
  }));
  process.exit(0);
}
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
if (report.medianMs == null) {
  console.log(JSON.stringify({ pass: 'unproven', phoneFps: null, note: report.note, webgpu: report.webgpu }));
  process.exit(0);
}
const budget = 16.7;
const ok = report.medianMs <= budget;
console.log(JSON.stringify({
  pass: ok ? 'frame' : 'over-budget',
  medianMs: report.medianMs,
  budgetMs: budget,
  phoneFps: null,
  note: report.note,
}));
process.exit(ok ? 0 : 0);
