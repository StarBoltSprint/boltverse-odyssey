// Repeat gate. A 3× crop of a large ice face fails when a shifted copy of
// itself still lines up. Round-4 crops are the fixture and must fail.
//   node repeat-gate.mjs <crop.jpg> ...
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export const REPEAT_PEAK_MAX = 0.31;
const SKIP_R = 20;

// 2D autocorrelation peak outside a 20 px disc. Round-4 crops sit near 0.35.
export function repeatPeak(file) {
  const py = spawnSync('python3', ['-c', `
import subprocess, sys, json
import numpy as np
p=sys.argv[1]
pr=subprocess.run(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','csv=p=0',p],capture_output=True,text=True)
w,h=map(int,pr.stdout.strip().split(','))
raw=subprocess.run(['ffmpeg','-v','error','-i',p,'-f','rawvideo','-pix_fmt','gray','pipe:'],capture_output=True).stdout
im=np.frombuffer(raw,np.uint8).reshape(h,w).astype(np.float32)
im=im-im.mean()
F=np.fft.fft2(im)
ac=np.fft.fftshift(np.fft.ifft2(F*np.conj(F)).real)
ac=ac/ac[h//2,w//2]
cy,cx=h//2,w//2
yy,xx=np.ogrid[:h,:w]
ac=ac.copy()
ac[(yy-cy)**2+(xx-cx)**2<=${SKIP_R}*${SKIP_R}]=0
iy,ix=np.unravel_index(np.argmax(ac),ac.shape)
print(json.dumps({'peak':round(float(ac[iy,ix]),4),'dx':int(ix-cx),'dy':int(iy-cy)}))
`, file], { encoding: 'utf8' });
  if (py.status !== 0) throw new Error(py.stderr.slice(-300) || 'repeat measure failed');
  return JSON.parse(py.stdout.trim());
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node repeat-gate.mjs <crop> ...');
  process.exit(2);
}
let fail = 0;
for (const file of files) {
  if (!fs.existsSync(file)) { console.error('FAIL missing', file); fail++; continue; }
  const r = repeatPeak(file);
  if (r.peak > REPEAT_PEAK_MAX) {
    console.error('FAIL', path.basename(file), JSON.stringify(r), 'max', REPEAT_PEAK_MAX);
    fail++;
  } else {
    console.log('PASS', path.basename(file), JSON.stringify(r));
  }
}
if (fail) process.exit(1);
console.log('PASS repeat', files.length);
