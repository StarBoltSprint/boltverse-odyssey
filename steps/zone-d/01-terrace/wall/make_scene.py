"""Zone D terrace scene for tools/imagine-to-3d/blender_wall.py (existing plates only). Frame = terrace_block.py / play page:
three.js y up, tier-1 facade z=0, +z toward the path, S = 0.0215 m per plate px (front x=0 col 535, ground row 870;
side z=0 col 890). Bands read from the plate pixels (snow-cap luminance edges), not from terrace_block's boxes."""
import json, os
ST = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
S = 0.0215; k = 1 / S; BACK = -744 * S
y = lambda r: (870 - r) * S
TIERS = [dict(hw=370 * S, z=0.0, stone=(871, 694), cap=(694, 600), door=[440, 690, 620, 872], srows=(864, 676)),
         dict(hw=345 * S, z=-135 * S, stone=(600, 470), cap=(470, 394), door=[430, 470, 610, 602], srows=(656, 494)),
         dict(hw=308 * S, z=-315 * S, stone=(394, 240), cap=(240, 180), door=[420, 245, 600, 396], srows=(475, 320))]
plates = dict(front=dict(img=f"{ST}/plates/v35/plate-front-v35.jpg", depth=f"{ST}/work/plate-front-depth.npy", mat="front"),
              side=dict(img=f"{ST}/plates/v35/plate-side-v35.jpg", depth=f"{ST}/work/plate-side-depth.npy", mat="side"),
              top=dict(img=f"{ST}/plates/top.jpg", mat="top"))
faces, flats = [], []
for i, T in enumerate(TIERS):
    sv = (y(T["stone"][0]) if i == 0 else y(TIERS[i - 1]["cap"][1]), y(T["stone"][1])); cv = (sv[1], y(T["cap"][1]))
    if i == 0: sv = (0.0, sv[1])
    stone = dict(kind="stone", v=list(sv), rows=[T["stone"][0] - (1 if i == 0 else 0), T["stone"][1]])
    cap = dict(kind="cornice", v=list(cv), rows=list(T["cap"]))
    w = [3.0, 1.2, 0.8][i]
    faces.append(dict(name=f"t{i+1}-front", plate="front", k=k, c0=535, cs=1, u=[-T["hw"], T["hw"]], weight=w,
                      frame=dict(o=[0, 0, T["z"]], right=[1, 0, 0], up=[0, 1, 0]), bands=[stone, cap], doors=[dict(search=T["door"], band=0, depth=1.5)]))
    srows = T["srows"]
    for side in ("left", "right"):
        capmap = dict(plate="front", c0=900, cs=1 if side == "left" else -1)
        sb = dict(kind="stone", v=list(sv), rows=list(srows)); cb = dict(kind="cornice", v=list(cv), rows=list(T["cap"]), map=capmap)
        if side == "left":
            fr = dict(o=[-T["hw"], 0, 0], right=[0, 0, 1], up=[0, 1, 0]); u = [BACK, T["z"]]; cs = 1; ext = [0, 1]
        else:
            fr = dict(o=[T["hw"], 0, 0], right=[0, 0, -1], up=[0, 1, 0]); u = [-T["z"], -BACK]; cs = -1; ext = [1, 0]
        faces.append(dict(name=f"t{i+1}-{side}", plate="side", cornice_from=f"t{i+1}-front", k=k, c0=890, cs=cs, u=u, weight=w * (0.6 if side == "left" else 0.35),
                          frame=fr, bands=[sb, cb], cornice_ext=ext, doors=[]))
    # back (never on the path): flat, front plate reused (declared)
    hw = T["hw"]; y0 = sv[0]; y1 = cv[1]
    flats.append(dict(plate="front", o=[hw, y0, BACK], U=[-2 * hw, 0, 0], V=[0, y1 - y0, 0], n=[6, 3], c0=535 + hw / S, cu=[k, 0, 0], r0=870 - y0 / S, cr=[0, -k, 0], cat="reserve"))
R0 = {2: 16, 1: 490, 0: 709}
ledges = [dict(front=f"t{i+1}-front", hw=T["hw"], z=T["z"], back=BACK, y=y(T["cap"][1]), plate="top", r0=R0[i], spm=48,
               next=(dict(hw=TIERS[i + 1]["hw"], z=TIERS[i + 1]["z"]) if i < 2 else None)) for i, T in enumerate(TIERS)]
json.dump(dict(name="terrace", plates=plates, faces=faces, flats=flats, ledges=ledges, opts=dict(scale=1.15),
               budgets=[dict(stone=30000, cornice=20000, ledge_cell=0.35), dict(stone=13000, cornice=9000, ledge_cell=0.6), dict(stone=3200, cornice=2400, ledge_cell=1.3)]),
          open(os.path.join(os.path.dirname(__file__), "terrace.wall.json"), "w"), indent=1)
# v4 proof piece (self-test good case built BY THE TOOL)
v4 = dict(name="v4piece", plates=dict(front=plates["front"]), opts=dict(scale=1.15),
          faces=[dict(name="t1-door-6m", plate="front", k=k, c0=535, cs=1, u=[(320 - 535) * S, (600 - 535) * S], weight=1, cornice_ext=[0, 0],
                      frame=dict(o=[0, 0, 0], right=[1, 0, 0], up=[0, 1, 0]), icicles=True,
                      bands=[dict(kind="stone", v=[0, y(694)], rows=[870, 694]), dict(kind="cornice", v=[y(694), y(600)], rows=[694, 600])],
                      doors=[dict(search=[440, 690, 620, 872], band=0, depth=1.5)])],
          flats=[], budgets=[dict(stone=11000, cornice=3000)])
json.dump(v4, open(os.path.join(os.path.dirname(__file__), "v4piece.wall.json"), "w"), indent=1)
print(len(faces), "faces", len(flats), "flats")
