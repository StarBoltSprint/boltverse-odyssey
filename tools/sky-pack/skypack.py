#!/usr/bin/env python3
"""tools/sky-pack: 12 sky plates -> KTX2 ASTC 4x4 sRGB, 2 levels (base + star-preserving mip 1)."""
import argparse, glob, json, os, re, subprocess, sys, tempfile
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'sky-magnification'))
import starmip as M

def latest(src, i):
    fs = glob.glob(f"{src}/zd-sky12-S{i:02d}-final*.jpg")
    return max(fs, key=lambda f: int(re.search(r'final(\d*)\.jpg', f).group(1) or 1))

def pack(src_jpg, out_ktx, tmp):
    a = np.asarray(Image.open(src_jpg).convert('RGB'), np.float32) / 255
    b0, b1 = f"{tmp}/l0.png", f"{tmp}/l1.png"
    Image.open(src_jpg).convert('RGB').save(b0)
    Image.fromarray((np.clip(M.mip1_star(a), 0, 1) * 255 + 0.5).astype(np.uint8)).save(b1)
    cmd = ['toktx', '--t2', '--encode', 'astc', '--astc_blk_d', '4x4', '--astc_quality', 'thorough',
           '--assign_oetf', 'srgb', '--mipmap', '--levels', '2', out_ktx, b0, b1]
    subprocess.run(cmd, check=True)
    info = subprocess.run(['ktxinfo', out_ktx], capture_output=True, text=True).stdout
    return cmd, info

def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='/workspace/zd-bible-1012/zd-plates/sky12')
    ap.add_argument('--out', default='/workspace/zd-bible-1012/zd-plates/sky12/ktx2-final5-mip1-star')
    a = ap.parse_args(argv); os.makedirs(a.out, exist_ok=True); rep = []
    with tempfile.TemporaryDirectory() as tmp:
        for i in range(12):
            s = latest(a.src, i); o = f"{a.out}/zd-sky12-S{i:02d}.ktx2"
            cmd, info = pack(s, o, tmp)
            g = lambda k: (re.search(rf'{k}:\s*(\S+)', info) or [None, None])[1]
            ok = ('ASTC_4x4_SRGB' in info and g('levelCount') == '2' and g('pixelWidth') == '1280' and g('pixelHeight') == '720')
            rep.append(dict(id=f"S{i:02d}", src=s, ktx2=o, bytes=os.path.getsize(o), vkFormat=g('vkFormat'),
                            levelCount=g('levelCount'), w=g('pixelWidth'), h=g('pixelHeight'), ok=ok))
            print(rep[-1]['id'], os.path.basename(s), rep[-1]['vkFormat'], rep[-1]['levelCount'], rep[-1]['bytes'], 'OK' if ok else 'BAD')
    json.dump(dict(tool='sky-pack', mip1='star-preserving (max on star 2x2 blocks, mean elsewhere)', plates=rep,
                   all_ok=all(r['ok'] for r in rep), total_bytes=sum(r['bytes'] for r in rep)),
              open(f"{a.out}/pack-report.json", 'w'), indent=1)
    return 0 if all(r['ok'] for r in rep) else 1

if __name__ == '__main__': sys.exit(main())
