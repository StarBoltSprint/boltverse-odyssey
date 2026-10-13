import json, os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import oneshot as o
from PIL import Image
ok = True
def chk(n, c):
    global ok; ok &= bool(c); print(("PASS " if c else "FAIL ") + n)
d = tempfile.mkdtemp(); os.makedirs(d + "/plates")
Image.new("RGB", (64, 64), (90, 60, 40)).save(d + "/plates/a.jpg"); open(d + "/spec.md", "w").write("x")
r = o.run(d, d + "/out", counter=d + "/c.json"); st = {s["id"]: s["status"] for s in r["stages"]}
chk("stops at plate approval", st["plates_approval"] == "STOP" and st["depth_moge2"] == "SKIPPED")
chk("plate sheet jpg + t_plates_sheet", os.path.exists(d + "/out/plates-sheet.jpg") and r["timer"]["t_plates_sheet"] is not None)
chk("imagine hook never passes", st["imagine_hook"] == "NOT_IMPLEMENTED")
chk("counter appended", len(json.load(open(d + "/c.json"))["runs"]) == 1)
r = o.run(d, d + "/out2", approved_plates=True); st = {s["id"]: s["status"] for s in r["stages"]}
chk("approved flag passes stop", st["plates_approval"] == "PASS")
chk("missing mesh blocks later stages", st["depth_moge2"] == "BLOCKED" and st["mesh_build"] == "SKIPPED")
chk("no stub ever PASS", all(s["status"] != "PASS" for s in r["stages"] if s.get("note","").startswith(("hook","not built"))))
json.dump({"schema": "zd-spine.v1.1", "points": [{"s": 0, "y": 0}, {"s": 5, "y": 1}]}, open(d + "/spine.json", "w"))
s = o.spine_check({"obj": d}); chk("must-fail spine (no xy, grade 20%)", s["status"] == "FAIL" and len(s["errors"]) == 3)
json.dump({"schema": "zd-spine.v1.2", "points": [{"s": 0, "y": 0, "xy": [0, 0]}, {"s": 5, "y": .5, "xy": [0, 5]}]}, open(d + "/spine.json", "w"))
chk("good spine passes", o.spine_check({"obj": d})["status"] == "PASS")
o.record_keep(d + "/out2/oneshot-run.json", None, "2099-01-01T00:00:00+01:00")
chk("t_keep recorded", json.load(open(d + "/out2/oneshot-run.json"))["timer"]["t_keep"] > 0)
# required must-fail: terrace walk must FAIL at door + wall ends. Walk not built -> this test is OPEN, not passed.
w = o.STAGES[[x[0] for x in o.STAGES].index("scripted_walk")][1]({})
chk("terrace walk must-fail: OPEN (walk is NOT_IMPLEMENTED, not counted as pass)", w["status"] == "NOT_IMPLEMENTED")
print("selftest", "PASS" if ok else "FAIL"); sys.exit(0 if ok else 1)
