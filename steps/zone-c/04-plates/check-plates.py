#!/usr/bin/env python3
"""Plate-check kit-gate for Zone C #5–#15. Exit 0 PASS, 1 FAIL."""
from __future__ import annotations
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PATTERNS = [
    "plate-05-*.jpg", "plate-06-*.jpg", "plate-07-*.jpg", "plate-08-*.jpg",
    "plate-09-*.jpg", "plate-10-*.jpg", "plate-11-*.jpg", "plate-12-*.jpg",
    "plate-13-*.jpg", "plate-14-*.jpg", "plate-15-*.jpg",
]
MIN_SIDE = 1024
MIN_BYTES = 20_000

def main() -> int:
    fails = []
    plates = []
    for pat in PATTERNS:
        hits = sorted(ROOT.glob(pat))
        if not hits:
            fails.append(f"missing {pat}")
            continue
        if len(hits) > 1:
            fails.append(f"ambiguous {pat}: {[h.name for h in hits]}")
        p = hits[0]
        plates.append(p)
        sz = p.stat().st_size
        if sz < MIN_BYTES:
            fails.append(f"{p.name}: too small ({sz} B)")
        try:
            from PIL import Image
            im = Image.open(p)
            im.load()
            w, h = im.size
            if min(w, h) < MIN_SIDE:
                fails.append(f"{p.name}: min side {min(w,h)} < {MIN_SIDE}")
            # non-blank variance
            small = im.convert("L").resize((64, 64))
            import statistics
            vals = list(small.getdata())
            if statistics.pstdev(vals) < 2.0:
                fails.append(f"{p.name}: near-blank (low variance)")
            # crude watermark / text band: very high-contrast thin horizontal strip near edges
            # (skip OCR unless tesseract present)
        except Exception as e:
            fails.append(f"{p.name}: unreadable ({e})")

    # optional OCR watermark scan
    try:
        import shutil, subprocess, tempfile
        if shutil.which("tesseract") and plates:
            for p in plates:
                with tempfile.NamedTemporaryFile(suffix=".txt") as t:
                    r = subprocess.run(
                        ["tesseract", str(p), t.name[:-4], "-l", "eng", "--psm", "6"],
                        capture_output=True, timeout=30,
                    )
                    txt = Path(t.name).read_text(errors="ignore") if Path(t.name).exists() else ""
                    # tesseract writes .txt next to basename
                    out = Path(str(t.name)[:-4] + ".txt")
                    txt = out.read_text(errors="ignore") if out.exists() else txt
                    low = txt.lower()
                    for bad in ("watermark", "getty", "shutterstock", "©", "http://", "https://", "grok.ai", "x.ai logo"):
                        if bad in low:
                            fails.append(f"{p.name}: OCR hit {bad!r}")
                            break
                    # long ASCII word runs that look like UI chrome
                    words = re.findall(r"[A-Za-z]{5,}", txt)
                    if len(words) >= 8:
                        fails.append(f"{p.name}: OCR many words (possible text overlay): {words[:6]}")
    except Exception:
        pass

    sheet = ROOT / "sheet-plates.jpg"
    if not sheet.exists():
        fails.append("missing sheet-plates.jpg")
    else:
        try:
            from PIL import Image
            im = Image.open(sheet)
            w, h = im.size
            if w < 800 or h < 400:
                fails.append(f"sheet-plates.jpg too small {w}x{h}")
        except Exception as e:
            fails.append(f"sheet unreadable: {e}")

    out = {"pass": not fails, "plates": [p.name for p in plates], "fails": fails}
    (ROOT / "kit-gate-result.json").write_text(json.dumps(out, indent=2) + "\n")
    (ROOT / "kit-gate-result.txt").write_text(
        ("PASS\n" if not fails else "FAIL\n") + "\n".join(fails) + ("\n" if fails else "")
    )
    print("PASS" if not fails else "FAIL")
    for f in fails:
        print(" -", f)
    return 0 if not fails else 1

if __name__ == "__main__":
    sys.exit(main())
