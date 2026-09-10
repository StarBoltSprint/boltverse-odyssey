#!/usr/bin/env python3
"""Box check. Not Smoke. Exit 0 = player may mount. Exit 1 = do not publish."""
import json, os, sys

if len(sys.argv) < 2:
    print("usage: python3 validate-pack.py ./packs/<id>", file=sys.stderr)
    sys.exit(2)

d = sys.argv[1]
fails = 0

def pass_(m):
    print("PASS  " + m)

def fail(m):
    global fails
    print("FAIL  " + m)
    fails += 1

def exists(rel):
    return os.path.isfile(os.path.join(d, rel))

STILLS = ["stills/spawn.jpg", "stills/at-a.jpg", "stills/at-b.jpg"]
FILMS = [
    "films/breath-spawn.mp4",
    "films/breath-a.mp4",
    "films/breath-b.mp4",
    "films/walk-spawn-a.mp4",
    "films/walk-spawn-b.mp4",
]

jp = os.path.join(d, "room.json")
room = None
sj = os.path.join(d, "smoke.json")
if not os.path.isfile(sj):
    fail("smoke.json missing — run node scripts/smoke-pack.mjs, do not hang")
else:
    try:
        smoke = json.load(open(sj, encoding="utf-8"))
        if smoke.get("ok") is True and smoke.get("script") == "scripts/smoke-pack.mjs":
            pass_("smoke.json")
        else:
            fail("smoke.json not ok — script must write it")
    except Exception:
        fail("smoke.json not JSON")

if not os.path.isfile(jp):
    fail("room.json missing")
else:
    try:
        room = json.load(open(jp, encoding="utf-8"))
        pass_("room.json")
    except Exception:
        fail("room.json not JSON")

if isinstance(room, dict):
    if (room.get("format") or 1) != 1:
        fail("format")
    else:
        pass_("format 1")
    plate = str(room.get("plate") or room.get("plateSize") or "720x1280").replace(" ", "")
    pass_("plate 720x1280") if plate == "720x1280" else fail("plate " + plate)
    pass_("aspect 9:16") if (room.get("aspect") or "9:16") == "9:16" else fail("aspect")
    fail("auth true") if room.get("auth") is True else pass_("auth off")
    fail("database true") if room.get("database") is True else pass_("database off")
    chrome = room.get("chrome") or "none"
    pass_("chrome none") if chrome == "none" else fail("chrome " + str(chrome))
    open_id = room.get("open") or "breath-spawn"
    pass_("open breath-spawn") if open_id == "breath-spawn" else fail("open " + str(open_id))
    cam = room.get("camera") or "lock-off"
    pass_("camera lock-off") if cam == "lock-off" else fail("camera " + str(cam))
    if room.get("PACK") is None and room.get("pack") is None:
        fail("PACK missing")
    else:
        pass_("PACK")

    clips = room.get("clips") or {}
    for cid, c in clips.items():
        if not isinstance(c, dict):
            continue
        f = (c.get("file") or "").lstrip("./")
        if f.startswith("http") or f.startswith("file:") or (f.startswith("/") and not f.startswith("stills/") and not f.startswith("films/")):
            fail("clip file must be relative: " + f)
        if c.get("required") is True and f and not exists(f):
            fail(cid + " required missing " + f)

    edges = room.get("edges") or []
    def has(fr, tap):
        return any(isinstance(e, dict) and e.get("from") == fr and e.get("tap") == tap for e in edges)
    pass_("edge spawn+A") if has("spawn", "A") else fail("edge spawn+A missing")
    pass_("edge spawn+B") if has("spawn", "B") else fail("edge spawn+B missing")

    for cid in ("walk-A-B", "walk-B-A", "walk-a-b", "walk-b-a"):
        c = clips.get(cid)
        if isinstance(c, dict) and c.get("required") is True:
            f = (c.get("file") or "").lstrip("./")
            pass_(cid) if exists(f) else fail(cid + " required missing")

    enter = room.get("ENTER") or room.get("enter") or {}
    for cid, c in (enter.get("clips") or {}).items():
        if not isinstance(c, dict):
            continue
        fail("ENTER " + cid + " missing to") if not c.get("to") else pass_("ENTER " + cid + " to " + str(c.get("to")))
        f = (c.get("file") or "").lstrip("./")
        if c.get("required") is True:
            pass_("ENTER " + cid) if exists(f) else fail("ENTER " + cid + " missing " + f)

for f in STILLS:
    pass_(f) if exists(f) else fail(f + " missing")
for f in FILMS:
    pass_(f) if exists(f) else fail(f + " missing")

if fails:
    print("PACK FAIL  " + str(fails))
    sys.exit(1)
print("PACK PASS")
