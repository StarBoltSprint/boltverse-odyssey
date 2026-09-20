# 20 — Default plate proportions (any biome still)

**Sealed 2026-09-20 (SmiR).** Hang ≠ wipe.

**Default starting frame** for a cold Grok cooking **any** Lane biome empty still / Video A — not Frost-only. Frost aurora KEEP is the **worked example** that hits these numbers; Tide / canyon / ember use the same skeleton + their `{PAINT}`.

Player (or explicit paint) may override. Without override, Grok **starts here**.

## Default skeleton (9:16, chase cam behind Bolt)

| Measure | Default | Notes |
|---|---|---|
| 3-lane road width | **~0.75–0.82** of frame width | Wide chase road — ban ice-hole / tiny ribbon |
| Sky / upper void | **~0.35–0.50** of frame height | Room for weather / aurora / dusk |
| Horizon band | **~0.38** from top (φ hit: \(1 - 1/\varphi\)) | Soft guide, not a hard crop line |
| Road takes frame | **~0.62** lower mass (\(1/\varphi\)) | Readable path |
| Paw plant Y | **~0.80** | Contact on road / luminous path |
| Bolt X | **0.50** | Do **not** φ-offset X |
| withersFrac | prefer lane fit (13d) | On **wide** roads Live ~0.10 can be KEEP — **FAIL** if Grok grows Bolt 2–3× just to hit withersMin 0.22 |

\(\varphi \approx 1.618\). Use as **composition audit**, not religion. Engine laws 13d / 17 / 19 win on conflict.

## What Grok does on a new convo

1. Empty still: 3 wide lanes, vanishing point, ZERO dog, camera lock.
2. Hit the default table above unless player asked a different framing.
3. Video A rush 48fps from that still pair.
4. REUSE 6s Bolt + GPU 17 (plate bounce / contact) — proportions stay on the **plate**, not by baking Bolt bigger.

## Player override

Chat / paint may ask tighter road, lower horizon, more sky, etc. Then hang that as the biome’s KEEP. Catalog still lists hung only.

## FAIL (default cook)

- Ice-hole / Beat-narrow road as silent default
- Growing Bolt to fake withersMin on a wide road (truck)
- Baking Bolt into the plate
- Inventing gallop
- Treating φ-X as mandatory

## Related

[00](00-PRIORITY0-any-biome.md) · [13d](13d-auto-scale.md) · [17](17-live-compositor.md) · [19](19-luminous-path-climb.md) · Frost aurora worked example (KEEP numbers): [20b-frost-aurora-proportions.md](20b-frost-aurora-proportions.md) · paste [COLD_START-any-biome.md](COLD_START-any-biome.md)
