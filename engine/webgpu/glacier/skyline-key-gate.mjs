// Follow-camera sky. A horizon is closed only with the dawn sky still in
// the picture. The key is run 31, stored for all six times as
// run32-hdr/before (same mesh; the 24 s frame matches run31/frames/t24.jpg).
//
// Fail unless, at each time:
//   dawn-sky fraction >= 0.9 of the key
//   mean skyline row within 140 px of the key
//   dark pixels in the top 360 rows (the moon) >= 0.7 of the key
// Round 9 fails the sky fraction: a near wall replaced the sky.
//   node skyline-key-gate.mjs <dir-of-t51.jpg...>
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const SKY_RATIO = 0.9;
export const LINE_PX = 140;
export const MOON_RATIO = 0.7;
const TAGS = ['t51', 't5567', 't79', 't117', 't24', 't30'];

const here = path.dirname(fileURLToPath(import.meta.url));
const KEY = path.join(here, 'artifacts/run32-hdr/before');

function measure(file) {
  const py = `
import subprocess, numpy as np, sys
r=subprocess.run(['ffmpeg','-v','error','-i',sys.argv[1],'-f','rawvideo','-pix_fmt','rgb24','pipe:'],capture_output=True,check=True)
im=np.frombuffer(r.stdout,np.uint8).reshape(1280,720,3).astype(np.int16)
rr,g,b=im[:,:,0],im[:,:,1],im[:,:,2]
Y=0.2126*rr+0.7152*g+0.0722*b
sky=((rr-g)>=4)&((np.maximum(rr,b)-g)>=12)&(rr>110)&(rr<230)&(g<205)
line=[]
for x in range(720):
    y=0
    last=-1
    while y<1000:
        if sky[y,x]:
            last=y
            y+=1
            continue
        if last>=0: break
        y+=1
        if y>50 and last<0: break
    line.append(last)
cols=[v for v in line if v>=0]
mean=float(np.mean(cols)) if cols else -1
dark=float((Y[:360]<80).mean())
print(float(sky.mean()), mean, dark)
`;
  const r = spawnSync('python3', ['-c', py, file], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error((r.stderr || 'skyline').slice(-400));
  const [sky, line, moon] = r.stdout.trim().split(/\s+/).map(Number);
  return { sky, line, moon };
}

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node skyline-key-gate.mjs <frame-dir>');
  process.exit(2);
}
let fail = 0;
const rows = [];
for (const tag of TAGS) {
  const gotF = path.join(dir, `${tag}.jpg`);
  if (!fs.existsSync(gotF)) { console.error('FAIL missing', gotF); fail++; continue; }
  const key = measure(path.join(KEY, `${tag}.jpg`));
  const got = measure(gotF);
  const skyRatio = got.sky / key.sky;
  const dLine = Math.abs(got.line - key.line);
  const moonRatio = key.moon > 0 ? got.moon / key.moon : 1;
  const row = {
    tag,
    skyRatio: +skyRatio.toFixed(3),
    line: +got.line.toFixed(1),
    keyLine: +key.line.toFixed(1),
    dLine: +dLine.toFixed(1),
    moonRatio: +moonRatio.toFixed(3),
    pass: skyRatio >= SKY_RATIO && dLine <= LINE_PX && moonRatio >= MOON_RATIO,
  };
  rows.push(row);
  const text = `${row.pass ? 'PASS' : 'FAIL'} ${tag} sky ${row.skyRatio} line ${row.line} key ${row.keyLine} d ${row.dLine} moon ${row.moonRatio}`;
  if (row.pass) console.log(text);
  else { console.error(text); fail++; }
}
const out = process.env.SKYLINE_JSON;
if (out) fs.writeFileSync(out, JSON.stringify({ skyRatio: SKY_RATIO, linePx: LINE_PX, moonRatio: MOON_RATIO, key: 'run32-hdr/before', rows }, null, 2));
if (fail) process.exit(1);
console.log('PASS skyline-key', TAGS.length);
