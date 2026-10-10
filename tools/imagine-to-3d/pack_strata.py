"""Pack strata outputs for the phone: per LOD an indexed vertex buffer (identical vertices merged; fallen-block
vertices kept in order after the cliff so the runtime can re-seat each 36-vertex block) and a Uint32 index.
LOD2 (identical to LOD1 since the same-shell redesign) is dropped. Output <dst>/<id>-lod<n>.bin = [verts f32 * 12][idx u32]
and <id>-geo.json with lods[n] = {verts, indexCount, blockVertStart, bytes}.
python3 pack_strata.py <srcDir> <dstDir> id [id ...]"""
import sys, os, json, numpy as np
QS = [100, 100, 100, 1, 16, 16, 20000, 20000, 20000, 10000, 10000, 10000]   # int16 = round(value * QS)
src, dst = sys.argv[1:3]; ids = sys.argv[3:]; os.makedirs(dst, exist_ok=True); tot = 0
import shutil
if os.path.exists(os.path.join(src, "gen-summary.json")): shutil.copy(os.path.join(src, "gen-summary.json"), dst)   # gate reads IoU / accepted-clash entries from here
for pid in ids:
    g = json.load(open(f"{src}/{pid}-geo.json")); st = g["stride"]; a = np.fromfile(f"{src}/{pid}.bin", np.float32).reshape(-1, st)
    QSs = QS + [1, 16, 16, 10000] if st == 16 else QS     # v10: plate2, px2, py2, blend weight
    out = dict(g); out["lods"] = []; out["packed"] = "q16"; out["qscale"] = QSs
    for li, L in enumerate(g["lods"][:2]):
        v = a[L["offset"]:L["offset"] + L["verts"]]; bs = L["blockStart"]
        cliff, blk = v[:bs], v[bs:]
        u, inv = np.unique(cliff, axis=0, return_inverse=True); inv = inv.ravel()
        V = np.concatenate([u, blk]).astype(np.float32)
        I = np.concatenate([inv, len(u) + np.arange(len(blk))]).astype(np.uint32)
        # int16 quantisation (half the bytes): pos 1 cm, plate id exact, px 1/16 px, tone 1/20000, relief 0.1 mm
        Q = np.array(QSs, np.float64)
        q = np.round(V.astype(np.float64) * Q)
        assert np.abs(q).max() < 32767, ("q16 overflow", np.abs(q).max(0))
        Iw = I.astype(np.uint16) if len(V) < 65536 else I
        fn = f"{dst}/{pid}-lod{li}.bin"; raw = q.astype(np.int16).tobytes() + Iw.tobytes(); open(fn, "wb").write(raw)
        import gzip; open(fn + ".gz", "wb").write(gzip.compress(raw, 9, mtime=0)); out["gz"] = True   # v10: shipped gzip (runtime DecompressionStream)
        e = dict(L); e.update(verts=int(len(V)), indexCount=int(len(I)), index16=bool(len(V) < 65536), blockVertStart=int(len(u)), bytes=os.path.getsize(fn)); e.pop("offset", None); e["gzBytes"] = os.path.getsize(fn + ".gz")
        out["lods"].append(e); tot += e["bytes"]
    json.dump(out, open(f"{dst}/{pid}-geo.json", "w"))
    print(pid, [(e["verts"], e["indexCount"] // 3, round(e["bytes"] / 1e6, 1)) for e in out["lods"]])
print("total MB", round(tot / 1e6, 1), "gz MB", round(sum(os.path.getsize(os.path.join(dst, f)) for f in os.listdir(dst) if f.endswith(".gz")) / 1e6, 1))
