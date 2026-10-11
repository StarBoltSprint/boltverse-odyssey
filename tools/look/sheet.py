"""Phone contact sheet. Neutral black and white labels only. No typed scene colour."""
import os
from PIL import Image, ImageDraw

CELL = (360, 800)


def _cell(path, label, cell=CELL):
    im = Image.open(path).convert("RGB")
    bar = 36
    frame = (cell[0], max(1, cell[1] - bar))
    im.thumbnail(frame, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", cell, (0, 0, 0))
    canvas.paste(im, ((cell[0] - im.width) // 2, bar + (frame[1] - im.height) // 2))
    draw = ImageDraw.Draw(canvas)
    draw.text((8, 8), label, fill=(255, 255, 255))
    return canvas


def compose(items, out, cell=CELL, cols=2):
    cells = [_cell(path, label, cell) for label, path in items]
    rows = (len(cells) + cols - 1) // cols
    w = cols * cell[0]
    h = rows * cell[1]
    sheet = Image.new("RGB", (w, h), (0, 0, 0))
    for i, c in enumerate(cells):
        sheet.paste(c, ((i % cols) * cell[0], (i // cols) * cell[1]))
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    sheet.save(out, quality=85)
    return out
