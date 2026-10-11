"""Phone contact sheet. Neutral black and white labels only. No typed scene colour."""
import os
from PIL import Image, ImageDraw

CELL = (360, 800)


def _cell(path, label):
    im = Image.open(path).convert("RGB")
    im.thumbnail(CELL, Image.Resampling.LANCZOS)
    bar = 28
    canvas = Image.new("RGB", (CELL[0], im.height + bar), (0, 0, 0))
    canvas.paste(im, ((CELL[0] - im.width) // 2, bar))
    draw = ImageDraw.Draw(canvas)
    draw.text((8, 6), label, fill=(255, 255, 255))
    return canvas


def compose(items, out):
    cells = [_cell(path, label) for label, path in items]
    cols = 2
    rows = (len(cells) + cols - 1) // cols
    w = cols * CELL[0]
    h = sum(max(c.height for c in cells[r * cols:(r + 1) * cols]) for r in range(rows))
    sheet = Image.new("RGB", (w, h), (0, 0, 0))
    y = 0
    for r in range(rows):
        row = cells[r * cols:(r + 1) * cols]
        rh = max(c.height for c in row)
        for i, c in enumerate(row):
            sheet.paste(c, (i * CELL[0], y))
        y += rh
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    sheet.save(out, quality=85)
    return out
