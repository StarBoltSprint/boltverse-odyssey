"""Tiny synthetic key image (96x54): bright sky on top, a jagged rim skyline, darker ground below. No real plate."""
import math
from PIL import Image
def make(path, w=96, h=54):
    im = Image.new("RGB", (w, h))
    for x in range(w):
        sky = int(h * (0.35 + 0.12 * math.sin(x / 7) + 0.05 * math.sin(x / 2.3)))
        for y in range(h):
            im.putpixel((x, y), (200 - y, 210 - y, 235 - y) if y < sky else (70 + y // 3, 64 + y // 3, 60 + y // 3))
    im.save(path); return path
