#!/usr/bin/env python3
"""manifest.py - slot cache: which Imagine images already exist for this bible, which must be generated.

  python3 tools/biome/manifest.py --biome ember-mesa [--catalogue tools/biome/catalogue] [--ingest DIR] [--strict]

Reads tools/biome/out/<id>/prompts.json (run prompts.py first). For each slot the cache key is
sha256(bibleVersion + styleBlock + slotPrompt) (Grok answer 8): same bible + same style + same prompt = same image.

  catalogue/<key>.<png|jpg|webp>         one image per cache key (untracked, shared by every biome)
  catalogue/index.json                   key -> {slot, biome, file, ingested}
  catalogue/fallback/<archetype>/<slot>  ready phone pack used after 2 QC fails (Grok answer 8)

--ingest DIR copies DIR/<slot>.<ext> (what the manual / external Imagine step saved) into the catalogue under its key.
Writes out/<id>/manifest.json (hit | miss | fallback per slot, totals) and links every available image to
out/<id>/slots/<slot>.<ext> so qc / stitch / bake read by slot name. --strict exits 2 while any slot misses.
"""
import argparse, glob, json, os, shutil, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import biome_lib as bl  # noqa: E402

EXTS = (".png", ".jpg", ".jpeg", ".webp")


def find(base_no_ext):
    for e in EXTS:
        if os.path.exists(base_no_ext + e):
            return base_no_ext + e
    return None


def link(src, dst):
    if os.path.lexists(dst):
        os.remove(dst)
    try:
        os.link(src, dst)
    except OSError:
        shutil.copy2(src, dst)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--biome", required=True)
    ap.add_argument("--prompts")
    ap.add_argument("--catalogue", default=os.path.join(bl.HERE, "catalogue"))
    ap.add_argument("--ingest", help="folder of freshly generated images named <slot>.<ext>")
    ap.add_argument("--strict", action="store_true")
    A = ap.parse_args()
    b, _ = bl.load_biome(A.biome)
    out_dir = os.path.join(bl.HERE, "out", b["id"])
    P = bl.read_json(A.prompts or os.path.join(out_dir, "prompts.json"))
    cat = A.catalogue
    os.makedirs(cat, exist_ok=True)
    idx_path = os.path.join(cat, "index.json")
    idx = bl.read_json(idx_path) if os.path.exists(idx_path) else {}
    attempts_path = os.path.join(out_dir, "attempts.json")
    attempts = bl.read_json(attempts_path) if os.path.exists(attempts_path) else {}
    ingested = 0
    if A.ingest:
        for s in P["slots"]:
            src = find(os.path.join(A.ingest, s["slot"]))
            if not src:
                continue
            ext = os.path.splitext(src)[1].lower()
            dst = os.path.join(cat, s["cacheKey"] + ext)
            shutil.copy2(src, dst)
            idx[s["cacheKey"]] = {"slot": s["slot"], "biome": b["id"], "file": os.path.basename(dst),
                                  "ingested": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "from": os.path.abspath(src)}
            ingested += 1
        bl.write_json(idx_path, idx)
    slots_dir = os.path.join(out_dir, "slots")
    os.makedirs(slots_dir, exist_ok=True)
    rows, hit, miss, fb = [], 0, 0, 0
    max_fails = b.get("qc", {}).get("maxFails", 2)
    arche = b.get("catalogueFallback") or b.get("archetype") or "default"
    for s in P["slots"]:
        f = find(os.path.join(cat, s["cacheKey"]))
        fails = int(attempts.get(s["slot"], {}).get("fails", 0))
        status, src = ("hit", f) if f else ("miss", None)
        if fails >= max_fails:
            fbf = find(os.path.join(cat, "fallback", arche, s["slot"])) or find(os.path.join(cat, "fallback", arche, s["template"]))
            status, src = ("fallback", fbf) if fbf else ("fallback-missing", None)
        if src:
            link(src, os.path.join(slots_dir, s["slot"] + os.path.splitext(src)[1].lower()))
        hit += status == "hit"; miss += status in ("miss", "fallback-missing"); fb += status == "fallback"
        rows.append({"slot": s["slot"], "key": s["cacheKey"], "status": status, "file": src, "qc": s["qc"], "fails": fails})
    man = {"biome": b["id"], "bibleVersion": b["bibleVersion"], "catalogue": os.path.abspath(cat), "ingested": ingested,
           "hits": hit, "misses": miss, "fallbacks": fb, "total": len(rows), "slots": rows,
           "imagineCallsNeeded": miss, "note": "misses = the Imagine step (manual / external). This tool never calls Imagine."}
    bl.write_json(os.path.join(out_dir, "manifest.json"), man)
    print(f"[manifest] {b['id']}: {hit} hit, {miss} miss, {fb} fallback / {len(rows)} (ingested {ingested}) -> {out_dir}/manifest.json")
    if miss:
        print("[manifest] Imagine step needed for: " + ", ".join(r["slot"] for r in rows if r["status"] in ("miss", "fallback-missing")))
    return 2 if (A.strict and miss) else 0


if __name__ == "__main__":
    sys.exit(main())
