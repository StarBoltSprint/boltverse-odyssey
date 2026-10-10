"""Per-object performance budget at the FULL device pixel ratio (SmiR 2026-10-10: native 1080p on the S20 FE,
1080 x 2400 = 412 x 915 css @ 2.625). Quality is never traded: this stage does not shrink a texture or a mesh, it only
says whether the object fits next to everything else; a FAIL is fixed by the cheaper *path* (merged/instanced draws,
R8 brightness atlas + low-res chroma, gzip/int16 geometry, LOD0 on demand, fewer dynamic fetches), never by fewer pixels.

Inputs (all optional, every one given is scored):
  --geo DIR         packed strata dir (pack_strata.py: <id>-geo.json, -lod<n>.bin(.gz)) -> start download, resident LOD0,
                    triangles
  --tex F [F ...]   textures the object binds (png/jpg/webp/ktx2 by header size) -> decoded GPU MiB (mips x4/3; R8 for
                    single-channel files, RGBA8 otherwise)
  --frag F [F ...]  fragment shaders dumped from the page (GLSL ES 3.00) -> static SPIR-V instructions / fetch sites /
                    loops via detail/shcount.sh (glslang + spirv-opt)
  --probe JSON      window.__objectsGate / __perf dump (checks/perf-probe.mjs) -> draw calls of this object
  --type T          imagine-to-3d type profile (perf: block), default rock
Output JSON {rows:[{check, value, limit, status}], verdict}. Exit 1 on any FAIL.
python3 checks/perf_budget.py --type rock --geo strata5 --tex luma0.png chroma.png --frag mesa.frag --out perf.json"""
import argparse, glob, json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import i23d_common as C
HERE = os.path.dirname(os.path.abspath(__file__))
DEVICE = dict(name="Galaxy S20 FE", cssW=412, cssH=915, dpr=2.625, pxW=1081, pxH=2401)
DEFAULT = dict(   # initial budgets (2026-10-10, from the PERF pass in PROGRESS-ground-detail.md: ground 3618 instr/32 fetch
                  # sites and mesas 915/15 were each ~50 % of the frame at walk view). Calibrate on the phone.
    fragInstrMax=900, fragFetchSitesMax=16, fragLoopsMax=2,
    texGpuMiBMax=64, startDownloadMBMax=8, lod0ResidentMBMax=12, residentTrisMax=750000, drawCallsMax=2)
# residentTrisMax is a reference (live v57 mesas: 194k LOD1 + <= 2 LOD0 ran 59 fps at pr 1.5), reported as INFO only.


def tex_bytes(path):
    from PIL import Image
    im = Image.open(path); w, h = im.size
    bpp = 1 if im.mode in ("L", "P", "1") else 4
    return w * h * bpp * 4 / 3, dict(file=os.path.basename(path), size=[w, h], mode=im.mode, gpuMiB=round(w * h * bpp * 4 / 3 / 2**20, 2))


def shader_cost(frag):
    r = subprocess.run(["bash", os.path.join(HERE, "..", "detail", "shcount.sh"), frag], capture_output=True, text=True)
    m = re.search(r"instr=(\d+) fetch_sites=(\d+) loops=(\d+)", r.stdout)
    return dict(file=os.path.basename(frag), instr=int(m[1]), fetchSites=int(m[2]), loops=int(m[3])) if m else dict(file=frag, error=r.stdout.strip() or r.stderr.strip())


def geo_cost(d):
    out = dict(start=0, startGz=0, lod0=0, lod0Gz=0, tris1=0, tris0max=0, objects=0)
    for g in sorted(glob.glob(os.path.join(d, "*-geo.json"))):
        G = json.load(open(g)); L = G.get("lods", [])
        if not L or "bytes" not in L[0]: continue
        out["objects"] += 1
        out["start"] += L[1]["bytes"] if len(L) > 1 else L[0]["bytes"]; out["startGz"] += (L[1] if len(L) > 1 else L[0]).get("gzBytes", 0)
        out["lod0"] = max(out["lod0"], L[0]["bytes"]); out["lod0Gz"] = max(out["lod0Gz"], L[0].get("gzBytes", 0))
        out["tris1"] += (L[1] if len(L) > 1 else L[0])["indexCount"] // 3; out["tris0max"] = max(out["tris0max"], L[0]["indexCount"] // 3)
    return out


def run(typ="rock", geo=None, tex=(), frag=(), probe=None, out=None, resident_lod0=2):
    prof = C.load_profile(typ); B = dict(DEFAULT); B.update(prof.get("perf", {}) or {})
    rows = []
    def row(check, value, limit, ok, info=None):
        rows.append(dict(check=check, value=value, limit=limit, status="INFO" if ok is None else ("PASS" if ok else "FAIL"), info=info))
    if geo:
        g = geo_cost(geo); ship = g["startGz"] or g["start"]
        row("geometry download at start (LOD1, shipped)", round(ship / 1e6, 2), B["startDownloadMBMax"], ship / 1e6 <= B["startDownloadMBMax"], g)
        row("LOD0 per object (fetched on demand)", round((g["lod0Gz"] or g["lod0"]) / 1e6, 2), B["lod0ResidentMBMax"], (g["lod0Gz"] or g["lod0"]) / 1e6 <= B["lod0ResidentMBMax"])
        tris = g["tris1"] + resident_lod0 * g["tris0max"]
        row(f"resident triangles (all LOD1 + {resident_lod0} LOD0)", tris, B["residentTrisMax"], None,
            "info only: geometry is never reduced for the phone (SmiR rule); over the reference -> merge/instance draws, LOD0 on demand")
    if tex:
        tot, info = 0, []
        for t in tex:
            b, i = tex_bytes(t); tot += b; info.append(i)
        row("texture GPU memory (decoded, mips)", round(tot / 2**20, 1), B["texGpuMiBMax"], tot / 2**20 <= B["texGpuMiBMax"], info)
    for f in frag:
        s = shader_cost(f)
        if "error" in s: row(f"shader compiles ({s['file']})", s["error"][:120], "compiles", False); continue
        row(f"fragment instructions ({s['file']}, static SPIR-V)", s["instr"], B["fragInstrMax"], s["instr"] <= B["fragInstrMax"])
        row(f"fragment fetch sites ({s['file']})", s["fetchSites"], B["fragFetchSitesMax"], s["fetchSites"] <= B["fragFetchSitesMax"])
        row(f"fragment loops ({s['file']})", s["loops"], B["fragLoopsMax"], s["loops"] <= B["fragLoopsMax"])
    if probe:
        P = json.load(open(probe)); dc = P.get("drawCalls")
        if dc is None: dc = (P.get("perf") or {}).get("drawCalls")
        if dc is not None: row("draw calls for this object type (merged / instanced)", dc, B["drawCallsMax"], dc <= B["drawCallsMax"])
    res = dict(type=typ, device=DEVICE, pixelRatio=DEVICE["dpr"], budgets=B, rows=rows,
               verdict="PASS" if rows and all(r["status"] != "FAIL" for r in rows) else ("FAIL" if rows else "NO-INPUT"))
    if out: C.dump(res, out)
    return res


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--type", default="rock"); ap.add_argument("--geo"); ap.add_argument("--tex", nargs="*", default=[])
    ap.add_argument("--frag", nargs="*", default=[]); ap.add_argument("--probe"); ap.add_argument("--out"); ap.add_argument("--resident-lod0", type=int, default=2)
    a = ap.parse_args()
    r = run(a.type, a.geo, a.tex, a.frag, a.probe, a.out, a.resident_lod0)
    for x in r["rows"]: print(x["status"], x["check"], x["value"], "limit", x["limit"])
    print(r["verdict"]); sys.exit(1 if r["verdict"] == "FAIL" else 0)
