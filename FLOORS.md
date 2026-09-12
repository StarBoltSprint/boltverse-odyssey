# FLOORS — do not cook the hard thing until the easy thing is a product

**Law 1.** Next to Law 0 (how to call Imagine). This is **what** to cook.

"Stand in a hall" = 3 stills + 5 films + taps.  
"Open Hall'" = 2nd pack + veil + curtain + anti-clone.  
Mixing both in the same button is why the keeper wall went up.

Grok does **not** "improve" by jumping to floor 3. That recooks `first=atA last=Hall' spawn` and clones the dog.

## The 4 floors

### Floor 0 — Stock

The golden pack. Everyone. No cook.  
`/` on the player. One room. Tap left / right = walk. Same door again = **stay**.  
Nobody asked for a hall. The site still works.

### Floor 1 — One style (default cook)

"Citadel moss." One id from [CATALOG.md](CATALOG.md).  
Same graph as stock. Same Bolt, same camera. Only the **materials** change. Not a novel.  
Still **one** room. Still **no** Enter.  
Out = `/r/moss`. Second tap = stay.

This is `node scripts/cook-room.mjs <slot>` (`cookRoom(style)`). Dry-run first. Live needs `XAI_API_KEY`. Never chat Imagine:

- 3 stills (spawn, atA, atB)
- 5 films: breath-spawn, breath-A, breath-B, walk-spawn-A, walk-spawn-B
- Smoke A+B+C on those. Hang. URL.

Stop. Do not cook walk-A-B. Do not cook Enter. Do not invent Hall'.

### Floor 2 — Cross the hall

Films `walk-A-B` / `walk-B-A`.  
Only if the player asks, **and** atA **and** atB PASS (else Imagine dollies between two frames).  
Same room. No ticket. No Hall'.  
If the films do not exist: tap the other door from a sill = **stay**. Graph already has these edges `required: false`.

### Floor 3 — Enter

Second tap on **the same** door, and only if:

- the player asked ("door A leads to ember")
- the neighbor is on the **catalog** (moss → ember), not "invent Mars"
- dest pack + enter clip + empty veil PASS
- dest breath posed (freeze if i2v walks)

Then the curtain. Then the 2nd hall.

`/r/citadel` is a floor-3 **demo** already hung. It is not stock. It is not the default cook.

## Opt-in

The player already does:

```
spawn + tap A  → walk
atA   + tap A  → enter IF the link exists, else stay
```

If you **do not cook** Enter, the link does not exist. Second tap is already stay. You do not code an easy mode. You **do not add** the file.

Opt-in = someone says "open Hall' onto ember". Not the default of "citadel moss".

## Who asks what

| Who | Floor | Grok cooks |
|---|---|---|
| Visitor, no phrase | 0 | nothing |
| "salle mousse" | 1 | 3 stills + 5 films |
| "teal to gold without the middle" | 2 | walk-A-B / B-A |
| "teal door leads to ember" | 3 | Enter, after confirm |

## Why the barrier drops

| Without floors | With floors |
|---|---|
| One cook must pass stills + 7 films + enter + veils | One cook passes 3 stills + 5 films = a product |
| Clone Enter kills the whole preview | Room 1 stays playable |
| Maker learns double-rAF on day 1 | Maker learns that at floor 3 |
| Player eats a bad curtain | Player has a hall that breathes |

Floor 1 can crowd. Floor 3 stays rare until Enter joints are boring.

## One sentence

**The product is a room where the dog stands.**  
The door into another room is an option, not the dish of the day.
