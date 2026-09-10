# TICKET — keeper gift (not play)

Play is free. Stock, walks, breath: **0**.  
This file is **one welcome plate** so a new player can taste the forge. It is not the hall.

Auth stays **off** on the 9:16. The id exists only here.

## Who pays

Keeper (you). Your Imagine key lives **on the server**. The player never sees SuperGrok.  
xAI does not slice a weekly SuperGrok %. You pick a number:

`weeklyCookCap` ≈ 20 % of *your* week (edit `src/game/ticket.ts`).

## Cadence

**1 still / day / X account.** Not 3 stills (that is a hall). Come back tomorrow. Week cap = keeper 20%.

## Who may claim

- **X account** (Grok / X Premium preferred). Not Google. Not 50 free throwaway Xs if you can help it.
- SuperGrok **paid** / X Premium = the anti-cheat. Free X farms drain the pool.
- Grok, in chat, can see SuperGrok. The web ledger cannot. Honor SuperGrok **when cooking**. Web = 1 / `userId` + weekly cap.
- **1 plate / player / UTC day**. Weekly cap still holds.

## What the gift is

**One still-spawn** in a catalog paint. Not a whole floor-1 hall (~8 cooks).

Same paint + same lock already hung → **0** (serve the pack). Do not spend.

Walk / breath / A↔B / already-hung enter → **0**.

## Flow

```
play  = anonymous hall (stock)
gift  = /gift  →  Continue with X
        →  pick moss|ember|dusk|…
        →  quota[player] == 0 and week < cap ?
             yes → ticket armed, cook 1 spawn still with keeper key
             no  → stay on stock, “already used” / “week is full”
```

Hall **never** shows Forge, %, generating. Cook off-plate. PASS → Hang pack, give `/r/<paint>` if that still is enough to see, else they still play stock and the still is a postcard.

FAIL → no URL, stay. [FAIL.md](FAIL.md) [SAS.md](SAS.md)

## Caps (keeper)

| knob | default |
|---|---|
| gift / player / day | **1** still-spawn |
| weekly cooks | **40** (your 20 %) |
| plate | still-spawn only |
| provider | **X** |

Ban / allowlist = keeper. Spam tickets → drop that `user_id`.

## Not this

- Login to **tap**
- Key in the client / shared Grok session
- “generating…” on Bolt
- 3 stills + 5 films as the welcome gift

## One line

Play is a folder. The gift is one still, one X, one time, on the keeper’s week — never on the plate.
