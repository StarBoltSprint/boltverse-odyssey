"""v3.1 key-B sky preview. Sky = key-zd1-b.jpg crop x0-430, y0-270 only (aurora + moon, left of the Frostspire): the spire's
placement relative to this terrace is not fixed, so it is excluded. The sky fills ONLY alpha-0 pixels of the lit render
(object + snow ground plane, film transparent). Cover-fit, nothing invented."""
import sys, glob, os, numpy as np
from PIL import Image
KEY = '/workspace/zd-bible-1012/key-zd1-b.jpg'; BOX = (0, 0, 430, 270)
sky0 = Image.open(KEY).convert('RGB').crop(BOX)
for d in sys.argv[1:]:
    for f in sorted(glob.glob(os.path.join(d, 'trg', '*.png'))):   # trg = lit render WITH ground, film transparent: alpha 0 = sky
        fg = np.asarray(Image.open(f).convert('RGBA')); H, W = fg.shape[:2]; s = max(W / sky0.width, H / sky0.height)
        sk = sky0.resize((round(sky0.width * s), round(sky0.height * s)), Image.LANCZOS); x = (sk.width - W) // 2
        sk = np.asarray(sk.crop((x, 0, x + W, H)))
        G = fg[..., :3].astype(np.float32); A = fg[..., 3:].astype(np.float32) / 255
        out = os.path.join(d, os.path.basename(f)[:-4] + '-sky.png')
        Image.fromarray((G * A + sk * (1 - A)).round().astype(np.uint8)).save(out); print(out, round(float((A == 0).mean()), 3))
