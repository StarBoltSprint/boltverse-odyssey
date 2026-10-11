# Placement from the key — 11 Oct

Verdict: FAIL

Blocking target: weighted silhouette IoU ≥ 0.75, every lifted object at the right depth order. Two rounds, then stop.

## Times (seconds)

| Stage | Seconds |
| --- | --- |
| staging page | 0.0 |
| sam2 masks | 4.7 |
| moge depth | 11.0 |
| depth lift | 0.1 |
| sky apply | 0.0 |
| cheap proxy | 0.0 |
| before render | 36.5 |
| before phone | 21.4 |
| round 1 render | 31.1 |
| round 2 render | 44.7 |
| phone and runners | 69.4 |

## Sky

```
{
 "sun": {
  "azimuthDeg": 113.77,
  "elevationDeg": 6.33,
  "pixel": [
   894.0,
   296.0
  ]
 },
 "planet": {
  "azimuthDeg": 293.77,
  "elevationDeg": 22.0,
  "radiusDeg": 13,
  "inKeyFrame": false
 },
 "note": "Sun direction is the ray through the key sun. Planet heading is opposite that ray so the gas giant leaves the key frame. Existing atlas and planet still only."
}
```

## Silhouette IoU

### before

Weighted 0.2387 · placed kinds 0.2981 · union 0.3017
Frame luma 89.74 · sky in the top 45% 0.8198

| Object | Kind | IoU |
| --- | --- | --- |
| rail | rail | 0.1271 |
| wreck | wreck | 0.2097 |
| mesa-right | mesa | 0.3399 |
| spire | spire | 0.0475 |
| mesa-left | mesa | 0.6685 |
| tower-l3 | tower | 0.0107 |
| slab-l | slab | 0.1174 |
| tower-l1 | tower | 0.341 |
| tower-r2 | tower | 0.466 |
| slab-r | slab | 0.1098 |
| tower-l2 | tower | 0.0703 |
| tower-r1 | tower | 0.0507 |
| arch | arch | 0.3857 |
| tower-mid | tower | 0.1982 |
| tower-l4 | tower | 0.0 |

### round1

Weighted 0.305 · placed kinds 0.3763 · union 0.3712
Frame luma 65.89 · sky in the top 45% 0.3908

| Object | Kind | IoU |
| --- | --- | --- |
| rail | rail | 0.1817 |
| wreck | wreck | 0.2654 |
| mesa-right | mesa | 0.4303 |
| spire | spire | 0.3626 |
| mesa-left | mesa | 0.559 |
| tower-l3 | tower | 0.176 |
| slab-l | slab | 0.1852 |
| tower-l1 | tower | 0.4328 |
| tower-r2 | tower | 0.5114 |
| slab-r | slab | 0.145 |
| tower-l2 | tower | 0.179 |
| tower-r1 | tower | 0.1539 |
| arch | arch | 0.4009 |
| tower-mid | tower | 0.1629 |
| tower-l4 | tower | 0.0162 |

### round2

Weighted 0.3559 · placed kinds 0.4049 · union 0.4329
Rejected: sky collapsed
Frame luma 57.51 · sky in the top 45% 0.3309

| Object | Kind | IoU |
| --- | --- | --- |
| rail | rail | 0.1965 |
| wreck | wreck | 0.363 |
| mesa-right | mesa | 0.3613 |
| spire | spire | 0.3702 |
| mesa-left | mesa | 0.5717 |
| tower-l3 | tower | 0.1855 |
| slab-l | slab | 0.2402 |
| tower-l1 | tower | 0.5703 |
| tower-r2 | tower | 0.6085 |
| slab-r | slab | 0.3011 |
| tower-l2 | tower | 0.1455 |
| tower-r1 | tower | 0.1539 |
| arch | arch | 0.3926 |
| tower-mid | tower | 0.2697 |
| tower-l4 | tower | 0.0004 |

## Layout checks (runner geometry)

```
{
 "key": {
  "corridorBlocked": [],
  "overlaps": [
   {
    "a": "t0-m2",
    "b": "t6-m4",
    "dist": 7.71,
    "need": 11.58
   },
   {
    "a": "t6-m4",
    "b": "t10-m4",
    "dist": 10.32,
    "need": 11.02
   }
  ],
  "n": 13
 },
 "depthInversions": [
  {
   "nearerInKey": "mesa-right",
   "butFartherThan": "tower-l4",
   "depth": [
    90.1,
    47.7
   ]
  },
  {
   "nearerInKey": "spire",
   "butFartherThan": "tower-l1",
   "depth": [
    55.0,
    29.1
   ]
  },
  {
   "nearerInKey": "spire",
   "butFartherThan": "tower-r2",
   "depth": [
    55.0,
    18.0
   ]
  },
  {
   "nearerInKey": "spire",
   "butFartherThan": "tower-l2",
   "depth": [
    55.0,
    36.6
   ]
  },
  {
   "nearerInKey": "mesa-left",
   "butFartherThan": "tower-l1",
   "depth": [
    89.9,
    29.1
   ]
  },
  {
   "nearerInKey": "mesa-left",
   "butFartherThan": "tower-r2",
   "depth": [
    89.9,
    18.0
   ]
  },
  {
   "nearerInKey": "mesa-left",
   "butFartherThan": "tower-r1",
   "depth": [
    89.9,
    61.9
   ]
  },
  {
   "nearerInKey": "mesa-left",
   "butFartherThan": "tower-l4",
   "depth": [
    89.9,
    47.7
   ]
  },
  {
   "nearerInKey": "tower-l2",
   "butFartherThan": "tower-r2",
   "depth": [
    36.6,
    18.0
   ]
  },
  {
   "nearerInKey": "tower-r1",
   "butFartherThan": "tower-l4",
   "depth": [
    61.9,
    47.7
   ]
  },
  {
   "nearerInKey": "tower-mid",
   "butFartherThan": "tower-l4",
   "depth": [
    142.6,
    47.7
   ]
  }
 ],
 "missing": [
  "todo-wreck",
  "todo-arch"
 ],
 "unexpectedMissing": [],
 "runners": {
  "street": {
   "pose": {
    "x": -7.45,
    "z": 3.44,
    "yaw": 81
   },
   "shot": "/workspace/grokcli/wt/placement-key-1011/steps/placement-key2-1011/runner-street.png"
  },
  "chase": {
   "pose": {
    "x": -35.31,
    "z": 45.51,
    "yaw": 30
   },
   "shot": "/workspace/grokcli/wt/placement-key-1011/steps/placement-key2-1011/runner-chase.png"
  },
  "runner": {
   "pose": {
    "x": -19.3,
    "z": 5.4,
    "yaw": 78
   },
   "shot": "/workspace/grokcli/wt/placement-key-1011/steps/placement-key2-1011/runner-runner.png"
  },
  "geometry": {
   "corridorBlocked": [],
   "overlaps": [
    {
     "a": "t0-m2",
     "b": "t6-m4",
     "dist": 7.71,
     "need": 11.58
    },
    {
     "a": "t6-m4",
     "b": "t10-m4",
     "dist": 10.32,
     "need": 11.02
    }
   ],
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
  "triangles": 732443,
  "detail": {
   "info": 29,
   "main": 29,
   "source": "passes.main",
   "visible": {
    "Mesh": 12,
    "sky1-ring": 1,
    "sky1-sprites": 1,
    "sky1-godrays": 1,
    "sand-drifts": 1,
    "air-sand-veils": 1,
    "avenue-slabs": 1,
    "mag-rail": 1,
    "spire-lod1": 1,
    "spire-emit-lod1": 1,
    "spire-beam": 1,
    "inst-m2-lod0-AB": 1,
    "inst-m3-lod0-AB": 1,
    "inst-m4-lod0-AB": 1,
    "inst-m6-lod0-AB": 1,
    "mesa-L-mid-lod0": 1,
    "mesa-L-mid2-lod0": 1,
    "mesa-L-mid2-lod1": 1,
    "mesa-L-far-lod1": 1,
    "mesa-R-butte-lod1": 1,
    "mesa-R-mid-lod0": 1,
    "mesa-R-band-lod1": 1,
    "mesa-B-left-lod0": 1,
    "mesa-B-left-lod1": 1,
    "mesa-B-right-lod1": 1,
    "mesa-B-far-lod1": 1,
    "mesa-drifts": 1
   }
  }
 },
 "beforePhone": {
  "drawCalls": 23,
  "triangles": 309627,
  "size": [
   540,
   1200
  ],
  "detail": {
   "info": 23,
   "main": 23,
   "source": "passes.main",
   "visible": {
    "Mesh": 12,
    "sky1-ring": 1,
    "sky1-sprites": 1,
    "sky1-godrays": 1,
    "sand-drifts": 1,
    "air-sand-veils": 1,
    "avenue-slabs": 1,
    "mag-rail": 1,
    "spire-lod1": 1,
    "spire-emit-lod1": 1,
    "spire-beam": 1,
    "inst-m2-lod0-AB": 1,
    "inst-m3-lod0-AB": 1,
    "inst-m4-lod0-AB": 1,
    "inst-m6-lod0-AB": 1,
    "mesa-L-mid-lod0": 1,
    "mesa-L-mid2-lod0": 1,
    "mesa-L-mid2-lod1": 1,
    "mesa-L-far-lod1": 1,
    "mesa-R-butte-lod1": 1,
    "mesa-R-mid-lod0": 1,
    "mesa-R-band-lod1": 1,
    "mesa-B-left-lod0": 1,
    "mesa-B-left-lod1": 1,
    "mesa-B-right-lod1": 1,
    "mesa-B-far-lod1": 1,
    "mesa-drifts": 1
   }
  }
 },
 "afterPhone": {
  "drawCalls": 24,
  "triangles": 673622,
  "size": [
   540,
   1200
  ],
  "detail": {
   "info": 24,
   "main": 24,
   "source": "passes.main",
   "visible": {
    "Mesh": 12,
    "sky1-ring": 1,
    "sky1-sprites": 1,
    "sky1-godrays": 1,
    "sand-drifts": 1,
    "air-sand-veils": 1,
    "avenue-slabs": 1,
    "mag-rail": 1,
    "spire-lod0": 1,
    "spire-emit-lod0": 1,
    "spire-beam": 1,
    "inst-m2-lod0-AB": 1,
    "inst-m3-lod0-AB": 1,
    "inst-m4-lod0-AB": 1,
    "inst-m6-lod0-AB": 1,
    "mesa-L-mid-lod0": 1,
    "mesa-L-mid2-lod0": 1,
    "mesa-L-mid2-lod1": 1,
    "mesa-L-far-lod0": 1,
    "mesa-L-far-lod1": 1,
    "mesa-R-butte-lod1": 1,
    "mesa-R-mid-lod1": 1,
    "mesa-R-band-lod1": 1,
    "mesa-B-left-lod1": 1,
    "mesa-B-right-lod1": 1,
    "mesa-B-far-lod0": 1,
    "mesa-drifts": 1
   }
  }
 },
 "cap": {
  "drawCalls": 12,
  "note": "Phone cap uses passes.main.calls when the page exposes it. The info.calls field is recorded beside it. Toward 12 is the goal; overCap is a flag, not the IoU verdict."
 },
 "overCap": true,
 "overBefore": true
}
```

## Stage clock

The 0.87 silhouette number is the object-cook gate. This step records a projected-seat proxy before the browser shots. The blocking number stays the framebuffer placed IoU ≥ 0.75.

```
{
 "cheapOk": true,
 "heavyRan": 4,
 "stages": [
  {
   "stage": "silhouette",
   "kind": "cheap",
   "seconds": 0.0017,
   "ok": true,
   "detail": "iou 0.3075 min 0.0"
  },
  {
   "stage": "colour",
   "kind": "cheap",
   "seconds": 0.0003,
   "ok": true,
   "detail": "mean abs 0.1404 max 1.0"
  },
  {
   "stage": "before renders",
   "kind": "heavy",
   "seconds": 57.9508,
   "ok": true,
   "detail": "ran"
  },
  {
   "stage": "round 1",
   "kind": "heavy",
   "seconds": 31.1157,
   "ok": true,
   "detail": "ran"
  },
  {
   "stage": "round 2",
   "kind": "heavy",
   "seconds": 44.6913,
   "ok": true,
   "detail": "ran"
  },
  {
   "stage": "phone and runners",
   "kind": "heavy",
   "seconds": 69.4389,
   "ok": true,
   "detail": "ran"
  }
 ]
}
```

## Capture gate

```
{
 "ready": {
  "ok": true,
  "kind": "frame",
  "cover": 0.9989,
  "minCover": null,
  "loading": false,
  "empty": false,
  "black": false,
  "why": ""
 },
 "loading": {
  "ok": false,
  "kind": "frame",
  "cover": 1.0,
  "minCover": null,
  "loading": true,
  "empty": false,
  "black": false,
  "why": "loading screen"
 },
 "loadingText": "Chargement\u2026 20/20",
 "readyPhone": {
  "ok": true,
  "kind": "frame",
  "cover": 0.9971,
  "minCover": null,
  "loading": false,
  "empty": false,
  "black": false,
  "why": ""
 }
}
```

## Rounds

Decision score is the weighted IoU of tower, spire, and mesa only. Before placed 0.2981 (all objects 0.2387). Round 1 placed 0.3763 reject=None. Round 2 placed 0.4049 reject=sky collapsed. Kept round1. Depth inversions 11. TODO (wreck/arch do not block) ['todo-wreck', 'todo-arch']. Unexpected [].

## Staging

http://127.0.0.1:8997/index-placement.html?hud=0&lockq=1&dyn=0&x=-51.115&z=9.63&yaw=78&pitch=4.84&eye=4.0&fov=90&w=540&h=1200&t=1791714310

Live preview files were not edited. No Imagine image was generated.

## Visual compare

`sheet-16x9.jpg` and `sheet-phone.jpg` put the kept frame beside `key-city3.jpg`.

The key is two rows of thin black blades along a sand avenue, the sun low and centre-right, the ringed spire just in front of that sun, and mesas framing the left and right. A wreck and a rail sit in the near sand.

The kept frame is round 1. Chunky grey towers bunch on the left. One pale stair tower and the ringed spire sit near the centre. A rock face fills the right half and covers the sunset side. There is no right-hand blade row. The phone sheet is the same cluster in a tall frame, with the key letterboxed beside it.

Round 2 reached placed IoU 0.4049 and was rejected: sky in the top 45% fell from 0.8198 to 0.3309. The keep is round 1 at 0.3763 (before 0.2981). The bar is 0.75. Eleven depth pairs are still inverted: the mesa and spire floors sit farther than towers the key paints nearer. Two tower footprints overlap. Phone `passes.main.calls` is 24, against 23 before and a cap of 12. Towers are already one instanced batch per module. The extra calls are the per-mesa meshes, which stayed in the frame. Wreck and arch stay TODO and did not block the verdict.

The loading shot `before-16x9-loading.png` (text `Chargement… 20/20`) fails the capture gate. The ready 16:9 and phone frames pass.

Stop. Two renders, then no third placement pass.

