"""Stage 'keyvideo' (optional, ideas only): an Imagine video started FROM the key image, sampled into frames that
enrich the feature checklist and the ambiance / motion notes (extra objects, ground and air details, sand motion).
NEVER used for geometry: video frames morph (q15 'a video orbit morphs. Reject it'). The frame folder carries a
marker file and coarse.py / views.py refuse any input inside a marked folder (C.assert_not_video_frame).

Our access: Grok Build `reference_to_video` (first_frame = key, 720p, 1-15 s) -> one request in an Imagine batch.
No video yet -> clean stub: the request batch + ideas.yaml with status 'pending-video' (the pipeline runs without it).

  python3 keyvideo.py request --key key.jpg --out DIR [--seconds 10]
  python3 keyvideo.py analyze --key key.jpg --video clip.mp4 --out DIR [--every 0.5]
Outputs: DIR/frames/*.png (+ marker), DIR/ideas.yaml (motion notes + candidate checklist items, use: checklist-only),
         DIR/ideas-sheet.jpg (key + candidate crops).
"""
import argparse, glob, json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import i23d_common as C
from imagine import Request, write_batch

MARKER = ".video-frames-not-for-geometry"
PROMPT = ("<IMAGE_1> comes alive: very slow forward camera drift along the avenue, the same city, same towers, same mesas, "
          "same wrecks, same light. Wind gusts lift fine sand from the dune crests and from the feet of the towers, sand veils "
          "rise several metres and fall back, small debris shivers. Keep every structure identical, no new buildings, no text.")


def request(key, out, seconds=10):
    os.makedirs(out, exist_ok=True)
    r = Request(id="keyvideo", kind="video", prompt=PROMPT, refs=[key], aspect="16:9" if Image.open(key).width > Image.open(key).height else "9:16",
                out=os.path.join(out, "keyvideo.mp4"), purpose="keyvideo (ideas only, never geometry)", duration=seconds)
    b = write_batch([r], os.path.join(out, "batch-keyvideo.json"), note="key video: checklist + ambiance ideas only")
    C.dump(dict(status="pending-video", key=os.path.abspath(key), batch=b, use="checklist-and-ambiance-only", geometry="forbidden",
                note="run `python3 imagine.py run <batch> --worktree <wt> --wait`, then `keyvideo.py analyze`"), os.path.join(out, "ideas.yaml"))
    return b


def frames(video, out, every):
    fd = os.path.join(out, "frames"); os.makedirs(fd, exist_ok=True)
    open(os.path.join(fd, MARKER), "w").write("frames of an Imagine video: ideas/checklist only, never geometry (morphs)\n")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", video, "-vf", f"fps={1 / every}", os.path.join(fd, "f%04d.png")], check=True)
    return sorted(glob.glob(os.path.join(fd, "f*.png")))


def motion_notes(F, every):
    """Sand motion from frame differences in the lower half (ground/air band): gust period, lift, direction."""
    lum = [C.luma(C.load_rgb(p)) for p in F]
    H = lum[0].shape[0]; band = slice(H // 3, H)
    act = np.array([np.abs(b[band] - a[band]).mean() for a, b in zip(lum, lum[1:])])
    notes = dict(frames=len(F), everyS=every, activityMean=round(float(act.mean()), 4) if len(act) else 0)
    if len(act) >= 6:
        a = act - act.mean(); sp = np.abs(np.fft.rfft(a)); fr = np.fft.rfftfreq(len(a), every)
        k = 1 + int(np.argmax(sp[1:])) if len(sp) > 1 else 0
        notes["gustPeriodS"] = round(float(1 / fr[k]), 2) if k and fr[k] > 0 else None
        notes["gustContrast"] = round(float(act.max() / max(1e-6, np.median(act))), 2)
    # dominant motion per tile via phase correlation (consecutive frames), vertical lift share
    vx, vy = [], []
    for a, b in zip(lum, lum[1:]):
        fx, fy, cx, cy = [], [], [], []
        A, B = a[band], b[band]; h, w = A.shape; th, tw = h // 3, w // 6
        for j in range(3):
            for i in range(6):
                pa, pb = A[j * th:(j + 1) * th, i * tw:(i + 1) * tw], B[j * th:(j + 1) * th, i * tw:(i + 1) * tw]
                R = np.fft.fft2(pa) * np.conj(np.fft.fft2(pb)); R /= np.abs(R) + 1e-9; r = np.abs(np.fft.ifft2(R))
                dy, dx = np.unravel_index(r.argmax(), r.shape); dy = dy - th if dy > th // 2 else dy; dx = dx - tw if dx > tw // 2 else dx
                if r.max() > 0.08: fx.append(-dx); fy.append(-dy); cx.append((i + 0.5) / 6 - 0.5); cy.append((j + 0.5) / 3 - 0.5)
        if len(fx) >= 4:   # remove the camera drift (pan + zoom: v = t + s * p, least squares); the rest is scene motion
            X = np.array(cx); Y = np.array(cy); M = np.stack([np.ones_like(X), X], 1); My = np.stack([np.ones_like(Y), Y], 1)
            px = np.linalg.lstsq(M, np.array(fx, float), rcond=None)[0]; py = np.linalg.lstsq(My, np.array(fy, float), rcond=None)[0]
            vx += list(np.array(fx) - M @ px); vy += list(np.array(fy) - My @ py)
    if vx:
        vx, vy = np.array(vx, float), np.array(vy, float); mv = np.hypot(vx, vy) > 0.5
        notes["residualTiles"] = int(mv.sum())
        notes["flowDirDeg"] = round(float(np.degrees(np.arctan2(-vy[mv].mean(), vx[mv].mean()))), 1) if mv.any() else None   # 0 = right, 90 = up
        notes["upwardShare"] = round(float((vy[mv] < 0).mean()), 3) if mv.any() else None
    return notes


def candidates(key, F, max_items=12, gy=6, gx=10, thr=2.0):
    """Tiles that differ from the key far more than the frame's median tile (the drift is roughly uniform, an event is
    not): transient = sand/air events (veils, plumes, gusts), persistent = a detail the video adds. Status
    'candidate': Grok vision / owner confirms and names the feature before it enters a checklist."""
    K = C.load_rgb(key); kh, kw = K.shape[:2]; Lk = C.luma(K)
    hits = np.zeros((len(F), gy, gx), bool); score = np.zeros((gy, gx))
    for t, p in enumerate(F):
        f = np.asarray(Image.open(p).convert("RGB").resize((kw, kh), Image.LANCZOS)).astype(np.float32) / 255   # analysis copy
        d = np.abs(C.luma(f) - Lk)
        tiles = np.array([[d[j * kh // gy:(j + 1) * kh // gy, i * kw // gx:(i + 1) * kw // gx].mean() for i in range(gx)] for j in range(gy)])
        r = tiles / (np.median(tiles) + 1e-4); hits[t] = r > thr; score = np.maximum(score, r)
    frac = hits.mean(0); out = []
    for j, i in sorted(zip(*np.nonzero(frac > 0)), key=lambda x: -score[x]):
        kind = "transient (sand / air event)" if frac[j, i] < 0.5 else "persistent (detail the video adds)"
        t_best = int(np.argmax(hits[:, j, i]))
        out.append(dict(id=f"vid-r{j}c{i}", kind=kind, framesFraction=round(float(frac[j, i]), 2), peakRatio=round(float(score[j, i]), 2),
                        firstFrame=os.path.basename(F[t_best]), tile=[int(i), int(j)],
                        region=[int(i * kw / gx), int(j * kh / gy), int((i + 1) * kw / gx), int((j + 1) * kh / gy)],
                        feature="describe after vision check", status="candidate", use="checklist-only"))
    return out[:max_items]


def analyze(key, video, out, every=0.5):
    F = frames(video, out, every)
    notes = motion_notes(F, every); cands = candidates(key, F)
    ideas = dict(status="analysed", key=os.path.abspath(key), video=os.path.abspath(video), use="checklist-and-ambiance-only",
                 geometry="forbidden", motion=notes, checklistCandidates=cands,
                 ambiance=[f"sand gust period ~{notes.get('gustPeriodS')} s (contrast x{notes.get('gustContrast')})",
                           f"dominant flow {notes.get('flowDirDeg')} deg (0 = screen right, 90 = up), upward share {notes.get('upwardShare')}"])
    C.dump(ideas, os.path.join(out, "ideas.yaml"))
    K = Image.open(key).convert("RGB"); d = ImageDraw.Draw(K)
    for c in cands: d.rectangle(c["region"], outline=(255, 220, 0), width=3); d.text((c["region"][0] + 4, c["region"][1] + 4), c["id"][-6:], fill=(255, 255, 0))
    K.save(os.path.join(out, "ideas-sheet.jpg"), quality=90)
    return ideas


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("cmd", choices=["request", "analyze"]); ap.add_argument("--key", required=True)
    ap.add_argument("--out", required=True); ap.add_argument("--video"); ap.add_argument("--every", type=float, default=0.5); ap.add_argument("--seconds", type=int, default=10)
    a = ap.parse_args()
    if a.cmd == "request": print(request(a.key, a.out, a.seconds))
    else: print(json.dumps({k: v for k, v in analyze(a.key, a.video, a.out, a.every).items() if k != "checklistCandidates"}))
