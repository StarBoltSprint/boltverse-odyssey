# Placement from the key — 11 Oct

Verdict: FAIL

Blocking target: weighted silhouette IoU ≥ 0.75, every lifted object at the right depth order. Two rounds, then stop.

## Times (seconds)

| Stage | Seconds |
| --- | --- |
| staging page | 0.0 |
| before render | 0.0 |
| before phone | 11.4 |
| sam2 masks | 0.0 |
| depth lift | 0.1 |
| sky apply | 0.0 |
| round 1 render | 16.0 |
| round 2 render | 15.6 |
| phone and runners | 41.2 |

The rock-wall pass is not in that table. Its measured times, from `summary-discarded.json`, are: before render 24.3, SAM2 8.7, depth lift 2.9, round 1 31.4, round 2 30.4, phone and runners 71.7. This pass reused the before frame, the masks, and the depth.

## Why this is FAIL

Placed-kind IoU is 0.351. The block is 0.75. Eleven placed pairs are in the wrong depth order. Wreck and arch have no mesh, so they are TODO markers and are not in the scene. Phone draw calls are 23 against the standing cap of 12. That cap was already exceeded on the before phone frame (23). The kept layout does not add draws. Corridor is clear and tower footprints do not overlap. Two honest rounds are done. Stop.

## Sky

```
{
 "sun": {
  "azimuthDeg": 112.7,
  "elevationDeg": 7.76,
  "pixel": [
   883.0,
   286.5
  ]
 },
 "planet": {
  "azimuthDeg": 292.7,
  "elevationDeg": 22.0,
  "radiusDeg": 13,
  "inKeyFrame": false
 },
 "note": "Sun direction is the ray through the key sun. Planet heading is opposite that ray so the gas giant leaves the key frame. Existing atlas and planet still only."
}
```

## Silhouette IoU

### before

Weighted 0.2413 · placed kinds 0.2944 · union 0.3052
Frame luma 91.45 · sky in the top 45% 0.8002

| Object | Kind | IoU |
| --- | --- | --- |
| rail | rail | 0.1411 |
| wreck | wreck | 0.2033 |
| mesa-right | mesa | 0.3397 |
| spire | spire | 0.1086 |
| mesa-left | mesa | 0.6599 |
| tower-l3 | tower | 0.0314 |
| slab-l | slab | 0.1328 |
| tower-l1 | tower | 0.3435 |
| tower-r2 | tower | 0.4736 |
| slab-r | slab | 0.0907 |
| tower-l2 | tower | 0.0701 |
| tower-r1 | tower | 0.1954 |
| arch | arch | 0.466 |
| tower-mid | tower | 0.1927 |
| tower-l4 | tower | 0.0089 |

### round1

Weighted 0.2696 · placed kinds 0.3455 · union 0.3354
Frame luma 89.65 · sky in the top 45% 0.7676

| Object | Kind | IoU |
| --- | --- | --- |
| rail | rail | 0.1446 |
| wreck | wreck | 0.2177 |
| mesa-right | mesa | 0.3883 |
| spire | spire | 0.0535 |
| mesa-left | mesa | 0.66 |
| tower-l3 | tower | 0.1952 |
| slab-l | slab | 0.1211 |
| tower-l1 | tower | 0.333 |
| tower-r2 | tower | 0.5428 |
| slab-r | slab | 0.114 |
| tower-l2 | tower | 0.2795 |
| tower-r1 | tower | 0.1997 |
| arch | arch | 0.3903 |
| tower-mid | tower | 0.1938 |
| tower-l4 | tower | 0.1566 |

### round2

Weighted 0.3114 · placed kinds 0.351 · union 0.3943
Frame luma 87.1 · sky in the top 45% 0.7733

| Object | Kind | IoU |
| --- | --- | --- |
| rail | rail | 0.2667 |
| wreck | wreck | 0.2103 |
| mesa-right | mesa | 0.3902 |
| spire | spire | 0.1275 |
| mesa-left | mesa | 0.6515 |
| tower-l3 | tower | 0.206 |
| slab-l | slab | 0.4156 |
| tower-l1 | tower | 0.336 |
| tower-r2 | tower | 0.5284 |
| slab-r | slab | 0.1139 |
| tower-l2 | tower | 0.2637 |
| tower-r1 | tower | 0.1997 |
| arch | arch | 0.3278 |
| tower-mid | tower | 0.1696 |
| tower-l4 | tower | 0.1881 |

## Layout checks (runner geometry)

```
{
 "key": {
  "corridorBlocked": [],
  "overlaps": [],
  "n": 13
 },
 "depthInversions": [
  {
   "nearerInKey": "mesa-left",
   "butFartherThan": "mesa-right",
   "depth": [
    311.7,
    132.1
   ]
  },
  {
   "nearerInKey": "tower-l2",
   "butFartherThan": "mesa-right",
   "depth": [
    217.6,
    132.1
   ]
  },
  {
   "nearerInKey": "tower-l4",
   "butFartherThan": "mesa-right",
   "depth": [
    296.3,
    132.1
   ]
  },
  {
   "nearerInKey": "mesa-left",
   "butFartherThan": "tower-l1",
   "depth": [
    311.7,
    126.7
   ]
  },
  {
   "nearerInKey": "mesa-left",
   "butFartherThan": "tower-r2",
   "depth": [
    311.7,
    188.0
   ]
  },
  {
   "nearerInKey": "mesa-left",
   "butFartherThan": "tower-r1",
   "depth": [
    311.7,
    256.7
   ]
  },
  {
   "nearerInKey": "tower-l2",
   "butFartherThan": "tower-l1",
   "depth": [
    217.6,
    126.7
   ]
  },
  {
   "nearerInKey": "tower-l4",
   "butFartherThan": "tower-l1",
   "depth": [
    296.3,
    126.7
   ]
  },
  {
   "nearerInKey": "tower-l2",
   "butFartherThan": "tower-r2",
   "depth": [
    217.6,
    188.0
   ]
  },
  {
   "nearerInKey": "tower-l4",
   "butFartherThan": "tower-r2",
   "depth": [
    296.3,
    188.0
   ]
  },
  {
   "nearerInKey": "tower-l4",
   "butFartherThan": "tower-r1",
   "depth": [
    296.3,
    256.7
   ]
  }
 ],
 "missing": [
  "todo-wreck",
  "todo-arch"
 ],
 "runners": {
  "street": {
   "pose": {
    "x": -7.45,
    "z": 3.44,
    "yaw": 81
   },
   "shot": "/workspace/grokcli/wt/placement-key-1011/steps/placement-key-1011/runner-street.png"
  },
  "chase": {
   "pose": {
    "x": -35.31,
    "z": 45.51,
    "yaw": 30
   },
   "shot": "/workspace/grokcli/wt/placement-key-1011/steps/placement-key-1011/runner-chase.png"
  },
  "runner": {
   "pose": {
    "x": -19.3,
    "z": 5.4,
    "yaw": 78
   },
   "shot": "/workspace/grokcli/wt/placement-key-1011/steps/placement-key-1011/runner-runner.png"
  },
  "geometry": {
   "corridorBlocked": [],
   "overlaps": [],
   "n": 13
  }
 }
}
```

## Phone budget

```
{
 "before16x9": {
  "drawCalls": 29,
  "triangles": 732443
 },
 "beforePhone": {
  "drawCalls": 23,
  "triangles": 309627,
  "size": [
   540,
   1200
  ]
 },
 "afterPhone": {
  "drawCalls": 23,
  "triangles": 313549,
  "size": [
   540,
   1200
  ]
 },
 "cap": {
  "drawCalls": 12,
  "note": "standing phone cap. Flag when the kept phone frame is over the cap or over the before phone frame."
 },
 "overCap": true,
 "overBefore": false
}
```

## Rounds

Decision score is the weighted IoU of tower, spire, and mesa only. Before placed 0.2944 (all objects 0.2413). Round 1 placed 0.3455 reject=None. Round 2 placed 0.351 reject=None. Kept round2. Depth inversions 11. Missing ['todo-wreck', 'todo-arch']. Discarded rock-wall measurement (camera inside a mesa; the IoU proxy counted rock as structure): before 0.2413, round 1 0.4923, round 2 0.4923. Those two renders are not the keep.

## Staging

http://127.0.0.1:8997/index-placement.html?hud=0&lockq=1&dyn=0&x=-51.115&z=9.63&yaw=78&pitch=4.84&eye=4.0&fov=90&w=540&h=1200&t=1791709090

Live preview files were not edited. No Imagine image was generated.
