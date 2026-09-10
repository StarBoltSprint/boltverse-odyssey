# HOLD — last still never dies

The **picture never dies**. A black / empty 9:16 mid-hall is illegal.

Player DOM already keeps a still under the videos ([ENGINE.md](ENGINE.md)). This file is the **ship gate**: numbers + FAIL reasons.

## Law

On `ended` / decode gap / plate swap:

1. Show **`stillEnd` immediately** (same frame)
2. Next breath / decay is **under** or already `canplay`
3. Transition = **cut 0s** or dissolve **≤ 0.28s** (`DISSOLVE_MS = 280`)
4. **NEVER** clear video → empty
5. **NEVER** `opacity: 0` with no still underneath
6. Missing next = **decay stock** or **freeze last frame** — not a hole

## Why

- Picture = clock → black = no glow, no grade, tap in the dark
- Identity drop → next frame = teleport / loader (banned)
- Encode that fades to black = **Smoke FAIL** (`encode.fade_black`)
- Player that drops the picture = **engine FAIL** (`engine.black_hole`)

## Ops

- Preload dest breath **before** the walk ends
- `stillEnd === stillStart` of next → cut 0s
- Same pose/biome, different stills → dissolve max 0.28s
- Enter / decay / first clip → dissolve or hold ~80ms OK
- Smoke FAIL / missing → decay, **no spinner**

## Anti

- `video.src = ""` then wait
- opacity 0 “while it loads”
- encode fade-to-black at clip end
- freeze breath “play once then still” **without** a visible still layer (breath **loops** until the next act)

## Smoke

| rule | if |
|---|---|
| `encode.fade_black` | last ~400ms of the clip go black / empty |
| `engine.black_hole` | player showed empty 9:16 (no still under) |
| `graph.ended_no_still` | `ended` without `stillEnd` on screen same frame |

Layer C: last frame of walks/breaths must still show hall + dog. Black last frame = FAIL, recook that plate.

## One line

At `ended`, `stillEnd` is already the picture — never an empty frame.
