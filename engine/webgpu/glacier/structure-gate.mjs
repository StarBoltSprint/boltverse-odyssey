// Wall structure. A 0.5 m tile at viewing distance shrinks a crack in the
// 1024 still to a sub-4 px speckle. That is a fail. The still's dominant
// wavelength, projected by focal * tile / distance, has to land at >= 4 px,
// and the crop's own dominant wavelength has to sit within 2x of that.
// The 3x crop is nearest-neighbour, so the measure uses every third pixel.
//   node structure-gate.mjs --distance 40 --tile 0.5 crop.jpg
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

export const MIN_FEATURE_PX = 4;
const FOCAL = (1280 / 2) / Math.tan(31 * Math.PI / 180);
const here = path.dirname(fileURLToPath(import.meta.url));
const STILL = path.join(here, 'tex/glacier-ice/v1.jpg');

function args(argv) {
  const out = { distance: 0, tile: 0.5, files: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--distance') out.distance = Number(argv[++i]);
    else if (argv[i] === '--tile') out.tile = Number(argv[++i]);
    else out.files.push(argv[i]);
  }
  return out;
}

function corrLen(file, step) {
  const py = `
import subprocess, numpy as np, sys
r=subprocess.run(['ffmpeg','-v','error','-i',sys.argv[1],'-f','rawvideo','-pix_fmt','rgb24','pipe:'],capture_output=True,check=True)
im=np.frombuffer(r.stdout,np.uint8)
n=int(round((im.size/3)**0.5))
im=im.reshape(n,n,3).astype(np.float64)
step=int(sys.argv[2])
if step>1: im=im[step//2::step, step//2::step]
Y=0.2126*im[:,:,0]+0.7152*im[:,:,1]+0.0722*im[:,:,2]
Y=Y-Y.mean()
v=(Y*Y).mean()
cl=1
for lag in range(1, min(48, Y.shape[1]//3)):
    ac=(Y[:,:-lag]*Y[:,lag:]).mean()/v
    if ac<0.5:
        cl=lag
        break
    cl=lag
print(cl)
`;
  const r = spawnSync('python3', ['-c', py, file, String(step)], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error((r.stderr || 'corr').slice(-400));
  return Number(r.stdout.trim());
}

const a = args(process.argv.slice(2));
if (!a.files.length || !(a.distance > 0)) {
  console.error('usage: node structure-gate.mjs --distance M [--tile 0.5] <3x-crop.jpg> ...');
  process.exit(2);
}
const stillLen = corrLen(STILL, 1);
const expected = (stillLen / 1024) * FOCAL * a.tile / a.distance;
let fail = 0;
for (const file of a.files) {
  const got = corrLen(file, 3);
  const projected = expected >= MIN_FEATURE_PX;
  const match = got >= expected / 2 && got <= expected * 2;
  const pass = projected && match && got >= MIN_FEATURE_PX;
  const line = `${pass ? 'PASS' : 'FAIL'} ${path.basename(file)} crop ${got.toFixed(1)} expected ${expected.toFixed(1)} stillLen ${stillLen} tile ${a.tile} dist ${a.distance}`;
  if (pass) console.log(line);
  else { console.error(line); fail++; }
}
if (fail) process.exit(1);
console.log('PASS structure', a.files.length);
