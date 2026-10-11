# A/B identity sheet for ab-order.mjs captures: per pose mean |diff| (/255), max, % pixels changed, + crops (new | g13 | diff x16).
import json, sys, numpy as np
from PIL import Image, ImageDraw
d = sys.argv[1]; meta = json.load(open(f"{d}/meta.json"))
def load(n, k, W, H): return np.flipud(np.frombuffer(open(f"{d}/{n}-{k}.raw", "rb").read(), np.uint8).reshape(H, W, 4)[:, :, :3])
rows, tiles = [], []
for n, m in meta.items():
    W, H = m["W"], m["H"]; a, b, c = load(n, "nw", W, H), load(n, "old", W, H), load(n, "nw2", W, H)
    df = np.abs(a.astype(int) - b.astype(int)); self_ = np.abs(a.astype(int) - c.astype(int))
    r = dict(pose=n, mean=float(df.mean()), max=int(df.max()), changed=float((df.max(2) > 0).mean() * 100), selfmean=float(self_.mean()), selfmax=int(self_.max()))
    rows.append(r); print(json.dumps(r))
    # crop: lower-middle (the ground point at the target distance sits near the centre row)
    cy, cx, s = H // 2, W // 2, min(W, H) // 3
    crop = lambda im: Image.fromarray(np.ascontiguousarray(im[cy - s // 2: cy + s // 2, cx - s // 2: cx + s // 2]))
    dd = np.clip(df * 16, 0, 255).astype(np.uint8)
    t = Image.new("RGB", (3 * s + 20, s + 28), "white"); dr = ImageDraw.Draw(t)
    for i, im in enumerate([a, b, dd]): t.paste(crop(im), (i * (s + 10), 28))
    dr.text((4, 4), f"{n}: new | g13 | diff x16   mean {r['mean']:.4f}/255  max {r['max']}  changed {r['changed']:.3f}%", fill="black")
    tiles.append(t)
    Image.fromarray(np.ascontiguousarray(a)).save(f"{d}/{n}-new.png"); Image.fromarray(np.ascontiguousarray(b)).save(f"{d}/{n}-g13.png")
Wt = max(t.width for t in tiles); sheet = Image.new("RGB", (Wt, sum(t.height + 6 for t in tiles)), "white"); y = 0
for t in tiles: sheet.paste(t, (0, y)); y += t.height + 6
sheet.save(f"{d}/ab-sheet.png"); json.dump(rows, open(f"{d}/ab.json", "w"), indent=1); print("sheet", sheet.size)
